import { CustomerLayout } from "@/components/layout/customer-layout";
import { formatSize } from "@/components/cart-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  Clock,
  ChefHat,
  CheckCircle2,
  PackageCheck,
  Receipt,
  ChevronRight,
  XCircle,
  LogIn,
  Snowflake,
  Flame,
} from "lucide-react";
import { BubbleCupLoader } from "@/components/bubble-cup-loader";

type OrderItem = {
  menuItemId: number;
  menuItemName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  temperature?: "hot" | "cold" | null;
  specialInstructions?: string | null;
};

type Order = {
  id: number;
  customerName: string;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  items: OrderItem[];
  totalAmount: number;
  discountAmount: number;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
};

const STATUS_META: Record<
  Order["status"],
  { label: string; tone: string; Icon: typeof Clock }
> = {
  pending: {
    label: "Received",
    tone: "bg-amber-100 text-amber-800 border-amber-200",
    Icon: Clock,
  },
  preparing: {
    label: "Being made",
    tone: "bg-blue-100 text-blue-800 border-blue-200",
    Icon: ChefHat,
  },
  ready: {
    label: "Ready for pickup",
    tone: "bg-green-100 text-green-800 border-green-200",
    Icon: CheckCircle2,
  },
  completed: {
    label: "Picked up",
    tone: "bg-slate-100 text-slate-700 border-slate-200",
    Icon: PackageCheck,
  },
  cancelled: {
    label: "Cancelled",
    tone: "bg-rose-100 text-rose-800 border-rose-200",
    Icon: XCircle,
  },
};

const ACTIVE_STATUSES: Order["status"][] = ["pending", "preparing", "ready"];

function StatusBadge({ status }: { status: Order["status"] }) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <Badge variant="outline" className={`gap-1 ${meta.tone}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function OrderCard({ order }: { order: Order }) {
  const isActive = ACTIVE_STATUSES.includes(order.status);
  const stripe =
    order.status === "ready"
      ? "bg-green-500"
      : order.status === "preparing"
        ? "bg-blue-400"
        : order.status === "pending"
          ? "bg-amber-400"
          : order.status === "cancelled"
            ? "bg-rose-400"
            : "bg-slate-300";

  return (
    <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripe}`} />
      <CardHeader className="pb-3 pl-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg font-serif">Order #{order.id}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(order.createdAt), "MMM d, h:mm a")} ·{" "}
              {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>
      </CardHeader>
      <CardContent className="pl-6 space-y-3">
        <div className="space-y-1.5">
          {(order.items ?? []).map((item, idx) => (
            <div key={idx} className="flex justify-between items-start text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-medium">
                  {item.quantity}× {item.menuItemName}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  <span>{formatSize(item.size)}</span>
                  {item.temperature === "hot" && (
                    <span className="inline-flex items-center gap-0.5 text-orange-600">
                      <Flame className="h-3 w-3" /> Hot
                    </span>
                  )}
                  {item.temperature === "cold" && (
                    <span className="inline-flex items-center gap-0.5 text-sky-600">
                      <Snowflake className="h-3 w-3" /> Cold
                    </span>
                  )}
                  {item.specialInstructions && (
                    <span className="italic">— {item.specialInstructions}</span>
                  )}
                </div>
              </div>
              <span className="text-muted-foreground tabular-nums ml-3">
                ${(item.unitPrice * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-semibold">${order.totalAmount.toFixed(2)}</span>
        </div>

        {isActive && (
          <Link href={`/order-status/${order.id}`}>
            <Button variant="outline" className="w-full mt-2">
              Track this order <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default function MyOrders() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/orders?clerkUserId=${encodeURIComponent(user.id)}`,
        );
        if (!res.ok) throw new Error(`Failed to load orders (${res.status})`);
        const data: Order[] = await res.json();
        if (!cancelled) {
          setOrders(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setOrders((prev) => prev ?? []);
        }
      }
    };
    load();
    // Poll while there are likely active orders.
    const id = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isLoaded, isSignedIn, user?.id]);

  if (isLoaded && !isSignedIn) {
    return (
      <CustomerLayout>
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-serif">Sign in to view your orders</h1>
          <p className="text-muted-foreground">
            Once you're signed in, you can track every order you've placed and
            see when it's ready for pickup.
          </p>
          <Button onClick={() => setLocation("/sign-in")} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <LogIn className="h-4 w-4 mr-2" /> Sign in
          </Button>
        </div>
      </CustomerLayout>
    );
  }

  if (!isLoaded || orders === null) {
    return (
      <CustomerLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <BubbleCupLoader size={110} message="Pulling up your orders…" />
        </div>
      </CustomerLayout>
    );
  }

  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const past = orders.filter((o) => !ACTIVE_STATUSES.includes(o.status));

  return (
    <CustomerLayout>
      <div className="space-y-8 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary-foreground">
            My Orders
          </h1>
          <p className="text-muted-foreground mt-1">
            Track in-progress orders and see your full history.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-border/60 rounded-xl bg-white/40">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium">No orders yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              When you place an order, it'll show up here.
            </p>
            <Link href="/">
              <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
                Browse the menu
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                  In progress
                </h2>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                  {active.length}
                </Badge>
              </div>
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Nothing being made right now.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {active.map((o) => (
                    <OrderCard key={o.id} order={o} />
                  ))}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    Past orders
                  </h2>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                    {past.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {past.map((o) => (
                    <OrderCard key={o.id} order={o} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </CustomerLayout>
  );
}
