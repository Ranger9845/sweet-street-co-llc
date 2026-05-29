import { useState } from "react";
import { useLocation } from "wouter";
import { useGetSettings } from "@workspace/api-client-react";
import { useOwnerAuth } from "@/components/owner-auth-provider";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function OwnerLogin() {
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { login } = useOwnerAuth();
  const { data: settings } = useGetSettings();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    const success = login(password, settings.ownerPassword);
    if (success) {
      setLocation("/owner");
    } else {
      toast({
        title: "Incorrect Password",
        description: "The password you entered is incorrect.",
        variant: "destructive"
      });
      setPassword("");
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md bg-white border border-border rounded-2xl shadow-sm">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="flex justify-center mb-2">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center p-3 shadow-sm">
              <img src="/logo.png" alt="Sweet Street Co" className="h-full w-full object-contain brightness-0 invert" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Sweet Street</CardTitle>
          <CardDescription className="text-base font-medium text-muted-foreground">Owner Portal Login</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground/70" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 rounded-xl border-border text-foreground placeholder:text-muted-foreground/70"
                  placeholder="Enter owner password"
                  autoFocus
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium transition-all duration-200" disabled={!settings || !password}>
              Access Dashboard
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
