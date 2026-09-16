import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Test from "@/models/Test";
import Question from "@/models/Question";
import ResponseModel from "@/models/Response";
import { getSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId } = await params;
    await connectDB();

    const test = await Test.findById(testId).lean();
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // Verify user is assigned to this test's room
    if (test.roomId !== session.roomId) {
      return NextResponse.json(
        { error: "You are not assigned to this test session" },
        { status: 403 }
      );
    }

    // Explicitly strip correctOption from questions - NEVER sent to client
    const questions = await Question.find({ testId })
      .sort({ order: 1 })
      .select("-correctOption")
      .lean();

    // Fetch existing responses for this user to resume on refresh/reconnect
    const userResponses = await ResponseModel.find({
      testId,
      userId: session.userId,
    }).lean();

    const responseMap: Record<string, string> = {};
    let isCompleted = false;

    for (const r of userResponses) {
        responseMap[r.questionId.toString()] = r.selectedOption || "";
      if (r.isFinal) isCompleted = true;
    }

    return NextResponse.json({
      test: {
        _id: test._id,
        title: test.title,
        scheduledStartTime: test.scheduledStartTime,
        durationMinutes: test.durationMinutes,
        status: test.status,
        roomId: test.roomId,
      },
      questions,
      responses: responseMap,
      isCompleted,
    });
  } catch (error: any) {
    console.error("Test taker fetch error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load test details" },
      { status: 500 }
    );
  }
}
