import { Router, type Request, type Response } from "express";
import { connectDB } from "@nextgen/db";
import { Admin, User, Test } from "@nextgen/db";
import {
  getSessionFromReq,
  hashPassword,
  comparePassword,
  setAuthCookie,
  clearAuthCookie,
} from "../middleware/auth";
import { checkRateLimit } from "../middleware/rateLimiter";

const router = Router();

function getIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (Array.isArray(xff)) return xff[0] || "127.0.0.1";
  if (typeof xff === "string") return xff;
  return req.socket?.remoteAddress || "127.0.0.1";
}

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const ip = getIp(req);
    const body = req.body || {};
    const { email, password } = body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    const trimmedEmail = String(email).toLowerCase().trim();

    // Brute force protection: max 10 attempts per minute per IP + email
    const rateCheck = checkRateLimit(`login:${ip}:${trimmedEmail}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Too many login attempts. Please try again in ${Math.ceil(
          rateCheck.retryAfterMs / 1000
        )} seconds.`,
      });
    }

    await connectDB();

    // 1. Check if user is Admin
    const admin = await Admin.findOne({ email: trimmedEmail });
    if (admin) {
      const match = await comparePassword(password, admin.passwordHash);
      if (!match) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      setAuthCookie(res, {
        userId: admin._id.toString(),
        email: admin.email,
        role: "admin",
      });

      return res.json({ success: true, role: "admin", redirectUrl: "/admin" });
    }

    // 2. Check if student User
    const user = await User.findOne({ email: trimmedEmail });
    if (user) {
      const match = await comparePassword(password, user.passwordHash);
      if (!match) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      setAuthCookie(res, {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        role: "user",
        roomId: user.roomId,
        mustChangePassword: user.mustChangePassword,
      });

      if (user.mustChangePassword) {
        return res.json({
          success: true,
          role: "user",
          mustChangePassword: true,
          redirectUrl: "/change-password",
        });
      }

      // Find the test for the user's roomId
      const test = await Test.findOne({ roomId: user.roomId });
      const testRedirect = test ? `/test/${test._id}` : "/";

      return res.json({
        success: true,
        role: "user",
        mustChangePassword: false,
        redirectUrl: testRedirect,
      });
    }

    return res.status(401).json({ error: "Invalid email or password" });
  } catch (error: any) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.json({ success: true });
});

// GET /api/auth/me
router.get("/me", (req: Request, res: Response) => {
  const session = getSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ authenticated: false, user: null });
  }
  return res.json({ authenticated: true, user: session });
});

// POST /api/auth/change-password
router.post("/change-password", async (req: Request, res: Response) => {
  try {
    const session = getSessionFromReq(req);
    if (!session || session.role !== "user") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { newPassword, confirmPassword } = req.body || {};

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newHash = await hashPassword(newPassword);
    user.passwordHash = newHash;
    user.mustChangePassword = false;
    await user.save();

    setAuthCookie(res, {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: "user",
      roomId: user.roomId,
      mustChangePassword: false,
    });

    const test = await Test.findOne({ roomId: user.roomId });
    const redirectUrl = test ? `/test/${test._id}` : "/";

    return res.json({
      success: true,
      message: "Password updated successfully",
      redirectUrl,
    });
  } catch (error: any) {
    console.error("Change password error:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to change password" });
  }
});

export default router;
