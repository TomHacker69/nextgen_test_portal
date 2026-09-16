"use client";

import { AuthGuard } from "@/components/AuthGuard";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ILiveParticipantRow, AdminLiveUpdatePayload } from "@nextgen/shared-types";
import { useParams } from "next/navigation";

export default function LiveMonitorPage() {
  const params = useParams();
  const testId = params.testId as string;

  return (
    <AuthGuard>
      <AdminLayout>
        <LiveMonitorContent testId={testId} />
      </AdminLayout>
    </AuthGuard>
  );
}

function LiveMonitorContent({ testId }: { testId: string }) {
  const [participants, setParticipants] = useState<Record<string, ILiveParticipantRow>>(
    {}
  );
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000", {
      transports: ["websocket"],
      withCredentials: true,
    });

    s.emit("admin:join", testId);

    s.on("admin:update", (payload: AdminLiveUpdatePayload) => {
      setParticipants((prev) => ({
        ...prev,
        [payload.userId]: {
          ...prev[payload.userId],
          userId: payload.userId,
          userName: payload.userName,
          userEmail: payload.userEmail,
          questionId: payload.questionId,
          questionIndex: payload.questionIndex,
          answers: {
            ...prev[payload.userId]?.answers,
            [payload.questionId]: payload.selectedOption,
          },
          lastAnsweredAt: payload.answeredAt,
        },
      }));
    });

    s.on("admin:codeUpdate", (payload) => {
      setParticipants((prev) => ({
        ...prev,
        [payload.userId]: {
          ...prev[payload.userId],
          userId: payload.userId,
          userName: payload.userName,
          userEmail: payload.userEmail,
          questionId: payload.questionId,
          codeSnapshots: {
            ...prev[payload.userId]?.codeSnapshots,
            [payload.questionId]: {
              code: payload.code,
              language: payload.language,
              capturedAt: payload.capturedAt,
            },
          },
        },
      }));
    });

    s.on("admin:codeGraded", (payload) => {
      setParticipants((prev) => ({
        ...prev,
        [payload.userId]: {
          ...prev[payload.userId],
          scores: {
            ...prev[payload.userId]?.scores,
            [payload.questionId]: payload.score,
          },
          gradingStatus: {
            ...prev[payload.userId]?.gradingStatus,
            [payload.questionId]: "graded",
          },
        },
      }));
    });

    s.on("admin:userBlocked", (payload) => {
      setParticipants((prev) => ({
        ...prev,
        [payload.userId]: {
          ...prev[payload.userId],
          blocked: true,
        },
      }));
    });

    s.on("admin:timeExtended", (payload) => {
      setParticipants((prev) => ({
        ...prev,
        [payload.userId]: {
          ...prev[payload.userId],
          extraMinutes: (prev[payload.userId]?.extraMinutes || 0) + payload.extraMinutes,
          personalEndTime: payload.personalEndTime,
        },
      }));
    });

    s.on("user:completed", (payload) => {
      setParticipants((prev) => ({
        ...prev,
        [payload.userId]: {
          ...prev[payload.userId],
          userId: payload.userId,
          isCompleted: true,
        },
      }));
    });

    setSocket(s);

    return () => {
      s.emit("admin:leave", testId);
      s.disconnect();
    };
  }, [testId]);

  const participantList = Object.values(participants);
  const liveCount = participantList.filter((p) => !p.isCompleted).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Live Test Monitoring</h2>
        <p className="text-sm text-muted-foreground">
          Test ID: {testId} · {liveCount} active,{" "}
          {participantList.filter((p) => p.isCompleted).length} completed
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Participants ({participantList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b">Student</th>
                  <th className="text-left p-2 border-b">Email</th>
                  <th className="text-left p-2 border-b">Q#</th>
                  <th className="text-left p-2 border-b">Status</th>
                  <th className="text-left p-2 border-b">Progress</th>
                </tr>
              </thead>
              <tbody>
                {participantList.map((p) => (
                  <tr key={p.userId} className={p.blocked ? "bg-red-50" : undefined}>
                    <td className="p-2 border-b">{p.name || p.userId}</td>
                    <td className="p-2 border-b">{p.email || "-"}</td>
                    <td className="p-2 border-b">{p.currentQuestionIndex + 1 || 1}</td>
                    <td className="p-2 border-b">
                      {p.blocked ? "Blocked" : p.isCompleted ? "Completed" : "Active"}
                    </td>
                    <td className="p-2 border-b">
                      {p.currentQuestionIndex}/{p.totalQuestions || "?"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
