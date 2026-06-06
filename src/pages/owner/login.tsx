import { useLocation } from "wouter";
import { useOwnerAuth } from "@/components/owner-auth-provider";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Mail, Loader2, Eye, EyeOff } from "lucide-react";

const OWNER_EMAIL = "ldfarris2007@gmail.com";

function Logo() {
  return (
    <div className="text-center space-y-2">
      <div className="flex justify-center">
        <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center p-3 shadow-sm">
          <img src="/logo.png" alt="Sweet Street Co" className="h-full w-full object-contain brightness-0 invert" />
        </div>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground mt-3">Sweet Street</h1>
      <p className="text-sm text-muted-foreground">Owner Portal</p>
    </div>
  );
}

export default function OwnerLogin() {
  const { isOwner, verifying, loginWithPassword } = useOwnerAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState(OWNER_EMAIL);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOwner) setLocation("/owner");
  }, [isOwner, setLocation]);

  if (isOwner) return null;

  if (verifying) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = await loginWithPassword(email, password);
    if (!ok) setError("Invalid email or password.");
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/50 p-4 gap-8">
      <Logo />
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            className="pl-9 rounded-xl"
            autoComplete="email"
            required
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type={showPw ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            className="pl-9 pr-10 rounded-xl"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-destructive text-center">{error}</p>}
        <Button type="submit" className="w-full rounded-xl gap-2 h-11" disabled={loading || !email || !password}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {loading ? "Signing in…" : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
