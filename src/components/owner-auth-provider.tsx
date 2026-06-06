import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface OwnerAuthContextType {
  isOwner: boolean;
  password: string;
  verifying: boolean;
  login: (password: string, actualPassword?: string) => boolean;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  verifyClerkUser: (email: string | null | undefined) => Promise<void>;
}

const OwnerAuthContext = createContext<OwnerAuthContextType | undefined>(undefined);

export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(true);
  const [authSource, setAuthSource] = useState<"clerk" | "password" | null>(null);

  // Clear any stale persisted auth on every load — owner must re-verify each session
  useEffect(() => {
    localStorage.removeItem("sweet_street_owner_auth");
    localStorage.removeItem("sweet_street_owner_pw");
  }, []);

  const login = (pw: string, actualPassword?: string) => {
    const verified = !actualPassword || pw === actualPassword;
    if (verified && pw) {
      setIsOwner(true);
      setPassword(pw);
      setAuthSource("password");
      return true;
    }
    return false;
  };

  const loginWithPassword = async (email: string, pw: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/owner/password-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem("ownerSessionGranted", "1");
        setIsOwner(true);
        setPassword(data.token ?? "");
        setAuthSource("password");
        setVerifying(false);
        return true;
      }
    } catch {}
    return false;
  };

  const logout = () => {
    setIsOwner(false);
    setPassword("");
    setAuthSource(null);
    sessionStorage.removeItem("ownerSessionGranted");
  };

  const verifyClerkUser = async (email: string | null | undefined) => {
    if (!email) {
      // Password-based sessions survive Clerk sign-out
      if (authSource === "password") {
        setVerifying(false);
        return;
      }
      setIsOwner(false);
      setPassword("");
      setVerifying(false);
      return;
    }

    if (!sessionStorage.getItem("ownerSessionGranted")) {
      setVerifying(false);
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/owner/api-token", {
        headers: { "x-clerk-user-email": email },
      });
      if (res.ok) {
        const data = await res.json();
        setIsOwner(true);
        setPassword(data.token ?? "");
        setAuthSource("clerk");
      } else {
        setIsOwner(false);
        setPassword("");
        setAuthSource(null);
      }
    } catch {
      setIsOwner(false);
      setAuthSource(null);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <OwnerAuthContext.Provider value={{ isOwner, password, verifying, login, loginWithPassword, logout, verifyClerkUser }}>
      {children}
    </OwnerAuthContext.Provider>
  );
}

export function useOwnerAuth() {
  const context = useContext(OwnerAuthContext);
  if (context === undefined) {
    throw new Error("useOwnerAuth must be used within an OwnerAuthProvider");
  }
  return context;
}
