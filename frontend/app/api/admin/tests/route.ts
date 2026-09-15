import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Test from "@/models/Test";
import User from "@/models/User";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const tests = await Test.find().sort({ scheduledStartTime: -1 }).lean();

    // Enrich with user counts per room
    const enrichedTests = await Promise.all(
      tests.map(async (t) => {
        const studentCount = await User.countDocuments({ roomId: t.roomId });
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

    const { title, scheduledStartTime, durationMinutes, roomId } = await req.json();

    if (!title || !scheduledStartTime || !durationMinutes || !roomId) {
      return NextResponse.json(
        { error: "Title, scheduled time, duration, and room ID are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const existingRoom = await Test.findOne({ roomId });
    if (existingRoom) {
      return NextResponse.json(
        { error: "Room ID is already in use by another test" },
        { status: 400 }
      );
    }

    const newTest = await Test.create({
      title,
      scheduledStartTime: new Date(scheduledStartTime),
      durationMinutes: Number(durationMinutes),
      roomId: String(roomId).trim().toUpperCase(),
      status: "scheduled",
      questions: [],
    });

    return NextResponse.json({ success: true, test: newTest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create test" },
      { status: 500 }
    );
  }
}
