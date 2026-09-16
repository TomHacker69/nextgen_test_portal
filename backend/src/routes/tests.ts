import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import {
  Test,
  UserTestAccess,
  Question,
  ResponseModel,
  CodeSnapshot,
} from "@nextgen/db";
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
    const { title, scheduledStartTime, durationMinutes, roomId, defaultPassword } = body;

    if (!title || !scheduledStartTime) {
      return res.status(400).json({
        error: "Title and scheduled start time are required",
      });
    }

    const finalRoomId = (roomId && String(roomId).trim())
      ? String(roomId).trim().toUpperCase()
      : `ROOM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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

    const existingRoom = await Test.findOne({ roomId: finalRoomId });
    if (existingRoom) {
      return res
        .status(400)
        .json({ error: "Room ID is already in use by another test" });
    }

    const newTest = await Test.create({
      title: String(title).trim(),
      scheduledStartTime: start,
      durationMinutes: duration,
      roomId: finalRoomId,
      defaultPassword: defaultPassword ? String(defaultPassword).trim() : undefined,
      status: "scheduled",
      questions: [],
    });

    // Arm timers for start (and any pre-existing user personalEndTime timers)
    void armTestTimer(newTest);

    return res.status(201).json({ success: true, test: newTest });
  } catch (error: any) {
    console.error("Create test error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to create test" });
  }
});

// DELETE /api/admin/tests/:testId — delete an assessment suite
router.delete("/:testId", async (req, res) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { testId } = req.params;
    await connectDB();

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Clean up all related records
    await Promise.all([
      Test.findByIdAndDelete(testId),
      Question.deleteMany({ testId }),
      UserTestAccess.deleteMany({ testId }),
      ResponseModel.deleteMany({ testId }),
      CodeSnapshot.deleteMany({ testId }),
    ]);

    return res.json({ success: true, message: "Assessment deleted successfully" });
  } catch (error: any) {
    console.error("Delete test error:", error);
    return res.status(500).json({ error: error?.message || "Failed to delete test" });
  }
});

export default router;
