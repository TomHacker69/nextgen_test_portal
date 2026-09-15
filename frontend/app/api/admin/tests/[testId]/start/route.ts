import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Test from "@/models/Test";
import { getSession } from "@/lib/auth";
import { getIO } from "@/lib/socketServer";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId } = await params;
    await connectDB();

    const test = await Test.findById(testId);
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
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

    return NextResponse.json({
      success: true,
      message: "Test started successfully",
      test,
    });
  } catch (error: any) {
    console.error("Start test error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to start test" },
      { status: 500 }
    );
  }
}
