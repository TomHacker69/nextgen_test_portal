import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Question from "@/models/Question";
import UserTestAccess from "@/models/UserTestAccess";
import { getSession } from "@/lib/auth";
import { enqueueCodeExecution } from "@/lib/sandboxQueue";
import { getIO } from "@/lib/socketServer";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId, questionId, code, language, questionIndex } = await req.json();

    if (!testId || !questionId || code === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectDB();

    const access = await UserTestAccess.findOne({ testId, userId: session.userId });
    if (!access || access.blocked) {
      return NextResponse.json(
        { error: "Access blocked or not permitted" },
        { status: 403 }
      );
    }

    const question = await Question.findById(questionId);
    if (!question || question.type !== "coding") {
      return NextResponse.json({ error: "Coding question not found" }, { status: 404 });
    }

    // Submit against ALL test cases (visible + hidden)
    const allCases = question.testCases || [];

    const jobId = await enqueueCodeExecution({
      testId,
      userId: session.userId,
      userName: session.name || "Candidate",
      questionId,
      code,
      language: language || question.language || "javascript",
      isSampleRun: false,
      testCases: allCases,
      timeLimitMs: question.timeLimitMs || 2000,
      memoryLimitKb: question.memoryLimitKb || 262144,
    });

    // Notify admin live room that grading is in progress
    const io = getIO();
    if (io) {
      io.to(`admin:${testId}`).emit("admin:gradingQueued", {
        testId,
        userId: session.userId,
        questionId,
        questionIndex: questionIndex ?? 0,
        jobId,
        queuedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      jobId,
      message: "Final code submission queued for full sandbox grading",
    });
  } catch (error: any) {
    console.error("Code submit error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit code" },
      { status: 500 }
    );
  }
}
