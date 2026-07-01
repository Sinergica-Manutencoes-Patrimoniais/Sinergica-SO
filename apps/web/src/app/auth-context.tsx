import { createContext, useCallback, useContext, useState } from "react";

interface AuthUser {
  name: string;
  email: string;
  role: "admin" | "escritorio" | "tecnico";
}

interface AuthCtx {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const STORAGE_KEY = "sinergica_os_user";

// DEV-ONLY bypass — substituir por Supabase Auth no Mês 2
const DEV_EMAIL = "trivia@triviastudio.com.br";
const DEV_PASSWORD = "Trivia123456";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 600)); // simula latência de rede
    if (email.toLowerCase() !== DEV_EMAIL || password !== DEV_PASSWORD) {
      throw new Error("Usuário ou senha inválidos");
    }
    const u: AuthUser = { name: "Trívia Studio", email: DEV_EMAIL, role: "admin" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
