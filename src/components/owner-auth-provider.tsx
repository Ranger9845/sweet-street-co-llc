import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const OWNER_EMAIL = "ldfarris2007@gmail.com";

interface OwnerAuthContextType {
  isOwner: boolean;
  password: string;
  verifying: boolean;
  login: (password: string, actualPassword?: string) => boolean;
  logout: () => void;
  /** Called by OwnerClerkSync (inside ClerkProvider) to authenticate via Clerk email */
  verifyClerkUser: (email: string | null | undefined) => Promise<void>;
}

const OwnerAuthContext = createContext<OwnerAuthContextType | undefined>(undefined);

export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(true);

  useEffect(() => {
    const stored = localStorage.getItem("sweet_street_owner_auth");
    const storedPw = localStorage.getItem("sweet_street_owner_pw");
    if (stored === "true") {
      setIsOwner(true);
      if (storedPw) setPassword(storedPw);
    }
    // Mark initial load done; Clerk sync will set verifying=false after it runs
    setVerifying(false);
  }, []);

  const login = (pw: string, actualPassword?: string) => {
    // When called from the server-verified login flow both args are the same pw.
    // Legacy path: if actualPassword differs, do a local compare.
    const verified = !actualPassword || pw === actualPassword;
    if (verified && pw) {
      setIsOwner(true);
      setPassword(pw);
      localStorage.setItem("sweet_street_owner_auth", "true");
      localStorage.setItem("sweet_street_owner_pw", pw);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsOwner(false);
    setPassword("");
    localStorage.removeItem("sweet_street_owner_auth");
    localStorage.removeItem("sweet_street_owner_pw");
  };

  const verifyClerkUser = async (email: string | null | undefined) => {
    if (!email) {
      // Clerk loaded but no signed-in user — stop verifying
      setVerifying(false);
      return;
    }

    // Already authenticated — check localStorage directly (avoids stale closure on isOwner)
    if (localStorage.getItem("sweet_street_owner_auth") === "true") {
      setVerifying(false);
      return;
    }

    // Fetch the API token from the server
    setVerifying(true);
    try {
      const res = await fetch("/api/owner/api-token", {
        headers: { "x-clerk-user-email": email },
      });
      if (res.ok) {
        const data = await res.json();
        const token: string = data.token ?? "";
        setIsOwner(true);
        setPassword(token);
        localStorage.setItem("sweet_street_owner_auth", "true");
        localStorage.setItem("sweet_street_owner_pw", token);
      } else {
        setIsOwner(false);
        setPassword("");
        localStorage.removeItem("sweet_street_owner_auth");
        localStorage.removeItem("sweet_street_owner_pw");
      }
    } catch {
      // Network error — fall back to localStorage state (already loaded above)
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
