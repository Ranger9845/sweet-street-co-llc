import { useListOrders, useGetSettings, getListOrdersQueryKey, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, ChefHat, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useNewOrderSound } from "@/hooks/use-new-order-sound";

function OrderCard({ order, variant, index }: { order: any; variant: "ready" | "preparing" | "pending"; index: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), index * 80);
    return () => clearTimeout(timer);
  }, [index]);

  const styles = {
    ready: {
      card: "bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 shadow-lg shadow-green-200/50",
      icon: "bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md shadow-green-300/50",
      iconSize: "h-16 w-16",
      innerIcon: "h-8 w-8",
      number: "text-4xl font-bold text-green-800",
      name: "text-xl font-semibold text-green-700",
    },
    preparing: {
      card: "bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-md shadow-blue-100/50",
      icon: "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-300/50",
      iconSize: "h-14 w-14",
      innerIcon: "h-7 w-7",
      number: "text-3xl font-bold text-blue-800",
      name: "text-lg font-medium text-blue-600",
    },
    pending: {
      card: "bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-sm",
      icon: "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-200/50",
      iconSize: "h-12 w-12",
      innerIcon: "h-6 w-6",
      number: "text-2xl font-bold text-amber-800",
      name: "text-base font-medium text-amber-600",
    },
  };

  const s = styles[variant];
  const Icon = variant === "ready" ? CheckCircle2 : variant === "preparing" ? ChefHat : Clock;

  return (
    <div
      className={`${s.card} rounded-2xl p-6 relative overflow-hidden transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"}`}
    >
      {variant === "ready" && (
        <>
          <div className="absolute top-3 right-3">
            <Sparkles className="h-5 w-5 text-green-400 animate-[spin_3s_linear_infinite]" />
          </div>
          <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-green-200/30 animate-[ping_2s_ease-in-out_infinite]" />
          <div className="absolute -top-2 -left-2 h-16 w-16 rounded-full bg-emerald-200/20 animate-[ping_3s_ease-in-out_infinite_0.5s]" />
        </>
      )}

      {variant === "preparing" && (
        <div className="absolute -bottom-3 -right-3 h-20 w-20 rounded-full bg-blue-100/40 animate-[pulse_2s_ease-in-out_infinite]" />
      )}

      <div className="flex items-center gap-4 relative z-10">
        <div className={`${s.icon} ${s.iconSize} rounded-xl flex items-center justify-center flex-shrink-0 ${variant === "ready" ? "animate-[ready-pulse_2s_ease-in-out_infinite]" : variant === "preparing" ? "animate-[gentle-bob_3s_ease-in-out_infinite]" : ""}`}>
          <Icon className={s.innerIcon} />
        </div>
        <div>
          <div className={s.number}>#{order.id}</div>
          <div className={`${s.name} mt-1`}>{order.customerName}</div>
        </div>
      </div>
    </div>
  );
}

