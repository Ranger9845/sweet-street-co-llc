import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface OwnerAuthContextType {
  isOwner: boolean;
  password: string;
  login: (password: string, actualPassword?: string) => boolean;
  logout: () => void;
}

const OwnerAuthContext = createContext<OwnerAuthContextType | undefined>(undefined);

export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("sweet_street_owner_auth");
    const storedPw = localStorage.getItem("sweet_street_owner_pw");
    if (stored === "true") {
      setIsOwner(true);
      if (storedPw) setPassword(storedPw);
    }
  }, []);

  const login = (pw: string, actualPassword?: string) => {
    if (actualPassword && pw === actualPassword) {
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

  return (
    <OwnerAuthContext.Provider value={{ isOwner, password, login, logout }}>
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
