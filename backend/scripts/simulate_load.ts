import "dotenv/config";
import mongoose from "mongoose";
import { io, Socket } from "socket.io-client";
import { connectDB, Test, Question, User, UserTestAccess } from "@nextgen/db";
import { signToken } from "../src/middleware/auth";
import type { OptionKey } from "@nextgen/shared-types";

// Configuration (supports both CLI flags e.g. --bots=500 and ENV vars e.g. BOTS=500)
const args = process.argv.slice(2);
const getArg = (flag: string) => args.find((a) => a.startsWith(`--${flag}=`))?.split("=")[1];

const BOTS_COUNT = parseInt(getArg("bots") || process.env.BOTS || "50", 10);
const DURATION_SECONDS = parseInt(getArg("duration") || process.env.DURATION || "30", 10);
const SOCKET_URL = getArg("url") || process.env.SOCKET_URL || "http://localhost:8000";
const SUBMIT_INTERVAL_MS = parseInt(getArg("interval") || process.env.SUBMIT_INTERVAL || "2000", 10);

interface LatencyRecord {
  timestamp: number;
  durationMs: number;
  success: boolean;
}

async function runLoadSimulation() {
  console.log("\n" + "=".repeat(60));
  console.log("  🚀 NEXTGEN TEST PORTAL — LOAD & CONCURRENCY SIMULATOR");
  console.log("=".repeat(60));
  console.log(`- Target URL:        ${SOCKET_URL}`);
  console.log(`- Virtual Bots:      ${BOTS_COUNT}`);
  console.log(`- Duration:          ${DURATION_SECONDS} seconds`);
  console.log(`- Submit Interval:   ~${SUBMIT_INTERVAL_MS} ms/bot (jittered)`);
  console.log("=".repeat(60) + "\n");

  // 1. Connect to Database & Load Active Test
  console.log("[1/4] Connecting to database to locate assessment...");
  await connectDB();

  const test =
    (await Test.findOne({ status: "live" })) ||
    (await Test.findOne().sort({ createdAt: -1 }));

  if (!test) {
    console.error("❌ No test assessment found in database! Please run 'npm run seed' first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const questions = await Question.find({ testId: test._id });
  if (questions.length === 0) {
    console.error(`❌ Test '${test.title}' has no questions attached!`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`✓ Located Test: "${test.title}" (ID: ${test._id}, Room: ${test.roomId})`);
  console.log(`✓ Total Questions: ${questions.length}`);

  // 2. Provision / Enroll Bot Candidates
  console.log(`\n[2/4] Provisioning ${BOTS_COUNT} virtual candidate accounts...`);
  const testEnd = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const botTokens: { botId: string; token: string; name: string }[] = [];

  for (let i = 1; i <= BOTS_COUNT; i++) {
    const email = `bot_${i}@loadtest.local`;
    const name = `Virtual Bot #${i}`;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        passwordHash: "$2a$10$FakeHashForLoadTestBotOnlyNotUsedForAuthDirectly",
        roomId: test.roomId,
        mustChangePassword: false,
      });
    } else if (user.roomId !== test.roomId) {
      user.roomId = test.roomId;
      await user.save();
    }

    await UserTestAccess.findOneAndUpdate(
      { testId: test._id, userId: user._id },
      {
        $setOnInsert: {
          extraMinutes: 0,
          blocked: false,
          personalEndTime: testEnd,
          status: "in_progress",
          lastSeenQuestionIndex: 0,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: "user",
      roomId: test.roomId,
      name,
    });

    botTokens.push({
      botId: user._id.toString(),
      token,
      name,
    });
  }

  console.log(`✓ All ${BOTS_COUNT} candidate accounts verified and enrolled.`);

  console.log(`\n[3/4] Connecting ${BOTS_COUNT} WebSocket connections to ${SOCKET_URL}...`);
  const sockets: Socket[] = [];
  const latencies: LatencyRecord[] = [];
  let connectedCount = 0;
  let connectionErrors = 0;
  let submissionSuccessCount = 0;
  let submissionErrorCount = 0;
  let isRunning = true;

  const optionsList: OptionKey[] = ["a", "b", "c", "d"];

  // Staggered connection to allow Windows TCP stack to cleanly establish connections
  for (let i = 0; i < botTokens.length; i++) {
    const { token, name } = botTokens[i];

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      timeout: 10000,
    });

    let botLoopStarted = false;

    socket.on("connect", () => {
      connectedCount++;
      socket.emit("user:heartbeat" as any, { testId: test._id.toString() });

      if (!botLoopStarted) {
        botLoopStarted = true;
        runBotLoop();
      }
    });

    socket.on("disconnect", () => {
      connectedCount = Math.max(0, connectedCount - 1);
    });

    socket.on("connect_error", () => {
      connectionErrors++;
    });

    const runBotLoop = async () => {
      while (isRunning) {
        // Jittered interval around SUBMIT_INTERVAL_MS
        const jitter = SUBMIT_INTERVAL_MS * 0.7 + Math.random() * (SUBMIT_INTERVAL_MS * 0.6);
        await new Promise((r) => setTimeout(r, jitter));
        if (!isRunning || !socket.connected) continue;

        const qIdx = Math.floor(Math.random() * questions.length);
        const question = questions[qIdx];
        const selectedOption = optionsList[Math.floor(Math.random() * optionsList.length)];

        socket.emit("user:navigate" as any, {
          testId: test._id.toString(),
          questionIndex: qIdx,
        });

        const start = performance.now();

        if (question.type === "coding") {
          socket.emit("code:snapshot" as any, {
            testId: test._id.toString(),
            questionId: question._id.toString(),
            code: `// Virtual bot ${name} snapshot\nfunction solution() {\n  return ${Math.random()};\n}`,
            language: question.language || "javascript",
          });
        }

        let ackReceived = false;
        const timeoutTimer = setTimeout(() => {
          if (!ackReceived && isRunning) {
            submissionErrorCount++;
          }
        }, 5000);

        socket.emit(
          "answer:submit" as any,
          {
            testId: test._id.toString(),
            questionId: question._id.toString(),
            selectedOption,
            questionIndex: qIdx,
          },
          (resp: any) => {
            if (ackReceived) return;
            ackReceived = true;
            clearTimeout(timeoutTimer);

            const durationMs = performance.now() - start;
            const success = Boolean(resp?.success);

            if (success) {
              submissionSuccessCount++;
            } else {
              submissionErrorCount++;
            }

            latencies.push({
              timestamp: Date.now(),
              durationMs,
              success,
            });
          }
        );
      }
    };

    sockets.push(socket);

    // Stagger in small batches
    if ((i + 1) % 25 === 0) {
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  // 4. Live Metric Reporter
  console.log(`\n[4/4] 🔥 Load Test Running for ${DURATION_SECONDS}s. Press Ctrl+C to stop early.`);
  console.log("Tip: Open Admin Proctoring Dashboard at http://localhost:3001/tests/[testId]/live to watch real-time stream!\n");

  const startTime = Date.now();
  const reporterInterval = setInterval(() => {
    const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const recentLatencies = latencies.slice(-100).map((l) => l.durationMs);
    const avgLatency =
      recentLatencies.length > 0
        ? (recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length).toFixed(1)
        : "0.0";
    const rps = (submissionSuccessCount / elapsedSec).toFixed(1);

    process.stdout.write(
      `\r⏱️  Elapsed: ${elapsedSec}s/${DURATION_SECONDS}s | 👥 Active Sockets: ${connectedCount}/${BOTS_COUNT} | ✉️  ACKs: ${submissionSuccessCount} | ❌ Errors: ${submissionErrorCount} | ⚡ Latency (avg): ${avgLatency}ms | 📊 Throughput: ${rps} req/s   `
    );
  }, 1000);

  // Graceful termination
  const cleanup = async () => {
    if (!isRunning) return;
    isRunning = false;
    clearInterval(reporterInterval);
    process.stdout.write("\n\nStopping load test & disconnecting bots...\n");

    for (const s of sockets) {
      s.disconnect();
    }

    await mongoose.disconnect();

    // Summary Metrics
    const validLatencies = latencies.filter((l) => l.success).map((l) => l.durationMs);
    validLatencies.sort((a, b) => a - b);

    const minLat = validLatencies.length ? validLatencies[0].toFixed(1) : "0";
    const maxLat = validLatencies.length ? validLatencies[validLatencies.length - 1].toFixed(1) : "0";
    const avgLat = validLatencies.length
      ? (validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length).toFixed(1)
      : "0";
    const p95Lat = validLatencies.length
      ? validLatencies[Math.floor(validLatencies.length * 0.95)].toFixed(1)
      : "0";
    const totalTimeSec = Math.max(1, (Date.now() - startTime) / 1000);

    console.log("\n" + "=".repeat(60));
    console.log("                  🏁 LOAD TEST SUMMARY REPORT");
    console.log("=".repeat(60));
    console.log(`Total Duration:            ${totalTimeSec.toFixed(1)} seconds`);
    console.log(`Simulated Candidates:       ${BOTS_COUNT}`);
    console.log(`Successful Submissions:    ${submissionSuccessCount}`);
    console.log(`Failed Submissions:        ${submissionErrorCount}`);
    console.log(`Throughput:                ${(submissionSuccessCount / totalTimeSec).toFixed(1)} sub/sec`);
    console.log(`Min Latency:               ${minLat} ms`);
    console.log(`Average Latency:           ${avgLat} ms`);
    console.log(`p95 Latency:               ${p95Lat} ms`);
    console.log(`Max Latency:               ${maxLat} ms`);
    console.log("=".repeat(60) + "\n");

    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Auto-stop after DURATION_SECONDS
  setTimeout(() => {
    void cleanup();
  }, DURATION_SECONDS * 1000);
}

runLoadSimulation().catch(async (err) => {
  console.error("Simulation failure:", err);
  await mongoose.disconnect();
  process.exit(1);
});
