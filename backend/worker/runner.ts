import Docker from "dockerode";
import { CodingLanguage, ITestCase, IExecutionResult } from "../types";
import stream from "stream";

// Connect to local docker socket (named pipe on Windows, /var/run/docker.sock on Linux)
const isWindows = process.platform === "win32";
const docker = new Docker(
  isWindows
    ? { socketPath: "//./pipe/docker_cli" }
    : { socketPath: "/var/run/docker.sock" }
);

export interface RunOptions {
  language: CodingLanguage;
  code: string;
  testCases: ITestCase[];
  timeLimitMs?: number;
  memoryLimitKb?: number;
}

const LANGUAGE_CONFIGS: Record<
  CodingLanguage,
  {
    image: string;
    filename: string;
    cmd: (filename: string) => string[];
    compileCmd?: (filename: string) => string[];
  }
> = {
  javascript: {
    image: "sandbox-node:20",
    filename: "solution.js",
    cmd: () => ["node", "/tmp/solution.js"],
  },
  python: {
    image: "sandbox-python:3.11",
    filename: "solution.py",
    cmd: () => ["python3", "/tmp/solution.py"],
  },
  cpp: {
    image: "sandbox-cpp:gcc13",
    filename: "solution.cpp",
    cmd: () => ["/tmp/solution"],
    compileCmd: () => ["g++", "-O2", "/tmp/solution.cpp", "-o", "/tmp/solution"],
  },
  java: {
    image: "sandbox-java:21",
    filename: "Solution.java",
    cmd: () => ["java", "-cp", "/tmp", "Solution"],
    compileCmd: () => ["javac", "-d", "/tmp", "/tmp/Solution.java"],
  },
};

/**
 * Creates a tar archive stream in memory containing the code file
 */
function createTarStream(filename: string, content: string): stream.Readable {
  const contentBuffer = Buffer.from(content, "utf8");
  const header = Buffer.alloc(512);

  // Write tar header
  header.write(filename, 0); // File name
  header.write("0000644\0", 100); // File mode
  header.write("0001750\0", 108); // Owner UID
  header.write("0001750\0", 116); // Group GID
  const sizeOctal = contentBuffer.length.toString(8).padStart(11, "0") + "\0";
  header.write(sizeOctal, 124); // File size
  const mtimeOctal = Math.floor(Date.now() / 1000).toString(8).padStart(11, "0") + "\0";
  header.write(mtimeOctal, 136); // Mod time
  header.write("0", 156); // Type flag: regular file

  // Compute checksum
  header.write("        ", 148); // Blank checksum field
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  const checksumOctal = checksum.toString(8).padStart(6, "0") + "\0 ";
  header.write(checksumOctal, 148);

  // Tar blocks must be padded to 512 bytes
  const padSize = (512 - (contentBuffer.length % 512)) % 512;
  const padding = Buffer.alloc(padSize);
  const endBlock = Buffer.alloc(1024); // Two 512-byte zero blocks marking archive end

  const s = new stream.PassThrough();
  s.end(Buffer.concat([header, contentBuffer, padding, endBlock]));
  return s;
}

/**
 * Executes a single test case inside a hardened Docker container
 */
