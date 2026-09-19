import cors from "cors";
import express from "express";
import authRouter from "./routes/auth";
import testsRouter from "./routes/tests";
import testRouter from "./routes/test";
import questionsRouter from "./routes/questions";
import startRouter from "./routes/start";
import statsRouter from "./routes/stats";
import usersRouter from "./routes/users";
import blockRouter from "./routes/block";
import extraTimeRouter from "./routes/extraTime";
import codeRouter from "./routes/code";

export function createApp() {
  const app = express();

  const rawOrigins =
    process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001";
  const allowedOrigins: string[] = rawOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  // CORS: explicit allow-list (no wildcard when credentials are involved)
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // allow non-browser tooling (e.g. curl)
        if (
          allowedOrigins.includes(origin) ||
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ) {
          return callback(null, true);
        }
        console.warn(`[CORS] Rejected origin: ${origin}`);
        return callback(new Error("Not allowed by CORS"), false);
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Health + root
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/", (_req, res) =>
    res.json({ service: "nextgen-test-portal-api", status: "running" })
  );

  // Public auth routes
  app.use("/api/auth", authRouter);

  // Student-facing routes
  app.use("/api/test", testRouter);
  app.use("/api/code", codeRouter);

  // Admin routes
  app.use("/api/admin/tests", testsRouter);
  app.use("/api/admin/tests/:testId/questions", questionsRouter);
  app.use("/api/admin/tests/:testId/start", startRouter);
  app.use("/api/admin/tests/:testId/stats", statsRouter);
  app.use("/api/admin/tests/:testId/users", usersRouter);
  app.use("/api/admin/tests/:testId/users/:userId/block", blockRouter);
  app.use("/api/admin/tests/:testId/users/:userId/extra-time", extraTimeRouter);

  // 404 handler
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // Global error handler — always returns JSON, never crashes with HTML or plain text
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("[Unhandled Error]", err?.message || err);
      const statusCode = typeof err.status === "number" ? err.status : 500;
      return res.status(statusCode).json({
        error: err?.message || "Internal server error",
      });
    }
  );

  return app;
}
