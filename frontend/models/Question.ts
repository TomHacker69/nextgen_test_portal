import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IOptionSubdoc {
  key: "a" | "b" | "c" | "d";
  text: string;
}

export interface ITestCaseSubdoc {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface IQuestionDoc extends Document {
  testId: Types.ObjectId;
  order: number;
  type: "mcq" | "coding";
  text: string;
  // MCQ fields
  options?: IOptionSubdoc[];
  correctOption?: "a" | "b" | "c" | "d";
  // Coding fields
  language?: "javascript" | "python" | "cpp" | "java";
  starterCode?: string;
  testCases?: ITestCaseSubdoc[];
  timeLimitMs?: number;
  memoryLimitKb?: number;
  createdAt: Date;
}

const OptionSchema = new Schema<IOptionSubdoc>(
  {
    key: {
      type: String,
      enum: ["a", "b", "c", "d"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const TestCaseSchema = new Schema<ITestCaseSubdoc>(
  {
    input: {
      type: String,
      default: "",
    },
    expectedOutput: {
      type: String,
      required: true,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestionDoc>(
  {
    testId: {
      type: Schema.Types.ObjectId,
      ref: "Test",
      required: true,
      index: true,
    },
    order: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["mcq", "coding"],
      default: "mcq",
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    // MCQ fields
    options: {
      type: [OptionSchema],
      default: undefined,
    },
    correctOption: {
      type: String,
      enum: ["a", "b", "c", "d"],
      // Keep server-side only; never send to client
    },
    // Coding fields
    language: {
      type: String,
      enum: ["javascript", "python", "cpp", "java"],
      default: "javascript",
    },
    starterCode: {
      type: String,
      default: "",
    },
    testCases: {
      type: [TestCaseSchema],
      default: [],
    },
    timeLimitMs: {
      type: Number,
      default: 2000,
    },
    memoryLimitKb: {
      type: Number,
      default: 262144, // 256 MB
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

QuestionSchema.index({ testId: 1, order: 1 });

const Question: Model<IQuestionDoc> =
  mongoose.models.Question || mongoose.model<IQuestionDoc>("Question", QuestionSchema);

export default Question;
