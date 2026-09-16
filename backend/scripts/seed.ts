import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Admin, User, Test, Question, ResponseModel, UserTestAccess } from "@nextgen/db";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nextgen_test_portal";

async function seed() {
  console.log("Connecting to MongoDB at:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB. Resetting seed collections...");

  await Admin.deleteMany({});
  await User.deleteMany({});
  await Test.deleteMany({});
  await Question.deleteMany({});
  await ResponseModel.deleteMany({});

  // 1. Create Default Admin Accounts
  const adminPasswordHash = await bcrypt.hash("Admin@1234", 10);
  const admin = await Admin.create({
    email: "admin@nextgen.local",
    passwordHash: adminPasswordHash,
    role: "admin",
  });
  // Also create testportal alias for convenience
  await Admin.create({
    email: "admin@testportal.com",
    passwordHash: adminPasswordHash,
    role: "admin",
  });
  console.log(`Created Admin: ${admin.email}`);

  // 2. Create Sample Test (Status 'live' so questions are unlocked immediately!)
  const roomId = "ROOM-CS-2026";
  const scheduledTime = new Date();

  const test = await Test.create({
    title: "Data Structures & Distributed Systems Assessment",
    scheduledStartTime: scheduledTime,
    durationMinutes: 60,
    status: "live", // Live status so candidate can answer questions right away!
    roomId,
    questions: [],
  });
  console.log(`Created Live Test: ${test.title} (ID: ${test._id}, Room: ${roomId})`);

  // 3. Create Questions
  const sampleQuestions = [
    {
      order: 1,
      text: "Which data structure uses LIFO (Last-In First-Out) principle?",
      options: [
        { key: "a", text: "Stack" },
        { key: "b", text: "Queue" },
        { key: "c", text: "Binary Tree" },
        { key: "d", text: "Linked List" },
      ],
      correctOption: "a",
    },
    {
      order: 2,
      text: "What is the worst-case time complexity of QuickSort?",
      options: [
        { key: "a", text: "O(n log n)" },
        { key: "b", text: "O(n^2)" },
        { key: "c", text: "O(n)" },
        { key: "d", text: "O(log n)" },
      ],
      correctOption: "b",
    },
    {
      order: 3,
      text: "Which protocol does WebSocket handshake upgrade from?",
      options: [
        { key: "a", text: "HTTP/1.1" },
        { key: "b", text: "FTP" },
        { key: "c", text: "SMTP" },
        { key: "d", text: "DNS" },
      ],
      correctOption: "a",
    },
    {
      order: 4,
      text: "In distributed databases, which theorem states you can only choose two between Consistency, Availability, and Partition Tolerance?",
      options: [
        { key: "a", text: "CAP Theorem" },
        { key: "b", text: "ACID Theorem" },
        { key: "c", text: "Amdahl's Law" },
        { key: "d", text: "BASE Theorem" },
      ],
      correctOption: "a",
    },
    {
      order: 5,
      text: "What is the primary benefit of Redis in high-concurrency systems?",
      options: [
        { key: "a", text: "In-memory sub-millisecond data access and pub/sub messaging" },
        { key: "b", text: "Cold storage of terabytes of relational data" },
        { key: "c", text: "CPU-bound heavy computations" },
        { key: "d", text: "Static file hosting" },
      ],
      correctOption: "a",
    },
  ];

  const questionDocs: mongoose.Types.ObjectId[] = [];
  for (const q of sampleQuestions) {
    const createdQ = await Question.create({
      testId: test._id,
      order: q.order,
      text: q.text,
      options: q.options as any,
      correctOption: q.correctOption as any,
    });
    if (createdQ) {
      questionDocs.push(createdQ._id as mongoose.Types.ObjectId);
    }
  }

  // Link questions to test
  test.questions = questionDocs;
  await test.save();
  console.log(`Attached ${questionDocs.length} questions to Test.`);

  // 4. Create Students / Candidates
  const studentPasswordHash = await bcrypt.hash("Student@1234", 10);
  const studentUserPassword = await bcrypt.hash("User@123456", 10);

  const student1 = await User.create({
    name: "Aarav Sharma",
    email: "student@testportal.com",
    passwordHash: studentUserPassword,
    roomId,
    mustChangePassword: false,
  });

  const student2 = await User.create({
    name: "Diya Patel",
    email: "student2@nextgen.local",
    passwordHash: studentPasswordHash,
    roomId,
    mustChangePassword: false,
  });

  // Create UserTestAccess for seeded candidates
  const testEnd = new Date(
    test.scheduledStartTime.getTime() + test.durationMinutes * 60 * 1000
  );

  for (const stu of [student1, student2]) {
    await UserTestAccess.create({
      testId: test._id,
      userId: stu._id,
      extraMinutes: 0,
      blocked: false,
      personalEndTime: testEnd,
      status: "not_started",
      lastSeenQuestionIndex: 0,
    });
  }

  console.log(`Created Students:`);
  console.log(`- ${student1.email} (Password: User@123456)`);
  console.log(`- ${student2.email} (Password: Student@1234)`);
  console.log("\n[SUCCESS] Node.js Database seeded successfully!");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
