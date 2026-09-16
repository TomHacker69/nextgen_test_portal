import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { verifyToken, parseTokenFromHeaderOrCookie, JWTPayload } from "./auth";
import { checkRateLimit } from "./rateLimiter";
import { connectDB } from "./db";
import ResponseModel from "@/models/Response";
import Test from "@/models/Test";
import UserTestAccess from "@/models/UserTestAccess";
import CodeSnapshot from "@/models/CodeSnapshot";
import {
  ClientSubmitAnswerPayload,
  ClientCodeSnapshotPayload,
  AdminLiveUpdatePayload,
  AdminCodeUpdatePayload,
  UserCompletedPayload,
} from "@/types";

export interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
}

let ioInstance: SocketIOServer | null = null;
const userSocketMap = new Map<string, string>(); // userId -> socketId

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function disconnectUserSocket(userId: string, reason?: string) {
  const socketId = userSocketMap.get(userId);
  if (socketId && ioInstance) {
    const s = ioInstance.sockets.sockets.get(socketId);
    if (s) {
      s.emit("error:blocked", { message: reason || "You have been blocked from this test session." });
      s.disconnect(true);
      console.log(`[Socket Server] Force-disconnected blocked user ${userId}`);
    }
  }
}

export function emitToUserSocket(userId: string, event: string, payload: any) {
  const socketId = userSocketMap.get(userId);
  if (socketId && ioInstance) {
    ioInstance.to(socketId).emit(event, payload);
  }
}

