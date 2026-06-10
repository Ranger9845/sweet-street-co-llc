import { Link, useLocation } from "wouter";
import { ReactNode, useEffect } from "react";
import { LayoutDashboard, MenuSquare, Settings, LogOut, Tag, Gift, History, Star, Package, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOwnerAuth } from "../owner-auth-provider";
import { useClerk } from "@clerk/react";
import { HelpBubble } from "@/components/help-bubble";
import { FeedbackWidget } from "@/components/feedback-widget";

export function OwnerLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { logout } = useOwnerAuth();
  const { signOut } = useClerk();

  // Log every owner dashboard page visit for diagnostics
  useEffect(() => {
    console.info(`[Owner Dashboard] Visited: ${location} at ${new Date().toISOString()}`);
  }, [location]);

  const navItems = [
    { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
    { href: "/owner/orders", label: "Past Orders", icon: History },
    { href: "/owner/menu", label: "Menu", icon: MenuSquare },
    { href: "/owner/discounts", label: "Discounts", icon: Tag },
    { href: "/owner/rewards", label: "Rewards", icon: Gift },
    { href: "/owner/reviews", label: "Reviews", icon: Star },
    { href: "/owner/inventory", label: "Inventory", icon: Package },
    { href: "/owner/db-stats", label: "Database", icon: Database },
    { href: "/owner/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-muted/50 font-sans text-foreground selection:bg-primary/20">
      <aside className="w-full md:w-72 bg-sidebar border-r border-border/80 flex flex-col h-auto md:min-h-[100dvh] shadow-[1px_0_10px_rgba(0,0,0,0.02)] z-10 sticky top-0">
        <div className="p-6 border-b border-border/60 flex items-center justify-between md:justify-start">
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="Sweet Street Co" className="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-sm" />
            <div className="hidden md:block">
              <span className="font-bold tracking-tight text-base block">Sweet Street</span>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Owner Portal</span>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1 p-4 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="min-w-fit md:min-w-0">
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-3 px-4 py-6 rounded-xl font-medium transition-all duration-200 ${
                    isActive 
                      ? "bg-primary text-white hover:bg-primary/90 hover:text-white shadow-md" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "text-muted-foreground/50" : "text-muted-foreground/70"}`} />
                  <span className="hidden md:inline">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/60 mt-auto hidden md:block bg-muted/50/50">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 px-4 py-6 rounded-xl font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors" 
            onClick={() => { logout(); signOut(); }}
          >
            <LogOut className="h-5 w-5 text-red-500" />
            <span>Log out</span>
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden p-4 md:p-8 lg:p-10">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      <HelpBubble isOwner={true} />
      <FeedbackWidget />
    </div>
  );
}
