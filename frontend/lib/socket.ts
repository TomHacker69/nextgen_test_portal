import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (socket && socket.connected) {
    return socket;
  }

  if (socket && !socket.connected) {
    socket.connect();
    return socket;
  }

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "", {
    path: "/socket.io",
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    withCredentials: true, // Sends httpOnly auth_token cookie
    auth: token ? { token } : undefined,
  });

  socket.on("connect", () => {
    console.log("[Socket Client] Connected with ID:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket Client] Disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.warn("[Socket Client] Connection error:", error.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
