import { createServer } from "http";
import next from "next";
import { initSocketServer } from "./lib/socketServer";
import { connectDB } from "./lib/db";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const rawOrigins =
  process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001";
const corsOrigins: string[] = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function bootstrap() {
  try {
    // 1. Connect MongoDB
    console.log("[Bootstrap] Connecting to MongoDB...");
    await connectDB();
    console.log("[Bootstrap] Connected to MongoDB successfully.");

    // 2. Prepare Next.js app
    console.log("[Bootstrap] Preparing Next.js application...");
    await app.prepare();

    // 3. Create HTTP Server
    const server = createServer((req, res) => {
      handle(req, res);
    });

    // 4. Initialize Socket.IO with Redis adapter and auth handlers
    console.log("[Bootstrap] Initializing Socket.IO server...");
    await initSocketServer(server, { corsOrigin: corsOrigins });

    // 5. Start listening
    server.listen(port, () => {
      console.log(`> Real-Time Test Portal ready on http://${hostname}:${port}`);
      console.log(`> Environment: ${dev ? "development" : "production"}`);
      console.log(`> Socket.IO endpoint: /socket.io`);
    });
  } catch (error) {
    console.error("[Bootstrap Error]", error);
    process.exit(1);
  }
}

bootstrap();
