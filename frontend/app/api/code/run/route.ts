import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Question from "@/models/Question";
import UserTestAccess from "@/models/UserTestAccess";
import { getSession } from "@/lib/auth";
import { enqueueCodeExecution } from "@/lib/sandboxQueue";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId, questionId, code, language } = await req.json();

    if (!testId || !questionId || code === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectDB();

    // Check user test access
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

    // Filter to visible/sample test cases only (sample run)
    const sampleCases = (question.testCases || []).filter((tc) => !tc.isHidden);

    const jobId = await enqueueCodeExecution({
      testId,
      userId: session.userId,
      userName: session.name || "Candidate",
      questionId,
      code,
      language: language || question.language || "javascript",
      isSampleRun: true,
      testCases: sampleCases,
      timeLimitMs: question.timeLimitMs || 2000,
      memoryLimitKb: question.memoryLimitKb || 262144,
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: "Code run queued for sample test cases",
    });
  } catch (error: any) {
    console.error("Code run error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to execute code" },
      { status: 500 }
    );
  }
}
