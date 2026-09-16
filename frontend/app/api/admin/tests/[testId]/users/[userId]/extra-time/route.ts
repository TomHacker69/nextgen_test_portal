import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Test from "@/models/Test";
import UserTestAccess from "@/models/UserTestAccess";
import { getSession } from "@/lib/auth";
import { getIO, emitToUserSocket } from "@/lib/socketServer";
import { armUserAutoSubmitTimer } from "@/lib/scheduler";

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
    const { extraMinutes } = await req.json();

    const addedMinutes = Number(extraMinutes);
    if (isNaN(addedMinutes) || addedMinutes <= 0) {
      return NextResponse.json(
        { error: "A positive number of extra minutes is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const test = await Test.findById(testId);
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const access = await UserTestAccess.findOne({ testId, userId });
    if (!access) {
      return NextResponse.json(
        { error: "User test access record not found" },
        { status: 404 }
      );
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

    // 1. Emit time:extended directly to that user's socket only
    emitToUserSocket(userId, "time:extended", {
      testId,
      userId,
      extraMinutes: newTotalExtra,
      addedMinutes,
      personalEndTime: newPersonalEnd.toISOString(),
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
        personalEndTime: newPersonalEnd.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Granted ${addedMinutes} extra minutes to candidate`,
      extraMinutes: newTotalExtra,
      personalEndTime: newPersonalEnd.toISOString(),
    });
  } catch (error: any) {
    console.error("Grant extra time error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to grant extra time" },
      { status: 500 }
    );
  }
}
