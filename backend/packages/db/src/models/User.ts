import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  passwordHash: string;
  mustChangePassword: boolean;
  roomId: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
    roomId: {
      type: String,
      required: true,
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

export type UserModel = Model<IUserDoc>;

export default (mongoose.models.User as UserModel) ||
  mongoose.model<IUserDoc, UserModel>("User", UserSchema);
