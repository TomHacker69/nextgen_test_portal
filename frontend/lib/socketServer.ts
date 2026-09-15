import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { verifyToken, parseTokenFromHeaderOrCookie, JWTPayload } from "./auth";
import { checkRateLimit } from "./rateLimiter";
import { connectDB } from "./db";
import ResponseModel from "@/models/Response";
import Test from "@/models/Test";
import User from "@/models/User";
import { ClientSubmitAnswerPayload, AdminLiveUpdatePayload, UserCompletedPayload } from "@/types";

export interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
}

let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return ioInstance;
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

  // Wire up Redis Adapter for multi-instance horizontal scaling
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      console.log(`[Socket.IO] Connecting to Redis adapter at ${redisUrl}...`);
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy(times) {
          return Math.min(times * 100, 3000);
        },
      });
      const subClient = pubClient.duplicate();

      pubClient.on("error", (err) => console.error("[Redis Pub Error]", err.message));
      subClient.on("error", (err) => console.error("[Redis Sub Error]", err.message));

      await Promise.all([
        new Promise<void>((resolve) => pubClient.once("ready", () => resolve())),
        new Promise<void>((resolve) => subClient.once("ready", () => resolve())),
      ]);

      io.adapter(createAdapter(pubClient, subClient));
      console.log("[Socket.IO] Redis adapter initialized successfully across cluster.");
    } catch (err: any) {
      console.warn(
        `[Socket.IO] Warning: Failed to connect to Redis (${err?.message}). Running in-memory single-node mode.`
      );
    }
  } else {
    console.log(
      "[Socket.IO] REDIS_URL not specified. Running with default in-memory adapter (single instance)."
    );
  }

  // Socket Authentication Middleware
  io.use((socket: AuthenticatedSocket, next) => {
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

    // Role-specific room joining
    if (user.role === "admin") {
      // Admin joins monitoring room for a test
      socket.on("admin:join", (testId: string) => {
        if (!testId) return;
        const roomName = `admin:${testId}`;
        socket.join(roomName);
        console.log(`[Admin Socket] Admin ${user.email} joined ${roomName}`);
      });

      socket.on("admin:leave", (testId: string) => {
        if (!testId) return;
        socket.leave(`admin:${testId}`);
      });
    } else if (user.role === "user") {
      // Test-taker joins their assigned test room
      const userRoomId = user.roomId;
      if (userRoomId) {
        const testRoomName = `test:${userRoomId}`;
        socket.join(testRoomName);
        console.log(`[User Socket] Student ${user.email} joined ${testRoomName}`);
      }

      // Handle real-time answer submission
      socket.on("answer:submit", async (data: ClientSubmitAnswerPayload, callback) => {
        try {
          const { testId, questionId, selectedOption, questionIndex } = data;

          if (!testId || !questionId || !selectedOption) {
            if (callback) callback({ success: false, error: "Invalid payload" });
            return;
          }

          // Rate limit: Max 1 answer submit per second per socket to guard against rapid spam
          const rateCheck = checkRateLimit(`submit:${socket.id}`, 1, 1000);
          if (!rateCheck.allowed) {
            if (callback)
              callback({
                success: false,
                error: "Submitting too fast. Please wait a moment.",
              });
            return;
          }

          await connectDB();

          // Server-side validation: Ensure test exists and matches user's assigned roomId
          const test = await Test.findById(testId);
          if (!test) {
            if (callback) callback({ success: false, error: "Test not found" });
            return;
          }

          if (test.status !== "live") {
            if (callback) callback({ success: false, error: "Test is not live" });
            return;
          }

          if (test.roomId !== user.roomId) {
            if (callback) callback({ success: false, error: "Unauthorized for this room" });
            return;
          }

          // Upsert response atomically
          const now = new Date();
          await ResponseModel.findOneAndUpdate(
            {
              testId: test._id,
              userId: user.userId,
              questionId,
            },
            {
              $set: {
                selectedOption,
                answeredAt: now,
                isFinal: false,
              },
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
            }
          );

          // Broadcast to Admin live room instantly
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

          if (callback) {
            callback({ success: true, timestamp: now.toISOString() });
          }
        } catch (error: any) {
          console.error("[answer:submit error]", error);
          if (callback) callback({ success: false, error: "Submission failed" });
        }
      });

      // Handle final test completion submission
      socket.on("user:completed", async (payload: { testId: string }, callback) => {
        try {
          const { testId } = payload;
          if (!testId) return;

          await connectDB();

          // Mark all responses of this user for this test as isFinal: true
          await ResponseModel.updateMany(
            { testId, userId: user.userId },
            { $set: { isFinal: true } }
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
          console.error("[user:completed error]", error);
          if (callback) callback({ success: false, error: "Completion failed" });
        }
      });
    }

    socket.on("disconnect", () => {
      // Disconnect handled cleanly
    });
  });

  ioInstance = io;
  return io;
}
