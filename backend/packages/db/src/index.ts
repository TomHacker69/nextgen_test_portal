import mongoose from "mongoose";

export { default as Admin, type IAdminDoc } from "./models/Admin";
export { default as Test, type ITestDoc } from "./models/Test";
export { default as Question, type IQuestionDoc } from "./models/Question";
export { default as User, type IUserDoc } from "./models/User";
export { default as ResponseModel, type IResponseDoc } from "./models/Response";
export { default as UserTestAccess, type IUserTestAccessDoc } from "./models/UserTestAccess";
export { default as CodeSnapshot, type ICodeSnapshotDoc } from "./models/CodeSnapshot";

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
      maxPoolSize: 100,
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
