import { OwnerLayout } from "@/components/layout/owner-layout";
import {
  useGetOrderStats, useListOrders, useBumpOrder, useUpdateOrderStatus,
  getListOrdersQueryKey, getGetOrderStatsQueryKey,
  useGetSettings, useUpdateSettings, getGetSettingsQueryKey,
  setExtraHeaders,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bell, BellOff, Volume2, CalendarClock, Phone, MessageSquare,
  AlertTriangle, Eye, Undo2, PackageCheck, ShoppingBag,
  CheckCircle2, ChefHat, Clock, TrendingUp, Receipt, Zap,
  Store, TrendingDown, BarChart2, Info, Sparkles, Coffee,
  GraduationCap, Sun, AlarmClock, Star, Bot, Loader2,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BubbleCupLoader } from "@/components/bubble-cup-loader";
import { useNewOrderSound } from "@/hooks/use-new-order-sound";
import { useOrderEvents } from "@/hooks/useOrderEvents";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOwnerAuth } from "@/components/owner-auth-provider";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─── Live cart types ──────────────────────────────────────────────────────────
type LiveCartItem = {
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
  specialInstructions?: string | null;
};
type LiveCart = {
  deviceId: string;
  customerName: string;
  items: LiveCartItem[];
  subtotal: number;
  updatedAt: number;
};

// ─── useLiveCarts — polls /api/live-carts every 3 seconds ────────────────────
function useLiveCarts(password: string | undefined) {
  const [carts, setCarts] = useState<LiveCart[]>([]);
  const pwRef = useRef(password);
  useEffect(() => { pwRef.current = password; }, [password]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/live-carts", {
          headers: { "x-owner-password": pwRef.current ?? "" },
        });
        if (r.ok && active) {
          const d = await r.json() as { carts: LiveCart[] };
          setCarts(d.carts ?? []);
        }
      } catch { /* silent */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { active = false; clearInterval(id); };
  }, []);

  return carts;
}

// ─── LiveCartCard — shows a single in-progress POS cart ──────────────────────
function LiveCartCard({ cart }: { cart: LiveCart }) {
  const TAX_RATE = 0.09;
  const tax = Math.round(cart.subtotal * TAX_RATE * 100) / 100;
  const total = cart.subtotal + tax;
  const secsAgo = Math.floor((Date.now() - cart.updatedAt) / 1000);
  const ageLabel = secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 280, damping: 26 }}
    >
      <div className="relative rounded-2xl border border-violet-200 bg-white overflow-hidden shadow-sm">
        {/* Left stripe */}
        <div className="absolute left-0 inset-y-0 w-1.5 bg-violet-500" />
        <div className="pl-5 pr-4 pt-4 pb-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200 px-2 py-0.5 rounded-full leading-none">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                  </span>
                  Being Rung Up
                </span>
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground truncate">{cart.customerName}</p>
            </div>
            <p className="text-xs text-muted-foreground/70 shrink-0 mt-1 bg-muted/50 border border-border/60 px-2 py-0.5 rounded-md">updated {ageLabel}</p>
          </div>

          {/* Items */}
          <div className="space-y-2 mb-4 bg-muted/50/50 rounded-xl p-3 border border-border/60">
            {cart.items.map((item, idx) => (
              <div key={idx} className="text-sm">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-foreground tabular-nums">{item.quantity}×</span>
                  <span className="font-semibold text-foreground/90">{item.name}</span>
                  {item.size && <span className="text-muted-foreground text-xs font-medium">({item.size})</span>}
                  <span className="ml-auto text-muted-foreground font-medium tabular-nums">
                    ${((item.unitPrice ?? 0) * (item.quantity ?? 1)).toFixed(2)}
                  </span>
                </div>
                {item.specialInstructions && (
                  <p className="ml-6 mt-1 text-amber-800 bg-amber-100/80 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5 text-xs font-medium leading-snug">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-70" />{item.specialInstructions}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t border-border/60 pt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground font-medium px-1">
              <span>Subtotal</span><span>${cart.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground font-medium px-1">
              <span>Tax (9%)</span><span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-foreground pt-1 px-1">
              <span>{cart.items.length} item{cart.items.length !== 1 ? "s" : ""}</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ─── Revenue chart data hook ──────────────────────────────────────────────────
type HourlySlot = { hour: number; label: string; revenue: number; orders: number };
type DailySlot = { date: string; dayOfWeek: number; label: string; revenue: number; orders: number };
type TomorrowHourly = { hour: number; label: string; projected: number };
type RevenueChartData = {
  hourlyToday: HourlySlot[];
  currentCtHour: number;
  last14Days: DailySlot[];
  projection: {
    tomorrowRevenue: number;
    tomorrowLow: number;
    tomorrowHigh: number;
    tomorrowDayName: string;
    tomorrowHourly: TomorrowHourly[];
    confidence: "low" | "medium" | "high";
    sameDayHistoryDays: number;
    weekOverWeekTrend: number;
    trendSlopePerDay: number;
    todayPaced: number;
    factors: string[];
  };
};

function useRevenueChart(intervalMs = 30_000) {
  const [data, setData] = useState<RevenueChartData | null>(null);
  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch("/api/orders/revenue-chart");
      if (r.ok) setData(await r.json() as RevenueChartData);
    } catch { /* silent */ }
  }, []);
  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, intervalMs);
    return () => clearInterval(id);
  }, [fetch_, intervalMs]);
  return data;
}

// ─── Open/Close toggle widget ────────────────────────────────────────────────
function OpenCloseToggle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey(), refetchInterval: 15000 }
  });
  const updateSettings = useUpdateSettings();

  const isOpen = settings?.isOpen ?? true;
  const toggling = updateSettings.isPending;

  const handleToggle = () => {
    const newVal = !isOpen;
    updateSettings.mutate({ isOpen: newVal }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({
          title: newVal ? "Shop is now OPEN" : "Shop is now CLOSED",
          description: newVal ? "Customers can place orders." : "Orders are paused for customers.",
        });
      },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={toggling}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all duration-300 shadow-sm select-none ${
        isOpen
          ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
      } ${toggling ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${isOpen ? "bg-emerald-400" : "bg-red-400"}`} />
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOpen ? "bg-emerald-500" : "bg-red-500"}`} />
      </span>
      <Store className="h-4 w-4" />
      {isOpen ? "Shop Open" : "Shop Closed"}
      <span className="text-[10px] font-normal opacity-60 ml-1">(tap to {isOpen ? "close" : "open"})</span>
    </button>
  );
}

