import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAdminDoc extends Document {
  email: string;
  passwordHash: string;
  role: "admin";
  createdAt: Date;
}

const AdminSchema = new Schema<IAdminDoc>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
      required: true,
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

export type AdminModel = Model<IAdminDoc>;

export default mongoose.models.Admin ||
  mongoose.model<IAdminDoc, AdminModel>("Admin", AdminSchema);
