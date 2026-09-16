import type { TestStatus } from "@nextgen/shared-types";
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ITestDoc extends Document {
  title: string;
  scheduledStartTime: Date;
  durationMinutes: number;
  defaultPassword?: string;
  status: TestStatus;
  questions: Types.ObjectId[];
  roomId: string;
  createdAt: Date;
}

const TestSchema = new Schema<ITestDoc>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    scheduledStartTime: {
      type: Date,
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    defaultPassword: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "live", "ended"],
      default: "scheduled",
      index: true,
    },
    questions: [
      {
        type: Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    roomId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
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

export type TestModel = Model<ITestDoc>;

export default (mongoose.models.Test as TestModel) ||
  mongoose.model<ITestDoc, TestModel>("Test", TestSchema);
