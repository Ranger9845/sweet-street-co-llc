import { useEffect, useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useUpdateOrderStatus, getListOrdersQueryKey, getGetOrderStatsQueryKey, getGetOrderQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { OwnerLayout } from "@/components/layout/owner-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, ArrowLeft, Loader2 } from "lucide-react";

export default function SquarePosResult() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const updateStatus = useUpdateOrderStatus();

  const params = new URLSearchParams(search);
  const orderId = parseInt(params.get("orderId") || "0", 10);
  const rawData = params.get("data");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [transactionId, setTransactionId] = useState("");

  useEffect(() => {
    if (!orderId || !rawData) {
      setStatus("error");
      setErrorMessage("Missing order information.");
      return;
    }

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(atob(rawData));
    } catch {
      setStatus("error");
      setErrorMessage("Could not read Square response.");
      return;
    }

    if (result.status === "ok") {
      setTransactionId((result.transaction_id as string) ?? "");
      updateStatus.mutate(
        { id: orderId, data: { status: "ready" } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
            queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetOrderStatsQueryKey() });
            setStatus("success");
          },
          onError: () => {
            setStatus("success");
          },
        }
      );
    } else {
      const code = (result.error_code as string) ?? "unknown";
      setErrorMessage(squareErrorMessage(code));
      setStatus("error");
    }
  }, []);

  return (
    <OwnerLayout>
      <div className="max-w-md mx-auto pt-16 px-4">
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
            {status === "loading" && (
              <>
                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                <p className="text-muted-foreground">Processing payment…</p>
              </>
            )}

            {status === "success" && (
              <>
                <CheckCircle2 className="h-16 w-16 text-green-600" />
                <h1 className="text-2xl font-serif font-bold text-green-700">Payment Received!</h1>
                <p className="text-muted-foreground">
                  Order #{orderId} has been marked as ready.
                  {transactionId && (
                    <span className="block mt-1 text-xs text-muted-foreground/70">
                      Square Txn: {transactionId}
                    </span>
                  )}
                </p>
                <div className="flex flex-col gap-2 w-full mt-2">
                  <Link href={`/owner/orders/${orderId}`}>
                    <Button className="w-full">View Order</Button>
                  </Link>
                  <Link href="/owner">
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Dashboard
                    </Button>
                  </Link>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <XCircle className="h-16 w-16 text-destructive" />
                <h1 className="text-2xl font-serif font-bold text-destructive">Payment Not Completed</h1>
                <p className="text-muted-foreground">{errorMessage || "The payment was cancelled or failed."}</p>
                <div className="flex flex-col gap-2 w-full mt-2">
                  <Link href={`/owner/orders/${orderId}`}>
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Order
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </OwnerLayout>
  );
}

function squareErrorMessage(code: string): string {
  switch (code) {
    case "payment_canceled": return "Payment was cancelled.";
    case "user_not_logged_in": return "No one is logged in to Square POS.";
    case "app_not_on_approved_domain": return "This app isn't approved in Square developer settings.";
    case "amount_too_small": return "The amount is too small to charge.";
    default: return `Square returned an error: ${code}`;
  }
}
