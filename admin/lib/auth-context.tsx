import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import api from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";

export interface AdminSession {
  userId: string;
  email: string;
  role: "admin";
  name?: string;
  roomId?: string;
}

interface AuthContextType {
  session: AdminSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();

    function onUnauthorized() {
      setSession(null);
    }
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  async function checkSession() {
    try {
      const res = await api.get("/auth/me");
      setSession(res.data as AdminSession);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    await api.post("/auth/login", { email, password });
    await checkSession();
  }

  async function logout() {
    await api.post("/auth/logout");
    setSession(null);
    disconnectSocket();
  }

  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
