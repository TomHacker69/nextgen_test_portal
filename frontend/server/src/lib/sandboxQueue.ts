import { Queue } from "bullmq";
import type { CodeExecutionJobData } from "@nextgen/shared-types";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_URL = process.env.REDIS_URL;

const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: REDIS_HOST, port: REDIS_PORT };

declare global {
  // eslint-disable-next-line no-var
  var ngCodeQueueInstance: Queue | undefined;
}

export function getCodeExecutionQueue(): Queue {
  if (global.ngCodeQueueInstance) {
    return global.ngCodeQueueInstance;
  }

  const queue = new Queue("code-execution-queue", {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 7200, count: 500 },
    },
  });

  global.ngCodeQueueInstance = queue;
  return queue;
}

export async function enqueueCodeExecution(
  data: Omit<CodeExecutionJobData, "jobId">
): Promise<string> {
  const queue = getCodeExecutionQueue();
  const jobId = `${data.testId}:${data.userId}:${data.questionId}:${Date.now()}`;

  await queue.add("execute", { ...data, jobId }, { jobId });
  return jobId;
}
