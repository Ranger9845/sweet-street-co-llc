import { OwnerLayout } from "@/components/layout/owner-layout";
import { formatSize } from "@/components/cart-provider";
import { useGetOrder, getGetOrderQueryKey, useUpdateOrderStatus, getListOrdersQueryKey, getGetOrderStatsQueryKey } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, ChefHat, Info } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";

export default function OrderDetail() {
  const params = useParams();
  const orderId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const updateStatus = useUpdateOrderStatus();

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: {
      enabled: !!orderId,
      queryKey: getGetOrderQueryKey(orderId)
    }
  });

  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  // Auto-mark as preparing when viewed if it was pending
  useEffect(() => {
    if (order && order.status === "pending") {
      updateStatus.mutate({ id: order.id, data: { status: "preparing" } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOrderStatsQueryKey() });
        }
      });
    }
  }, [order?.id, order?.status]);

  const toggleStep = (itemId: number, stepNumber: number) => {
    const key = `${itemId}-${stepNumber}`;
    setCheckedSteps(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const markReady = () => {
    if (!order) return;
    updateStatus.mutate({ id: order.id, data: { status: "ready" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrderStatsQueryKey() });
        setLocation("/owner");
      }
    });
  };

  const [squarePosLoading, setSquarePosLoading] = useState(false);

  const chargeViaSquarePOS = useCallback(async () => {
    if (!order) return;
    setSquarePosLoading(true);
    try {
      const configRes = await fetch("/api/payments/config");
      const config = await configRes.json();
      const appId: string = config.applicationId ?? "";

      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      const callbackUrl = `${window.location.origin}${basePath}/owner/square-pos-result?orderId=${order.id}`;

      const amountCents = Math.round(Number(order.totalAmount) * 100);

      const payload = {
        amount_money: { amount: amountCents, currency_code: "USD" },
        callback_url: callbackUrl,
        client_id: appId,
        version: "1.3",
        notes: `Sweet Street #${order.id} — ${order.customerName}`,
        options: {
          supported_tender_types: ["CREDIT_CARD", "CASH", "OTHER"],
        },
      };

      const encoded = btoa(JSON.stringify(payload));
      window.location.href = `square-commerce-v1://payment/create?data=${encoded}`;
    } finally {
      setSquarePosLoading(false);
    }
  }, [order]);

  if (isLoading || !order) {
    return <OwnerLayout><div className="p-8 text-center text-muted-foreground">Loading order details...</div></OwnerLayout>;
  }

  return (
    <OwnerLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <Link href="/owner">
            <Button variant="ghost" size="sm" className="pl-0 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
          <Badge className={`capitalize ${
            order.status === "pending" ? "bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100" :
            order.status === "preparing" ? "bg-muted text-foreground/90 border border-border hover:bg-muted" :
            order.status === "ready" ? "bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-100" :
            order.status === "completed" ? "bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-100" :
            "bg-muted text-foreground/90 border border-border"
          }`}>
            {order.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-1 space-y-6">
            <Card className="bg-white border border-border rounded-2xl shadow-sm">
              <CardHeader className="bg-muted/50 pb-4 border-b border-border/60 rounded-t-2xl">
                <CardTitle className="text-xl font-bold tracking-tight text-foreground">Order #{order.id}</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">
                  Placed {format(new Date(order.createdAt), "h:mm a")}
                </div>
                {(order as any).scheduledFor && (
                  <div className="flex items-center gap-1 mt-1 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-xl px-2 py-1">
                    Scheduled for {format(new Date((order as any).scheduledFor), "EEEE, MMM d 'at' h:mm a")}
                  </div>
                )}
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Customer</div>
                  <div className="font-medium text-foreground">{order.customerName}</div>
                  <div className="text-sm text-muted-foreground">{order.customerEmail}</div>
                  {order.customerPhone && (
                    <div className="text-sm text-muted-foreground mt-1">{order.customerPhone}</div>
                  )}
                </div>
                
                {order.notes && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Order Notes</div>
                    <div className="text-sm bg-muted/50 p-3 rounded-xl text-foreground/80 border border-border">
                      {order.notes}
                    </div>
                  </div>
                )}

                <Separator className="bg-muted" />
                
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Summary</div>
                  <div className="flex justify-between font-bold text-lg text-foreground">
                    <span>Total</span>
                    <span>${Number(order.totalAmount).toFixed(2)}</span>
                  </div>
                  {order.paidAt ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                      Prepaid
                    </div>
                  ) : (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                      Pay in Store
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button 
              className="w-full py-6 text-lg bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium disabled:opacity-50" 
              onClick={markReady}
              disabled={updateStatus.isPending || order.status === "ready" || order.status === "completed"}
            >
              <Check className="mr-2 h-5 w-5" />
              Mark Order Ready
            </Button>

          </div>

          <div className="md:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ChefHat className="h-6 w-6 text-foreground" />
              Prep Instructions
            </h2>

            {order.items.map((item, idx) => {
              // Find the full menu item to get the prep steps
              const menuItem = order.menuItems?.find(m => m.id === item.menuItemId);
              
              return (
                <Card key={idx} className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
                  <CardHeader className="bg-muted/50 pb-4 border-b border-border/60">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2 flex-wrap text-foreground">
                          <span className="bg-primary text-white h-6 w-6 rounded-full flex items-center justify-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <span className="font-bold tracking-tight">{item.menuItemName}</span>
                          {(item as any).temperature === "hot" && (
                            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border border-orange-200 text-xs gap-1">
                              Hot
                            </Badge>
                          )}
                          {(item as any).temperature === "cold" && (
                            <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs gap-1">
                              Iced
                            </Badge>
                          )}
                          {(item as any).lotusBase && (
                            <Badge className="bg-lime-100 text-lime-700 hover:bg-lime-100 border border-lime-200 text-xs gap-1">
                              {(item as any).lotusBase}
                            </Badge>
                          )}
                          {(item as any).milk && (
                            <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border border-blue-200 text-xs gap-1">
                              {(item as any).milk}
                            </Badge>
                          )}
                        </CardTitle>
                      </div>
                    </div>
                    {item.specialInstructions && (
                      <div className="mt-3 flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 shadow-sm">
                        <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                        <span className="text-sm font-medium">{item.specialInstructions}</span>
                      </div>
                    )}
                  </CardHeader>
                  
                  <CardContent className="pt-4 p-0">
                    {(() => {
                      const sps = (menuItem as any)?.sizePrepSteps as Record<string, { stepNumber: number; instruction: string }[]> | undefined;
                      const sizeSteps = item.size != null ? sps?.[item.size] : undefined;
                      const stepsToShow = (sizeSteps && sizeSteps.length > 0) ? sizeSteps : (menuItem?.prepSteps ?? []);
                      if (!stepsToShow || stepsToShow.length === 0) {
                        return <div className="p-4 text-muted-foreground text-sm italic">No specific prep steps recorded for this item.</div>;
                      }
                      return (
                      <div className="divide-y divide-zinc-100">
                        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-border text-foreground/80 bg-muted/50">
                            {formatSize(item.size)} prep
                          </Badge>
                          {sizeSteps && sizeSteps.length > 0 ? (
                            <span className="text-xs text-muted-foreground">Steps tailored for {formatSize(item.size)}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Showing default steps (no {formatSize(item.size)}-specific steps set)</span>
                          )}
                        </div>
                        {[...stepsToShow].sort((a,b) => a.stepNumber - b.stepNumber).map(step => {
                          const isChecked = checkedSteps[`${item.menuItemId}-${step.stepNumber}`] || false;
                          return (
                            <div 
                              key={step.stepNumber}
                              className={`p-4 flex items-start gap-3 cursor-pointer transition-colors ${isChecked ? 'bg-muted/50/80 opacity-75' : 'hover:bg-muted/50'}`}
                              onClick={() => toggleStep(item.menuItemId, step.stepNumber)}
                            >
                              <div className={`mt-0.5 shrink-0 h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${isChecked ? 'bg-primary border-primary text-white' : 'border-border bg-white'}`}>
                                {isChecked && <Check className="h-3.5 w-3.5" />}
                              </div>
                              <div className="space-y-1">
                                <div className={`text-sm font-semibold text-foreground/80 ${isChecked ? 'line-through opacity-70' : ''}`}>
                                  Step {step.stepNumber}
                                </div>
                                <div className={`text-sm text-foreground ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                                  {step.instruction}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              );
            })}
          </div>

        </div>
      </div>
    </OwnerLayout>
  );
}
