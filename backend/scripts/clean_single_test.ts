import { connectDB, Test } from "@nextgen/db";
import mongoose from "mongoose";

async function updateTestInDb() {
  await connectDB();

  // 1. Delete extra tests
  const delRes = await Test.deleteMany({ roomId: "ROOM-ALGO-2026" });
  console.log("Deleted extra tests:", delRes.deletedCount);

  // 2. Update primary test
  const updateRes = await Test.updateOne(
    { roomId: "ROOM-CS-2026" },
    {
      $set: {
        title: "Comprehensive Technical Assessment (15 Aptitude, 10 ML, 5 Coding)",
        durationMinutes: 90,
        status: "live"
      }
    }
  );
  console.log("Updated primary test title:", updateRes.modifiedCount);

  // 3. Verify
  const tests = await Test.find({});
  console.log("\n=== ALL TESTS IN DATABASE ===");
  for (const t of tests) {
    console.log(`- Title: "${t.title}"`);
    console.log(`  Room ID: ${t.roomId}`);
    console.log(`  Status: ${t.status}`);
    console.log(`  Total Questions: ${t.questions.length}`);
  }

  await mongoose.disconnect();
}

updateTestInDb().catch(console.error);
