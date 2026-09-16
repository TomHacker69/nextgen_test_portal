import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { Test, Question, ResponseModel } from "@nextgen/db";
import { getSessionFromReq } from "../middleware/auth";

const router = Router();

// GET /api/test — list assessments available to the logged-in candidate
router.get("/", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "user") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await connectDB();

    // Find tests matching the user's room or all live/scheduled tests
    const tests = await Test.find({
      $or: [
        { roomId: session.roomId },
        { status: { $in: ["live", "scheduled"] } },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    const results = await Promise.all(
      tests.map(async (test: any) => {
        const questionCount = await Question.countDocuments({ testId: test._id });
        const mcqCount = await Question.countDocuments({ testId: test._id, type: "mcq" });
        const codingCount = await Question.countDocuments({ testId: test._id, type: "coding" });

        const responses = await ResponseModel.find({
          testId: test._id,
          userId: session.userId,
        }).lean();

        const isCompleted = responses.some((r: any) => r.isFinal);
        const answersCount = responses.length;
        const score = responses.reduce((acc: number, r: any) => acc + (r.score || 0), 0);

        return {
          _id: test._id,
          title: test.title,
          roomId: test.roomId,
          durationMinutes: test.durationMinutes,
          status: test.status,
          scheduledStartTime: test.scheduledStartTime,
          totalQuestions: questionCount,
          mcqCount,
          codingCount,
          answersCount,
          isCompleted,
          score,
          isUserRoom: test.roomId === session.roomId,
        };
      })
    );

    return res.json({
      success: true,
      user: {
        userId: session.userId,
        email: session.email,
        roomId: session.roomId,
      },
      assessments: results,
    });
  } catch (error: any) {
    console.error("Fetch available assessments error:", error);
    return res.status(500).json({ error: error?.message || "Failed to load assessments" });
  }
});

// POST /api/test/:testId/reset — candidate retake / reset test state
router.post("/:testId/reset", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "user") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { testId } = req.params;
    await connectDB();

    // Delete responses for this user & test to allow fresh retake
    await ResponseModel.deleteMany({
      testId,
      userId: session.userId,
    });

    return res.json({ success: true, message: "Assessment session reset successfully" });
  } catch (error: any) {
    console.error("Reset test error:", error);
    return res.status(500).json({ error: error?.message || "Failed to reset assessment" });
  }
});

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

    // Explicitly strip correctOption & mask hidden test cases — NEVER sent to candidate client
    const rawQuestions = await Question.find({ testId })
      .sort({ order: 1 })
      .select("-correctOption")
      .lean();

    const questions = rawQuestions.map((q: any) => {
      if (q.type === "coding" && Array.isArray(q.testCases)) {
        return {
          ...q,
          testCases: q.testCases.map((tc: any) => ({
            input: tc.isHidden ? "" : tc.input,
            expectedOutput: tc.isHidden ? "" : tc.expectedOutput,
            isHidden: Boolean(tc.isHidden),
          })),
        };
      }
      return q;
    });

    const userResponses = await ResponseModel.find({
      testId,
      userId: session.userId,
    }).lean();

    const responseMap: Record<string, string> = {};
    let isCompleted = false;

    for (const r of userResponses) {
      responseMap[r.questionId.toString()] = r.selectedOption || r.finalCode || "";
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
