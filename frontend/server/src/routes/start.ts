import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { Test } from "@nextgen/db";
import { getSessionFromReq } from "../middleware/auth";
import { getIO } from "../sockets/socketServer";

const router = Router();

// POST / → start a scheduled test live (admin)
router.post("/", async (req: Request, res: Response) => {
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

    test.status = "live";
    await test.save();

    // Broadcast test:started event via Socket.IO
    const io = getIO();
    if (io) {
      const roomKey = `test:${test.roomId}`;
      console.log(`[Socket.IO Broadcast] Emitting test:started to room: ${roomKey}`);
      io.to(roomKey).emit("test:started", {
        testId: test._id.toString(),
        roomId: test.roomId,
        startedAt: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      message: "Test started successfully",
      test,
    });
  } catch (error: any) {
    console.error("Start test error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to start test" });
  }
});

export default router;
