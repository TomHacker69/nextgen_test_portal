import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ITestDoc extends Document {
  title: string;
  scheduledStartTime: Date;
  durationMinutes: number;
  status: "scheduled" | "live" | "ended";
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

const Test: Model<ITestDoc> =
  mongoose.models.Test || mongoose.model<ITestDoc>("Test", TestSchema);

export default Test;