// ─── Custom tooltip for revenue chart ────────────────────────────────────────
function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.name === "revenue" ? "#10b981" : "#6366f1" }}>
          ${Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
}

// ─── Revenue Chart component ──────────────────────────────────────────────────
function RevenueChart() {
  const data = useRevenueChart();
  const [tab, setTab] = useState<"today" | "history" | "tomorrow">("today");

  if (!data) {
    return (
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-4 w-4 text-muted-foreground/70" />
          <span className="text-sm font-semibold text-muted-foreground">Revenue</span>
        </div>
        <div className="h-48 flex items-center justify-center text-muted-foreground/70 text-sm">Loading chart…</div>
      </div>
    );
  }

  const { hourlyToday, currentCtHour, last14Days, projection } = data;

  const visibleHours = hourlyToday.slice(0, Math.max(currentCtHour + 2, 12));
  const todayTotal = hourlyToday.reduce((s, h) => s + h.revenue, 0);
  const wow = projection.weekOverWeekTrend;
  const confidenceBadge = {
    high: "bg-emerald-100 text-emerald-700 border-emerald-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-muted text-muted-foreground border-border",
  }[projection.confidence];

  // Tomorrow hourly: trim to hours that have projected revenue (or at least up to 8pm)
  const visibleTomorrow = projection.tomorrowHourly?.filter((h) => h.hour <= 21 && h.hour >= 7) ?? [];

  // Trend arrow for the slope
  const slopePositive = projection.trendSlopePerDay >= 1;
  const slopeNegative = projection.trendSlopePerDay <= -1;

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-base font-bold text-foreground">Revenue & Forecast</span>
          {(slopePositive || slopeNegative) && (
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ml-2 ${slopePositive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
              {slopePositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {slopePositive ? "+" : ""}{projection.trendSlopePerDay.toFixed(1)}/day
            </span>
          )}
        </div>
        <div className="flex bg-muted p-1 rounded-xl">
          {(["today", "history", "tomorrow"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${
                tab === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "today" ? "Today" : t === "history" ? "14-Day" : "Tomorrow"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 flex-1 flex flex-col">
        {tab === "today" && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="text-center rounded-xl bg-muted/50 border border-border/60 py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Today</p>
                <p className="text-xl font-bold text-emerald-600">${todayTotal.toFixed(2)}</p>
              </div>
              <div className="text-center rounded-xl bg-muted/50 border border-border/60 py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Paced</p>
                <p className="text-xl font-bold text-foreground">
                  {projection.todayPaced > 0 ? `$${projection.todayPaced.toFixed(0)}` : "—"}
                </p>
              </div>
              <div className="text-center rounded-xl bg-muted/50 border border-border/60 py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">WoW</p>
                <p className={`text-xl font-bold flex items-center justify-center gap-1 ${wow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {wow >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {Math.abs(wow) > 9.99 ? "999%+" : `${Math.abs(wow * 100).toFixed(0)}%`}
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visibleHours} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<RevenueTooltip />} cursor={{ fill: "#fafafa" }} />
                  <ReferenceLine x={hourlyToday[currentCtHour]?.label} stroke="#e4e4e7" strokeDasharray="4 2" label={{ value: "now", position: "top", fontSize: 9, fill: "#71717a" }} />
                  <Bar dataKey="revenue" name="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === "history" && (
          <div className="flex-1 min-h-[210px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last14Days} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: "#fafafa" }} />
                <Bar dataKey="revenue" name="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === "tomorrow" && (
          <>
            {/* Projection summary */}
            <div className="flex items-center justify-between gap-3 mb-6 bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-indigo-900">{projection.tomorrowDayName} Forecast</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confidenceBadge}`}>
                    {projection.confidence} confidence
                  </span>
                </div>
                {projection.tomorrowRevenue > 0 ? (
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl font-black text-indigo-600">${projection.tomorrowRevenue.toFixed(0)}</p>
                    {projection.tomorrowLow !== projection.tomorrowHigh && (
                      <p className="text-sm font-medium text-indigo-400">range: ${projection.tomorrowLow.toFixed(0)}–${projection.tomorrowHigh.toFixed(0)}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Not enough data yet — projections improve after a few days of sales.</p>
                )}
              </div>
              {projection.sameDayHistoryDays > 0 && (
                <div className="text-right shrink-0 bg-white p-2.5 rounded-xl border border-indigo-100 shadow-sm">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Based on</p>
                  <p className="text-xl font-bold text-indigo-600 leading-none my-1">{projection.sameDayHistoryDays}</p>
                  <p className="text-xs text-muted-foreground font-medium">{projection.tomorrowDayName}s</p>
                </div>
              )}
            </div>
            
            {/* Hour-by-hour curve */}
            <div className="flex-1 min-h-[140px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visibleTomorrow} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="projGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "#e4e4e7" }} />
                  <Area type="monotone" dataKey="projected" name="projected" stroke="#6366f1" strokeWidth={3} fill="url(#projGradient)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            {/* Factors */}
            {projection.factors.length > 0 && (
              <div className="mt-auto space-y-1.5 pt-4 border-t border-border/60">
                {projection.factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Daily Breakdown (Mr. Krabs) ─────────────────────────────────────────────
type DailyTopItem = { name: string; count: number; revenue: number };
type DailyBreakdownData = {
  totalRevenue: number;
  netProfit: number;
  orderCount: number;
  avgOrderValue: number;
  topItems: DailyTopItem[];
  bottomItems: DailyTopItem[];
  hourlyPeak: { hour: number; label: string; revenue: number } | null;
  aiInsight: string;
  vsYesterday: { revenue: number; orderCount: number; revenueDelta: number; revenueDeltaPct: number } | null;
  generatedAt: string;
};

function useDailyBreakdown(intervalMs = 5 * 60_000) {
  const [data, setData] = useState<DailyBreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch("/api/orders/daily-breakdown");
      if (r.ok) setData(await r.json() as DailyBreakdownData);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, intervalMs);
    return () => clearInterval(id);
  }, [fetch_, intervalMs]);
  return { data, loading };
}

// ─── Mr. Krabs auto-bump hook ─────────────────────────────────────────────────
type AutoBumpResult = { bumped: { id: number; customerName: string; waitMinutes: number }[]; message: string | null };

function useAutoBump(
  password: string | undefined,
  onBumped: (result: AutoBumpResult) => void,
  intervalMs = 90_000,
) {
  const pwRef = useRef(password);
  const onBumpedRef = useRef(onBumped);
  useEffect(() => { pwRef.current = password; }, [password]);
  useEffect(() => { onBumpedRef.current = onBumped; }, [onBumped]);

  useEffect(() => {
    if (!password) return;
    let active = true;
    const run = async () => {
      try {
        const r = await fetch("/api/orders/sweet-street-buddy/auto-bump", {
          method: "POST",
          headers: { "x-owner-password": pwRef.current ?? "" },
        });
        if (r.ok && active) {
          const data = await r.json() as AutoBumpResult;
          if (data.bumped.length > 0) onBumpedRef.current(data);
        }
      } catch { /* silent */ }
    };
    // Delay first run by 30s so dashboard can settle on load
    const firstRun = setTimeout(() => { void run(); }, 30_000);
    const id = setInterval(() => { void run(); }, intervalMs);
    return () => { active = false; clearTimeout(firstRun); clearInterval(id); };
  }, [password, intervalMs]);
}

function DailyBreakdownWidget() {
  const { data, loading } = useDailyBreakdown();

  if (loading) {
    return (
      <div className="rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 to-rose-50 p-4 shadow-sm animate-pulse flex items-center gap-3">
        <span className="text-base">🫧</span>
        <span className="text-sm text-pink-400">Sweet Street Buddy is fizzing up your report…</span>
      </div>
    );
  }

  if (!data) return null;

  const { totalRevenue, netProfit, orderCount, avgOrderValue, topItems, bottomItems, hourlyPeak, aiInsight, vsYesterday } = data;
  const isDown = vsYesterday ? vsYesterday.revenueDelta < 0 : false;
  const isUp = vsYesterday ? vsYesterday.revenueDelta > 0 : false;

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/60">
        <Sparkles className="h-4 w-4 text-muted-foreground/70" />
        <span className="text-base font-bold text-foreground">Sweet Street Buddy</span>
        <span className="text-[10px] text-muted-foreground/70 font-medium ml-1">Daily Scoop</span>
        {isDown && vsYesterday && (
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            {Math.abs(vsYesterday.revenueDeltaPct).toFixed(1)}% vs yday
          </span>
        )}
        {isUp && vsYesterday && (
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            +{Math.abs(vsYesterday.revenueDeltaPct).toFixed(1)}% vs yday
          </span>
        )}
        {!vsYesterday && <span className="text-xs text-muted-foreground/70 ml-auto">refreshes every 5 min</span>}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Buddy insight bubble */}
        <div className="rounded-xl bg-muted/50 border border-border px-4 py-3">
          <p className="text-sm leading-relaxed text-foreground/80 font-medium italic">{aiInsight}</p>
        </div>

        {/* Key numbers: Revenue + Net Profit + Orders + Avg */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center rounded-xl bg-white border border-border py-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Revenue</p>
            <p className="text-lg font-bold text-emerald-600">${totalRevenue.toFixed(2)}</p>
          </div>
          <div className="text-center rounded-xl bg-white border border-border py-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Net Profit</p>
            <p className="text-lg font-bold text-foreground">${netProfit.toFixed(2)}</p>
          </div>
          <div className="text-center rounded-xl bg-white border border-border py-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Orders</p>
            <p className="text-lg font-bold text-foreground">{orderCount}</p>
          </div>
          <div className="text-center rounded-xl bg-white border border-border py-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Avg</p>
            <p className="text-lg font-bold text-foreground">${avgOrderValue.toFixed(2)}</p>
          </div>
        </div>

        {/* Yesterday comparison */}
        {vsYesterday && (
          <div className={`flex items-center gap-3 text-sm rounded-xl px-4 py-3 ${isDown ? "bg-red-50 border border-red-100" : isUp ? "bg-emerald-50 border border-emerald-100" : "bg-muted/50 border border-border"}`}>
            {isDown
              ? <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
              : <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />}
            <span className={isDown ? "text-red-700" : isUp ? "text-emerald-800" : "text-foreground/80"}>
              Yesterday: <span className="font-bold">${vsYesterday.revenue.toFixed(2)}</span> ({vsYesterday.orderCount} orders)
              {" "}—{" "}
              <span className="font-bold">
                {isDown
                  ? `$${Math.abs(vsYesterday.revenueDelta).toFixed(2)} less today`
                  : isUp
                    ? `$${Math.abs(vsYesterday.revenueDelta).toFixed(2)} more today 🎉`
                    : "same as today"}
              </span>
            </span>
          </div>
        )}

        {/* Peak hour */}
        {hourlyPeak && (
          <div className="flex items-center gap-3 text-sm bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
            <Zap className="h-4 w-4 text-violet-500 shrink-0" />
            <span className="text-violet-800 font-medium">
              Peak hour: <span className="font-bold">{hourlyPeak.label}</span> — <span className="font-bold">${hourlyPeak.revenue.toFixed(2)}</span> in sales
            </span>
          </div>
        )}

        {/* Top items */}
        {topItems.length > 0 && (
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Star Drinks Today</p>
            <div className="space-y-2">
              {topItems.map((item, i) => {
                const maxCount = topItems[0].count;
                const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground/70 w-4 text-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground truncate">{item.name}</span>
                        <span className="text-xs font-medium text-muted-foreground shrink-0">{item.count}×</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-border transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-foreground w-14 text-right shrink-0">${item.revenue.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Slow movers */}
        {bottomItems.length > 0 && (
          <div className="pt-2 border-t border-border/60">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Needs a Boost</p>
            <div className="flex flex-wrap gap-2">
              {bottomItems.map((item) => (
                <span key={item.name} className="text-xs font-medium bg-muted border border-border rounded-full px-3 py-1 text-foreground/80">
                  {item.name} <span className="text-muted-foreground/70 ml-1">{item.count}×</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {orderCount === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-border rounded-2xl bg-muted/50">
            <Coffee className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No orders yet today</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Check back once the orders start rolling in</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rush Prediction widget ───────────────────────────────────────────────────
type RushWindow = {
  label: string; startHour: number; endHour: number; peakHour: number;
  expectedRevenue: number; minutesUntil: number | null; isActive: boolean;
  type: "school-lunch" | "after-school" | "happy-hour" | "general";
  confidence: "high" | "medium" | "low";
  aiReasoning: string;
};
type RushPredictionData = {
  currentHour: number; dayOfWeek: number; dayName: string;
  nextRush: RushWindow | null; upcomingRushes: RushWindow[];
  quietPeriod: boolean; quietUntil: number | null; generatedAt: string;
};

function useRushPrediction(intervalMs = 120_000) {
  const [data, setData] = useState<RushPredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch("/api/orders/rush-prediction");
      if (r.ok) setData(await r.json() as RushPredictionData);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, intervalMs);
    return () => clearInterval(id);
  }, [fetch_, intervalMs]);
  return { data, loading };
}

const RUSH_ICONS: Record<RushWindow["type"], React.ElementType> = {
  "school-lunch": GraduationCap,
  "after-school": GraduationCap,
  "happy-hour": Sun,
  "general": Coffee,
};

const RUSH_COLORS: Record<RushWindow["type"], { bg: string; border: string; text: string; badge: string }> = {
  "school-lunch": { bg: "from-sky-50 to-blue-50", border: "border-sky-200", text: "text-sky-700", badge: "bg-sky-100 text-sky-700 border-sky-200" },
  "after-school": { bg: "from-violet-50 to-purple-50", border: "border-violet-200", text: "text-violet-700", badge: "bg-violet-100 text-violet-700 border-violet-200" },
  "happy-hour": { bg: "from-amber-50 to-orange-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  "general": { bg: "from-emerald-50 to-teal-50", border: "border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function RushWidget() {
  const { data, loading } = useRushPrediction();

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-3 animate-pulse h-full">
        <Sparkles className="h-4 w-4 text-slate-300" />
        <span className="text-sm text-slate-400">AI analyzing rush patterns…</span>
      </div>
    );
  }

  if (!data) return null;

  const { nextRush, upcomingRushes, quietPeriod, quietUntil, dayName } = data;
  const noRushesToday = upcomingRushes.length === 0;

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/60 shrink-0">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <span className="text-base font-bold text-foreground">AI Rush Forecast</span>
        {quietPeriod && (
          <span className="ml-auto text-[10px] font-semibold bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">
            Quiet{quietUntil !== null ? ` until ${quietUntil}:00` : ""}
          </span>
        )}
      </div>

      {/* Rush list */}
      <div className="px-4 py-4 flex-1 flex flex-col gap-3">
        {noRushesToday ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <Coffee className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No rush windows expected today</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{dayName}</p>
          </div>
        ) : (
          upcomingRushes.map((rush, i) => {
            const colors = RUSH_COLORS[rush.type];
            const Icon = RUSH_ICONS[rush.type];
            const isNext = nextRush?.label === rush.label && i === 0;
            return (
              <div
                key={`${rush.label}-${i}`}
                className={`rounded-xl border bg-gradient-to-r ${colors.bg} ${colors.border} px-4 py-3 ${rush.isActive ? "ring-2 ring-primary ring-offset-1" : isNext ? "ring-1 ring-offset-1 ring-border" : ""}`}
              >
                {/* Top row: icon + label + time + status + revenue */}
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${colors.text}`} />
                  <span className={`text-xs font-bold ${colors.text}`}>{rush.label}</span>
                  <span className={`text-[10px] opacity-60 ${colors.text}`}>{rush.startHour}–{rush.endHour}</span>
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {rush.isActive ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                        <span className="h-1 w-1 rounded-full bg-white" /> LIVE
                      </span>
                    ) : rush.minutesUntil !== null ? (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${colors.badge}`}>
                        in {formatMinutes(rush.minutesUntil)}
                      </span>
                    ) : null}
                    <span className={`text-sm font-black ${colors.text}`}>
                      {rush.expectedRevenue > 0 ? `$${rush.expectedRevenue.toFixed(0)}` : "—"}
                    </span>
                  </div>
                </div>
                {/* AI reasoning in first-person */}
                <p className={`text-[11px] mt-1.5 leading-snug italic ${colors.text} opacity-75`}>
                  {rush.aiReasoning}
                </p>
              </div>
            );
          })
        )}

        {/* Footer note */}
        <p className="text-[10px] text-slate-300 text-center mt-auto pt-1">updates every 2 min</p>
      </div>
    </div>
  );
}

function useVisitorCount(intervalMs = 15_000) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const fetch_ = () => {
      fetch("/api/visitors/count")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d && typeof d.count === "number") setCount(d.count); })
        .catch(() => {});
    };
    fetch_();
    const id = setInterval(fetch_, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return count;
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, variant = "pending", now, onBump, onMarkPickedUp, onUnbump, bumpPending, updatePending }: {
  order: any; variant?: "pending" | "preparing" | "ready"; now: Date;
  onBump: (id: number, name: string) => void;
  onMarkPickedUp: (id: number, name: string, wasPaid: boolean) => void;
  onUnbump: (id: number, name: string) => void;
  bumpPending: boolean; updatePending: boolean;
}) {
  const isReady = variant === "ready";
  const wasPaid = !!order.paidAt;
  const src = typeof order.source === "string" ? order.source : "";
  const isPos = src === "pos" || src.startsWith("pos:");
  const isSquare = src.startsWith("square");

  // Derive station label from source field
  // Handles both "pos:drive-through" (POS app) and "square-pos:drive-through" (Square Terminal)
  const stationLabel = (() => {
    if (!src.includes(":")) return null;
    const slug = src.split(":")[1];
    if (!slug) return null;
    if (slug.includes("drive")) return "Drive Through";
    if (slug.includes("window")) return "Window";
    return slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  })();

  const scheduledAt = order.scheduledFor ? new Date(order.scheduledFor) : null;
  const isScheduledLocked = scheduledAt && scheduledAt > now;
  const minsUntilStart = scheduledAt ? Math.ceil((scheduledAt.getTime() - now.getTime()) / 60000) : 0;

  const displayNotes = isSquare ? null : order.notes;
  const menuItemMap = new Map((order.menuItems ?? []).map((m: any) => [m.id, m]));
  const hasRecipe = (order.menuItems ?? []).length > 0 &&
    (order.items ?? []).some((i: any) => menuItemMap.has(i.menuItemId));

  const stripeColor = variant === "ready" ? "bg-emerald-500" : variant === "preparing" ? "bg-blue-500" : "bg-amber-400";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 280, damping: 26 }}
    >
      <div className={`relative rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 ${
        isSquare
          ? "bg-amber-50 border-amber-200 ring-1 ring-amber-200"
          : variant === "ready" ? "border-emerald-200" : variant === "preparing" ? "border-sky-200" : "border-amber-200"
      }`}>
        {/* Left status stripe */}
        <div className={`absolute left-0 inset-y-0 w-1 ${stripeColor}`} />

        <div className={`pl-4 pr-3 pt-3 pb-2 ${variant === "ready" ? "bg-emerald-50/50" : variant === "preparing" ? "bg-sky-50/50" : "bg-amber-50/50"}`}>
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">#{order.id}</span>
                {isSquare && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                    <ShoppingBag className="h-2.5 w-2.5" />
                    {stationLabel
                      ? (stationLabel === "Drive Through" ? `🚗 ${stationLabel}` : stationLabel === "Window" ? `🪟 ${stationLabel}` : `📍 ${stationLabel}`)
                      : (order.source === "square-online" ? "Square Online" : "Square POS")}
                  </span>
                )}
                {isPos && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full leading-none">
                    <Eye className="h-2.5 w-2.5" />
                    {stationLabel
                      ? (stationLabel === "Drive Through" ? `🚗 ${stationLabel}` : stationLabel === "Window" ? `🪟 ${stationLabel}` : `📍 ${stationLabel}`)
                      : "POS"}
                  </span>
                )}
                {scheduledAt && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none border ${
                    isScheduledLocked
                      ? "bg-purple-100 text-purple-700 border-purple-200"
                      : "bg-sky-100 text-sky-700 border-sky-200"
                  }`}>
                    <CalendarClock className="h-2.5 w-2.5" />
                    {isScheduledLocked ? `In ${minsUntilStart}m` : format(scheduledAt, "h:mm a")}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{order.customerName}</p>
              {order.customerEmail && (
                <p className="text-xs text-slate-400 truncate">{order.customerEmail}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium text-slate-500">{format(new Date(order.createdAt), "h:mm a")}</p>
              <p className="text-[10px] text-slate-400">{formatDistanceToNowStrict(new Date(order.createdAt), { addSuffix: true })}</p>
              {(wasPaid || isPos || isSquare) && (
                <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Prepaid</span>
              )}
              {isReady && !wasPaid && !isPos && !isSquare && (
                <span className="inline-block mt-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Pays in Store</span>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-1 mb-2">
            {(order.items ?? []).map((item: any, idx: number) => (
              <div key={idx} className="text-xs">
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-slate-600 tabular-nums">{item.quantity}×</span>
                  <span className="font-medium text-slate-800">{item.menuItemName}</span>
                  {item.size && <span className="text-slate-400">({item.size})</span>}
                  <span className="ml-auto text-slate-500 font-medium tabular-nums">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-0.5 ml-4">
                  {item.temperature === "hot" && <span className="bg-orange-100 text-orange-700 rounded px-1 py-0.5 leading-none">🔥 Hot</span>}
                  {item.temperature === "cold" && <span className="bg-sky-100 text-sky-700 rounded px-1 py-0.5 leading-none">❄️ Cold</span>}
                  {item.lotusBase && <span className="bg-lime-100 text-lime-700 rounded px-1 py-0.5 leading-none">⚡ {item.lotusBase}</span>}
                  {item.milk && <span className="bg-blue-50 text-blue-700 rounded px-1 py-0.5 leading-none">🥛 {item.milk}</span>}
                </div>
                {item.specialInstructions && (
                  <p className="ml-4 mt-0.5 text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 flex items-start gap-1 leading-snug">
                    <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />{item.specialInstructions}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Total line */}
          <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-1 mb-2">
            <span>{(order.items ?? []).length} item{(order.items ?? []).length !== 1 ? "s" : ""}</span>
            <span className="font-bold text-slate-700">${(Number(order.totalAmount) || 0).toFixed(2)}</span>
          </div>

          {/* Recipe section — shown when menu item matched */}
          {hasRecipe && (
            <div className="mb-2 rounded-lg bg-blue-50 border border-blue-100 p-2 space-y-2">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                <ChefHat className="h-3 w-3" /> How to Make
              </p>
              {(order.items ?? []).map((item: any, idx: number) => {
                const matched = menuItemMap.get(item.menuItemId) as any;
                if (!matched) return null;
                const ingredients = matched.ingredients ?? [];
                const steps = matched.prepSteps ?? [];
                return (
                  <div key={idx} className="text-xs">
                    <p className="font-semibold text-blue-800 mb-1">{matched.name}</p>
                    {ingredients.length > 0 && (
                      <ul className="space-y-0.5 mb-1.5">
                        {ingredients.map((ing: any, i: number) => (
                          <li key={i} className="text-blue-700 flex gap-1.5">
                            <span className="text-blue-400 shrink-0">•</span>
                            <span>{ing.amount} {ing.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {steps.length > 0 && (
                      <ol className="space-y-0.5">
                        {steps.map((step: any, i: number) => (
                          <li key={i} className="text-blue-700 flex gap-1.5">
                            <span className="font-bold text-blue-500 shrink-0 tabular-nums">{step.stepNumber ?? i + 1}.</span>
                            <span>{step.instruction}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Notes */}
          {displayNotes && (
            <div className="mb-2 text-xs bg-orange-50 border border-orange-200 text-orange-800 rounded-lg px-2 py-1.5 flex gap-1.5 items-start">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /><span>{displayNotes}</span>
            </div>
          )}

          {/* Phone */}
          {!isReady && order.customerPhone && (
            <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Phone className="h-3 w-3" />
              <a href={`tel:${order.customerPhone}`} className="hover:text-slate-700 hover:underline transition-colors">{order.customerPhone}</a>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Link href={`/owner/orders/${order.id}`} className="shrink-0">
              <Button variant="outline" size="sm" className="h-8 text-xs px-2.5 border-slate-200 text-slate-600 hover:bg-slate-50">
                Details
              </Button>
            </Link>
            {isPos ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-md h-8 px-2 border border-dashed border-slate-200">
                <Eye className="h-3 w-3 mr-1" /> Managed by POS
              </div>
            ) : isReady ? (
              <>
                <Button variant="outline" size="sm"
                  className="h-8 text-xs px-2.5 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => onUnbump(order.id, order.customerName)} disabled={updatePending}>
                  <Undo2 className="h-3 w-3 mr-1" /> Unbump
                </Button>
                <Button size="sm"
                  className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => onMarkPickedUp(order.id, order.customerName, wasPaid)} disabled={updatePending}
                  data-testid={`button-picked-up-${order.id}`}>
                  <PackageCheck className="h-3 w-3 mr-1" /> Picked Up
                </Button>
              </>
            ) : isScheduledLocked ? (
              <Button size="sm" className="flex-1 h-8 text-xs bg-purple-100 text-purple-700 cursor-not-allowed" disabled>
                <CalendarClock className="h-3 w-3 mr-1" />
                {minsUntilStart > 60 ? `Ready in ${Math.ceil(minsUntilStart / 60)}h` : `Ready in ${minsUntilStart}m`}
              </Button>
            ) : (
              <Button size="sm"
                className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => onBump(order.id, order.customerName)} disabled={bumpPending}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Ready
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Column header ────────────────────────────────────────────────────────────
function ColumnHeader({ label, count, color, dot }: { label: string; count: number; color: string; dot: string }) {
  return (
    <div className={`flex items-center gap-3 mb-4 pb-2 border-b-2 ${color}`}>
      <span className={`w-3 h-3 rounded-full ${dot}`} />
      <h2 className="font-bold text-foreground text-base">{label}</h2>
      <span className={`ml-auto text-sm font-bold px-2.5 py-0.5 rounded-full ${dot === "bg-amber-400" ? "bg-amber-100 text-amber-800 border-amber-200 border" : dot === "bg-sky-400" ? "bg-sky-100 text-sky-800 border-sky-200 border" : "bg-emerald-100 text-emerald-800 border-emerald-200 border"}`}>
        {count}
      </span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyColumn({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-2xl bg-muted/50">
      <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 text-muted-foreground/70">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Buddy Control Center ─────────────────────────────────────────────────────
type DailySpecialData = { drinkName: string; promoName: string; tagline: string; suggestedDiscount: string; promoCopy: string };
type PushUpdateResult = { title: string; message: string; sentTo: number };

function BuddyControlCenter() {
  const { password } = useOwnerAuth();
  const { toast } = useToast();
  const [specialLoading, setSpecialLoading] = useState(false);
  const [special, setSpecial] = useState<DailySpecialData | null>(null);
  const [settingBanner, setSettingBanner] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState<PushUpdateResult | null>(null);

  const generateSpecial = async () => {
    setSpecialLoading(true);
    setSpecial(null);
    try {
      const r = await fetch("/api/orders/sweet-street-buddy/daily-special", {
        method: "POST",
        headers: { "x-owner-password": password ?? "" },
      });
      if (r.ok) setSpecial(await r.json() as DailySpecialData);
      else toast({ title: "Couldn't generate special", variant: "destructive" });
    } catch { toast({ title: "Couldn't generate special", variant: "destructive" }); }
    finally { setSpecialLoading(false); }
  };

  const setAsBanner = async () => {
    if (!special) return;
    setSettingBanner(true);
    try {
      const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-owner-password": password ?? "" },
        body: JSON.stringify({ announcementEnabled: true, announcementText: special.promoCopy }),
      });
      if (r.ok) toast({ title: "📢 Announcement set!", description: special.promoCopy });
      else toast({ title: "Couldn't set announcement", variant: "destructive" });
    } catch { toast({ title: "Couldn't set announcement", variant: "destructive" }); }
    finally { setSettingBanner(false); }
  };

  const sendPushUpdate = async () => {
    setPushLoading(true);
    setPushResult(null);
    try {
      const r = await fetch("/api/orders/sweet-street-buddy/push-update", {
        method: "POST",
        headers: { "x-owner-password": password ?? "" },
      });
      if (r.ok) {
        const data = await r.json() as PushUpdateResult;
        setPushResult(data);
        toast({ title: `📲 Sent to ${data.sentTo} device${data.sentTo !== 1 ? "s" : ""}!`, description: data.message });
      } else {
        toast({ title: "Couldn't send update", variant: "destructive" });
      }
    } catch { toast({ title: "Couldn't send update", variant: "destructive" }); }
    finally { setPushLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/60">
        <Sparkles className="h-4 w-4 text-muted-foreground/70" />
        <span className="text-base font-bold text-foreground">Buddy AI Tools</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100">
        {/* Daily Special */}
        <div className="p-4 md:p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-foreground">Daily Special Generator</p>
            <p className="text-xs text-muted-foreground mt-1">Buddy picks a slow-moving drink and writes a promo for it.</p>
          </div>
          <Button
            size="sm"
            onClick={generateSpecial}
            disabled={specialLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm text-sm h-10 font-medium"
          >
            {specialLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : "Generate Daily Special"}
          </Button>
          {special && (
            <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{special.promoName}</p>
                  <p className="text-xs text-muted-foreground font-medium">{special.drinkName}</p>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg px-2.5 py-1 font-bold shrink-0">{special.suggestedDiscount}</span>
              </div>
              <p className="text-xs text-muted-foreground italic">"{special.tagline}"</p>
              <div className="rounded-lg bg-white border border-border p-3 shadow-sm">
                <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider mb-1">Banner Copy</p>
                <p className="text-sm text-foreground/90 leading-relaxed font-medium">{special.promoCopy}</p>
              </div>
              <Button
                size="sm"
                onClick={setAsBanner}
                disabled={settingBanner}
                variant="outline"
                className="w-full border-border text-foreground/80 hover:bg-muted/50 hover:text-foreground text-sm h-10 rounded-xl"
              >
                {settingBanner ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Setting…</> : "Set as Announcement Banner"}
              </Button>
            </div>
          )}
        </div>

        {/* Push Sales Update */}
        <div className="p-4 md:p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-foreground">Push Sales Update</p>
            <p className="text-xs text-muted-foreground mt-1">Send a live sales snapshot to all POS devices right now.</p>
          </div>
          <Button
            size="sm"
            onClick={sendPushUpdate}
            disabled={pushLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm text-sm h-10 font-medium"
          >
            {pushLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : "Send to POS Devices"}
          </Button>
          {pushResult && (
            <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-3">
              <span className="inline-flex text-xs bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg px-2.5 py-1 font-bold">
                Sent to {pushResult.sentTo} device{pushResult.sentTo !== 1 ? "s" : ""}
              </span>
              <div className="rounded-lg bg-white border border-border p-3 shadow-sm mt-2">
                <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider mb-1">Notification</p>
                <p className="text-sm font-bold text-foreground">{pushResult.title}</p>
                <p className="text-sm text-foreground/80 mt-1 leading-relaxed">{pushResult.message}</p>
              </div>
            </div>
          )}
          {pushResult?.sentTo === 0 && (
            <p className="text-xs text-muted-foreground italic bg-muted/50 p-3 rounded-lg border border-border">No POS devices registered — open the POS app to register one.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Low Performer Alerts ──────────────────────────────────────────────────────
function LowPerformerAlerts() {
  const { password } = useOwnerAuth();
  const [alerts, setAlerts] = useState<{ name: string; suggestion: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!password) { setLoading(false); return; }
    fetch("/api/orders/sweet-street-buddy/low-performer-alerts", {
      headers: { "x-owner-password": password },
    })
      .then(r => r.ok ? r.json() as Promise<{ alerts: { name: string; suggestion: string }[] }> : null)
      .then(data => { if (data) setAlerts(data.alerts); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [password]);

  if (loading || alerts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/60">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-base font-bold text-foreground">Drinks Needing Love</span>
        <span className="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
          {alerts.length} item{alerts.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {alerts.map((alert) => (
          <div key={alert.name} className="flex items-start gap-3 rounded-xl bg-muted/50 border border-border p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{alert.name}</p>
              <p className="text-xs font-medium text-muted-foreground mt-1 leading-relaxed">{alert.suggestion}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const now = useNow();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const visitorCount = useVisitorCount();
  const { password } = useOwnerAuth();
  const liveCarts = useLiveCarts(password);
  useOrderEvents();

  // Sync owner password into the shared API client so useBumpOrder /
  // useUpdateOrderStatus include x-owner-password on every request.
  useEffect(() => {
    setExtraHeaders(password ? { "x-owner-password": password } : {});
  }, [password]);

  const { data: stats, isLoading: statsLoading } = useGetOrderStats({
    query: { queryKey: getGetOrderStatsQueryKey(), refetchInterval: 5000, refetchIntervalInBackground: true }
  });
  const { data: pendingOrders, isLoading: pendingLoading } = useListOrders({ status: "pending" }, {
    query: { queryKey: getListOrdersQueryKey({ status: "pending" }), refetchInterval: 5000, refetchIntervalInBackground: true }
  });
  const { data: preparingOrders, isLoading: preparingLoading } = useListOrders({ status: "preparing" }, {
    query: { queryKey: getListOrdersQueryKey({ status: "preparing" }), refetchInterval: 5000, refetchIntervalInBackground: true }
  });
  const { data: readyOrders, isLoading: readyLoading } = useListOrders({ status: "ready" }, {
    query: { queryKey: getListOrdersQueryKey({ status: "ready" }), refetchInterval: 5000, refetchIntervalInBackground: true }
  });

  const bumpOrder = useBumpOrder();
  const updateStatus = useUpdateOrderStatus();

  // Mr. Krabs auto-bump — fires every 90s, refreshes order lists on bump
  useAutoBump(password, useCallback((result: AutoBumpResult) => {
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOrderStatsQueryKey() });
    const names = result.bumped.map(o => o.customerName).join(", ");
    toast({
      title: `🫧 Sweet Street Buddy marked ${result.bumped.length} order${result.bumped.length !== 1 ? "s" : ""} ready!`,
      description: result.message ?? `${names} — automatically bumped to ready. ✨`,
    });
  }, [queryClient, toast]));

  const latestPending = pendingOrders && pendingOrders.length > 0 ? pendingOrders[pendingOrders.length - 1] : null;
  const ding = useNewOrderSound(pendingOrders?.length, {
    latestOrder: latestPending ? { id: latestPending.id, customerName: latestPending.customerName } : null,
  });

  const handleEnableSound = async () => {
    const ok = await ding.enable();
    if (ok) toast({ title: "New-order sound on", description: "You'll hear a ding for every new order." });
    else toast({ title: "Audio blocked", description: "Click anywhere on the page first, then try again.", variant: "destructive" });
  };
  const handleDisableSound = () => {
    ding.disable();
    toast({ title: "Sound off" });
  };
  const handleEnableNotifications = async () => {
    const result = await ding.requestNotifyPermission();
    if (result === "granted") toast({ title: "Pop-up alerts on" });
    else if (result === "denied") toast({ title: "Notifications blocked", variant: "destructive" });
  };

  const handleBump = (id: number, customerName: string) => {
    bumpOrder.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Order advanced", description: `${customerName}'s order moved to next step.` });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrderStatsQueryKey() });
      },
      onError: (e) => toast({ title: "Failed to update order", description: String(e), variant: "destructive" }),
    });
  };
  const handleMarkPickedUp = (id: number, customerName: string, wasPaid: boolean) => {
    updateStatus.mutate({ id, data: { status: "completed" } }, {
      onSuccess: () => {
        toast({ title: "Order complete", description: wasPaid ? `${customerName}'s order picked up.` : `${customerName} paid. Order complete.` });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrderStatsQueryKey() });
      },
      onError: (e) => toast({ title: "Failed to update order", description: String(e), variant: "destructive" }),
    });
  };
  const handleUnbump = (id: number, customerName: string) => {
    updateStatus.mutate({ id, data: { status: "pending" } }, {
      onSuccess: () => {
        toast({ title: "Moved back to Pending", description: `#${id} — ${customerName}` });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrderStatsQueryKey() });
      },
      onError: (e) => toast({ title: "Failed to update order", description: String(e), variant: "destructive" }),
    });
  };

  const initialLoading = statsLoading || pendingLoading || preparingLoading || readyLoading;
  if (initialLoading) {
    return (
      <OwnerLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2">
          <BubbleCupLoader size={120} message="Loading dashboard…" />
        </div>
      </OwnerLayout>
    );
  }

  const squarePendingCount = (pendingOrders ?? []).filter((o: any) =>
    typeof o.source === "string" && o.source.startsWith("square")
  ).length;

  return (
    <OwnerLayout>
      <div className="space-y-4 max-w-7xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          {/* Left: title + meta */}
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {format(now, "EEEE, MMM d")} · {format(now, "h:mm a")}
                {visitorCount !== null && visitorCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1.5 text-muted-foreground font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-border opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-muted/500" />
                    </span>
                    {visitorCount} browsing
                  </span>
                )}
              </p>
            </div>
            <OpenCloseToggle />
          </div>

          {/* Right: sound controls */}
          {ding.supported && (
            <div className="flex items-center gap-2">
              {ding.needsUnlock ? (
                <Button size="sm" variant="outline" className="border-border bg-white hover:bg-muted/50 rounded-xl shadow-sm text-sm" onClick={handleEnableSound}>
                  <Bell className="h-4 w-4 mr-2" /> Enable Sound
                </Button>
              ) : ding.enabled && ding.unlocked ? (
                <>
                  <Badge className="bg-muted text-foreground border border-border gap-1.5 text-xs py-1 px-2.5 rounded-lg shadow-sm">
                    <Bell className="h-3 w-3" /> Sound on
                  </Badge>
                  {ding.notifyPermission === "default" && (
                    <Button variant="outline" size="sm" onClick={handleEnableNotifications} className="border-border bg-white hover:bg-muted/50 rounded-xl shadow-sm text-sm h-9">
                      <Bell className="h-4 w-4 mr-1.5" /> Alerts
                    </Button>
                  )}
                  {ding.notifyPermission === "granted" && (
                    <Badge className="bg-muted text-foreground border border-border gap-1.5 text-xs py-1 px-2.5 rounded-lg shadow-sm">
                      <Bell className="h-3 w-3" /> Alerts on
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={ding.testDing} className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted">
                    <Volume2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDisableSound} className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted">
                    <BellOff className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={handleEnableSound} className="border-border bg-white hover:bg-muted/50 rounded-xl shadow-sm text-sm">
                  <Bell className="h-4 w-4 mr-2" /> Turn on ding
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <Tabs defaultValue="orders">
          <TabsList className="bg-muted border border-border rounded-full p-1 h-auto gap-1">
            <TabsTrigger value="orders" className="rounded-full text-sm font-medium px-5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-white text-muted-foreground hover:text-foreground transition-colors">
              Orders
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-full text-sm font-medium px-5 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-white text-muted-foreground hover:text-foreground transition-colors">
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* ── Orders tab ────────────────────────────────────────────── */}
          <TabsContent value="orders" className="mt-4 space-y-4">

            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2">
              {[
                { label: "Revenue Today", value: `$${(stats?.revenueToday || 0).toFixed(2)}` },
                { label: "Orders Today", value: String(stats?.totalToday || 0) },
                { label: "Pending", value: String(stats?.pendingCount || 0) },
                { label: "Preparing", value: String(stats?.preparingCount || 0) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border border-border bg-white p-4 shadow-sm flex flex-col justify-center">
                  <p className="text-sm text-muted-foreground font-medium">{label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                </div>
              ))}
            </div>

            {/* Being Rung Up */}
            {liveCarts.length > 0 && (
              <div className="mt-6 border border-violet-200 bg-violet-50/30 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                  </span>
                  <h2 className="font-bold text-foreground text-base">Being Rung Up</h2>
                  <span className="ml-auto text-sm font-bold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200">
                    {liveCarts.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <AnimatePresence mode="popLayout">
                    {liveCarts.map((cart) => (
                      <LiveCartCard key={cart.deviceId} cart={cart} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Square online banner */}
            {squarePendingCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-amber-500 text-white rounded-xl px-4 py-3 shadow-sm shadow-amber-200"
              >
                <Zap className="h-4 w-4 shrink-0" />
                <p className="text-sm font-semibold">
                  {squarePendingCount} new Square Online {squarePendingCount === 1 ? "order" : "orders"} waiting — already paid!
                </p>
              </motion.div>
            )}

            {/* Ready for Pickup */}
            <div className="mt-8">
              <ColumnHeader label="Ready for Pickup" count={readyOrders?.length ?? 0} color="border-emerald-200" dot="bg-emerald-500" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {(readyOrders?.length ?? 0) === 0 ? (
                    <motion.div key="empty-ready" className="col-span-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <EmptyColumn icon={CheckCircle2} message="No orders waiting for pickup" />
                    </motion.div>
                  ) : (
                    readyOrders?.map((order) => (
                      <OrderCard key={order.id} order={order} variant="ready" now={now}
                        onBump={handleBump} onMarkPickedUp={handleMarkPickedUp} onUnbump={handleUnbump}
                        bumpPending={bumpOrder.isPending} updatePending={updateStatus.isPending} />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* New Orders + Preparing */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              <div>
                <ColumnHeader label="New Orders" count={pendingOrders?.length ?? 0} color="border-amber-200" dot="bg-amber-400" />
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {(pendingOrders?.length ?? 0) === 0 ? (
                      <motion.div key="empty-pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <EmptyColumn icon={Clock} message="Queue is clear" />
                      </motion.div>
                    ) : (
                      pendingOrders?.map((order) => (
                        <OrderCard key={order.id} order={order} variant="pending" now={now}
                          onBump={handleBump} onMarkPickedUp={handleMarkPickedUp} onUnbump={handleUnbump}
                          bumpPending={bumpOrder.isPending} updatePending={updateStatus.isPending} />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div>
                <ColumnHeader label="Preparing" count={preparingOrders?.length ?? 0} color="border-sky-200" dot="bg-sky-400" />
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {(preparingOrders?.length ?? 0) === 0 ? (
                      <motion.div key="empty-preparing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <EmptyColumn icon={ChefHat} message="Nothing being prepared" />
                      </motion.div>
                    ) : (
                      preparingOrders?.map((order) => (
                        <OrderCard key={order.id} order={order} variant="preparing" now={now}
                          onBump={handleBump} onMarkPickedUp={handleMarkPickedUp} onUnbump={handleUnbump}
                          bumpPending={bumpOrder.isPending} updatePending={updateStatus.isPending} />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

          </TabsContent>

          {/* ── Analytics tab ─────────────────────────────────────────── */}
          <TabsContent value="analytics" className="mt-4 space-y-4">

            {/* Revenue chart + Rush widget */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
              <div className="lg:col-span-3">
                <RevenueChart />
              </div>
              <div className="lg:col-span-2 lg:self-stretch">
                <RushWidget />
              </div>
            </div>

            {/* Sweet Street Buddy daily breakdown */}
            <DailyBreakdownWidget />

            {/* Low Performer Alerts */}
            <LowPerformerAlerts />

            {/* Buddy AI Tools */}
            <BuddyControlCenter />

          </TabsContent>
        </Tabs>

      </div>
    </OwnerLayout>
  );
}
