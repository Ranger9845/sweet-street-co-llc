import { OwnerLayout } from "@/components/layout/owner-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Gift } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { CupCardSkeleton } from "@/components/cup-spinner";

type Reward = {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  discountType: string;
  discountValue: number;
  active: boolean;
  createdAt: string;
};

const API = "/api";

export default function RewardsManagement() {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [discountType, setDiscountType] = useState("dollar");
  const [discountValue, setDiscountValue] = useState("");
  const [active, setActive] = useState(true);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/rewards`);
      if (res.ok) setRewards(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRewards(); }, []);

  const openNew = () => {
    setEditingId(null);
    setName(""); setDescription(""); setPointsCost(""); setDiscountType("dollar"); setDiscountValue(""); setActive(true);
    setDialogOpen(true);
  };

  const openEdit = (r: Reward) => {
    setEditingId(r.id);
    setName(r.name);
    setDescription(r.description || "");
    setPointsCost(String(r.pointsCost));
    setDiscountType(r.discountType);
    setDiscountValue(String(r.discountValue));
    setActive(r.active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const cost = parseInt(pointsCost, 10);
    if (!name.trim() || isNaN(cost) || cost <= 0) {
      toast({ title: "Name and a valid point cost are required", variant: "destructive" });
      return;
    }

    const body = { name, description: description || null, pointsCost: cost, discountType, discountValue: parseFloat(discountValue) || 0, active };

    const url = editingId ? `${API}/rewards/${editingId}` : `${API}/rewards`;
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      toast({ title: editingId ? "Reward Updated" : "Reward Created" });
      setDialogOpen(false);
      fetchRewards();
    } else {
      const { error } = await res.json();
      toast({ title: error || "Failed to save", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this reward?")) return;
    const res = await fetch(`${API}/rewards/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Reward Deleted" });
      fetchRewards();
    }
  };

  const toggleActive = async (r: Reward) => {
    await fetch(`${API}/rewards/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !r.active }),
    });
    fetchRewards();
  };

  return (
    <OwnerLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Rewards Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Create rewards customers can redeem with their loyalty points.</p>
          </div>
          <Button onClick={openNew} className="shrink-0 bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium">
            <Plus className="mr-2 h-4 w-4" /> Add Reward
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2].map(i => <CupCardSkeleton key={i} height={144} />)}
          </div>
        ) : rewards.length === 0 ? (
          <Card className="bg-white border border-border rounded-2xl shadow-sm p-12 text-center border-dashed">
            <Gift className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-xl font-bold tracking-tight text-foreground">No rewards yet</h3>
            <p className="text-sm font-medium text-muted-foreground mt-2">Create your first reward so customers can redeem points!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rewards.map((r) => (
              <Card key={r.id} className={`flex flex-col bg-white border border-border rounded-2xl shadow-sm transition-all ${!r.active ? 'opacity-60 grayscale-[0.3]' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-bold tracking-tight text-foreground">{r.name}</CardTitle>
                    <Badge className={r.active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200" : "bg-muted text-muted-foreground border border-border hover:bg-muted"}>
                      {r.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {r.description && <p className="text-sm font-medium text-muted-foreground mt-1">{r.description}</p>}
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary" className="bg-muted text-foreground/90 border border-border font-semibold">{r.pointsCost} pts</Badge>
                    <Badge variant="outline" className="border-border text-muted-foreground font-medium">
                      {r.discountType === "percent"
                        ? `${r.discountValue}% off`
                        : r.discountType === "free_item"
                          ? "Free item"
                          : `$${(r.discountValue ?? 0).toFixed(2)} off`}
                    </Badge>
                  </div>
                </CardContent>
                <div className="border-t border-border/60 bg-muted/50 p-3 flex justify-between items-center rounded-b-2xl">
                  <div className="flex items-center space-x-2">
                    <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
                    <Label className="text-xs font-medium text-foreground/80">{r.active ? "Active" : "Inactive"}</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(r)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[450px] bg-white border border-border rounded-2xl shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">{editingId ? "Edit Reward" : "New Reward"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="font-semibold text-foreground">Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Free 16oz Drink" className="rounded-xl border-border focus:ring-ring" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-foreground">Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What the customer gets..." rows={2} className="rounded-xl border-border focus:ring-ring" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-foreground">Points Cost</Label>
                <Input type="number" value={pointsCost} onChange={e => setPointsCost(e.target.value)} placeholder="100" className="rounded-xl border-border focus:ring-ring" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-foreground">Discount Type</Label>
                  <Select value={discountType} onValueChange={setDiscountType}>
                    <SelectTrigger className="rounded-xl border-border focus:ring-ring"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dollar">Dollar Off</SelectItem>
                      <SelectItem value="percent">Percent Off</SelectItem>
                      <SelectItem value="free_item">Free Item</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-foreground">{discountType === "percent" ? "Percent" : discountType === "free_item" ? "Value (optional)" : "Amount ($)"}</Label>
                  <Input type="number" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="5.00" className="rounded-xl border-border focus:ring-ring" />
                </div>
              </div>
              <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-xl border border-border">
                <Switch checked={active} onCheckedChange={setActive} />
                <Label className="font-semibold text-foreground">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl border-border text-foreground/80">Cancel</Button>
              <Button onClick={handleSave} className="bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </OwnerLayout>
  );
}
