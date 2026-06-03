import { useLocation } from "wouter";
import { useOwnerAuth } from "@/components/owner-auth-provider";
import { useUser, useClerk, SignIn } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useEffect } from "react";

const OWNER_EMAIL = "ldfarris2007@gmail.com";

export default function OwnerLogin() {
  const { isOwner, verifyClerkUser } = useOwnerAuth();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const userEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  const isOwnerEmail = userEmail?.toLowerCase() === OWNER_EMAIL.toLowerCase();

  // If already authenticated as owner, redirect immediately
  useEffect(() => {
    if (isOwner) {
      setLocation("/owner");
    }
  }, [isOwner, setLocation]);

  // Also redirect if Clerk user has owner email and isOwner just resolved
  if (isOwner) {
    return null; // useEffect redirect will fire
  }

  // Clerk hasn't loaded yet — show nothing to avoid flash
  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Signed in as the wrong account
  if (user && !isOwnerEmail) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-muted/50 p-4">
        <div className="w-full max-w-md bg-white border border-border rounded-2xl shadow-sm p-8 text-center space-y-5">
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center p-3 shadow-sm">
              <img src="/logo.png" alt="Sweet Street Co" className="h-full w-full object-contain brightness-0 invert" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sweet Street</h1>
          <p className="text-base font-medium text-muted-foreground">Owner Portal</p>
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3">
            <p className="text-sm font-medium text-destructive">
              This account doesn't have owner access.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Signed in as <span className="font-medium">{userEmail}</span>
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => signOut()}
          >
            Sign out and try again
          </Button>
        </div>
      </div>
    );
  }

  // Signed in as the owner email but no active dashboard session (new tab/window).
  // Require an explicit click to grant access so closing the browser tab acts as a sign-out.
  if (user && isOwnerEmail) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/50 p-4 gap-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center p-3 shadow-sm">
              <img src="/logo.png" alt="Sweet Street Co" className="h-full w-full object-contain brightness-0 invert" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-3">Sweet Street</h1>
          <p className="text-base font-medium text-muted-foreground">Owner Portal</p>
        </div>
        <div className="w-full max-w-xs space-y-3">
          <Button
            className="w-full rounded-xl gap-2"
            onClick={() => {
              sessionStorage.setItem("ownerSessionGranted", "1");
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

  // Not signed in — show Clerk SignIn
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/50 p-4 gap-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center p-3 shadow-sm">
            <img src="/logo.png" alt="Sweet Street Co" className="h-full w-full object-contain brightness-0 invert" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-3">Sweet Street</h1>
        <p className="text-base font-medium text-muted-foreground">Owner Portal Login</p>
      </div>
      <SignIn
        routing="hash"
        forceRedirectUrl="/owner/login"
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "rounded-2xl shadow-sm border border-border",
          },
        }}
      />
    </div>
  );
}
