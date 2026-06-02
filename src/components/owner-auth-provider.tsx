import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface OwnerAuthContextType {
  isOwner: boolean;
  password: string;
  verifying: boolean;
  login: (password: string, actualPassword?: string) => boolean;
  logout: () => void;
  verifyClerkUser: (email: string | null | undefined) => Promise<void>;
}

const OwnerAuthContext = createContext<OwnerAuthContextType | undefined>(undefined);

export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(true);

  // Clear any stale persisted auth on every load — owner must re-verify via Clerk each session
  useEffect(() => {
    localStorage.removeItem("sweet_street_owner_auth");
    localStorage.removeItem("sweet_street_owner_pw");
  }, []);

  const login = (pw: string, actualPassword?: string) => {
    const verified = !actualPassword || pw === actualPassword;
    if (verified && pw) {
      setIsOwner(true);
      setPassword(pw);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsOwner(false);
    setPassword("");
  };

  const verifyClerkUser = async (email: string | null | undefined) => {
    if (!email) {
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
      } else {
        setIsOwner(false);
        setPassword("");
      }
    } catch {
      // Network error — deny access rather than silently allow
      setIsOwner(false);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <OwnerAuthContext.Provider value={{ isOwner, password, verifying, login, logout, verifyClerkUser }}>
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
