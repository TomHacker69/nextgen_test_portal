import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { Question, UserTestAccess } from "@nextgen/db";
import { getSessionFromReq } from "../middleware/auth";
import { enqueueCodeExecution } from "../lib/sandboxQueue";
import { getIO } from "../sockets/socketServer";
import type { ITestCase } from "@nextgen/shared-types";

const router = Router();

function getIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (Array.isArray(xff)) return xff[0] || "127.0.0.1";
  if (typeof xff === "string") return xff;
  return req.socket?.remoteAddress || "127.0.0.1";
}

// POST /api/code/run — run code against visible/sample test cases (user)
router.post("/run", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body || {};
    const { testId, questionId, code, language } = body;

    if (!testId || !questionId || code === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await connectDB();

    const access = await UserTestAccess.findOne({ testId, userId: session.userId });
    if (!access || access.blocked) {
      return res
        .status(403)
        .json({ error: "Access blocked or not permitted" });
    }

    const question = await Question.findById(questionId);
    if (!question || question.type !== "coding") {
      return res.status(404).json({ error: "Coding question not found" });
    }

    // Filter to visible/sample test cases only (sample run)
    const sampleCases = (question.testCases || []).filter((tc: ITestCase) => !tc.isHidden);

    const jobId = await enqueueCodeExecution({
      testId,
      userId: session.userId,
      userName: session.name || "Candidate",
      questionId,
      code,
      language: language || question.language || "javascript",
      isSampleRun: true,
      testCases: sampleCases,
      timeLimitMs: question.timeLimitMs || 2000,
      memoryLimitKb: question.memoryLimitKb || 262144,
    });

    return res.json({
      success: true,
      jobId,
      message: "Code run queued for sample test cases",
    });
  } catch (error: any) {
    console.error("Code run error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to execute code" });
  }
});

// POST /api/code/submit — submit final code for full sandbox grading (user)
router.post("/submit", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body || {};
    const { testId, questionId, code, language, questionIndex } = body;

    if (!testId || !questionId || code === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await connectDB();

    const access = await UserTestAccess.findOne({ testId, userId: session.userId });
    if (!access || access.blocked) {
      return res
        .status(403)
        .json({ error: "Access blocked or not permitted" });
    }

    const question = await Question.findById(questionId);
    if (!question || question.type !== "coding") {
      return res.status(404).json({ error: "Coding question not found" });
    }

    // Submit against ALL test cases (visible + hidden)
    const allCases = question.testCases || [];

    const jobId = await enqueueCodeExecution({
      testId,
      userId: session.userId,
      userName: session.name || "Candidate",
      questionId,
      code,
      language: language || question.language || "javascript",
      isSampleRun: false,
      testCases: allCases,
      timeLimitMs: question.timeLimitMs || 2000,
      memoryLimitKb: question.memoryLimitKb || 262144,
    });

    // Notify admin live room that grading is in progress
    const io = getIO();
    if (io) {
      io.to(`admin:${testId}`).emit("admin:gradingQueued", {
        testId,
        userId: session.userId,
        questionId,
        questionIndex: questionIndex ?? 0,
        jobId,
        queuedAt: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      jobId,
      message: "Final code submission queued for full sandbox grading",
    });
  } catch (error: any) {
    console.error("Code submit error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to submit code" });
  }
});

export default router;
