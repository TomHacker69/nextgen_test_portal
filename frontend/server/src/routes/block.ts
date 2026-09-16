import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { UserTestAccess } from "@nextgen/db";
import { getSessionFromReq } from "../middleware/auth";
import { disconnectUserSocket, getIO } from "../sockets/socketServer";

const router = Router();

// POST / → block a candidate (admin)
router.post("/", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { testId, userId } = req.params;
    await connectDB();

    const access = await UserTestAccess.findOne({ testId, userId });
    if (!access) {
      return res
        .status(404)
        .json({ error: "User test access record not found" });
    }

    access.blocked = true;
    access.status = "blocked";
    await access.save();

    // Disconnect active socket immediately
    disconnectUserSocket(
      userId,
      "You have been blocked from this test session by an administrator."
    );

    // Broadcast admin:userBlocked to admin live monitoring room
    const io = getIO();
    if (io) {
      io.to(`admin:${testId}`).emit("admin:userBlocked", {
        testId,
        userId,
        blockedAt: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      message: "Candidate blocked and socket disconnected successfully",
    });
  } catch (error: any) {
    console.error("Block user error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to block user" });
  }
});

export default router;
