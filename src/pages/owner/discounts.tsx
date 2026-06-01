import { useState, useEffect } from "react";
import { OwnerLayout } from "@/components/layout/owner-layout";
import { useOwnerAuth } from "@/components/owner-auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, School, ToggleLeft, ToggleRight, DollarSign, Percent, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DiscountCode = {
  id: number;
  code: string;
  schoolName: string;
  discountType: string;
  discountAmount: number;
  active: boolean;
  createdAt: string;
};

function discountLabel(code: DiscountCode) {
  if (code.discountType === "percent") return `${code.discountAmount}% off`;
  if (code.discountType === "free_delivery") return "Free delivery";
  return `$${code.discountAmount.toFixed(2)} off`;
}

function discountBadgeColor(type: string) {
  if (type === "percent") return "text-blue-700 border-blue-200 bg-blue-50";
  if (type === "free_delivery") return "text-purple-700 border-purple-200 bg-purple-50";
  return "text-emerald-700 border-emerald-200 bg-emerald-50";
}

export default function Discounts() {
  const { password } = useOwnerAuth();
  const { toast } = useToast();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>("dollar");
  const [newAmount, setNewAmount] = useState("1.00");
  const [saving, setSaving] = useState(false);

  const fetchCodes = async () => {
    try {
      const res = await fetch("/api/discount-codes", {
        headers: { "x-owner-token": password || "" },
      });
      if (res.ok) setCodes(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCodes(); }, [password]);

  const handleCreate = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-owner-token": password || "" },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          schoolName: newName.trim(),
          discountType: newType,
          discountAmount: newType === "free_delivery" ? 0 : (parseFloat(newAmount) || 1),
        }),
      });

      if (res.ok) {
        const created: DiscountCode = await res.json();
        setCodes((prev) => [...prev, created]);
        setNewCode("");
        setNewName("");
        setNewType("dollar");
        setNewAmount("1.00");
        setDialogOpen(false);
        toast({ title: "Code Created", description: `Code ${created.code} is ready to use.` });
      } else {
        const { error } = await res.json();
        toast({ title: "Error", description: error, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (code: DiscountCode) => {
    const res = await fetch(`/api/discount-codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-owner-token": password || "" },
      body: JSON.stringify({ active: !code.active }),
    });
    if (res.ok) {
      const updated: DiscountCode = await res.json();
      setCodes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/discount-codes/${id}`, { method: "DELETE", headers: { "x-owner-token": password || "" } });
    if (res.ok || res.status === 204) {
      setCodes((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Code Deleted" });
    }
  };

  return (
    <OwnerLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Discount Codes</h1>
            <p className="text-sm text-muted-foreground mt-1">Create codes to give customers a discount at checkout.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium">
                <Plus className="h-4 w-4" /> New Code
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] bg-white border border-border rounded-2xl shadow-xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Create Discount Code</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Customers enter this code at checkout to receive a discount.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="code" className="font-semibold text-foreground">Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g. SUMMIT2025"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    maxLength={20}
                    className="rounded-xl border-border focus:ring-ring"
                  />
                  <p className="text-xs font-medium text-muted-foreground">Will be converted to uppercase automatically.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-semibold text-foreground">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Summit Academy, Summer Promo, VIP"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="rounded-xl border-border focus:ring-ring"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-foreground">Discount Type</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger className="rounded-xl border-border focus:ring-ring">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dollar">
                        <span className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" /> Dollar Amount
                        </span>
                      </SelectItem>
                      <SelectItem value="percent">
                        <span className="flex items-center gap-2">
                          <Percent className="h-4 w-4" /> Percentage
                        </span>
                      </SelectItem>
                      <SelectItem value="free_delivery">
                        <span className="flex items-center gap-2">
                          <Truck className="h-4 w-4" /> Free Delivery
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newType !== "free_delivery" && (
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="font-semibold text-foreground">
                      {newType === "percent" ? "Discount Percent (%)" : "Discount Amount ($)"}
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      min="0.01"
                      max={newType === "percent" ? "100" : undefined}
                      step={newType === "percent" ? "1" : "0.01"}
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="rounded-xl border-border focus:ring-ring"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-border text-foreground/80">Cancel</Button>
                <Button onClick={handleCreate} disabled={saving || !newCode.trim() || !newName.trim()} className="bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium">
                  {saving ? "Creating..." : "Create Code"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <Card className="bg-white border border-border rounded-2xl shadow-sm"><CardContent className="py-8 text-center text-muted-foreground">Loading codes...</CardContent></Card>
        ) : codes.length === 0 ? (
          <Card className="bg-white border border-border rounded-2xl shadow-sm border-dashed">
            <CardContent className="py-16 text-center space-y-3">
              <School className="h-12 w-12 text-muted-foreground/50 mx-auto" />
              <p className="text-muted-foreground font-medium">No discount codes yet. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {codes.map((code) => (
              <Card key={code.id} className={`bg-white border border-border rounded-2xl shadow-sm transition-all ${code.active ? "" : "opacity-60 grayscale-[0.5]"}`}>
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-bold text-lg tracking-widest text-foreground">
                        {code.code}
                      </span>
                      <Badge className={code.active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200" : "bg-muted text-muted-foreground border border-border hover:bg-muted"}>
                        {code.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className={`font-semibold ${discountBadgeColor(code.discountType)}`}>
                        {discountLabel(code)}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {code.schoolName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={code.active ? "Deactivate" : "Activate"}
                      onClick={() => toggleActive(code)}
                      className="text-muted-foreground/70 hover:text-foreground hover:bg-muted rounded-xl"
                    >
                      {code.active
                        ? <ToggleRight className="h-6 w-6 text-foreground" />
                        : <ToggleLeft className="h-6 w-6" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(code.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="bg-muted/50 border border-border rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <School className="h-4 w-4" /> How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium text-muted-foreground space-y-2">
            <p>• Give your code to customers — they enter it at checkout to get the discount.</p>
            <p>• Dollar amount takes a flat amount off. Percentage takes a % off the total.</p>
            <p>• Free delivery codes will waive the delivery fee once delivery is available.</p>
            <p>• Toggle a code off anytime to stop new orders from using it.</p>
          </CardContent>
        </Card>
      </div>
    </OwnerLayout>
  );
}
