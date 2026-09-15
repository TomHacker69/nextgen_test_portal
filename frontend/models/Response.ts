import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IResponseDoc extends Document {
  testId: Types.ObjectId;
  userId: Types.ObjectId;
  questionId: Types.ObjectId;
  selectedOption: "a" | "b" | "c" | "d";
  answeredAt: Date;
  isFinal: boolean;
  createdAt: Date;
}

const ResponseSchema = new Schema<IResponseDoc>(
  {
    testId: {
      type: Schema.Types.ObjectId,
      ref: "Test",
      required: true,
      index: true, // Required for admin live aggregation queries
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
      required: true,
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
