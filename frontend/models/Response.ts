import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IExecutionResultSubdoc {
  testCaseIndex: number;
  passed: boolean;
  actualOutput: string;
  stderr: string;
  executionTimeMs: number;
}

export interface IResponseDoc extends Document {
  testId: Types.ObjectId;
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  // MCQ fields
  selectedOption?: "a" | "b" | "c" | "d";
  answeredAt: Date;
  isFinal: boolean;
  // Coding fields
  finalCode?: string;
  executionResults?: IExecutionResultSubdoc[];
  score?: number;
  createdAt: Date;
}

const ExecutionResultSchema = new Schema<IExecutionResultSubdoc>(
  {
    testCaseIndex: {
      type: Number,
      required: true,
    },
    passed: {
      type: Boolean,
      required: true,
    },
    actualOutput: {
      type: String,
      default: "",
    },
    stderr: {
      type: String,
      default: "",
    },
    executionTimeMs: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const ResponseSchema = new Schema<IResponseDoc>(
  {
    testId: {
      type: Schema.Types.ObjectId,
      ref: "Test",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    selectedOption: {
      type: String,
      enum: ["a", "b", "c", "d"],
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
    isFinal: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Coding fields
    finalCode: {
      type: String,
    },
    executionResults: {
      type: [ExecutionResultSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: allows upserting on answer change without creating duplicate entries
ResponseSchema.index({ testId: 1, userId: 1, questionId: 1 }, { unique: true });

// Compound index for user test recovery
ResponseSchema.index({ testId: 1, userId: 1 });

const ResponseModel: Model<IResponseDoc> =
  mongoose.models.Response ||
  mongoose.model<IResponseDoc>("Response", ResponseSchema);

export default ResponseModel;
