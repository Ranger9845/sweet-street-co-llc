import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/components/cart-provider";
import { CartFlyProvider } from "@/components/cart-fly";
import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import NotFound from "@/pages/not-found";
import { OwnerAuthProvider } from "@/components/owner-auth-provider";
import { SplashScreen } from "@/components/splash-screen";

// Customer pages
import Home from "@/pages/home";
import Checkout from "@/pages/checkout";
import OrderStatus from "@/pages/order-status";
import MyOrders from "@/pages/my-orders";
import OrderBoard from "@/pages/order-board";
import Rewards from "@/pages/rewards";

// Owner pages
import OwnerLogin from "@/pages/owner/login";
import OwnerDashboard from "@/pages/owner/dashboard";
import PastOrders from "@/pages/owner/past-orders";
import OrderDetail from "@/pages/owner/order-detail";
import MenuManagement from "@/pages/owner/menu-management";
import Discounts from "@/pages/owner/discounts";
import RewardsManagement from "@/pages/owner/rewards-management";
import ReviewsManagement from "@/pages/owner/reviews-management";
import OwnerPOS from "@/pages/pos";
import POSSetup from "@/pages/owner/pos-setup";
import Settings from "@/pages/owner/settings";
import SquarePOSResult from "@/pages/owner/square-pos-result";

const queryClient = new QueryClient();

const rawClerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const clerkPubKey = typeof rawClerkPubKey === "string" && rawClerkPubKey.trim().length > 0 ? rawClerkPubKey : undefined;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || undefined;

const clerkKeyIsValid = typeof clerkPubKey === "string" && /^(pk_test_|pk_live_)[A-Za-z0-9_-]{20,}$/.test(clerkPubKey);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function Router() {
  return (
    <Switch>
      {/* Customer routes */}
      <Route path="/" component={Home} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/order" component={Checkout} />
      <Route path="/order-status/:id" component={OrderStatus} />
      <Route path="/my-orders" component={MyOrders} />
      <Route path="/board" component={OrderBoard} />
      <Route path="/rewards" component={Rewards} />

      {/* Owner routes */}
      <Route path="/owner/login" component={OwnerLogin} />
      <Route path="/owner/orders/:id" component={OrderDetail} />
      <Route path="/owner/orders" component={PastOrders} />
      <Route path="/owner/menu" component={MenuManagement} />
      <Route path="/owner/discounts" component={Discounts} />
      <Route path="/owner/rewards" component={RewardsManagement} />
      <Route path="/owner/reviews" component={ReviewsManagement} />
      <Route path="/owner/pos" component={OwnerPOS} />
      <Route path="/owner/pos-setup" component={POSSetup} />
      <Route path="/owner/settings" component={Settings} />
      <Route path="/owner/square-pos-result" component={SquarePOSResult} />
      <Route path="/owner" component={OwnerDashboard} />

      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!clerkKeyIsValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div className="max-w-xl rounded-3xl border border-input/50 bg-muted p-8 shadow-lg">
          <h1 className="text-3xl font-semibold mb-4">Clerk configuration error</h1>
          <p className="mb-3 text-base leading-7 text-foreground/90">
            Your app is missing a valid Clerk publishable key. Please set
            <code className="bg-slate-900/10 rounded px-1.5 py-0.5 text-sm font-medium">VITE_CLERK_PUBLISHABLE_KEY</code>
            in <code className="bg-slate-900/10 rounded px-1.5 py-0.5 text-sm font-medium">.env.local</code>.
          </p>
          <p className="text-sm text-foreground/70">
            The current key is invalid or incomplete, so Clerk cannot load its JS bundle.
          </p>
        </div>
      </div>
    );
  }

  return (
      <ClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        routerPush={(to) => setLocation(stripBase(to))}
        routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <CartProvider>
            <CartFlyProvider>
              <Router />
              <Toaster />
            </CartFlyProvider>
          </CartProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen visible={showSplash} onDone={() => setShowSplash(false)} />}
      </AnimatePresence>
      <OwnerAuthProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
      </OwnerAuthProvider>
    </>
  );
}

export default App;
