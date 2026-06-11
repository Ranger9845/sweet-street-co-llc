import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OwnerLayout } from "@/components/layout/owner-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOwnerAuth } from "@/components/owner-auth-provider";
import { useToast } from "@/hooks/use-toast";
import {
  Search, ScanLine, Package, TrendingDown, Plus,
  X, CheckCircle2, AlertTriangle, DollarSign,
  ChevronRight, Loader2, RotateCcw, Camera,
} from "lucide-react";
import { format, parseISO } from "date-fns";
// Polyfill for Safari and other browsers that lack native BarcodeDetector
import { BarcodeDetector as BarcodeDetectorPolyfill } from "barcode-detector/pure";

// ── Types ────────────────────────────────────────────────────────────────────

interface CatalogVariation {
  id: string;
  name: string;
  sku: string | null;
  upc: string | null;
  price: number;
  count: number | null;
  unitCost: number | null;
}

interface CatalogItem {
  id: string;
  name: string;
  variations: CatalogVariation[];
}

interface SearchResult {
  variationId: string;
  itemId: string | null;
  itemName: string;
  variationName: string;
  sku: string | null;
  upc: string | null;
  price: number;
  count: number | null;
  unitCost: number | null;
}

interface ReportData {
  days: number;
  totalSpent: number;
  receiveCount: number;
  receives: any[];
  byItem: { itemName: string; totalQty: number; totalCost: number }[];
}

// ── Hooks ────────────────────────────────────────────────────────────────────

function useOwnerHeaders() {
  const { password } = useOwnerAuth();
  return { "x-owner-password": password ?? "", "Content-Type": "application/json" };
}

// ── Barcode scanner ──────────────────────────────────────────────────────────
// Uses <input type="file" capture="environment"> so the native iOS camera
// opens directly — no getUserMedia / video stream needed, works on Safari.

interface ScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

