import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import type { ITestCase } from "@nextgen/shared-types";

export interface TestCaseResult {
  testCaseIndex: number;
  passed: boolean;
  status: "passed" | "failed" | "timeout" | "compilation_error" | "runtime_error";
  runtimeMs: number;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  stdout: string;
  stderr: string;
  isHidden?: boolean;
}

export interface ExecutionSummary {
  success: boolean;
  score: number; // 0.0 to 1.0
  passedCount: number;
  totalCount: number;
  compilationError?: string;
  results: TestCaseResult[];
}

interface LanguageSpec {
  filename: string;
  compileCmd?: string;
  compileArgs?: (filename: string, binName: string) => string[];
  runCmd: string;
  runArgs: (filenameOrBin: string) => string[];
}

const LANGUAGES: Record<string, LanguageSpec> = {
  javascript: {
    filename: "solution.js",
    runCmd: "node",
    runArgs: (filename) => [filename],
  },
  python: {
    filename: "solution.py",
    runCmd: "python",
    runArgs: (filename) => [filename],
  },
  cpp: {
    filename: "solution.cpp",
    compileCmd: "g++",
    compileArgs: (filename, binName) => ["-O2", filename, "-o", binName],
    runCmd: "", // replaced by compiled binary path
    runArgs: () => [],
  },
  java: {
    filename: "Solution.java",
    compileCmd: "javac",
    compileArgs: (filename) => [filename],
    runCmd: "java",
    runArgs: () => ["-cp", ".", "Solution"],
  },
};

/**
 * Normalizes output strings for fair comparison:
 * Standardizes line endings (\r\n -> \n) and trims trailing whitespaces/lines.
 */
function normalizeOutput(str: string): string {
  return (str || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/**
 * Executes a child process with a timeout and pipes stdin.
 */
function runProcess(
  command: string,
  args: string[],
  cwd: string,
  input: string,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; timedOut: boolean; exitCode: number | null; runtimeMs: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let killed = false;

    const proc = spawn(command, args, {
      cwd,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      killed = true;
      try {
        proc.kill("SIGKILL");
      } catch {}
    }, timeoutMs);

    if (input) {
      proc.stdin.write(input);
      if (!input.endsWith("\n")) {
        proc.stdin.write("\n");
      }
    }
    proc.stdin.end();

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      const runtimeMs = Date.now() - startTime;
      resolve({
        stdout,
        stderr,
        timedOut,
        exitCode: code,
        runtimeMs,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      const runtimeMs = Date.now() - startTime;
      resolve({
        stdout,
        stderr: stderr + "\n" + err.message,
        timedOut: false,
        exitCode: 1,
        runtimeMs,
      });
    });
  });
}

/**
 * Compiles and runs user code against a set of test cases in an isolated temporary directory.
 */
export async function executeCode(
  language: string,
  code: string,
  testCases: ITestCase[],
  timeLimitMs: number = 2000
): Promise<ExecutionSummary> {
  const langKey = (language || "javascript").toLowerCase();
  const spec = LANGUAGES[langKey] || LANGUAGES.javascript;

  // 1. Create a unique scratch directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextgen-sandbox-"));
  const sourcePath = path.join(tempDir, spec.filename);
  const binaryName = "solution_bin";
  const binaryPath = path.join(tempDir, binaryName);

  try {
    // 2. Write the source code
    await fs.writeFile(sourcePath, code, "utf8");

    // 3. Optional compilation step (C++, Java)
    if (spec.compileCmd && spec.compileArgs) {
      const compileArgs = spec.compileArgs(spec.filename, binaryName);
      const compileResult = await runProcess(
        spec.compileCmd,
        compileArgs,
        tempDir,
        "",
        10000 // 10s compile timeout
      );

      if (compileResult.exitCode !== 0 || compileResult.timedOut) {
        return {
          success: false,
          score: 0,
          passedCount: 0,
          totalCount: testCases.length,
          compilationError: compileResult.stderr || "Compilation failed",
          results: testCases.map((tc, idx) => ({
            testCaseIndex: idx,
            passed: false,
            status: "compilation_error",
            runtimeMs: 0,
            input: tc.isHidden ? undefined : tc.input,
            expectedOutput: tc.isHidden ? undefined : tc.expectedOutput,
            stdout: "",
            stderr: compileResult.stderr || "Compilation failed",
            isHidden: tc.isHidden,
          })),
        };
      }
    }

    // Determine command to run
    let runCommand = spec.runCmd;
    let runArgs = spec.runArgs(spec.filename);
    if (langKey === "cpp") {
      runCommand = process.platform === "win32" && !binaryPath.endsWith(".exe") ? `${binaryPath}.exe` : binaryPath;
      runArgs = [];
    }

    // 4. Run each test case
    const results: TestCaseResult[] = [];
    let passedCount = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const tcInput = tc.input || "";
      const expectedNormalized = normalizeOutput(tc.expectedOutput || "");

      const runResult = await runProcess(
        runCommand,
        runArgs,
        tempDir,
        tcInput,
        timeLimitMs
      );

      const actualNormalized = normalizeOutput(runResult.stdout);
      let status: TestCaseResult["status"] = "failed";
      let passed = false;

      if (runResult.timedOut) {
        status = "timeout";
      } else if (runResult.exitCode !== 0) {
        status = "runtime_error";
      } else if (actualNormalized === expectedNormalized) {
        status = "passed";
        passed = true;
        passedCount++;
      } else {
        status = "failed";
      }

      results.push({
        testCaseIndex: i,
        passed,
        status,
        runtimeMs: runResult.runtimeMs,
        input: tc.isHidden ? undefined : tc.input,
        expectedOutput: tc.isHidden ? undefined : tc.expectedOutput,
        actualOutput: tc.isHidden ? undefined : actualNormalized,
        stdout: tc.isHidden ? "" : runResult.stdout,
        stderr: runResult.stderr,
        isHidden: tc.isHidden,
      });
    }

    const totalCount = testCases.length;
    const score = totalCount > 0 ? passedCount / totalCount : 1.0;

    return {
      success: passedCount === totalCount,
      score,
      passedCount,
      totalCount,
      results,
    };
  } finally {
    // 5. Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  }
}
