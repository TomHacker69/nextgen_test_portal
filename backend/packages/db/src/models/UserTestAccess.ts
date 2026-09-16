import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IUserTestAccessDoc extends Document {
  testId: Types.ObjectId;
  userId: Types.ObjectId;
  extraMinutes: number;
  blocked: boolean;
  personalEndTime: Date;
  status: "not_started" | "in_progress" | "completed" | "blocked";
  lastSeenQuestionIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserTestAccessSchema = new Schema<IUserTestAccessDoc>(
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
    extraMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    blocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    personalEndTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "blocked"],
      default: "not_started",
      index: true,
    },
    lastSeenQuestionIndex: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: one access record per user per test
UserTestAccessSchema.index({ testId: 1, userId: 1 }, { unique: true });

export type UserTestAccessModel = Model<IUserTestAccessDoc>;

export default (mongoose.models.UserTestAccess as UserTestAccessModel) ||
  mongoose.model<IUserTestAccessDoc, UserTestAccessModel>(
    "UserTestAccess",
    UserTestAccessSchema
  );