function BarcodeScanner({ onDetected, onClose }: ScannerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const openPicker = () => {
    if (fileRef.current) {
      fileRef.current.value = "";
      fileRef.current.click();
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("processing");
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new BarcodeDetectorPolyfill({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
      });
      const barcodes = await detector.detect(bitmap);
      bitmap.close();
      if (barcodes.length > 0) {
        onDetected(barcodes[0].rawValue);
      } else {
        setErrorMsg("No barcode found — try getting closer or better lighting.");
        setStatus("error");
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Could not read the photo.");
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
      {/* Hidden file input — capture="environment" opens back camera on mobile */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm text-center space-y-4">
        {status === "processing" ? (
          <>
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
            <p className="font-semibold text-lg">Reading barcode…</p>
          </>
        ) : status === "error" ? (
          <>
            <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" />
            <div>
              <p className="font-bold text-lg">No barcode detected</p>
              <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <Button onClick={openPicker} className="w-full h-12 text-base rounded-xl">
              <Camera className="h-4 w-4 mr-2" /> Try Again
            </Button>
            <button onClick={onClose} className="text-sm text-muted-foreground block w-full py-1">
              Cancel
            </button>
          </>
        ) : (
          <>
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <ScanLine className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg">Scan Barcode</p>
              <p className="text-sm text-muted-foreground mt-1">
                Point your camera at the product barcode and take a photo
              </p>
            </div>
            <Button onClick={openPicker} className="w-full h-12 text-base rounded-xl">
              <Camera className="h-4 w-4 mr-2" /> Open Camera
            </Button>
            <button onClick={onClose} className="text-sm text-muted-foreground block w-full py-1">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Receive tab ──────────────────────────────────────────────────────────────

interface ReceiveFormProps { headers: Record<string, string> }

function ReceiveTab({ headers }: ReceiveFormProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [scanning, setScanning] = useState(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: searchData, isFetching } = useQuery({
    queryKey: ["inv-search", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { results: [] };
      const r = await fetch(`/api/inventory/search?q=${encodeURIComponent(debouncedQuery)}`, { headers });
      return r.json() as Promise<{ results: SearchResult[] }>;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("No item selected");
      const r = await fetch("/api/inventory/receive", {
        method: "POST",
        headers,
        body: JSON.stringify({
          variationId: selected.variationId,
          itemName: selected.itemName,
          variationName: selected.variationName,
          quantity: Number(qty),
          unitCost: cost ? Number(cost) : 0,
          notes: notes || undefined,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () => {
      toast({ title: "Stock received!", description: `${qty}× ${selected?.itemName}${selected?.variationName !== "Regular" ? ` (${selected?.variationName})` : ""} logged.` });
      qc.invalidateQueries({ queryKey: ["inv-catalog"] });
      qc.invalidateQueries({ queryKey: ["inv-report"] });
      setSelected(null);
      setQuery("");
      setQty("1");
      setCost("");
      setNotes("");
    },
    onError: (e: any) => toast({ title: "Failed to receive stock", description: e.message, variant: "destructive" }),
  });

  const selectResult = (r: SearchResult) => {
    setSelected(r);
    setQuery(`${r.itemName}${r.variationName !== "Regular" ? ` — ${r.variationName}` : ""}`);
    if (r.unitCost) setCost(String(r.unitCost));
  };

  const results = searchData?.results ?? [];
  const showDropdown = debouncedQuery.length >= 2 && !selected && results.length > 0;
  const showNoResults = debouncedQuery.length >= 2 && !selected && !isFetching && results.length === 0;

  return (
    <div className="space-y-4">
      {scanning && (
        <BarcodeScanner
          onDetected={(code) => { setScanning(false); setQuery(code); setDebouncedQuery(code); }}
          onClose={() => setScanning(false)}
        />
      )}

      {/* Search */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); }}
              placeholder="Search by name, SKU, or barcode…"
              className="pl-9 h-12 rounded-xl"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button
            variant="outline"
            className="h-12 w-12 p-0 rounded-xl shrink-0"
            onClick={() => setScanning(true)}
            title="Scan barcode"
          >
            <ScanLine className="h-5 w-5" />
          </Button>
        </div>

        {/* Dropdown results */}
        {showDropdown && (
          <div className="absolute z-20 top-full mt-1 left-0 right-12 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
            {results.map((r) => (
              <button key={r.variationId} onClick={() => selectResult(r)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50 last:border-0">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{r.itemName}</p>
                  {r.variationName !== "Regular" && (
                    <p className="text-xs text-muted-foreground">{r.variationName}</p>
                  )}
                  {r.upc && <p className="text-xs text-muted-foreground font-mono">{r.upc}</p>}
                </div>
                <div className="text-right shrink-0">
                  {r.count !== null && (
                    <Badge variant="outline" className={`text-xs ${r.count < 5 ? "border-amber-300 text-amber-700 bg-amber-50" : ""}`}>
                      {r.count} in stock
                    </Badge>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {showNoResults && (
          <div className="absolute z-20 top-full mt-1 left-0 right-12 bg-white border border-border rounded-xl shadow-lg px-4 py-3 text-sm text-muted-foreground text-center">
            No matching items for "{debouncedQuery}"
          </div>
        )}
      </div>

      {/* Selected item card + receive form */}
      {selected ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-start justify-between gap-3 p-4 border-b border-border/60">
            <div>
              <p className="font-bold text-base">{selected.itemName}</p>
              {selected.variationName !== "Regular" && (
                <p className="text-sm text-muted-foreground">{selected.variationName}</p>
              )}
              {selected.upc && <p className="text-xs text-muted-foreground font-mono mt-0.5">{selected.upc}</p>}
            </div>
            <div className="text-right shrink-0">
              {selected.count !== null && (
                <p className={`text-sm font-semibold ${selected.count < 5 ? "text-amber-600" : "text-emerald-600"}`}>
                  {selected.count} in stock
                </p>
              )}
              <button onClick={() => { setSelected(null); setQuery(""); }} className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 ml-auto">
                <X className="h-3 w-3" /> Change
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Quantity received
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="h-12 text-lg font-semibold rounded-xl text-center"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Unit cost ($)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                  className="h-12 text-lg font-semibold rounded-xl text-center"
                />
              </div>
            </div>

            {cost && qty && (
              <p className="text-sm text-muted-foreground text-center">
                Total: <span className="font-bold text-foreground">${(Number(qty) * Number(cost)).toFixed(2)}</span>
              </p>
            )}

            <Input
              placeholder="Notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-10 rounded-xl"
            />

            <Button
              className="w-full h-12 text-base font-semibold rounded-xl"
              disabled={!qty || Number(qty) <= 0 || receiveMutation.isPending}
              onClick={() => receiveMutation.mutate()}
            >
              {receiveMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                : <><CheckCircle2 className="h-4 w-4 mr-2" /> Receive {qty}× {selected.itemName.split(" ")[0]}</>}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <ScanLine className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">Search for an item above or tap the scan icon to scan a product barcode</p>
        </div>
      )}
    </div>
  );
}

// ── Stock tab ────────────────────────────────────────────────────────────────

interface StockTabProps { headers: Record<string, string> }

function StockTab({ headers }: StockTabProps) {
  const [filter, setFilter] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["inv-catalog"],
    queryFn: async () => {
      const r = await fetch("/api/inventory/catalog", { headers });
      return r.json() as Promise<{ items: CatalogItem[]; configured: boolean }>;
    },
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(filter.toLowerCase()) ||
    i.variations.some(v => v.sku?.includes(filter) || v.upc?.includes(filter))
  );

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!data?.configured) return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
      <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
      <p className="font-semibold">Square not configured</p>
      <p className="text-sm mt-1">Add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to enable inventory tracking.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter items…" className="pl-9 h-10 rounded-xl" />
        </div>
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => refetch()} disabled={isFetching}>
          <RotateCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">No items found.</p>
      )}

      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.id} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="font-semibold text-sm">{item.name}</p>
            </div>
            <div className="divide-y divide-border/60">
              {item.variations.map(v => {
                const low = v.count !== null && v.count < 5;
                const none = v.count !== null && v.count === 0;
                return (
                  <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground">{v.name}</p>
                      {v.upc && <p className="text-xs text-muted-foreground/60 font-mono">{v.upc}</p>}
                    </div>
                    {v.unitCost != null && (
                      <span className="text-xs text-muted-foreground">${v.unitCost.toFixed(2)}/ea</span>
                    )}
                    {v.count !== null ? (
                      <Badge className={`text-xs font-semibold shrink-0 ${
                        none ? "bg-red-100 text-red-700 border-red-200" :
                        low  ? "bg-amber-100 text-amber-700 border-amber-200" :
                               "bg-emerald-100 text-emerald-700 border-emerald-200"
                      }`} variant="outline">
                        {none && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {v.count} in stock
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">
                        Not tracked
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Report tab ───────────────────────────────────────────────────────────────

interface ReportTabProps { headers: Record<string, string> }

function ReportTab({ headers }: ReportTabProps) {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["inv-report", days],
    queryFn: async () => {
      const r = await fetch(`/api/inventory/report?days=${days}`, { headers });
      return r.json() as Promise<ReportData>;
    },
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      {/* Range picker */}
      <div className="flex gap-2">
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              days === d ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}>
            {d}d
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Total Spent</span>
              </div>
              <p className="text-2xl font-bold">${data.totalSpent.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">last {data.days} days</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Receives</span>
              </div>
              <p className="text-2xl font-bold">{data.receiveCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">stock entries</p>
            </div>
          </div>

          {/* By-item breakdown */}
          {data.byItem.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Spending by Item</p>
              </div>
              <div className="divide-y divide-border/60">
                {data.byItem.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.itemName}</p>
                      <p className="text-xs text-muted-foreground">{item.totalQty} units received</p>
                    </div>
                    <span className="text-sm font-bold shrink-0">${item.totalCost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent receive log */}
          {data.receives.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receive History</p>
              </div>
              <div className="divide-y divide-border/60">
                {data.receives.slice(0, 30).map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.item_name ?? r.variation_id}
                        {r.variation_name && r.variation_name !== "Regular" && (
                          <span className="text-muted-foreground font-normal"> — {r.variation_name}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(r.received_at), "MMM d, h:mm a")}
                        {r.notes && <span className="ml-1 italic">{r.notes}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{r.quantity}×</p>
                      {Number(r.unit_cost) > 0 && (
                        <p className="text-xs text-muted-foreground">${(Number(r.quantity) * Number(r.unit_cost)).toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.receives.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No receives logged in this period.</p>
              <p className="text-xs mt-1">Use the Receive tab to log incoming stock.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryManagement() {
  const headers = useOwnerHeaders();

  return (
    <OwnerLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Receive stock, track levels, and see spending</p>
        </div>

        <Tabs defaultValue="receive">
          <TabsList className="bg-muted border border-border rounded-full p-1 h-auto gap-1 w-full">
            <TabsTrigger value="receive" className="flex-1 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm font-medium px-3 py-1.5">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Receive
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex-1 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm font-medium px-3 py-1.5">
              <Package className="h-3.5 w-3.5 mr-1.5" /> Stock
            </TabsTrigger>
            <TabsTrigger value="report" className="flex-1 rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm text-sm font-medium px-3 py-1.5">
              <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Spending
            </TabsTrigger>
          </TabsList>

          <TabsContent value="receive" className="mt-4">
            <ReceiveTab headers={headers} />
          </TabsContent>
          <TabsContent value="stock" className="mt-4">
            <StockTab headers={headers} />
          </TabsContent>
          <TabsContent value="report" className="mt-4">
            <ReportTab headers={headers} />
          </TabsContent>
        </Tabs>
      </div>
    </OwnerLayout>
  );
}
