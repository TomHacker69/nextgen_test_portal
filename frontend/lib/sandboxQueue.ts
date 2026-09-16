import { Queue } from "bullmq";
import { CodingLanguage, ITestCase, IExecutionResult } from "@/types";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_URL = process.env.REDIS_URL;

const connection = REDIS_URL
  ? { url: REDIS_URL }
  : { host: REDIS_HOST, port: REDIS_PORT };

export interface CodeExecutionJobData {
  jobId: string;
  testId: string;
  userId: string;
  userName?: string;
  questionId: string;
  code: string;
  language: CodingLanguage;
  isSampleRun: boolean;
  testCases: ITestCase[];
  timeLimitMs?: number;
  memoryLimitKb?: number;
}

export interface CodeExecutionJobResult {
  jobId: string;
  testId: string;
  userId: string;
  questionId: string;
  isSampleRun: boolean;
  executionResults: IExecutionResult[];
  score: number;
}

declare global {
  // eslint-disable-next-line no-var
  var codeQueueInstance: Queue | undefined;
}

export function getCodeExecutionQueue(): Queue {
  if (global.codeQueueInstance) {
    return global.codeQueueInstance;
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

  global.codeQueueInstance = queue;
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
