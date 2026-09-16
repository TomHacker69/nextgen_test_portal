import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Test from "@/models/Test";
import Question from "@/models/Question";
import { getSession } from "@/lib/auth";

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

    const questions = await Question.find({ testId }).sort({ order: 1 }).lean();
    return NextResponse.json({ questions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch questions" },
      { status: 500 }
    );
  }
}

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
    const body = await req.json();
    const {
      type,
      text,
      options,
      correctOption,
      language,
      starterCode,
      testCases,
      timeLimitMs,
      memoryLimitKb,
    } = body;

    if (!type || !text) {
      return NextResponse.json(
        { error: "Question type and text are required" },
        { status: 400 }
      );
    }

    await connectDB();

    const test = await Test.findById(testId);
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const count = await Question.countDocuments({ testId });
    const order = count + 1;

    let questionData: any = {
      testId: test._id,
      order,
      type,
      text: String(text).trim(),
    };

    if (type === "mcq") {
      if (!options || !Array.isArray(options) || options.length < 2) {
        return NextResponse.json(
          { error: "MCQ questions must have at least 2 options" },
          { status: 400 }
        );
      }
      if (!correctOption) {
        return NextResponse.json(
          { error: "Correct option is required for MCQ questions" },
          { status: 400 }
        );
      }
      questionData.options = options;
      questionData.correctOption = correctOption;
    } else if (type === "coding") {
      questionData.language = language || "javascript";
      questionData.starterCode = starterCode || "";
      questionData.testCases = Array.isArray(testCases) ? testCases : [];
      questionData.timeLimitMs = timeLimitMs ? Number(timeLimitMs) : 2000;
      questionData.memoryLimitKb = memoryLimitKb ? Number(memoryLimitKb) : 262144;
    }

    const question = await Question.create(questionData);

    // Link question to test
    test.questions.push(question._id as any);
    await test.save();

    return NextResponse.json({ success: true, question }, { status: 201 });
  } catch (error: any) {
    console.error("Create question error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create question" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId } = await params;
    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get("questionId");

    if (!questionId) {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }

    await connectDB();
    await Question.findOneAndDelete({ _id: questionId, testId });
    await Test.findByIdAndUpdate(testId, { $pull: { questions: questionId } });

    return NextResponse.json({ success: true, message: "Question deleted" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete question" },
      { status: 500 }
    );
  }
}
