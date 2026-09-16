import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import mongoose from "mongoose";
import { runCodeAgainstTestCases } from "./runner";
import { CodeExecutionJobData, CodeExecutionJobResult } from "../lib/sandboxQueue";
import ResponseModel from "../models/Response";
import UserTestAccess from "../models/UserTestAccess";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_URL = process.env.REDIS_URL;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nextgen_test_portal";

const connection = REDIS_URL
  ? new Redis(REDIS_URL, { maxRetriesPerRequest: null })
  : new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null });

const pubClient = connection.duplicate();

async function startWorker() {
  console.log("[Worker] Connecting to MongoDB at", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log("[Worker] MongoDB connected.");

  console.log("[Worker] Initializing BullMQ Worker on 'code-execution-queue'...");

  const worker = new Worker<CodeExecutionJobData, CodeExecutionJobResult>(
    "code-execution-queue",
    async (job: Job<CodeExecutionJobData>) => {
      const {
        jobId,
        testId,
        userId,
        userName,
        questionId,
        code,
        language,
        isSampleRun,
        testCases,
        timeLimitMs,
        memoryLimitKb,
      } = job.data;

      console.log(
        `[Worker] Processing Job ${jobId} (${isSampleRun ? "SAMPLE RUN" : "FINAL SUBMIT"}) for user ${userId}`
      );

      // Execute in hardened container sandbox
      const { executionResults, score } = await runCodeAgainstTestCases({
        language,
        code,
        testCases,
        timeLimitMs,
        memoryLimitKb,
      });

      // If final submission, persist directly to MongoDB Response collection
      if (!isSampleRun) {
        await ResponseModel.findOneAndUpdate(
          { testId, userId, questionId },
          {
            $set: {
              finalCode: code,
              executionResults,
              score,
              isFinal: true,
              answeredAt: new Date(),
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Update UserTestAccess status to in_progress
        await UserTestAccess.findOneAndUpdate(
          { testId, userId },
          { $set: { status: "in_progress" } }
        );
      }

      const result: CodeExecutionJobResult = {
        jobId,
        testId,
        userId,
        questionId,
        isSampleRun,
        executionResults,
        score,
      };

      // Broadcast completion event across cluster via Redis Pub/Sub
      await pubClient.publish(
        "sandbox:completed",
        JSON.stringify({
          ...result,
          userName,
          completedAt: new Date().toISOString(),
        })
      );

      console.log(`[Worker] Finished Job ${jobId}. Passed: ${score * 100}%`);
      return result;
    },
    {
      connection,
      concurrency: 8, // Sized to host's CPU budget
      limiter: {
        max: 16,
        duration: 1000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  console.log("[Worker] Code Execution Sandbox Worker is ready and listening for jobs.");
}

startWorker().catch((err) => {
  console.error("[Worker Fatal Error]", err);
  process.exit(1);
});
