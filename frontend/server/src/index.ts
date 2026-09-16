import http from "http";
import { connectDB } from "@nextgen/db";
import { createApp } from "./app";
import { initSocketServer } from "./sockets/socketServer";
import { initSchedulerOnBoot } from "./scheduler/scheduler";

const PORT = parseInt(process.env.PORT || "4000", 10);
const HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

const rawOrigins =
  process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001";
const corsOrigins: string[] = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

async function bootstrap() {
  try {
    // 1. Connect MongoDB
    console.log("[Bootstrap] Connecting to MongoDB...");
    await connectDB();
    console.log("[Bootstrap] Connected to MongoDB successfully.");

    // 2. Create Express app
    const app = createApp();

    // 3. Create HTTP server
    const server = http.createServer(app);

    // 4. Initialize Socket.IO (with CORS allow-list + Redis adapter)
    console.log("[Bootstrap] Initializing Socket.IO server...");
    await initSocketServer(server, { corsOrigin: corsOrigins });

    // 5. Re-arm active test/user timers from persisted DB state
    console.log("[Bootstrap] Re-arming scheduled timers...");
    await initSchedulerOnBoot();

    // 6. Start listening
    server.listen(PORT, HOSTNAME, () => {
      console.log(`[Bootstrap] API + Socket.IO ready on http://${HOSTNAME}:${PORT}`);
      console.log(`[Socket.IO] endpoint: /socket.io`);
    });
  } catch (error) {
    console.error("[Bootstrap Error]", error);
    process.exit(1);
  }
}

bootstrap();