export async function initSocketServer(server: HttpServer): Promise<SocketIOServer> {
  if (ioInstance) return ioInstance;

  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
    maxHttpBufferSize: 1e6, // 1 MB
  });

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      console.log(`[Socket.IO] Connecting to Redis adapter at ${redisUrl}...`);
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (t) => Math.min(t * 100, 3000),
      });
      const subClient = pubClient.duplicate();

      pubClient.on("error", (err) => console.error("[Redis Pub Error]", err.message));
      subClient.on("error", (err) => console.error("[Redis Sub Error]", err.message));

      await Promise.all([
        new Promise<void>((res) => pubClient.once("ready", () => res())),
        new Promise<void>((res) => subClient.once("ready", () => res())),
      ]);

      io.adapter(createAdapter(pubClient, subClient));
      console.log("[Socket.IO] Redis adapter initialized successfully across cluster.");

      // Subscribe to sandbox worker results
      const workerSubscriber = pubClient.duplicate();
      workerSubscriber.subscribe("sandbox:completed");
      workerSubscriber.on("message", (channel, message) => {
        if (channel === "sandbox:completed") {
          try {
            const data = JSON.parse(message);
            // Notify student
            emitToUserSocket(data.userId, "code:evaluated", data);
            // Notify admin live room
            io.to(`admin:${data.testId}`).emit("admin:codeGraded", data);
          } catch (e) {
            console.error("[Worker Message Parse Error]", e);
          }
        }
      });
    } catch (err: any) {
      console.warn(
        `[Socket.IO] Warning: Failed to connect to Redis (${err?.message}). Running in-memory single-node mode.`
      );
    }
  }

  // Socket Authentication & Blocking Check Middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const authHeader = socket.handshake.headers.authorization;
      const handshakeAuthToken = socket.handshake.auth?.token;

      const token =
        handshakeAuthToken ||
        parseTokenFromHeaderOrCookie(cookieHeader, authHeader);

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error("Authentication error: Invalid or expired token"));
      }

      // Check if user is blocked from their assigned room
      if (decoded.role === "user" && decoded.roomId) {
        await connectDB();
        const test = await Test.findOne({ roomId: decoded.roomId });
        if (test) {
          const access = await UserTestAccess.findOne({
            testId: test._id,
            userId: decoded.userId,
          });
          if (access && access.blocked) {
            return next(new Error("Access denied: You have been blocked from this assessment"));
          }
        }
      }

      socket.user = decoded;
      next();
    } catch (err: any) {
      return next(new Error(`Authentication failed: ${err?.message}`));
    }
  });

  // Connection Handler
  io.on("connection", (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    userSocketMap.set(user.userId, socket.id);

    if (user.role === "admin") {
      socket.on("admin:join", (testId: string) => {
        if (!testId) return;
        socket.join(`admin:${testId}`);
      });

      socket.on("admin:leave", (testId: string) => {
        if (!testId) return;
        socket.leave(`admin:${testId}`);
      });
    } else if (user.role === "user") {
      const userRoomId = user.roomId;
      if (userRoomId) {
        socket.join(`test:${userRoomId}`);
        socket.join(`user:${user.userId}`);
      }

      // MCQ Answer Submission
      socket.on("answer:submit", async (data: ClientSubmitAnswerPayload, callback) => {
        try {
          const { testId, questionId, selectedOption, questionIndex } = data;
          if (!testId || !questionId || !selectedOption) {
            if (callback) callback({ success: false, error: "Invalid payload" });
            return;
          }

          const rateCheck = checkRateLimit(`submit:${socket.id}`, 1, 1000);
          if (!rateCheck.allowed) {
            if (callback)
              callback({ success: false, error: "Submitting too fast. Please wait a moment." });
            return;
          }

          await connectDB();

          // Verify access & not blocked
          const access = await UserTestAccess.findOne({ testId, userId: user.userId });
          if (!access || access.blocked) {
            if (callback) callback({ success: false, error: "Candidate blocked or unauthorized" });
            return;
          }

          const now = new Date();
          await ResponseModel.findOneAndUpdate(
            { testId, userId: user.userId, questionId },
            {
              $set: {
                selectedOption,
                answeredAt: now,
                isFinal: false,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          // Update user's access status
          access.status = "in_progress";
          access.lastSeenQuestionIndex = questionIndex ?? 0;
          await access.save();

          const adminPayload: AdminLiveUpdatePayload = {
            testId,
            userId: user.userId,
            userName: user.name || "Student",
            userEmail: user.email,
            questionId,
            questionIndex: questionIndex ?? 0,
            selectedOption,
            answeredAt: now.toISOString(),
          };

          io.to(`admin:${testId}`).emit("admin:update", adminPayload);

          if (callback) callback({ success: true, timestamp: now.toISOString() });
        } catch (error: any) {
          if (callback) callback({ success: false, error: "Submission failed" });
        }
      });

      // 2-Minute Code Snapshot Sync
      socket.on("code:snapshot", async (data: ClientCodeSnapshotPayload) => {
        try {
          const { testId, questionId, code, language } = data;
          if (!testId || !questionId || code === undefined) return;

          await connectDB();

          // Check not blocked
          const access = await UserTestAccess.findOne({ testId, userId: user.userId });
          if (!access || access.blocked) return;

          const now = new Date();
          await CodeSnapshot.findOneAndUpdate(
            { testId, userId: user.userId, questionId },
            {
              $set: {
                code,
                language: language || "javascript",
                capturedAt: now,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );

          const adminCodePayload: AdminCodeUpdatePayload = {
            testId,
            userId: user.userId,
            userName: user.name || "Student",
            userEmail: user.email,
            questionId,
            code,
            language: language || "javascript",
            capturedAt: now.toISOString(),
          };

          io.to(`admin:${testId}`).emit("admin:codeUpdate", adminCodePayload);
        } catch (e: any) {
          console.error("[code:snapshot error]", e.message);
        }
      });

      // User Final Completion
      socket.on("user:completed", async (payload: { testId: string }, callback) => {
        try {
          const { testId } = payload;
          if (!testId) return;

          await connectDB();

          await ResponseModel.updateMany(
            { testId, userId: user.userId },
            { $set: { isFinal: true } }
          );

          await UserTestAccess.findOneAndUpdate(
            { testId, userId: user.userId },
            { $set: { status: "completed" } }
          );

          const now = new Date();
          const completedData: UserCompletedPayload = {
            testId,
            userId: user.userId,
            userName: user.name || "Student",
            userEmail: user.email,
            completedAt: now.toISOString(),
          };

          io.to(`admin:${testId}`).emit("user:completed", completedData);

          if (callback) callback({ success: true });
        } catch (error: any) {
          if (callback) callback({ success: false, error: "Completion failed" });
        }
      });
    }

    socket.on("disconnect", () => {
      userSocketMap.delete(user.userId);
    });
  });

  ioInstance = io;
  return io;
}
