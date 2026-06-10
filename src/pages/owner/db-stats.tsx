import { useQuery } from "@tanstack/react-query";
import { OwnerLayout } from "@/components/layout/owner-layout";
import { useOwnerAuth } from "@/components/owner-auth-provider";
import {
  Database, RefreshCw, Loader2, DollarSign, ShoppingBag, Star,
  Tag, Gift, Package, Award, TrendingUp,
} from "lucide-react";

interface DbStats {
  tables: { name: string; count: number | null }[];
  highlights: {
    orders: {
      total: number;
      today: number;
      byStatus: Record<string, number>;
      revenue: number;
      revenueToday: number;
    };
    menuAvailable: number;
    giftCardTotalCents: number;
    pointsOutstanding: number;
    reviews: { total: number; approved: number; avgRating: number };
    activeDiscountCodes: number;
    activeRewards: number;
    inventorySpend: number;
  };
}

const TABLE_LABELS: Record<string, string> = {
  settings: "Settings",
  menu_items: "Menu Items",
  modifiers: "Modifiers",
  pos_categories: "POS Categories",
  orders: "Orders",
  discount_codes: "Discount Codes",
  rewards: "Rewards",
  points_ledger: "Points Ledger",
  favorites: "Favorites",
  reviews: "Reviews",
  live_carts: "Live Carts",
  user_profiles: "User Profiles",
  user_seen_points: "Seen Points",
  inventory_receives: "Inventory Receives",
  inventory_costs: "Inventory Costs",
  gift_cards: "Gift Cards",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  preparing: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  ready: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

function StatCard({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl bg-white border border-border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`h-4 w-4 ${accent}`} />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      </div>
      <p className={`text-xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

export default function DbStats() {
  const { password } = useOwnerAuth();

  const { data, isLoading, isFetching, refetch, error } = useQuery<DbStats>({
    queryKey: ["owner-db-stats"],
    queryFn: async () => {
      const res = await fetch("/api/owner/db-stats", {
        headers: { "x-owner-password": password ?? "" },
      });
      if (!res.ok) throw new Error("Failed to load database stats");
      return res.json();
    },
    enabled: !!password,
    refetchOnWindowFocus: false,
  });

  const h = data?.highlights;

  return (
    <OwnerLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Database className="h-7 w-7 text-violet-500" />
              Database Overview
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Read-only snapshot of every table and a few key business metrics.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-white text-sm font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Failed to load database stats.
          </div>
        ) : (
          <>
            {/* Highlights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={ShoppingBag} label="Total Orders" value={String(h?.orders.total ?? 0)} accent="text-foreground" />
              <StatCard icon={DollarSign} label="All-Time Revenue" value={`$${(h?.orders.revenue ?? 0).toFixed(2)}`} accent="text-emerald-600" />
              <StatCard icon={TrendingUp} label="Orders Today" value={String(h?.orders.today ?? 0)} accent="text-foreground" />
              <StatCard icon={DollarSign} label="Revenue Today" value={`$${(h?.orders.revenueToday ?? 0).toFixed(2)}`} accent="text-emerald-600" />

              <StatCard icon={Package} label="Available Menu Items" value={String(h?.menuAvailable ?? 0)} accent="text-foreground" />
              <StatCard icon={Star} label="Avg Review Rating" value={(h?.reviews.avgRating ?? 0).toFixed(1)} accent="text-amber-500" />
              <StatCard icon={Tag} label="Active Discount Codes" value={String(h?.activeDiscountCodes ?? 0)} accent="text-foreground" />
              <StatCard icon={Award} label="Active Rewards" value={String(h?.activeRewards ?? 0)} accent="text-foreground" />

              <StatCard icon={TrendingUp} label="Loyalty Points Outstanding" value={(h?.pointsOutstanding ?? 0).toLocaleString()} accent="text-violet-600" />
              <StatCard icon={Gift} label="Gift Card Value Issued" value={`$${((h?.giftCardTotalCents ?? 0) / 100).toFixed(2)}`} accent="text-pink-600" />
              <StatCard icon={DollarSign} label="Inventory Spend" value={`$${(h?.inventorySpend ?? 0).toFixed(2)}`} accent="text-foreground" />
              <StatCard icon={Star} label="Approved Reviews" value={`${h?.reviews.approved ?? 0} / ${h?.reviews.total ?? 0}`} accent="text-foreground" />
            </div>

            {/* Orders by status */}
            {h && Object.keys(h.orders.byStatus).length > 0 && (
              <div className="rounded-xl bg-white border border-border p-4 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-3">Orders by Status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(h.orders.byStatus).map(([status, count]) => (
                    <span
                      key={status}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border ${STATUS_COLORS[status] ?? "bg-muted/50 text-foreground border-border"}`}
                    >
                      {status.replace(/_/g, " ")}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Table row counts */}
            <div className="rounded-xl bg-white border border-border p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground mb-3">Table Row Counts</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {data?.tables.map((t) => (
                  <div key={t.name} className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground truncate">{TABLE_LABELS[t.name] ?? t.name}</span>
                    <span className="text-sm font-bold text-foreground tabular-nums">{t.count ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </OwnerLayout>
  );
}
