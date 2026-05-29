import { OwnerLayout } from "@/components/layout/owner-layout";
import { useListMenuItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem, getListMenuItemsQueryKey, useListModifiers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, PlusCircle, MinusCircle, GripVertical, Snowflake, Flame, Thermometer } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { CupCardSkeleton } from "@/components/cup-spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Size = "16oz" | "24oz" | "34oz";
type Step = { stepNumber: number; instruction: string };
type Ing = { name: string; amount: string };
type SizeStepMap = Record<Size, Step[]>;
type SizeIngMap = Record<Size, Ing[]>;
const SIZES: Size[] = ["16oz", "24oz", "34oz"];
const emptyStepMap = (): SizeStepMap => ({ "16oz": [{ stepNumber: 1, instruction: "" }], "24oz": [{ stepNumber: 1, instruction: "" }], "34oz": [{ stepNumber: 1, instruction: "" }] });
const emptyIngMap = (): SizeIngMap => ({ "16oz": [{ name: "", amount: "" }], "24oz": [{ name: "", amount: "" }], "34oz": [{ name: "", amount: "" }] });

export default function MenuManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: menuItems, isLoading } = useListMenuItems();
  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const deleteMenuItem = useDeleteMenuItem();

  const { data: allModifiers } = useListModifiers();

  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formModifierIds, setFormModifierIds] = useState<number[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price16, setPrice16] = useState("");
  const [price24, setPrice24] = useState("");
  const [price34, setPrice34] = useState("");
  const [available, setAvailable] = useState(true);
  const [temperature, setTemperature] = useState<"hot" | "cold" | "both">("cold");
  const [sizeIngredients, setSizeIngredients] = useState<SizeIngMap>(emptyIngMap);
  const [activeIngSize, setActiveIngSize] = useState<Size>("16oz");
  const [sizePrepSteps, setSizePrepSteps] = useState<SizeStepMap>(emptyStepMap);
  const [activeStepSize, setActiveStepSize] = useState<Size>("16oz");

  const openNewForm = () => {
    setEditingItem(null);
    setName("");
    setDescription("");
    setPrice16(""); setPrice24(""); setPrice34("");
    setAvailable(true);
    setTemperature("cold");
    setSizeIngredients(emptyIngMap());
    setActiveIngSize("16oz");
    setSizePrepSteps(emptyStepMap());
    setActiveStepSize("16oz");
    setFormModifierIds([]);
    setIsEditing(true);
  };

  const openEditForm = (item: any) => {
    setEditingItem(item);
    setName(item.name);
    setDescription(item.description || "");
    const sp = item.sizePrices || {};
    setPrice16(sp["16oz"] ? String(sp["16oz"]) : "");
    setPrice24(sp["24oz"] ? String(sp["24oz"]) : "");
    setPrice34(sp["34oz"] ? String(sp["34oz"]) : "");
    setAvailable(item.available);
    setTemperature(((item as any).temperature as "hot" | "cold" | "both") || "cold");

    const sIng = item.sizeIngredients || {};
    const legacyIngs: Ing[] = item.ingredients?.length ? [...item.ingredients] : [];
    const nextIng: SizeIngMap = { "16oz": [], "24oz": [], "34oz": [] };
    for (const s of SIZES) {
      const fromSize = sIng[s] as Ing[] | undefined;
      nextIng[s] = (fromSize && fromSize.length)
        ? fromSize.map(x => ({ ...x }))
        : (legacyIngs.length ? legacyIngs.map(x => ({ ...x })) : [{ name: "", amount: "" }]);
    }
    setSizeIngredients(nextIng);
    setActiveIngSize("16oz");

    const sps = item.sizePrepSteps || {};
    const legacy: Step[] = item.prepSteps?.length ? [...item.prepSteps].sort((a: Step, b: Step) => a.stepNumber - b.stepNumber) : [];
    const next: SizeStepMap = { "16oz": [], "24oz": [], "34oz": [] };
    for (const s of SIZES) {
      const fromSize = sps[s] as Step[] | undefined;
      const list = (fromSize && fromSize.length) ? [...fromSize].sort((a, b) => a.stepNumber - b.stepNumber) : (legacy.length ? legacy.map(x => ({ ...x })) : [{ stepNumber: 1, instruction: "" }]);
      next[s] = list;
    }
    setSizePrepSteps(next);
    setActiveStepSize("16oz");
    setFormModifierIds((item.modifierIds as number[] | null) ?? []);
    setIsEditing(true);
  };

  const updateStepsFor = (size: Size, updater: (steps: Step[]) => Step[]) => {
    setSizePrepSteps(prev => ({ ...prev, [size]: updater(prev[size]) }));
  };

  const copyStepsToOtherSizes = (from: Size) => {
    const src = sizePrepSteps[from].map(s => ({ ...s }));
    setSizePrepSteps({
      "16oz": from === "16oz" ? src : src.map(s => ({ ...s })),
      "24oz": from === "24oz" ? src : src.map(s => ({ ...s })),
      "34oz": from === "34oz" ? src : src.map(s => ({ ...s })),
    });
    toast({ title: `Copied ${from} steps to all sizes` });
  };

  const updateIngsFor = (size: Size, updater: (ings: Ing[]) => Ing[]) => {
    setSizeIngredients(prev => ({ ...prev, [size]: updater(prev[size]) }));
  };

  const copyIngsToOtherSizes = (from: Size) => {
    const src = sizeIngredients[from].map(i => ({ ...i }));
    setSizeIngredients({
      "16oz": from === "16oz" ? src : src.map(i => ({ ...i })),
      "24oz": from === "24oz" ? src : src.map(i => ({ ...i })),
      "34oz": from === "34oz" ? src : src.map(i => ({ ...i })),
    });
    toast({ title: `Copied ${from} ingredients to all sizes` });
  };

  const copyIngsIntoPrepSteps = (size: Size, mode: "append" | "replace") => {
    const validIngs = sizeIngredients[size].filter(i => i.name.trim() !== "");
    if (validIngs.length === 0) {
      toast({ title: `No ingredients for ${size} to copy`, variant: "destructive" });
      return;
    }
    const ingSteps: Step[] = validIngs.map((i, idx) => ({
      stepNumber: idx + 1,
      instruction: i.amount.trim() ? `Add ${i.amount.trim()} of ${i.name.trim()}` : `Add ${i.name.trim()}`,
    }));
    setSizePrepSteps(prev => {
      const existing = mode === "replace"
        ? []
        : prev[size].filter(s => s.instruction.trim() !== "");
      const combined = [...existing, ...ingSteps].map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
      return { ...prev, [size]: combined };
    });
    setActiveStepSize(size);
    toast({ title: `${mode === "replace" ? "Replaced" : "Appended"} ${validIngs.length} step${validIngs.length === 1 ? "" : "s"} from ${size} ingredients` });
  };

  const handleSave = () => {
    const p16 = parseFloat(price16);
    const p24 = parseFloat(price24);
    const p34 = parseFloat(price34);
    const validPrices = [p16, p24, p34].filter(p => !isNaN(p) && p > 0);

    if (validPrices.length === 0) {
      toast({ title: "Set at least one size price", variant: "destructive" });
      return;
    }

    const fallback = Math.min(...validPrices);
    const sizePrices = {
      "16oz": !isNaN(p16) && p16 > 0 ? p16 : fallback,
      "24oz": !isNaN(p24) && p24 > 0 ? p24 : fallback,
      "34oz": !isNaN(p34) && p34 > 0 ? p34 : fallback,
    };
    const basePrice = sizePrices["16oz"];

    const cleanedSizeIngs: SizeIngMap = {
      "16oz": sizeIngredients["16oz"].filter(i => i.name.trim() !== "").map(i => ({ name: i.name.trim(), amount: i.amount.trim() })),
      "24oz": sizeIngredients["24oz"].filter(i => i.name.trim() !== "").map(i => ({ name: i.name.trim(), amount: i.amount.trim() })),
      "34oz": sizeIngredients["34oz"].filter(i => i.name.trim() !== "").map(i => ({ name: i.name.trim(), amount: i.amount.trim() })),
    };
    // Legacy ingredients fallback = the largest non-empty size list (so old consumers still work)
    const validIngredients = (cleanedSizeIngs["34oz"].length ? cleanedSizeIngs["34oz"] : cleanedSizeIngs["24oz"].length ? cleanedSizeIngs["24oz"] : cleanedSizeIngs["16oz"]);
    const cleanedSizeSteps: SizeStepMap = {
      "16oz": sizePrepSteps["16oz"].filter(s => s.instruction.trim() !== "").map((s, idx) => ({ ...s, stepNumber: idx + 1 })),
      "24oz": sizePrepSteps["24oz"].filter(s => s.instruction.trim() !== "").map((s, idx) => ({ ...s, stepNumber: idx + 1 })),
      "34oz": sizePrepSteps["34oz"].filter(s => s.instruction.trim() !== "").map((s, idx) => ({ ...s, stepNumber: idx + 1 })),
    };
    // Legacy prepSteps fallback = the largest non-empty list (so old consumers still work)
    const legacyFallback = (cleanedSizeSteps["16oz"].length ? cleanedSizeSteps["16oz"] : cleanedSizeSteps["24oz"].length ? cleanedSizeSteps["24oz"] : cleanedSizeSteps["34oz"]);

    const data = {
      name,
      description: description || null,
      price: basePrice,
      sizePrices,
      available,
      ingredients: validIngredients,
      sizeIngredients: cleanedSizeIngs,
      prepSteps: legacyFallback,
      sizePrepSteps: cleanedSizeSteps,
      temperature,
      modifierIds: formModifierIds,
    };

    if (editingItem) {
      updateMenuItem.mutate({ id: editingItem.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
          setIsEditing(false);
          toast({ title: "Item Updated" });
        }
      });
    } else {
      createMenuItem.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
          setIsEditing(false);
          toast({ title: "Item Created" });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteMenuItem.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
          toast({ title: "Item Deleted" });
        }
      });
    }
  };

  const toggleAvailability = (id: number, current: boolean) => {
    updateMenuItem.mutate({ id, data: { available: !current } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
      }
    });
  };

  return (
    <OwnerLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Menu Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Add, edit, and organize your dirty sodas.</p>
          </div>
          <Button onClick={openNewForm} className="shrink-0 bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium">
            <Plus className="mr-2 h-4 w-4" /> Add New Drink
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <CupCardSkeleton key={i} height={192} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {menuItems?.map(item => (
              <Card key={item.id} className={`flex flex-col bg-white border border-border rounded-2xl shadow-sm ${!item.available ? 'opacity-70 grayscale-[0.3]' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-xl font-bold tracking-tight text-foreground">{item.name}</CardTitle>
                      {(() => {
                        const t = ((item as any).temperature as "hot" | "cold" | "both") || "cold";
                        if (t === "hot") return <Badge className="bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-50"><Flame className="h-3 w-3 mr-1" />Hot</Badge>;
                        if (t === "both") return <Badge className="bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-50"><Thermometer className="h-3 w-3 mr-1" />Hot or Cold</Badge>;
                        return <Badge className="bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-50"><Snowflake className="h-3 w-3 mr-1" />Cold</Badge>;
                      })()}
                    </div>
                    <div className="font-semibold bg-muted text-foreground/90 px-2 py-1 rounded-lg text-sm shrink-0 border border-border">
                      {(() => {
                        const sp = (item as any).sizePrices || {};
                        const prices = [sp["16oz"], sp["24oz"], sp["34oz"]].filter((p: number) => p > 0);
                        if (prices.length === 0) return `$${item.price.toFixed(2)}`;
                        const lo = Math.min(...prices);
                        const hi = Math.max(...prices);
                        return lo === hi ? `$${lo.toFixed(2)}` : `$${lo.toFixed(2)}–$${hi.toFixed(2)}`;
                      })()}
                    </div>
                  </div>
                  {item.description && <CardDescription className="line-clamp-2 mt-1 text-muted-foreground">{item.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.ingredients?.slice(0, 4).map((ing, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-muted/50 border-border font-medium text-muted-foreground">
                        {ing.name}
                      </Badge>
                    ))}
                    {(item.ingredients?.length || 0) > 4 && (
                      <Badge variant="outline" className="text-xs bg-muted/50 border-border font-medium text-muted-foreground">+{item.ingredients!.length - 4} more</Badge>
                    )}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground mt-3">
                    {(() => {
                      const sps = (item as any).sizePrepSteps as SizeStepMap | undefined;
                      if (sps) {
                        const counts = SIZES.map(s => `${s.replace("oz", "")}: ${sps[s]?.length || 0}`).join(" · ");
                        return <span>Prep steps — {counts}</span>;
                      }
                      return <span>{item.prepSteps?.length || 0} prep steps defined</span>;
                    })()}
                  </div>
                </CardContent>
                <div className="border-t border-border/60 bg-muted/50 p-3 flex justify-between items-center rounded-b-2xl">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={item.available} 
                      onCheckedChange={() => toggleAvailability(item.id, item.available)}
                      disabled={updateMenuItem.isPending}
                    />
                    <Label className="text-xs font-medium text-foreground/80">{item.available ? 'Available' : 'Hidden'}</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEditForm(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white border border-border rounded-2xl shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">{editingItem ? 'Edit Menu Item' : 'New Menu Item'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              
              <div className="space-y-2">
                <Label className="font-semibold text-foreground">Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dirty Dr. Pepper" className="rounded-xl border-border focus:ring-ring" />
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold text-foreground">Size Pricing</Label>
                <p className="text-xs font-medium text-muted-foreground">Set the price for each cup size.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">16 oz ($)</Label>
                    <Input type="number" step="0.01" value={price16} onChange={e => setPrice16(e.target.value)} placeholder="4.50" className="rounded-xl border-border focus:ring-ring" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">24 oz ($)</Label>
                    <Input type="number" step="0.01" value={price24} onChange={e => setPrice24(e.target.value)} placeholder="5.50" className="rounded-xl border-border focus:ring-ring" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">32 oz ($)</Label>
                    <Input type="number" step="0.01" value={price34} onChange={e => setPrice34(e.target.value)} placeholder="6.50" className="rounded-xl border-border focus:ring-ring" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-foreground">Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Delicious description..." rows={2} className="rounded-xl border-border focus:ring-ring" />
              </div>

              <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-xl border border-border">
                <Switch checked={available} onCheckedChange={setAvailable} />
                <Label className="font-semibold text-foreground">Available on Customer Menu</Label>
              </div>

              <div className="space-y-2 bg-muted/50 p-3 rounded-xl border border-border">
                <Label className="text-base font-semibold flex items-center gap-2 text-foreground">
                  <Thermometer className="h-4 w-4" /> Serving Temperature
                </Label>
                <p className="text-xs font-medium text-muted-foreground">How is this drink served? "Either" lets customers choose.</p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {([
                    { v: "cold" as const, label: "Cold", icon: Snowflake, active: "bg-sky-50 border-sky-300 text-sky-700", iconColor: "text-sky-500" },
                    { v: "hot" as const, label: "Hot", icon: Flame, active: "bg-orange-50 border-orange-300 text-orange-700", iconColor: "text-orange-500" },
                    { v: "both" as const, label: "Either", icon: Thermometer, active: "bg-violet-50 border-violet-300 text-violet-700", iconColor: "text-violet-500" },
                  ]).map(opt => {
                    const Icon = opt.icon;
                    const selected = temperature === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setTemperature(opt.v)}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                          selected ? opt.active : "border-border bg-white hover:border-border text-muted-foreground"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${selected ? opt.iconColor : ""}`} />
                        <span className="text-sm font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-base font-semibold text-foreground">Ingredients</Label>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Each cup size can have its own ingredient list (e.g. larger sizes use more syrup).</p>
                </div>
                <Tabs value={activeIngSize} onValueChange={(v) => setActiveIngSize(v as Size)}>
                  <TabsList className="grid w-full grid-cols-3 bg-muted rounded-xl p-1">
                    {SIZES.map(s => (
                      <TabsTrigger key={s} value={s} className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        {s.replace("oz", " oz")}
                        {sizeIngredients[s].some(x => x.name.trim() !== "") && (
                          <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {SIZES.map(s => (
                    <TabsContent key={s} value={s} className="space-y-3 pt-3">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <Button variant="outline" size="sm" type="button" onClick={() => copyIngsToOtherSizes(s)} className="rounded-xl border-border">
                          Copy {s} ingredients to all sizes
                        </Button>
                        <Button variant="ghost" size="sm" type="button" onClick={() => updateIngsFor(s, ings => [...ings, { name: "", amount: "" }])} className="text-muted-foreground">
                          <PlusCircle className="h-4 w-4 mr-1" /> Add Ingredient
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {sizeIngredients[s].map((ing, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Input
                              placeholder="Ingredient (e.g. Coconut Syrup)"
                              value={ing.name}
                              onChange={(e) => updateIngsFor(s, ings => {
                                const next = [...ings];
                                next[idx] = { ...next[idx], name: e.target.value };
                                return next;
                              })}
                              className="flex-[2] rounded-xl border-border focus:ring-ring"
                            />
                            <Input
                              placeholder="Amount (e.g. 2 pumps)"
                              value={ing.amount}
                              onChange={(e) => updateIngsFor(s, ings => {
                                const next = [...ings];
                                next[idx] = { ...next[idx], amount: e.target.value };
                                return next;
                              })}
                              className="flex-1 rounded-xl border-border focus:ring-ring"
                            />
                            <Button variant="ghost" size="icon" type="button" onClick={() => updateIngsFor(s, ings => ings.filter((_, i) => i !== idx))}>
                              <MinusCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                        {sizeIngredients[s].length === 0 && (
                          <p className="text-xs font-medium text-muted-foreground italic">No ingredients yet for {s}. Click "Add Ingredient" above.</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60 mt-3 pt-3">
                        <span className="text-xs font-medium text-muted-foreground self-center mr-1">Send to {s} prep steps:</span>
                        <Button variant="outline" size="sm" type="button" className="h-7 text-xs rounded-xl border-border text-muted-foreground" onClick={() => copyIngsIntoPrepSteps(s, "append")}>
                          Append
                        </Button>
                        <Button variant="outline" size="sm" type="button" className="h-7 text-xs rounded-xl border-border text-muted-foreground" onClick={() => copyIngsIntoPrepSteps(s, "replace")}>
                          Replace
                        </Button>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-base font-semibold text-foreground">Prep Steps</Label>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Instructions for your staff to make the drink. Each size can have specific steps.</p>
                </div>
                <Tabs value={activeStepSize} onValueChange={(v) => setActiveStepSize(v as Size)}>
                  <TabsList className="grid w-full grid-cols-3 bg-muted rounded-xl p-1">
                    {SIZES.map(s => (
                      <TabsTrigger key={s} value={s} className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        {s.replace("oz", " oz")}
                        {sizePrepSteps[s].some(x => x.instruction.trim() !== "") && (
                          <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {SIZES.map(s => (
                    <TabsContent key={s} value={s} className="space-y-3 pt-3">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <Button variant="outline" size="sm" type="button" onClick={() => copyStepsToOtherSizes(s)} className="rounded-xl border-border">
                          Copy {s} steps to all sizes
                        </Button>
                        <Button variant="ghost" size="sm" type="button" onClick={() => updateStepsFor(s, steps => [...steps, { stepNumber: steps.length + 1, instruction: "" }])} className="text-muted-foreground">
                          <PlusCircle className="h-4 w-4 mr-1" /> Add Step
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {sizePrepSteps[s].map((step, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <div className="shrink-0 text-sm font-semibold text-muted-foreground/70 w-6">{idx + 1}.</div>
                            <Input
                              placeholder="e.g. Pump 2 shots of vanilla"
                              value={step.instruction}
                              onChange={(e) => updateStepsFor(s, steps => {
                                const next = [...steps];
                                next[idx] = { ...next[idx], instruction: e.target.value };
                                return next;
                              })}
                              className="flex-1 rounded-xl border-border focus:ring-ring"
                            />
                            <Button variant="ghost" size="icon" type="button" onClick={() => updateStepsFor(s, steps => {
                              const next = steps.filter((_, i) => i !== idx);
                              return next.map((st, i) => ({ ...st, stepNumber: i + 1 }));
                            })}>
                              <MinusCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                        {sizePrepSteps[s].length === 0 && (
                          <p className="text-xs font-medium text-muted-foreground italic">No prep steps yet for {s}.</p>
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
              
              <div className="space-y-2">
                <Label className="text-base font-semibold text-foreground">Allowed Modifiers (Optional)</Label>
                <p className="text-xs font-medium text-muted-foreground mb-2">Select which modifiers (creams, boba, extra flavor) are allowed for this drink.</p>
                <div className="border border-border rounded-xl p-3 bg-muted/50/50 max-h-48 overflow-y-auto custom-scrollbar">
                  {allModifiers && allModifiers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {allModifiers.map(mod => {
                        const isSelected = formModifierIds.includes(mod.id);
                        return (
                          <div 
                            key={mod.id} 
                            className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                              isSelected ? 'bg-muted border-border' : 'bg-white border-border hover:bg-muted/50'
                            }`}
                            onClick={() => {
                              setFormModifierIds(prev => 
                                isSelected ? prev.filter(id => id !== mod.id) : [...prev, mod.id]
                              );
                            }}
                          >
                            <Switch 
                              checked={isSelected} 
                              className="mr-3 pointer-events-none"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-foreground">{mod.name}</div>
                              <div className="text-xs text-muted-foreground">${Number(mod.price).toFixed(2)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic text-center py-4">No modifiers exist yet. Add them in Settings.</div>
                  )}
                </div>
              </div>

            </div>
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-xl border-border text-foreground/80">Cancel</Button>
              <Button onClick={handleSave} className="bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium">Save Menu Item</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </OwnerLayout>
  );
}
