import type { ITestDoc } from "@nextgen/db";
import { Test, UserTestAccess, ResponseModel } from "@nextgen/db";
import { getIO } from "../sockets/socketServer";
import { connectDB } from "@nextgen/db";

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function clearScheduledTimer(key: string) {
  const timer = activeTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(key);
  }
}

/**
 * Arms a timer for when a test's scheduledStartTime arrives
 */
export function armTestStartTimer(testId: string, startTime: Date, roomId: string) {
  clearScheduledTimer(`start:${testId}`);

  const delayMs = startTime.getTime() - Date.now();

  const triggerStart = async () => {
    try {
      await connectDB();
      const test = await Test.findById(testId);
      if (test && test.status === "scheduled") {
        test.status = "live";
        await test.save();

        const io = getIO();
        if (io) {
          console.log(`[Scheduler] Auto-starting Test ${testId} for room test:${roomId}`);
          io.to(`test:${roomId}`).emit("test:started", {
            testId,
            roomId,
            startedAt: new Date().toISOString(),
          });
          io.to(`admin:${testId}`).emit("admin:testLive", { testId });
        }
      }
    } catch (err: any) {
      console.error(`[Scheduler] Error starting test ${testId}:`, err.message);
    }
  };

  if (delayMs <= 0) {
    triggerStart();
  } else {
    const timer = setTimeout(triggerStart, delayMs);
    activeTimers.set(`start:${testId}`, timer);
    console.log(`[Scheduler] Armed start timer for test ${testId} in ${Math.round(delayMs / 1000)}s`);
  }
}

/**
 * Arms an auto-submit timer for a specific user based on their personalEndTime
 */
export function armUserAutoSubmitTimer(
  testId: string,
  userId: string,
  personalEndTime: Date
) {
  const timerKey = `user-end:${testId}:${userId}`;
  clearScheduledTimer(timerKey);

  const delayMs = personalEndTime.getTime() - Date.now();

  const triggerAutoSubmit = async () => {
    try {
      await connectDB();
      const access = await UserTestAccess.findOne({ testId, userId });
      if (access && access.status !== "completed" && access.status !== "blocked") {
        access.status = "completed";
        await access.save();

        // Mark all responses of this user for this test as isFinal: true
        await ResponseModel.updateMany({ testId, userId }, { $set: { isFinal: true } });

        const io = getIO();
        if (io) {
          console.log(`[Scheduler] Auto-submitted test ${testId} for user ${userId} at personalEndTime`);
          io.to(`user:${userId}`).emit("test:autoSubmitted", {
            testId,
            message: "Time limit reached. Your responses have been submitted automatically.",
          });
          io.to(`admin:${testId}`).emit("user:completed", {
            testId,
            userId,
            autoSubmitted: true,
            completedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err: any) {
      console.error(`[Scheduler] Error auto-submitting for user ${userId}:`, err.message);
    }
  };

  if (delayMs <= 0) {
    triggerAutoSubmit();
  } else {
    const timer = setTimeout(triggerAutoSubmit, delayMs);
    activeTimers.set(timerKey, timer);
    console.log(
      `[Scheduler] Armed auto-submit timer for user ${userId} on test ${testId} in ${Math.round(
        delayMs / 1000
      )}s`
    );
  }
}

/**
 * Arms timers for a test (start + per-user personalEndTimes)
 */
export async function armTestTimer(test: ITestDoc) {
  const testId = test._id.toString();

  if (test.status === "scheduled") {
    armTestStartTimer(testId, test.scheduledStartTime, test.roomId);
  }

  // Load all enrolled users for this test and arm individual personalEndTime timers
  const accesses = await UserTestAccess.find({
    testId: test._id,
    status: { $in: ["not_started", "in_progress"] },
  });

  for (const acc of accesses) {
    armUserAutoSubmitTimer(testId, acc.userId.toString(), acc.personalEndTime);
  }
}

/**
 * Scans DB on boot and re-arms all scheduled/live tests and user timers
 */
export async function initSchedulerOnBoot() {
  try {
    await connectDB();
    console.log("[Scheduler] Boot scan: Re-arming active test and user timers...");

    const activeTests = await Test.find({
      status: { $in: ["scheduled", "live"] },
    });

    console.log(`[Scheduler] Found ${activeTests.length} active/scheduled tests.`);
    for (const t of activeTests) {
      await armTestTimer(t);
    }

    console.log("[Scheduler] Boot re-arming complete.");
  } catch (err: any) {
    console.error("[Scheduler Boot Error]", err.message);
  }
}
