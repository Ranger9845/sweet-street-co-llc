import { useUser } from "@clerk/react";

const DEV_EMAIL = "ldfarris2007@gmail.com";

/** True only for the developer's Clerk account — gates the Dev Console UI. */
export function useIsDevUser(): boolean {
  const { user, isLoaded } = useUser();
  if (!isLoaded || !user) return false;
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
  return !!email && email.toLowerCase() === DEV_EMAIL;
}

export function getDevEmail(): string {
  return DEV_EMAIL;
}
