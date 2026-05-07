import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@/types/api";
import { authApi } from "@/services";

const STORAGE_KEY = "filevault.session";

interface StoredSession {
  user: User;
  expires_at: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (new Date(parsed.expires_at).getTime() < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStored()?.user ?? null);
  const [isLoading, setLoading] = useState(false);

  // Refresh user info on mount if a session is present.
  useEffect(() => {
    const stored = readStored();
    if (stored && !user) setUser(stored.user);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback((u: User) => {
    const session: StoredSession = {
      user: u,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await authApi.logout();
    } finally {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      signIn,
      signOut,
    }),
    [user, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
