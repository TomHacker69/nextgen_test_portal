import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import UserTestAccess from "@/models/UserTestAccess";
import { getSession } from "@/lib/auth";
import { disconnectUserSocket, getIO } from "@/lib/socketServer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string; userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId, userId } = await params;
    await connectDB();

    const access = await UserTestAccess.findOne({ testId, userId });
    if (!access) {
      return NextResponse.json(
        { error: "User test access record not found" },
        { status: 404 }
      );
    }

    access.blocked = true;
    access.status = "blocked";
    await access.save();

    // Disconnect active socket immediately
    disconnectUserSocket(userId, "You have been blocked from this test session by an administrator.");

    // Broadcast admin:userBlocked to admin live monitoring room
    const io = getIO();
    if (io) {
      io.to(`admin:${testId}`).emit("admin:userBlocked", {
        testId,
        userId,
        blockedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Candidate blocked and socket disconnected successfully",
    });
  } catch (error: any) {
    console.error("Block user error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to block user" },
      { status: 500 }
    );
  }
}
