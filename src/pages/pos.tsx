import { useListMenuItems } from "@workspace/api-client-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, Minus, Trash2, Monitor, CheckCircle2, RotateCcw, XCircle, Wifi, WifiOff, Banknote, Smartphone } from "lucide-react";
import { CupSpinner } from "@/components/cup-spinner";

type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

type OrderResult = {
  id: number;
  totalAmount: number;
} | null;

type TerminalDevice = {
  id: string;
  name: string;
  status: string;
};

type CheckoutState = {
  checkoutId: string;
  status: string;
} | null;

type PaymentMethod = "terminal" | "cash" | "square-reader";

type SquareConfig = {
  configured: boolean;
  applicationId: string | null;
  locationId: string | null;
  environment: string;
} | null;

const TAX_RATE = 0.09;

export default function POS() {
  const { data: menuItems } = useListMenuItems();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult>(null);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("terminal");

  // Terminal state
  const [devices, setDevices] = useState<TerminalDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Square Reader state
  const [squareConfig, setSquareConfig] = useState<SquareConfig>(null);
  const [readerAwaitingConfirm, setReaderAwaitingConfirm] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100;
  const grandTotal = subtotal + taxAmount;

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/terminal/devices");
      const data = await res.json();
      setDevices(data.devices || []);
      if (data.devices?.length === 1 && !selectedDevice) {
        setSelectedDevice(data.devices[0].id);
      }
    } catch {
      setDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    fetchDevices();
    fetch("/api/payments/config")
      .then((r) => r.ok ? r.json() : null)
      .then(setSquareConfig)
      .catch(() => {});
  }, [fetchDevices]);

  const startTerminalCheckout = async () => {
    if (!selectedDevice || subtotal <= 0) return;
    setProcessing(true);
    setError("");

    try {
      const res = await fetch("/api/payments/terminal/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDevice,
          customerName: customerName || "Walk-in",
          items: cart.map((item) => ({
            menuItemId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const { error: errMsg } = await res.json();
        setError(errMsg || "Failed to send to terminal");
        setProcessing(false);
        return;
      }

      const checkout = await res.json();
      setCheckoutState(checkout);
      startPolling(checkout.checkoutId);
    } catch (e: any) {
      setError(e?.message || "Failed to connect to terminal");
      setProcessing(false);
    }
  };

  const startPolling = (checkoutId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/terminal/checkout/${checkoutId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "COMPLETED") {
          stopPolling();
          await completeOrder(checkoutId);
        } else if (data.status === "CANCELED" || data.status === "CANCEL_REQUESTED") {
          stopPolling();
          setError("Payment was canceled on the terminal.");
          setProcessing(false);
          setCheckoutState(null);
        }
      } catch {}
    }, 2000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => { return () => stopPolling(); }, []);

  const completeOrder = async (checkoutId: string) => {
    try {
      const res = await fetch("/api/payments/terminal/complete-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId }),
      });
      if (!res.ok) {
        const { error: errMsg } = await res.json();
        setError(errMsg || "Payment succeeded but order creation failed");
        setProcessing(false);
        setCheckoutState(null);
        return;
      }
      const order = await res.json();
      setOrderResult({ id: order.id, totalAmount: Number(order.totalAmount) });
      setProcessing(false);
      setCheckoutState(null);
    } catch {
      setError("Payment succeeded but order creation failed. Check dashboard.");
      setProcessing(false);
      setCheckoutState(null);
    }
  };

  const cancelCheckout = async () => {
    if (!checkoutState?.checkoutId) return;
    try {
      const res = await fetch(`/api/payments/terminal/checkout/${checkoutState.checkoutId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        setError("Could not cancel — the customer may have already paid. Please wait.");
        return;
      }
      stopPolling();
      setProcessing(false);
      setCheckoutState(null);
      setError("");
    } catch {
      setError("Failed to cancel. Please wait for the terminal to finish.");
    }
  };

  const processCashOrder = async () => {
    if (subtotal <= 0) return;
    setProcessing(true);
    setError("");
    try {
      const res = await fetch("/api/payments/pos/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName || "Walk-in",
          items: cart.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
        }),
      });
      if (!res.ok) {
        const { error: errMsg } = await res.json();
        setError(errMsg || "Failed to create order");
        setProcessing(false);
        return;
      }
      const order = await res.json();
      setOrderResult({ id: order.id, totalAmount: Number(order.totalAmount) });
    } catch (e: any) {
      setError(e?.message || "Failed to create order");
    } finally {
      setProcessing(false);
    }
  };

  const openSquareApp = () => {
    if (!squareConfig?.applicationId) return;
    const amountCents = Math.round(grandTotal * 100);
    const payload = {
      amount_money: { amount: amountCents, currency_code: "USD" },
      client_id: squareConfig.applicationId,
      version: "1.3",
      notes: `Sweet Street${customerName ? ` - ${customerName}` : ""}`,
    };
    window.location.href = `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify(payload))}`;
    // After returning from Square app, show the confirm button
    setTimeout(() => setReaderAwaitingConfirm(true), 1500);
  };

  const confirmSquareReaderPayment = async () => {
    await processCashOrder();
    setReaderAwaitingConfirm(false);
  };

  const addToCart = (item: { id: number; name: string; price: number }) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev.map((c) => c.id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter((c) => c.quantity > 0)
    );
  };

  const newOrder = () => {
    setCart([]);
    setCustomerName("");
    setOrderResult(null);
    setError("");
    setCheckoutState(null);
    setReaderAwaitingConfirm(false);
    stopPolling();
  };

  const availableItems = menuItems?.filter((m) => m.available) || [];

  if (orderResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fdf2f0] to-[#fce8f0] flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-xl p-12 text-center max-w-md w-full space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-serif font-bold text-[#7c3d5e]">Payment Complete</h2>
          <div className="space-y-2">
            <p className="text-xl text-gray-700">Order <span className="font-bold">#{orderResult.id}</span></p>
            <p className="text-2xl font-bold text-[#7c3d5e]">${orderResult.totalAmount.toFixed(2)}</p>
          </div>
          <button
            onClick={newOrder}
            className="w-full py-4 bg-[#7c3d5e] hover:bg-[#6b3450] text-white rounded-xl text-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="h-5 w-5" />
            New Order
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { key: "terminal", label: "Terminal", icon: <Monitor className="h-4 w-4" /> },
    { key: "square-reader", label: "Square App", icon: <Smartphone className="h-4 w-4" /> },
    { key: "cash", label: "Cash", icon: <Banknote className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf2f0] to-[#fce8f0] flex flex-col lg:flex-row">
      {/* Menu */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-bold text-[#7c3d5e]">Sweet Street POS</h1>
          <p className="text-[#9e6b82] mt-1">Tap items to add them to the order</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {availableItems.map((item) => {
            const inCart = cart.find((c) => c.id === item.id);
            return (
              <button
                key={item.id}
                onClick={() => addToCart({ id: item.id, name: item.name, price: item.price ?? 0 })}
                disabled={processing}
                className={`relative bg-white rounded-xl p-4 text-left shadow-sm border-2 transition-all duration-200 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                  inCart ? "border-[#7c3d5e] bg-pink-50/50" : "border-transparent hover:border-pink-200"
                }`}
              >
                {inCart && (
                  <span className="absolute -top-2 -right-2 bg-[#7c3d5e] text-white text-xs font-bold h-6 w-6 rounded-full flex items-center justify-center shadow">
                    {inCart.quantity}
                  </span>
                )}
                <p className="font-semibold text-gray-800 text-sm leading-tight">{item.name}</p>
                <p className="text-[#7c3d5e] font-bold mt-2">${(item.price ?? 0).toFixed(2)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-[420px] bg-white border-l border-pink-100 flex flex-col shadow-xl">
        {/* Customer name + payment tabs */}
        <div className="p-5 border-b border-gray-100 space-y-3">
          <input
            type="text"
            placeholder="Customer name (optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            disabled={processing}
            className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3d5e]/30 focus:border-[#7c3d5e]/50 disabled:opacity-50"
          />

          {/* Payment method tabs */}
          <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setPaymentMethod(tab.key); setError(""); setReaderAwaitingConfirm(false); }}
                disabled={processing}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                  paymentMethod === tab.key
                    ? "bg-white text-[#7c3d5e] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                } disabled:opacity-50`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Terminal device selector */}
          {paymentMethod === "terminal" && (
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-[#9e6b82]" />
              <span className="text-xs font-medium text-gray-600">Device:</span>
              {loadingDevices ? (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <CupSpinner size={14} /> Finding devices...
                </span>
              ) : devices.length === 0 ? (
                <div className="flex items-center gap-1.5">
                  <WifiOff className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-amber-600">No terminal found</span>
                  <button onClick={fetchDevices} className="text-xs text-[#7c3d5e] hover:underline ml-1">Refresh</button>
                </div>
              ) : devices.length === 1 ? (
                <div className="flex items-center gap-1.5">
                  <Wifi className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-green-700 font-medium">{devices[0].name}</span>
                </div>
              ) : (
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#7c3d5e]/30"
                >
                  <option value="">Select terminal...</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Square Reader info */}
          {paymentMethod === "square-reader" && (
            <div className="bg-blue-50 rounded-xl px-3 py-2.5 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Using Square's own app with your reader</p>
              <p className="text-blue-600">Download <strong>Square Point of Sale</strong> from the App Store (it's free), sign in with your Square account, and connect your reader. Then tap the button below to open it with the total pre-filled.</p>
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-auto p-5">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3 py-12">
              <Monitor className="h-12 w-12 opacity-30" />
              <p className="text-sm font-medium">No items added</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">${item.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      disabled={processing}
                      className="h-7 w-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-50"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      disabled={processing}
                      className="h-7 w-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-90 transition-all disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="font-bold text-sm w-16 text-right">${(item.price * item.quantity).toFixed(2)}</p>
                  <button
                    onClick={() => setCart((prev) => prev.filter((c) => c.id !== item.id))}
                    disabled={processing}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total + action buttons */}
        <div className="border-t border-gray-100 p-5 space-y-4">
          {/* Price breakdown */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Tax (9%)</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <span className="text-gray-600 font-medium">Total</span>
              <span className="text-3xl font-bold text-[#7c3d5e]">${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Terminal payment */}
          {paymentMethod === "terminal" && cart.length > 0 && !processing && (
            <div className="space-y-3">
              <button
                onClick={startTerminalCheckout}
                disabled={!selectedDevice || subtotal <= 0}
                className="w-full py-4 bg-[#7c3d5e] hover:bg-[#6b3450] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-lg font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                <Monitor className="h-5 w-5" />
                Charge ${grandTotal.toFixed(2)} to Terminal
              </button>
              {!selectedDevice && devices.length === 0 && (
                <p className="text-xs text-center text-amber-600">Connect a Square Terminal to accept payments</p>
              )}
            </div>
          )}

          {/* Terminal waiting */}
          {paymentMethod === "terminal" && processing && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center space-y-3">
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                  <Monitor className="absolute inset-0 m-auto h-6 w-6 text-blue-600" />
                </div>
                <p className="font-semibold text-blue-800 text-lg">Waiting for customer...</p>
                <p className="text-sm text-blue-600">Customer should tap, dip, or swipe on the Terminal</p>
                <p className="text-xs text-blue-500">${grandTotal.toFixed(2)}</p>
              </div>
              <button
                onClick={cancelCheckout}
                className="w-full py-3 bg-white border-2 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <XCircle className="h-5 w-5" />
                Cancel Payment
              </button>
            </div>
          )}

          {/* Cash payment */}
          {paymentMethod === "cash" && cart.length > 0 && !processing && (
            <button
              onClick={processCashOrder}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-lg font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
            >
              <Banknote className="h-5 w-5" />
              Collect ${grandTotal.toFixed(2)} Cash
            </button>
          )}

          {/* Square Reader / Square App */}
          {paymentMethod === "square-reader" && cart.length > 0 && !processing && (
            <div className="space-y-3">
              {!readerAwaitingConfirm ? (
                <>
                  <button
                    onClick={openSquareApp}
                    disabled={!squareConfig?.applicationId}
                    className="w-full py-4 bg-[#006aff] hover:bg-[#0055cc] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-lg font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                  >
                    <Smartphone className="h-5 w-5" />
                    Open Square App — ${grandTotal.toFixed(2)}
                  </button>
                  {!squareConfig?.applicationId && (
                    <p className="text-xs text-center text-amber-600">Square isn't configured yet — check Settings.</p>
                  )}
                  <button
                    onClick={() => setReaderAwaitingConfirm(true)}
                    className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors underline underline-offset-2"
                  >
                    Already paid in Square app? Confirm here
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center space-y-1">
                    <p className="font-semibold text-green-800">Did the payment go through?</p>
                    <p className="text-sm text-green-600">Confirm to record the order in Sweet Street.</p>
                  </div>
                  <button
                    onClick={confirmSquareReaderPayment}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-lg font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Yes, Payment Received
                  </button>
                  <button
                    onClick={() => setReaderAwaitingConfirm(false)}
                    className="w-full py-2.5 text-sm text-red-400 hover:text-red-600 font-medium transition-colors"
                  >
                    No, go back
                  </button>
                </div>
              )}
            </div>
          )}

          {processing && paymentMethod !== "terminal" && (
            <div className="flex items-center justify-center gap-2 py-3 text-[#7c3d5e]">
              <CupSpinner size={20} />
              <span className="text-sm font-medium">Processing...</span>
            </div>
          )}

          {cart.length > 0 && !processing && (
            <button
              onClick={newOrder}
              className="w-full py-2.5 text-sm text-red-400 hover:text-red-600 font-medium transition-colors"
            >
              Clear Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
