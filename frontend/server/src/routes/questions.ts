import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { Test, Question } from "@nextgen/db";
import { getSessionFromReq } from "../middleware/auth";

const router = Router();

// GET / → list questions for a test (admin)
router.get("/", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { testId } = req.params;
    await connectDB();

    const questions = await Question.find({ testId }).sort({ order: 1 }).lean();
    return res.json({ questions });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to fetch questions" });
  }
});

// POST / → create a question for a test (admin)
// Body: { type, text, options?, correctOption?, language?, starterCode?, testCases?, timeLimitMs?, memoryLimitKb? }
router.post("/", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { testId } = req.params;
    const body = req.body || {};
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
      return res
        .status(400)
        .json({ error: "Question type and text are required" });
    }

    await connectDB();

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    const count = await Question.countDocuments({ testId });
    const order = count + 1;

    const questionData: any = {
      testId: test._id,
      order,
      type,
      text: String(text).trim(),
    };

    if (type === "mcq") {
      if (!options || !Array.isArray(options) || options.length < 2) {
        return res
          .status(400)
          .json({ error: "MCQ questions must have at least 2 options" });
      }
      if (!correctOption) {
        return res
          .status(400)
          .json({ error: "Correct option is required for MCQ questions" });
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
    test.questions.push(question._id);
    await test.save();

    return res.status(201).json({ success: true, question });
  } catch (error: any) {
    console.error("Create question error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to create question" });
  }
});

// DELETE /:questionId → delete a question
router.delete("/:questionId", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { testId, questionId } = req.params;
    await connectDB();

    await Question.findOneAndDelete({ _id: questionId, testId });
    await Test.findByIdAndUpdate(testId, { $pull: { questions: questionId } });

    return res.json({ success: true, message: "Question deleted" });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to delete question" });
  }
});

export default router;
