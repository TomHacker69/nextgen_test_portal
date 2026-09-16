import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Test from "@/models/Test";
import UserTestAccess from "@/models/UserTestAccess";
import { getSession } from "@/lib/auth";
import { armTestTimer } from "@/lib/scheduler";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const tests = await Test.find().sort({ scheduledStartTime: -1 }).lean();

    const enrichedTests = await Promise.all(
      tests.map(async (t) => {
        const studentCount = await UserTestAccess.countDocuments({ testId: t._id });
        return {
          ...t,
          studentCount,
          questionCount: Array.isArray(t.questions) ? t.questions.length : 0,
        };
      })
    );

    return NextResponse.json({ tests: enrichedTests });
  } catch (error: any) {
    console.error("Admin tests fetch error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch tests" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, scheduledStartTime, scheduledEndTime, roomId, defaultPassword } =
      await req.json();

    if (!title || !scheduledStartTime || !scheduledEndTime || !roomId) {
      return NextResponse.json(
        { error: "Title, start time, end time, and Room ID are required" },
        { status: 400 }
      );
    }

    const start = new Date(scheduledStartTime);
    const end = new Date(scheduledEndTime);

    if (end.getTime() <= start.getTime()) {
      return NextResponse.json(
        { error: "End time must be after scheduled start time" },
        { status: 400 }
      );
    }

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);

    await connectDB();

    const existingRoom = await Test.findOne({ roomId: String(roomId).trim().toUpperCase() });
    if (existingRoom) {
      return NextResponse.json(
        { error: "Room ID is already in use by another test" },
        { status: 400 }
      );
    }

    const newTest = await Test.create({
      title: String(title).trim(),
      scheduledStartTime: start,
      durationMinutes,
      roomId: String(roomId).trim().toUpperCase(),
      defaultPassword: defaultPassword ? String(defaultPassword).trim() : undefined,
      status: "scheduled",
      questions: [],
    });

    // Arm timers for start and end
    armTestTimer(newTest);

    return NextResponse.json({ success: true, test: newTest }, { status: 201 });
  } catch (error: any) {
    console.error("Create test error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create test" },
      { status: 500 }
    );
  }
}
