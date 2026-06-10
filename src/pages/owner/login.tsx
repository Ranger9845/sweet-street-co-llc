import { useLocation } from "wouter";
import { useOwnerAuth } from "@/components/owner-auth-provider";
import { useUser, useClerk, useSignIn } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

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
    </div>
  );
}

// Clerk v6 useSignIn() returns { signIn, errors, fetchStatus } with the new signal API.
// Flow: signIn.create({ identifier }) → emailCode.sendCode() → emailCode.verifyCode({ code }) → finalize()
function OwnerSignInForm() {
  const { signIn, fetchStatus } = useSignIn();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(OWNER_EMAIL);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const loading = fetchStatus === "fetching";

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const { error: createErr } = await signIn.create({ identifier: email });
    if (createErr) { setError(createErr.message); return; }
    const { error: sendErr } = await signIn.emailCode.sendCode();
    if (sendErr) { setError(sendErr.message); return; }
    setStep("code");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const { error: verifyErr } = await signIn.emailCode.verifyCode({ code });
    if (verifyErr) { setError(verifyErr.message); return; }
    const { error: finalizeErr } = await signIn.finalize();
    if (finalizeErr) { setError(finalizeErr.message); }
    // On success, useUser() updates → OwnerLogin re-renders → shows "Open Owner Dashboard"
  };

  if (step === "code") {
    return (
      <form onSubmit={handleVerify} className="w-full max-w-xs space-y-4">
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">Check your email</p>
          <p className="text-xs text-muted-foreground">
            We sent a 6-digit code to <span className="font-medium">{email}</span>
          </p>
        </div>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
          className="text-center text-2xl tracking-widest font-mono rounded-xl h-14"
          autoFocus
          autoComplete="one-time-code"
        />
        {error && <p className="text-xs text-destructive text-center">{error}</p>}
        <Button type="submit" className="w-full rounded-xl gap-2 h-11" disabled={loading || code.length < 6}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {loading ? "Verifying…" : "Verify & Continue"}
        </Button>
        <button
          type="button"
          onClick={() => { setStep("email"); setCode(""); setError(""); signIn.reset(); }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mx-auto transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Use a different email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="w-full max-w-xs space-y-4">
      <p className="text-sm font-medium text-muted-foreground text-center">Owner Portal Login</p>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="email"
          placeholder="owner@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          className="pl-9 rounded-xl"
          autoComplete="email"
          required
        />
      </div>
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
      <Button type="submit" className="w-full rounded-xl gap-2 h-11" disabled={loading || !email}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {loading ? "Sending code…" : "Send verification code"}
      </Button>
    </form>
  );
}

export default function OwnerLogin() {
  const { isOwner, verifying, verifyClerkUser } = useOwnerAuth();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const [sessionGranted, setSessionGranted] = useState(() => !!sessionStorage.getItem("ownerSessionGranted"));

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;

  useEffect(() => {
    if (isOwner) setLocation("/owner");
  }, [isOwner, setLocation]);

  if (isOwner) return null;

  if (!isLoaded || (user && sessionGranted && verifying)) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Verification was attempted (via the button below) and the backend
  // rejected this email — it's not in the allowed owner emails list.
  if (user && sessionGranted) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted/50 p-4">
        <div className="w-full max-w-md bg-white border border-border rounded-2xl shadow-sm p-8 text-center space-y-5">
          <Logo />
          <p className="text-base font-medium text-muted-foreground">Owner Portal</p>
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
            <p className="text-sm font-medium text-destructive">This account doesn't have owner access.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Signed in as <span className="font-medium">{userEmail}</span>
            </p>
          </div>
          <Button variant="outline" className="w-full rounded-xl" onClick={() => signOut()}>
            Sign out and try again
          </Button>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/50 p-4 gap-6">
        <Logo />
        <div className="w-full max-w-xs space-y-3">
          <Button
            className="w-full rounded-xl gap-2"
            onClick={() => {
              sessionStorage.setItem("ownerSessionGranted", "1");
              setSessionGranted(true);
              verifyClerkUser(userEmail);
            }}
          >
            <Lock className="h-4 w-4" />
            Open Owner Dashboard
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Signed in as <span className="font-medium">{userEmail}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/50 p-4 gap-8">
      <Logo />
      <OwnerSignInForm />
    </div>
  );
}
