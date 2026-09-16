import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ICodeSnapshotDoc extends Document {
  testId: Types.ObjectId;
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  code: string;
  language: string;
  capturedAt: Date;
  createdAt: Date;
}

const CodeSnapshotSchema = new Schema<ICodeSnapshotDoc>(
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
    code: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      default: "javascript",
    },
    capturedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index for upserting 2-minute snapshots
CodeSnapshotSchema.index({ testId: 1, userId: 1, questionId: 1 }, { unique: true });

const CodeSnapshot: Model<ICodeSnapshotDoc> =
  mongoose.models.CodeSnapshot ||
  mongoose.model<ICodeSnapshotDoc>("CodeSnapshot", CodeSnapshotSchema);

export default CodeSnapshot;
