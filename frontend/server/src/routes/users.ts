import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { Test, User, UserTestAccess } from "@nextgen/db";
import { getSessionFromReq, hashPassword } from "../middleware/auth";
import { armUserAutoSubmitTimer } from "../scheduler/scheduler";

const router = Router();

// GET / → list users mapped to a test (admin)
router.get("/", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { testId } = req.params;
    await connectDB();

    const accesses = await UserTestAccess.find({ testId })
      .populate("userId", "name email roomId")
      .lean();

    return res.json({ users: accesses });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to fetch mapped users" });
  }
});

// POST / → map (create/fill) users for a test (admin)
// Body: { emails: string[], defaultPassword: string }
router.post("/", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { testId } = req.params;
    const { emails, defaultPassword } = req.body || {};

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one email is required" });
    }

    if (!defaultPassword || String(defaultPassword).trim().length < 6) {
      return res.status(400).json({
        error: "A default test password of at least 6 characters is required",
      });
    }

    await connectDB();

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Derive the test's absolute end time from scheduledStartTime + durationMinutes
    const testEnd = new Date(
      test.scheduledStartTime.getTime() + test.durationMinutes * 60 * 1000
    );

    // Save default password on test record
    test.defaultPassword = String(defaultPassword).trim();
    await test.save();

    const hashedPassword = await hashPassword(defaultPassword);
    const results: any[] = [];

    // Parse and sanitize emails
    const cleanEmails = Array.from(
      new Set(
        emails
          .map((e: string) => String(e).toLowerCase().trim())
          .filter((e: string) => e.length > 0 && e.includes("@"))
      )
    );

    for (const email of cleanEmails) {
      let user = await User.findOne({ email });
      if (!user) {
        const namePart = email.split("@")[0].replace(/[._-]/g, " ");
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

        user = await User.create({
          name: formattedName,
          email,
          passwordHash: hashedPassword,
          mustChangePassword: true,
          roomId: test.roomId,
        });
      } else {
        // Update user's password and room for this test
        user.passwordHash = hashedPassword;
        user.roomId = test.roomId;
        await user.save();
      }

      // Upsert UserTestAccess
      const access = await UserTestAccess.findOneAndUpdate(
        { testId: test._id, userId: user._id },
        {
          $setOnInsert: {
            extraMinutes: 0,
            blocked: false,
            personalEndTime: testEnd,
            status: "not_started",
            lastSeenQuestionIndex: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Arm auto-submit timer for this user
      armUserAutoSubmitTimer(
        test._id.toString(),
        user._id.toString(),
        access.personalEndTime
      );

      results.push({ email: user.email, userId: user._id, accessId: access._id });
    }

    return res.json({
      success: true,
      message: `Mapped ${results.length} users with default test password`,
      count: results.length,
      users: results,
    });
  } catch (error: any) {
    console.error("Map users error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to map users" });
  }
});

export default router;
