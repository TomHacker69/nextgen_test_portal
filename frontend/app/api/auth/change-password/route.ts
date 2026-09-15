import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Test from "@/models/Test";
import { getSession, hashPassword, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { newPassword, confirmPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newHash = await hashPassword(newPassword);
    user.passwordHash = newHash;
    user.mustChangePassword = false;
    await user.save();

    // Re-issue cookie with mustChangePassword = false
    await setAuthCookie({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: "user",
      roomId: user.roomId,
      mustChangePassword: false,
    });

    const test = await Test.findOne({ roomId: user.roomId });
    const redirectUrl = test ? `/test/${test._id}` : "/";

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
      redirectUrl,
    });
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to change password" },
      { status: 500 }
    );
  }
}