async function executeSingleTestCase(
  config: (typeof LANGUAGE_CONFIGS)[CodingLanguage],
  code: string,
  testCase: ITestCase,
  index: number,
  timeLimitMs: number
): Promise<IExecutionResult> {
  const startTime = Date.now();
  let container: Docker.Container | null = null;
  let forceKillTimer: NodeJS.Timeout | null = null;

  try {
    // 1. Create Hardened Ephemeral Container
    container = await docker.createContainer({
      Image: config.image,
      Cmd: config.cmd(config.filename),
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      OpenStdin: true,
      StdinOnce: true,
      Tty: false,
      HostConfig: {
        NetworkMode: "none", // NO network access
        Memory: 256 * 1024 * 1024, // 256 MB RAM limit
        MemorySwap: 256 * 1024 * 1024, // No swap trickery
        NanoCpus: 500000000, // 0.5 CPU
        PidsLimit: 64, // Fork-bomb defense
        ReadonlyRootfs: true, // Read-only root filesystem
        CapDrop: ["ALL"], // Drop all Linux capabilities
        SecurityOpt: ["no-new-privileges"],
        Tmpfs: {
          "/tmp": "rw,noexec,nosuid,size=64m", // Scratch tmpfs space only
        },
      },
      WorkingDir: "/tmp",
    });

    // 2. Inject Code as Tar into /tmp (read-only for execution)
    const tarStream = createTarStream(config.filename, code);
    await container.putArchive(tarStream, { path: "/tmp" });

    // 3. Attach Stdin/Stdout/Stderr stream
    const containerStream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";

    // Docker multiplexes stdout and stderr into headers: [STREAM_TYPE, 0, 0, 0, SIZE1, SIZE2, SIZE3, SIZE4]
    containerStream.on("data", (chunk: Buffer) => {
      let offset = 0;
      while (offset < chunk.length) {
        if (offset + 8 > chunk.length) {
          stdoutBuffer += chunk.slice(offset).toString("utf8");
          break;
        }
        const streamType = chunk[offset]; // 1 for stdout, 2 for stderr
        const payloadSize = chunk.readUInt32BE(offset + 4);
        offset += 8;

        const payload = chunk.slice(offset, offset + payloadSize).toString("utf8");
        if (streamType === 2) {
          stderrBuffer += payload;
        } else {
          stdoutBuffer += payload;
        }
        offset += payloadSize;
      }
    });

    // 4. Start Container
    await container.start();

    // 5. Send Stdin (Test case input)
    if (testCase.input) {
      containerStream.write(testCase.input + "\n");
    }
    containerStream.end();

    // 6. Supervising Hard Wall-Clock Timeout
    const timeoutPromise = new Promise<{ StatusCode: number }>((resolve) => {
      forceKillTimer = setTimeout(async () => {
        try {
          if (container) {
            await container.kill();
          }
        } catch {
          // Ignored if already terminated
        }
        resolve({ StatusCode: 124 }); // 124 standard timeout exit code
      }, timeLimitMs + 1000);
    });

    // 7. Wait for completion or timeout
    const exitStatus = await Promise.race([container.wait(), timeoutPromise]);

    if (forceKillTimer) clearTimeout(forceKillTimer);

    const executionTimeMs = Date.now() - startTime;
    const isTimeout = exitStatus.StatusCode === 124 || executionTimeMs > timeLimitMs;

    const trimmedActual = stdoutBuffer.trim();
    const trimmedExpected = testCase.expectedOutput.trim();
    const passed = !isTimeout && exitStatus.StatusCode === 0 && trimmedActual === trimmedExpected;

    return {
      testCaseIndex: index,
      passed,
      actualOutput: isTimeout ? "Time Limit Exceeded (TLE)" : trimmedActual,
      stderr: isTimeout ? "Process terminated: Wall-clock limit exceeded" : stderrBuffer.trim(),
      executionTimeMs,
    };
  } catch (err: any) {
    return {
      testCaseIndex: index,
      passed: false,
      actualOutput: "",
      stderr: `Execution error: ${err.message}`,
      executionTimeMs: Date.now() - startTime,
    };
  } finally {
    if (forceKillTimer) clearTimeout(forceKillTimer);
    if (container) {
      try {
        await container.remove({ force: true });
      } catch {
        // Container cleanup
      }
    }
  }
}

/**
 * Main sandbox execution runner
 */
export async function runCodeAgainstTestCases(
  options: RunOptions
): Promise<{ executionResults: IExecutionResult[]; score: number }> {
  const { language, code, testCases, timeLimitMs = 2000 } = options;
  const config = LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS.javascript;

  const executionResults: IExecutionResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const res = await executeSingleTestCase(config, code, testCases[i], i, timeLimitMs);
    executionResults.push(res);
  }

  const passedCount = executionResults.filter((r) => r.passed).length;
  const score = testCases.length > 0 ? passedCount / testCases.length : 0;

  return { executionResults, score };
}
