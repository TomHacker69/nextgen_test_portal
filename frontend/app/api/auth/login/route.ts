import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Admin from "@/models/Admin";
import User from "@/models/User";
import Test from "@/models/Test";
import { comparePassword, setAuthCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimiter";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const trimmedEmail = String(email).toLowerCase().trim();

    // Brute force protection: max 10 attempts per minute per IP + email
    const rateCheck = checkRateLimit(`login:${ip}:${trimmedEmail}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${Math.ceil(
            rateCheck.retryAfterMs / 1000
          )} seconds.`,
        },
        { status: 429 }
      );
    }

    await connectDB();

    // 1. Check if user is Admin
    const admin = await Admin.findOne({ email: trimmedEmail });
    if (admin) {
      const match = await comparePassword(password, admin.passwordHash);
      if (!match) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      await setAuthCookie({
        userId: admin._id.toString(),
        email: admin.email,
        role: "admin",
      });

      return NextResponse.json({
        success: true,
        role: "admin",
        redirectUrl: "/admin",
      });
    }

    // 2. Check if student User
    const user = await User.findOne({ email: trimmedEmail });
    if (user) {
      const match = await comparePassword(password, user.passwordHash);
      if (!match) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      await setAuthCookie({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        role: "user",
        roomId: user.roomId,
        mustChangePassword: user.mustChangePassword,
      });

      if (user.mustChangePassword) {
        return NextResponse.json({
          success: true,
          role: "user",
          mustChangePassword: true,
          redirectUrl: "/change-password",
        });
      }

      // Find the test for the user's roomId
      const test = await Test.findOne({ roomId: user.roomId });
      const testRedirect = test ? `/test/${test._id}` : "/";

      return NextResponse.json({
        success: true,
        role: "user",
        mustChangePassword: false,
        redirectUrl: testRedirect,
      });
    }

    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
