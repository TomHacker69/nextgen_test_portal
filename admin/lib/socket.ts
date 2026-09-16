import { io, Socket } from "socket.io-client";
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@nextgen/shared-types";

let socket: Socket<ClientToServerEvents, ServerToClientEvents> | null = null;

export function getSocket(): Socket<ClientToServerEvents, ServerToClientEvents> {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000", {
      transports: ["websocket"],
      withCredentials: true,
      auth: {
        token: typeof window !== "undefined" ? getCookie("auth_token") : undefined,
      },
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : undefined;
}
