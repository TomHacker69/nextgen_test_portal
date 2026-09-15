import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IOptionSubdoc {
  key: "a" | "b" | "c" | "d";
  text: string;
}

export interface IQuestionDoc extends Document {
  testId: Types.ObjectId;
  order: number;
  text: string;
  options: IOptionSubdoc[];
  correctOption: "a" | "b" | "c" | "d";
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
    text: {
      type: String,
      required: true,
    },
    options: {
      type: [OptionSchema],
      validate: [
        (val: IOptionSubdoc[]) => val.length >= 2,
        "Question must have at least 2 options",
      ],
      required: true,
    },
    correctOption: {
      type: String,
      enum: ["a", "b", "c", "d"],
      required: true,
      // Note: Always strip this field when querying for test-takers
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
