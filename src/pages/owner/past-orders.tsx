import { OwnerLayout } from "@/components/layout/owner-layout";
import { useListOrders, useUpdateOrderStatus, getListOrdersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { format, isToday, isThisWeek, isThisMonth } from "date-fns";
import { ChevronRight, Search, Receipt, History, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CupCardSkeleton } from "@/components/cup-spinner";
import { formatSize } from "@/components/cart-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Range = "today" | "week" | "month" | "all";

export default function PastOrders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateStatus = useUpdateOrderStatus();

  const { data: orders, isLoading } = useListOrders(
    { status: "completed" },
    { query: { refetchInterval: 30000, queryKey: getListOrdersQueryKey({ status: "completed" }) } },
  );

  const [range, setRange] = useState<Range>("today");
  const [query, setQuery] = useState("");

  const handleUnbump = (e: React.MouseEvent, id: number, customerName: string) => {
    e.preventDefault();
    e.stopPropagation();
    updateStatus.mutate(
      { id, data: { status: "pending" } },
      {
        onSuccess: () => {
          toast({ title: "Order unbumped", description: `#${id} — ${customerName} moved back to Pending.` });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to unbump", description: "Something went wrong. Please try again.", variant: "destructive" });
        },
      },
    );
  };

  const filtered = useMemo(() => {
    if (!orders) return [];
    const q = query.trim().toLowerCase();
    return [...orders]
      .filter((o) => {
        const when = new Date((o.paidAt ?? o.createdAt) ?? new Date().toISOString());
        if (range === "today" && !isToday(when)) return false;
        if (range === "week" && !isThisWeek(when, { weekStartsOn: 1 })) return false;
        if (range === "month" && !isThisMonth(when)) return false;
        if (q) {
          const hay = `${o.customerName ?? ""} ${o.id}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ta = new Date((a.paidAt ?? a.createdAt) ?? new Date().toISOString()).getTime();
        const tb = new Date((b.paidAt ?? b.createdAt) ?? new Date().toISOString()).getTime();
        return tb - ta;
      });
  }, [orders, range, query]);

  const totalRevenue = filtered.reduce(
    (sum, o) => sum + Number(o.totalAmount ?? 0),
    0,
  );

  return (
    <OwnerLayout>
      <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <History className="h-7 w-7 text-foreground" />
              Past Orders
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              All completed orders, newest first.
            </p>
          </div>
        </div>

        <Card className="bg-white border border-border rounded-2xl shadow-sm">
          <CardContent className="pt-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["today", "week", "month", "all"] as Range[]).map((r) => (
                <Button
                  key={r}
                  variant={range === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRange(r)}
                  className={`capitalize rounded-xl ${range === r ? 'bg-primary text-white hover:bg-primary/90 shadow-sm font-medium' : 'border border-border bg-white hover:bg-muted/50 text-foreground/80'}`}
                >
                  {r === "today" ? "Today" : r === "week" ? "This week" : r === "month" ? "This month" : "All time"}
                </Button>
              ))}
            </div>
            <div className="relative md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                placeholder="Search by name or order #"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 rounded-xl border-border focus:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="bg-white border border-border rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{filtered.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-border rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">${totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-border rounded-2xl shadow-sm col-span-2 md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                ${filtered.length > 0 ? (totalRevenue / filtered.length).toFixed(2) : "0.00"}
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CupCardSkeleton />
            <CupCardSkeleton />
            <CupCardSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-white border border-border border-dashed rounded-2xl shadow-sm">
            <CardContent className="py-16 text-center text-muted-foreground space-y-2">
              <Receipt className="h-10 w-10 mx-auto opacity-40 text-muted-foreground/70" />
              <p className="font-medium text-foreground/80">No completed orders in this range.</p>
              <p className="text-sm text-muted-foreground">Try a different time range or clear the search.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const when = new Date((order.paidAt ?? order.createdAt) ?? new Date().toISOString());
              const itemCount = order.items?.reduce(
                (a: number, i: { quantity?: number }) => a + (i.quantity ?? 0),
                0,
              ) ?? 0;
              return (
                <Link key={order.id} href={`/owner/orders/${order.id}`}>
                  <Card className="bg-white border border-border rounded-2xl shadow-sm hover:border-border hover:shadow-md transition-all cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex-shrink-0 h-11 w-11 rounded-full bg-muted text-foreground font-bold flex items-center justify-center">
                            #{order.id}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground truncate">{order.customerName || "Guest"}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(when, "MMM d, yyyy")} • {format(when, "h:mm a")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-bold text-base text-foreground">${Number(order.totalAmount ?? 0).toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">
                              {itemCount} item{itemCount === 1 ? "" : "s"}
                            </div>
                          </div>
                          {order.paidAt ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200">
                              Paid
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                              Unpaid
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-xs rounded-xl border border-border bg-white hover:bg-muted/50 text-foreground/80 flex-shrink-0"
                            onClick={(e) => handleUnbump(e, order.id, order.customerName || "Guest")}
                            disabled={updateStatus.isPending}
                            title="Move back to Ready on the dashboard"
                          >
                            <Undo2 className="h-3 w-3 mr-1" /> Unbump
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
                        </div>
                      </div>
                      {order.items && order.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          {order.items.slice(0, 4).map((it: { quantity?: number; menuItemName?: string; size?: string; temperature?: string | null; lotusBase?: string | null; milk?: string | null }, i: number) => (
                            <span key={i} className="inline-flex items-center gap-1 flex-wrap">
                              {it.quantity}× {it.menuItemName} <span className="opacity-60">({formatSize(it.size)})</span>
                              {it.temperature === "hot" && <span className="text-orange-600">Hot</span>}
                              {it.temperature === "cold" && <span className="text-sky-600">Iced</span>}
                              {it.lotusBase && <span className="text-lime-700 opacity-80">{it.lotusBase}</span>}
                              {it.milk && <span className="text-blue-700 opacity-80">{it.milk}</span>}
                            </span>
                          ))}
                          {order.items.length > 4 && (
                            <span className="italic">+{order.items.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </OwnerLayout>
  );
}
