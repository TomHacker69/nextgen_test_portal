import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { Test, Question, ResponseModel } from "@nextgen/db";
import { getSessionFromReq } from "../middleware/auth";

const router = Router();

// GET /api/test/:testId  — student view of an assigned test
router.get("/:testId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "user") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { testId } = req.params;
    await connectDB();

    const test = await Test.findById(testId).lean();
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Verify user is assigned to this test's room
    if (test.roomId !== session.roomId) {
      return res.status(403).json({
        error: "You are not assigned to this test session",
      });
    }

    // Explicitly strip correctOption — NEVER sent to client
    const questions = await Question.find({ testId })
      .sort({ order: 1 })
      .select("-correctOption")
      .lean();

    const userResponses = await ResponseModel.find({
      testId,
      userId: session.userId,
    }).lean();

    const responseMap: Record<string, string> = {};
    let isCompleted = false;

    for (const r of userResponses) {
      responseMap[r.questionId.toString()] = r.selectedOption || "";
      if (r.isFinal) isCompleted = true;
    }

    return res.json({
      test: {
        _id: test._id,
        title: test.title,
        scheduledStartTime: test.scheduledStartTime,
        durationMinutes: test.durationMinutes,
        status: test.status,
        roomId: test.roomId,
      },
      questions,
      responses: responseMap,
      isCompleted,
    });
  } catch (error: any) {
    console.error("Test taker fetch error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to load test details" });
  }
});

export default router;
