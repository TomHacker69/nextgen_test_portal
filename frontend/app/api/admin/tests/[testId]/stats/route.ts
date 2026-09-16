import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Test from "@/models/Test";
import Question from "@/models/Question";
import User from "@/models/User";
import UserTestAccess from "@/models/UserTestAccess";
import ResponseModel from "@/models/Response";
import { getSession } from "@/lib/auth";
import { ILiveParticipantRow } from "@/types";

export async function GET(
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

    const test = await Test.findById(testId).lean();
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // Never send correctOption to client
    const questions = await Question.find({ testId })
      .sort({ order: 1 })
      .select("-correctOption")
      .lean();

    // Find all users assigned to this test's roomId
    const users = await User.find({ roomId: test.roomId })
      .select("name email roomId createdAt")
      .lean();

    // Find all responses for this test
    const responses = await ResponseModel.find({ testId }).lean();

    // Map responses by userId
    const responseByUser: Record<string, { answers: Record<string, any>; isFinal: boolean; lastAnsweredAt?: string }> = {};
    for (const r of responses) {
      const uId = r.userId.toString();
      if (!responseByUser[uId]) {
        responseByUser[uId] = { answers: {}, isFinal: false };
      }
      responseByUser[uId].answers[r.questionId.toString()] = r.selectedOption;
      if (r.isFinal) {
        responseByUser[uId].isFinal = true;
      }
      responseByUser[uId].lastAnsweredAt = r.answeredAt?.toISOString();
    }

    // Derive the test's absolute end time (per-user access records may extend it)
    const baseEnd = new Date(
      test.scheduledStartTime.getTime() + test.durationMinutes * 60 * 1000
    );

    // Fetch per-user access records to populate blocked / extra-time / deadline fields
    const accessRecords = await UserTestAccess.find({ testId }).lean();
    const accessByUser: Record<
      string,
      { blocked: boolean; extraMinutes: number; personalEndTime: Date }
    > = {};
    for (const a of accessRecords) {
      accessByUser[a.userId.toString()] = {
        blocked: a.blocked,
        extraMinutes: a.extraMinutes,
        personalEndTime: a.personalEndTime,
      };
    }

    // Construct participant rows
    const participants: ILiveParticipantRow[] = users.map((u) => {
      const uId = u._id.toString();
      const userResp = responseByUser[uId] || { answers: {}, isFinal: false };
      const answeredCount = Object.keys(userResp.answers).length;
      const access = accessByUser[uId];

      return {
        userId: uId,
        name: u.name,
        email: u.email,
        roomId: u.roomId,
        currentQuestionIndex: answeredCount,
        totalQuestions: questions.length,
        answers: userResp.answers,
        codeSnapshots: {},
        gradingStatus: {},
        scores: {},
        blocked: access?.blocked ?? false,
        extraMinutes: access?.extraMinutes ?? 0,
        personalEndTime: (access?.personalEndTime ?? baseEnd).toISOString(),
        isCompleted:
          userResp.isFinal || (questions.length > 0 && answeredCount >= questions.length),
        lastAnsweredAt: userResp.lastAnsweredAt,
        isOnline: false,
      };
    });

    return NextResponse.json({
      test,
      questions,
      participants,
    });
  } catch (error: any) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load test stats" },
      { status: 500 }
    );
  }
}
