import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey, getGetOrderStatsQueryKey } from "@workspace/api-client-react";

export function useOrderEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const url = "/api/events/orders";
    const es = new EventSource(url);

    es.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ status: "pending" }) });
      void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ status: "preparing" }) });
      void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ status: "ready" }) });
      void queryClient.invalidateQueries({ queryKey: getGetOrderStatsQueryKey() });
    };

    es.onerror = () => {
      // Browser will auto-reconnect; no action needed
    };

    return () => {
      es.close();
    };
  }, [queryClient]);
}
