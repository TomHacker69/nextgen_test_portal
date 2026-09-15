import { io } from "socket.io-client";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Test from "../models/Test";
import Question from "../models/Question";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nextgen_test_portal";
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-in-production-123456";
const TARGET_SERVER = process.env.SERVER_URL || "http://localhost:3000";

const TOTAL_BOTS = parseInt(process.env.BOTS || "50", 10); // default 50 bots, can pass BOTS=500

async function simulate() {
  console.log(`Starting Concurrency Load Simulator with ${TOTAL_BOTS} virtual test-takers...`);
  await mongoose.connect(MONGODB_URI);

  const test = await Test.findOne({ status: "live" }) || await Test.findOne();
  if (!test) {
    console.error("No test found. Please run 'npm run seed' first.");
    process.exit(1);
  }

  const questions = await Question.find({ testId: test._id }).sort({ order: 1 });
  console.log(`Targeting Test: "${test.title}" (Room: ${test.roomId}) with ${questions.length} questions.`);

  const sockets: Array<{ client: any; userId: string; name: string; index: number }> = [];

  for (let i = 1; i <= TOTAL_BOTS; i++) {
    const padded = String(i).padStart(3, "0");
    const userId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign(
      {
        userId,
        email: `bot_${padded}@simulate.io`,
        name: `Virtual Test-Taker #${padded}`,
        role: "user",
        roomId: test.roomId,
        mustChangePassword: false,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const client = io(TARGET_SERVER, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });

    sockets.push({ client, userId, name: `Virtual Test-Taker #${padded}`, index: i });
  }

  console.log(`Initialized ${sockets.length} client sockets. Waiting for connection...`);

  await new Promise((res) => setTimeout(res, 2000));

  // Simulate staggered answers
  console.log("Simulating realistic live test answers...");

  for (let qIdx = 0; qIdx < questions.length; qIdx++) {
    const q = questions[qIdx];
    console.log(`\n>>> Answering Question ${qIdx + 1}/${questions.length}: "${q.text.substring(0, 40)}..."`);

    for (const item of sockets) {
      const options = ["a", "b", "c", "d"] as const;
      const chosen = options[Math.floor(Math.random() * options.length)];

      item.client.emit("answer:submit", {
        testId: test._id.toString(),
        questionId: q._id.toString(),
        selectedOption: chosen,
        questionIndex: qIdx,
      });

      // slight jitter to simulate realistic concurrent arrivals
      await new Promise((res) => setTimeout(res, 20));
    }

    await new Promise((res) => setTimeout(res, 1500));
  }

  console.log("\nAll bots completed answers. Sending completion events...");
  for (const item of sockets) {
    item.client.emit("user:completed", { testId: test._id.toString() });
  }

  console.log("Load simulation completed successfully!");
  setTimeout(() => {
    for (const item of sockets) item.client.disconnect();
    mongoose.disconnect();
    process.exit(0);
  }, 3000);
}

simulate().catch((e) => {
  console.error("Simulation error:", e);
  process.exit(1);
});
