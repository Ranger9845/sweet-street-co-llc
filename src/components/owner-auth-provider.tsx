import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface OwnerAuthContextType {
  isOwner: boolean;
  verifying: boolean;
  password: string;
  loginDirect: (password: string) => void;
  logout: () => void;
}

const OwnerAuthContext = createContext<OwnerAuthContextType | undefined>(undefined);

export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [verifying, setVerifying] = useState<boolean>(true);

  useEffect(() => {
    const stored = localStorage.getItem("sweet_street_owner_auth");
    const storedPw = localStorage.getItem("sweet_street_owner_pw");
    if (stored === "true" && storedPw && storedPw !== "undefined" && storedPw !== "null") {
      fetch("/api/owner/verify", { method: "POST", headers: { "x-owner-password": storedPw } })
        .then((r) => {
          if (r.ok) {
            setIsOwner(true);
            setPassword(storedPw);
          } else {
            localStorage.removeItem("sweet_street_owner_auth");
            localStorage.removeItem("sweet_street_owner_pw");
          }
        })
        .catch(() => {
          // Network failure — trust cached session
          setIsOwner(true);
          setPassword(storedPw);
        })
        .finally(() => setVerifying(false));
    } else {
      localStorage.removeItem("sweet_street_owner_auth");
      localStorage.removeItem("sweet_street_owner_pw");
      setVerifying(false);
    }
  }, []);

  const loginDirect = (pw: string) => {
    setIsOwner(true);
    setPassword(pw);
    localStorage.setItem("sweet_street_owner_auth", "true");
    localStorage.setItem("sweet_street_owner_pw", pw);
  };

  const logout = () => {
    setIsOwner(false);
    setPassword("");
    localStorage.removeItem("sweet_street_owner_auth");
    localStorage.removeItem("sweet_street_owner_pw");
  };

  return (
    <OwnerAuthContext.Provider value={{ isOwner, verifying, password, loginDirect, logout }}>
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