export default function OrderBoard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [colonVisible, setColonVisible] = useState(true);

  const { data: settings } = useGetSettings({
    query: { refetchInterval: 30000, queryKey: getGetSettingsQueryKey() }
  });

  const { data: readyOrders } = useListOrders({ status: "ready" }, {
    query: { refetchInterval: 3000, queryKey: getListOrdersQueryKey({ status: "ready" }) }
  });

  const { data: preparingOrders } = useListOrders({ status: "preparing" }, {
    query: { refetchInterval: 3000, queryKey: getListOrdersQueryKey({ status: "preparing" }) }
  });

  const { data: pendingOrders } = useListOrders({ status: "pending" }, {
    query: { refetchInterval: 3000, queryKey: getListOrdersQueryKey({ status: "pending" }) }
  });

  const ding = useNewOrderSound(pendingOrders?.length);

  useEffect(() => {
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    const colonInterval = setInterval(() => setColonVisible(v => !v), 1000);
    return () => { clearInterval(timeInterval); clearInterval(colonInterval); };
  }, []);

  const shopName = settings?.shopName || "Sweet Street";
  const hours = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const [hh, mm] = hours.split(':');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf2f0] via-[#fef6f3] to-[#fce8f0] flex flex-col overflow-hidden">
      <style>{`
        @keyframes ready-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50% { transform: scale(1.08); box-shadow: 0 0 20px 4px rgba(34,197,94,0.2); }
        }
        @keyframes gentle-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes float-in {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes count-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .ready-header-glow {
          text-shadow: 0 0 30px rgba(34,197,94,0.15);
        }
        .column-divider {
          background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.06), transparent);
        }
      `}</style>

      <header className="bg-white/70 backdrop-blur-md border-b border-pink-200/60 px-8 py-5 flex items-center justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-50/50 via-transparent to-pink-50/50 animate-[gradient-shift_8s_ease_infinite] bg-[length:200%_100%]" />
        <div className="relative z-10">
          <h1 className="text-5xl font-serif font-bold text-[#7c3d5e] tracking-tight">{shopName}</h1>
          <p className="text-[#b8849e] text-lg mt-1 font-medium tracking-wide">Order Status Board</p>
        </div>
        <div className="flex items-center gap-6 relative z-10">
          <button
            onClick={ding.enabled ? ding.disable : ding.enable}
            title={ding.enabled ? "Mute new-order ding" : "Enable new-order ding"}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-pink-200/60 bg-white/60 hover:bg-white/90 transition-colors text-[#7c3d5e] text-sm font-medium"
          >
            {ding.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 opacity-50" />}
            {ding.enabled ? (ding.needsUnlock ? "Tap to activate" : "Sound on") : "Sound off"}
          </button>
          <div className="text-right">
            <div className="text-4xl font-mono font-bold text-[#7c3d5e] tabular-nums">
              {hh}<span className={`transition-opacity duration-300 ${colonVisible ? 'opacity-100' : 'opacity-30'}`}>:</span>{mm}
            </div>
            <div className="text-sm text-[#b8849e] font-medium mt-1">
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-3 gap-0 relative">
        <div className="hidden lg:block absolute left-[33.33%] top-8 bottom-8 w-px column-divider" />
        <div className="hidden lg:block absolute left-[66.66%] top-8 bottom-8 w-px column-divider" />

        <div className="px-4 space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="h-4 w-4 rounded-full bg-green-500" />
              <div className="absolute inset-0 h-4 w-4 rounded-full bg-green-400 animate-ping" />
            </div>
            <h2 className="text-3xl font-serif font-bold text-green-700 ready-header-glow">Ready for Pickup</h2>
            <span className="bg-green-100 text-green-800 text-xl font-bold px-3.5 py-1 rounded-full min-w-[2.5rem] text-center animate-[count-pop_0.3s_ease] shadow-sm">
              {readyOrders?.length || 0}
            </span>
          </div>

          {readyOrders && readyOrders.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {readyOrders.map((order, i) => (
                <OrderCard key={order.id} order={order} variant="ready" index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-300/40" />
              <p className="text-xl text-green-400/60">No orders ready yet</p>
            </div>
          )}
        </div>

        <div className="px-4 space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="h-4 w-4 rounded-full bg-blue-500" />
              <div className="absolute inset-0 h-4 w-4 rounded-full bg-blue-400 animate-[pulse_2s_ease-in-out_infinite]" />
            </div>
            <h2 className="text-3xl font-serif font-bold text-blue-700">Preparing</h2>
            <span className="bg-blue-100 text-blue-800 text-xl font-bold px-3.5 py-1 rounded-full min-w-[2.5rem] text-center shadow-sm">
              {preparingOrders?.length || 0}
            </span>
          </div>

          {preparingOrders && preparingOrders.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {preparingOrders.map((order, i) => (
                <OrderCard key={order.id} order={order} variant="preparing" index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <ChefHat className="h-16 w-16 mx-auto mb-4 text-blue-300/40" />
              <p className="text-xl text-blue-400/60">Nothing being prepared</p>
            </div>
          )}
        </div>

        <div className="px-4 space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-4 w-4 rounded-full bg-amber-500" />
            <h2 className="text-3xl font-serif font-bold text-amber-700">In Queue</h2>
            <span className="bg-amber-100 text-amber-800 text-xl font-bold px-3.5 py-1 rounded-full min-w-[2.5rem] text-center shadow-sm">
              {pendingOrders?.length || 0}
            </span>
          </div>

          {pendingOrders && pendingOrders.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {pendingOrders.map((order, i) => (
                <OrderCard key={order.id} order={order} variant="pending" index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Clock className="h-16 w-16 mx-auto mb-4 text-amber-300/40" />
              <p className="text-xl text-amber-400/60">No orders in queue</p>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white/40 backdrop-blur-sm border-t border-pink-200/40 px-8 py-4 text-center">
        <p className="text-[#b8849e] text-lg font-medium tracking-wide">Listen for your name or check this board — we'll let you know when your order is ready!</p>
      </footer>
    </div>
  );
}
