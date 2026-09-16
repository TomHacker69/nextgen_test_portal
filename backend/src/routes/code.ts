import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { Test, Question, UserTestAccess, ResponseModel } from "@nextgen/db";
import { getSessionFromReq } from "../middleware/auth";
import { getIO } from "../sockets/socketServer";
import { executeCode } from "../lib/codeCompiler";
import type { ITestCase } from "@nextgen/shared-types";

const router = Router();

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

    const test = await Test.findById(testId);
    if (!test || (session.role !== "admin" && test.roomId !== session.roomId && test.status !== "live")) {
      return res.status(403).json({ error: "Not enrolled in this assessment session" });
    }

    const access = await UserTestAccess.findOne({ testId, userId: session.userId });
    if (access && access.blocked) {
      return res.status(403).json({ error: "Access blocked by supervisor" });
    }

    const question = await Question.findById(questionId);
    if (!question || question.type !== "coding") {
      return res.status(404).json({ error: "Coding question not found" });
    }

    // Visible / sample test cases or custom input
    let targetCases: ITestCase[] = (question.testCases || []).filter((tc: ITestCase) => !tc.isHidden);
    if (body.customInput !== undefined && body.customInput !== null && body.customInput.trim() !== "") {
      targetCases = [
        {
          input: String(body.customInput),
          expectedOutput: "",
          isHidden: false,
        },
      ];
    }
    const timeLimitMs = question.timeLimitMs || 2000;
    const selectedLang = language || question.language || "javascript";

    const executionSummary = await executeCode(
      selectedLang,
      code,
      targetCases,
      timeLimitMs
    );

    return res.json({
      success: true,
      summary: executionSummary,
    });
  } catch (error: any) {
    console.error("Code run error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to execute code" });
  }
});

// POST /api/code/submit — submit final code for full grading against all test cases
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

    const test = await Test.findById(testId);
    if (!test || (session.role !== "admin" && test.roomId !== session.roomId && test.status !== "live")) {
      return res.status(403).json({ error: "Not enrolled in this assessment session" });
    }

    const access = await UserTestAccess.findOne({ testId, userId: session.userId });
    if (access && access.blocked) {
      return res.status(403).json({ error: "Access blocked by supervisor" });
    }

    const question = await Question.findById(questionId);
    if (!question || question.type !== "coding") {
      return res.status(404).json({ error: "Coding question not found" });
    }

    // Submit against ALL test cases (visible + hidden)
    const allCases = question.testCases || [];
    const timeLimitMs = question.timeLimitMs || 2000;
    const selectedLang = language || question.language || "javascript";

    const executionSummary = await executeCode(
      selectedLang,
      code,
      allCases,
      timeLimitMs
    );

    // Persist response to database
    await ResponseModel.findOneAndUpdate(
      { testId, userId: session.userId, questionId },
      {
        $set: {
          finalCode: code,
          executionResults: executionSummary.results,
          score: executionSummary.score,
          isFinal: true,
          answeredAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await UserTestAccess.findOneAndUpdate(
      { testId, userId: session.userId },
      { $set: { status: "in_progress" } },
      { upsert: true }
    );

    // Notify admin proctoring room
    const io = getIO();
    if (io) {
      io.to(`admin:${testId}`).emit("code:evaluated", {
        testId,
        userId: session.userId,
        userName: session.name || "Candidate",
        questionId,
        questionIndex: questionIndex ?? 0,
        score: executionSummary.score,
        passedCount: executionSummary.passedCount,
        totalCount: executionSummary.totalCount,
        completedAt: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      summary: executionSummary,
      message: `Solution submitted successfully. Score: ${Math.round(executionSummary.score * 100)}%`,
    });
  } catch (error: any) {
    console.error("Code submit error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to submit code" });
  }
});

export default router;
