import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { Test, UserTestAccess } from "@nextgen/db";
import { getSessionFromReq } from "../middleware/auth";
import { getIO, emitToUserSocket } from "../sockets/socketServer";
import { armUserAutoSubmitTimer } from "../scheduler/scheduler";

const router = Router();

// POST / → grant extra time to a candidate (admin)
// Body: { extraMinutes: number }
router.post("/", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { testId, userId } = req.params;
    const { extraMinutes } = req.body || {};

    const addedMinutes = Number(extraMinutes);
    if (isNaN(addedMinutes) || addedMinutes <= 0) {
      return res
        .status(400)
        .json({ error: "A positive number of extra minutes is required" });
    }

    await connectDB();

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const access = await UserTestAccess.findOne({ testId, userId });
    if (!access) {
      return res
        .status(404)
        .json({ error: "User test access record not found" });
    }

    // Recalculate personalEndTime = (scheduledStartTime + durationMinutes) + (existingExtra + addedMinutes)
    const newTotalExtra = access.extraMinutes + addedMinutes;
    const baseEnd = new Date(
      test.scheduledStartTime.getTime() + test.durationMinutes * 60 * 1000
    ).getTime();
    const newPersonalEnd = new Date(baseEnd + newTotalExtra * 60 * 1000);

    access.extraMinutes = newTotalExtra;
    access.personalEndTime = newPersonalEnd;
    await access.save();

    const personalEndTimeISO = newPersonalEnd.toISOString();

    // 1. Emit time:extended directly to that user's socket only
    emitToUserSocket(userId, "time:extended", {
      testId,
      userId,
      extraMinutes: newTotalExtra,
      addedMinutes,
      personalEndTime: personalEndTimeISO,
    });

    // 2. Reschedule the user's auto-submit timer
    armUserAutoSubmitTimer(testId, userId, newPersonalEnd);

    // 3. Notify the admin live room
    const io = getIO();
    if (io) {
      io.to(`admin:${testId}`).emit("admin:timeExtended", {
        testId,
        userId,
        extraMinutes: newTotalExtra,
        personalEndTime: personalEndTimeISO,
      });
    }

    return res.json({
      success: true,
      message: `Granted ${addedMinutes} extra minutes to candidate`,
      extraMinutes: newTotalExtra,
      personalEndTime: personalEndTimeISO,
    });
  } catch (error: any) {
    console.error("Grant extra time error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to grant extra time" });
  }
});

export default router;
