import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { Test, Question, UserTestAccess } from "@nextgen/db";
import { getSessionFromReq } from "../middleware/auth";
import { armTestTimer } from "../scheduler/scheduler";

const router = Router();

// GET /api/admin/tests  — list all tests
router.get("/", async (req, res) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await connectDB();
    const tests = await Test.find().sort({ scheduledStartTime: -1 }).lean();

    const enrichedTests = await Promise.all(
      tests.map(async (t) => {
        const studentCount = await UserTestAccess.countDocuments({ testId: t._id });
        const questionCount = Array.isArray(t.questions) ? t.questions.length : 0;
        return {
          ...t,
          _id: t._id.toString(),
          studentCount,
          questionCount,
        };
      })
    );

    return res.json({ tests: enrichedTests });
  } catch (error: any) {
    console.error("Admin tests fetch error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to fetch tests" });
  }
});

// POST /api/admin/tests — create a test (accepts durationMinutes, the canonical field)
router.post("/", async (req, res) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = req.body || {};
    const { title, scheduledStartTime, durationMinutes, roomId, defaultPassword, questions } = body;

    if (!title || !scheduledStartTime || !roomId) {
      return res.status(400).json({
        error: "Title, start time, duration, and Room ID are required",
      });
    }

    const start = new Date(scheduledStartTime);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: "Invalid scheduled start time" });
    }

    let duration = Number(durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      return res
        .status(400)
        .json({ error: "durationMinutes must be a positive number" });
    }

    await connectDB();

    const normalizedRoomId = String(roomId).trim().toUpperCase();
    const existingRoom = await Test.findOne({ roomId: normalizedRoomId });
    if (existingRoom) {
      return res
        .status(400)
        .json({ error: "Room ID is already in use by another test" });
    }

    const newTest = await Test.create({
      title: String(title).trim(),
      scheduledStartTime: start,
      durationMinutes: duration,
      roomId: normalizedRoomId,
      defaultPassword: defaultPassword ? String(defaultPassword).trim() : undefined,
      status: "scheduled",
      questions: [],
    });

    if (Array.isArray(questions) && questions.length > 0) {
      const questionDocs = await Promise.all(
        questions.map(async (q: any, index: number) => {
          const questionData: any = {
            testId: newTest._id,
            order: q.order ?? index,
            type: q.type || "mcq",
            text: String(q.text || "").trim(),
          };

          if (q.type === "mcq") {
            if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
              throw new Error("MCQ questions must have at least 2 options");
            }
            if (!q.correctOption) {
              throw new Error("Correct option is required for MCQ questions");
            }
            questionData.options = q.options;
            questionData.correctOption = q.correctOption;
          } else if (q.type === "coding") {
            questionData.language = q.language || "javascript";
            questionData.starterCode = q.starterCode || "";
            questionData.testCases = Array.isArray(q.testCases) ? q.testCases : [];
            questionData.timeLimitMs = q.timeLimitMs ? Number(q.timeLimitMs) : 2000;
            questionData.memoryLimitKb = q.memoryLimitKb ? Number(q.memoryLimitKb) : 262144;
          }

          return Question.create(questionData);
        })
      );

      newTest.questions = questionDocs.map((q: any) => q._id);
      await newTest.save();
    }

    void armTestTimer(newTest);

    return res.status(201).json({ success: true, test: newTest });
  } catch (error: any) {
    console.error("Create test error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to create test" });
  }
});

export default router;
