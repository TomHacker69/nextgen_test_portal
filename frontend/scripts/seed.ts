import mongoose from "mongoose";
import Admin from "../models/Admin";
import User from "../models/User";
import Test from "../models/Test";
import Question from "../models/Question";
import ResponseModel from "../models/Response";
import { hashPassword } from "../lib/auth";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nextgen_test_portal";

async function seed() {
  console.log("Connecting to MongoDB at:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB. Clearing existing seed data...");

  await Admin.deleteMany({});
  await User.deleteMany({});
  await Test.deleteMany({});
  await Question.deleteMany({});
  await ResponseModel.deleteMany({});

  // 1. Create Admin
  const adminPasswordHash = await hashPassword("Admin@123456");
  const admin = await Admin.create({
    email: "admin@testportal.com",
    passwordHash: adminPasswordHash,
    role: "admin",
  });
  console.log(`Created Admin: ${admin.email}`);

  // 2. Create Sample Test
  const roomId = "ROOM-CS-2026";
  const scheduledTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes in future

  const test = await Test.create({
    title: "National Cloud Architecture & Distributed Systems Olympiad",
    scheduledStartTime: scheduledTime,
    durationMinutes: 30,
    status: "scheduled",
    roomId,
    questions: [],
  });

  // 3. Create Questions
  const sampleQuestions: Array<{
    order: number;
    text: string;
    options: Array<{ key: "a" | "b" | "c" | "d"; text: string }>;
    correctOption: "a" | "b" | "c" | "d";
  }> = [
    {
      order: 1,
      text: "Which protocol does WebSocket handshake upgrade from?",
      options: [
        { key: "a", text: "HTTP/1.1 or HTTP/2" },
        { key: "b", text: "FTP" },
        { key: "c", text: "SMTP" },
        { key: "d", text: "DNS" },
      ],
      correctOption: "a",
    },
    {
      order: 2,
      text: "Why is the Redis adapter required when scaling Socket.IO horizontally across multiple nodes?",
      options: [
        { key: "a", text: "To replace MongoDB as the primary database" },
        { key: "b", text: "To broadcast socket events across pods using Redis Pub/Sub" },
        { key: "c", text: "To compress JSON payloads before sending" },
        { key: "d", text: "To encrypt TLS certificates at the edge" },
      ],
      correctOption: "b",
    },
    {
      order: 3,
      text: "What does the 'httpOnly' flag in JWT cookies protect against?",
      options: [
        { key: "a", text: "Cross-Site Request Forgery (CSRF)" },
        { key: "b", text: "Cross-Site Scripting (XSS) token theft by client scripts" },
        { key: "c", text: "SQL Injection attacks" },
        { key: "d", text: "DDoS volumetric flooding" },
      ],
      correctOption: "b",
    },
    {
      order: 4,
      text: "In MongoDB, what type of index ensures a student can re-answer without creating duplicate responses?",
      options: [
        { key: "a", text: "Single field index on answeredAt" },
        { key: "b", text: "Unique compound index on { testId: 1, userId: 1, questionId: 1 }" },
        { key: "c", text: "Text index on selectedOption" },
        { key: "d", text: "Geospatial 2dsphere index" },
      ],
      correctOption: "b",
    },
    {
      order: 5,
      text: "Which HTTP status code should be returned when a client exceeds rate limits?",
      options: [
        { key: "a", text: "400 Bad Request" },
        { key: "b", text: "403 Forbidden" },
        { key: "c", text: "429 Too Many Requests" },
        { key: "d", text: "503 Service Unavailable" },
      ],
      correctOption: "c",
    },
    {
      order: 6,
      text: "In Next.js App Router, where should WebSocket persistent connections ideally be held?",
      options: [
        { key: "a", text: "Inside Next.js Edge Middleware" },
        { key: "b", text: "Inside standard Serverless API Route functions" },
        { key: "c", text: "In a persistent long-running Node server (e.g. server.ts)" },
        { key: "d", text: "Inside React Server Component render passes" },
      ],
      correctOption: "c",
    },
    {
      order: 7,
      text: "What is the primary benefit of virtualizing a table with 500+ rows in the DOM?",
      options: [
        { key: "a", text: "It bypasses CSS rendering rules" },
        { key: "b", text: "It only renders visible DOM nodes, preventing memory leaks and frame drops" },
        { key: "c", text: "It automatically saves rows to IndexedDB" },
        { key: "d", text: "It converts HTML tables to WebGL canvas" },
      ],
      correctOption: "b",
    },
    {
      order: 8,
      text: "When bcrypt hashes a password, what does the 'salt' accomplish?",
      options: [
        { key: "a", text: "It compresses the password to save disk space" },
        { key: "b", text: "It prevents precomputed rainbow table attacks" },
        { key: "c", text: "It speeds up hash computation time" },
        { key: "d", text: "It enables reversible decryption" },
      ],
      correctOption: "b",
    },
  ];

  const questionIds: mongoose.Types.ObjectId[] = [];
  for (const qData of sampleQuestions) {
    const q = await Question.create({
      testId: test._id,
      order: qData.order,
      text: qData.text,
      options: qData.options,
      correctOption: qData.correctOption,
    });
    questionIds.push(q._id as mongoose.Types.ObjectId);
  }

  test.questions = questionIds as any;
  await test.save();
  console.log(`Created Test "${test.title}" with ${questionIds.length} questions. Room: ${roomId}`);

  // 4. Create Sample Test-Takers (Users)
  const defaultUserPasswordHash = await hashPassword("User@123456");

  // User 1: Demo user ready to test without forced password reset
  await User.create({
    name: "Alex Rivera (Demo Student)",
    email: "student@testportal.com",
    passwordHash: defaultUserPasswordHash,
    mustChangePassword: false, // directly tests taking flow
    roomId,
  });

  // User 2: First-time user testing forced password reset flow
  await User.create({
    name: "Jordan Lee (First-Time)",
    email: "newuser@testportal.com",
    passwordHash: defaultUserPasswordHash,
    mustChangePassword: true, // triggers /change-password
    roomId,
  });

  // Create 48 additional cohort students assigned to the room
  const studentBatch = [];
  for (let i = 1; i <= 48; i++) {
    const padded = String(i).padStart(2, "0");
    studentBatch.push({
      name: `Student Candidate #${padded}`,
      email: `candidate${padded}@testportal.com`,
      passwordHash: defaultUserPasswordHash,
      mustChangePassword: false,
      roomId,
    });
  }
  await User.insertMany(studentBatch);
  console.log(`Created 50 test-taker candidate accounts.`);

  console.log("\n==========================================");
  console.log(" SEED COMPLETED SUCCESSFULLY!");
  console.log("==========================================");
  console.log("Admin Account:");
  console.log("  Email:    admin@testportal.com");
  console.log("  Password: Admin@123456");
  console.log("\nDemo Ready Student:");
  console.log("  Email:    student@testportal.com");
  console.log("  Password: User@123456");
  console.log("\nNew Student (Forced Password Reset Test):");
  console.log("  Email:    newuser@testportal.com");
  console.log("  Password: User@123456");
  console.log("==========================================\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
