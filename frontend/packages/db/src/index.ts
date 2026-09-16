import mongoose from "mongoose";

export { default as Admin } from "./models/Admin";
export type { IAdminDoc } from "./models/Admin";
export { default as Test } from "./models/Test";
export type { ITestDoc } from "./models/Test";
export { default as Question } from "./models/Question";
export type { IQuestionDoc } from "./models/Question";
export { default as User } from "./models/User";
export type { IUserDoc } from "./models/User";
export { default as ResponseModel } from "./models/Response";
export type { IResponseDoc } from "./models/Response";
export { default as UserTestAccess } from "./models/UserTestAccess";
export type { IUserTestAccessDoc } from "./models/UserTestAccess";
export { default as CodeSnapshot } from "./models/CodeSnapshot";
export type { ICodeSnapshotDoc } from "./models/CodeSnapshot";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nextgen_test_portal";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var ngMongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.ngMongooseCache || { conn: null, promise: null };

if (!global.ngMongooseCache) {
  global.ngMongooseCache = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 50,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
