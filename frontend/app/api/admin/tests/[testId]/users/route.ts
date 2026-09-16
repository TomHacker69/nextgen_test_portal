import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Test from "@/models/Test";
import User from "@/models/User";
import UserTestAccess from "@/models/UserTestAccess";
import { getSession, hashPassword } from "@/lib/auth";
import { armUserAutoSubmitTimer } from "@/lib/scheduler";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId } = await params;
    await connectDB();

    const accesses = await UserTestAccess.find({ testId })
      .populate("userId", "name email roomId")
      .lean();

    return NextResponse.json({ users: accesses });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch mapped users" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId } = await params;
    const { emails, defaultPassword } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: "At least one email is required" },
        { status: 400 }
      );
    }

    if (!defaultPassword || String(defaultPassword).trim().length < 6) {
      return NextResponse.json(
        { error: "A default test password of at least 6 characters is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const test = await Test.findById(testId);
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // Derive the test's absolute end time from scheduledStartTime + durationMinutes
    const testEnd = new Date(
      test.scheduledStartTime.getTime() + test.durationMinutes * 60 * 1000
    );

    // Save default password on test record
    test.defaultPassword = String(defaultPassword).trim();
    await test.save();

    const hashedPassword = await hashPassword(defaultPassword);
    const results = [];

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
        // Derive initial display name from email username
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
      armUserAutoSubmitTimer(test._id.toString(), user._id.toString(), access.personalEndTime);

      results.push({ email: user.email, userId: user._id, accessId: access._id });
    }

    return NextResponse.json({
      success: true,
      message: `Mapped ${results.length} users with default test password`,
      count: results.length,
      users: results,
    });
  } catch (error: any) {
    console.error("Map users error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to map users" },
      { status: 500 }
    );
  }
}
