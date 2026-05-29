import { OwnerLayout } from "@/components/layout/owner-layout";
import {
  useListPosCategories,
  useCreatePosCategory,
  useUpdatePosCategory,
  useDeletePosCategory,
  useUpdatePosItemAssignments,
  useListMenuItems,
  getListPosCategoriesQueryKey,
  getListMenuItemsQueryKey,
} from "@workspace/api-client-react";
import type { PosCategory, MenuItem } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, GripVertical, Save, Layers, List } from "lucide-react";

const PRESET_COLORS = [
  "#F9AF94", "#F97316", "#EF4444", "#EC4899",
  "#A855F7", "#6366F1", "#3B82F6", "#06B6D4",
  "#10B981", "#84CC16", "#EAB308", "#78716C",
];

const PRESET_EMOJIS = ["C", "T", "S", "E", "F", "L", "M", "P", "R", "W", "B", "D"];

interface CategoryFormData {
  name: string;
  emoji: string;
  color: string;
  sortOrder: number;
}

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  initial?: PosCategory | null;
  onSave: (data: CategoryFormData) => Promise<void>;
  isSaving: boolean;
}

function CategoryDialog({ open, onClose, initial, onSave, isSaving }: CategoryDialogProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "C");
  const [color, setColor] = useState(initial?.color ?? "#F9AF94");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setEmoji(initial?.emoji ?? "C");
      setColor(initial?.color ?? "#F9AF94");
      setSortOrder(initial?.sortOrder ?? 0);
    }
  }, [open, initial]);

  async function handleSave() {
    if (!name.trim()) return;
    await onSave({ name: name.trim(), emoji, color, sortOrder });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm bg-white border border-border rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">{initial ? "Edit Category" : "New Category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-foreground mb-1 block">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dirty Soda"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
              className="rounded-xl border-border focus:ring-ring"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold text-foreground mb-2 block">Short Code</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center border-2 transition-all ${
                    emoji === e ? "border-primary bg-muted font-bold" : "border-transparent hover:border-border font-medium"
                  }`}
                >
                  {e}
                </button>
              ))}
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="or type…"
                className="w-24 h-9 text-center rounded-xl border-border focus:ring-ring"
                maxLength={4}
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold text-foreground mb-2 block">Color</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? "border-primary scale-110" : "border-transparent hover:scale-105"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-8 rounded-xl cursor-pointer border border-border"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="font-mono text-sm w-28 rounded-xl border-border focus:ring-ring"
                maxLength={7}
              />
              <div
                className="flex-1 h-8 rounded-xl border border-border"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold text-foreground mb-1 block">Sort Order</Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              className="w-24 rounded-xl border-border focus:ring-ring"
              min={0}
            />
            <p className="text-xs font-medium text-muted-foreground mt-1">Lower numbers appear first</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl border-border text-foreground/80 hover:bg-muted/50">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium"
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ItemRow {
  id: number;
  name: string;
  posCategoryId: string | null;
  posSortOrder: number;
  posHidden: boolean;
}

export default function PosSetup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories = [], isLoading: catsLoading } = useListPosCategories({});
  const { data: menuItems = [], isLoading: itemsLoading } = useListMenuItems({});

  const createCat = useCreatePosCategory();
  const updateCat = useUpdatePosCategory();
  const deleteCat = useDeletePosCategory();
  const updateAssignments = useUpdatePosItemAssignments();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<PosCategory | null>(null);
  const [isSavingCat, setIsSavingCat] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Item assignment local state
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [assignmentsDirty, setAssignmentsDirty] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const initialItemsRef = useRef<ItemRow[]>([]);

  useEffect(() => {
    if (menuItems.length > 0) {
      const rows = (menuItems as MenuItem[]).map((item) => ({
        id: item.id,
        name: item.name,
        posCategoryId: item.posCategoryId ?? null,
        posSortOrder: item.posSortOrder ?? 0,
        posHidden: item.posHidden ?? false,
      }));
      setItemRows(rows);
      initialItemsRef.current = rows;
      setAssignmentsDirty(false);
    }
  }, [menuItems]);

  function updateItemRow(id: number, updates: Partial<ItemRow>) {
    setItemRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updates } : row))
    );
    setAssignmentsDirty(true);
  }

  async function saveAssignments() {
    setSavingAssignments(true);
    try {
      await updateAssignments.mutateAsync({
        data: {
          assignments: itemRows.map((row) => ({
            menuItemId: row.id,
            posCategoryId: row.posCategoryId,
            posSortOrder: row.posSortOrder,
            posHidden: row.posHidden,
          })),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
      setAssignmentsDirty(false);
      toast({ title: "Item assignments saved" });
    } catch {
      toast({ title: "Failed to save assignments", variant: "destructive" });
    } finally {
      setSavingAssignments(false);
    }
  }

  async function handleSaveCategory(data: CategoryFormData) {
    setIsSavingCat(true);
    try {
      if (editingCat) {
        await updateCat.mutateAsync({
          id: editingCat.id,
          data,
        });
        toast({ title: "Category updated" });
      } else {
        await createCat.mutateAsync({ data });
        toast({ title: "Category created" });
      }
      await queryClient.invalidateQueries({ queryKey: getListPosCategoriesQueryKey() });
    } catch {
      toast({ title: "Failed to save category", variant: "destructive" });
    } finally {
      setIsSavingCat(false);
      setEditingCat(null);
    }
  }

  async function handleDeleteCategory(id: number) {
    try {
      await deleteCat.mutateAsync({ id });
      await queryClient.invalidateQueries({ queryKey: getListPosCategoriesQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListMenuItemsQueryKey() });
      toast({ title: "Category deleted" });
      setDeleteConfirmId(null);
    } catch {
      toast({ title: "Failed to delete category", variant: "destructive" });
    }
  }

  // Group items by category for preview
  const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const uncategorized = itemRows.filter((r) => !r.posCategoryId && !r.posHidden);

  return (
    <OwnerLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">POS Setup</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage how items appear on your POS screen — categories, order, and visibility.
          </p>
        </div>

        {/* CATEGORIES SECTION */}
        <Card className="bg-white border border-border rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Layers className="h-5 w-5 text-foreground" />
                Categories
              </CardTitle>
              <CardDescription className="text-muted-foreground font-medium mt-1">
                Create tabs that group items on the POS. Drag sort order to reorder.
              </CardDescription>
            </div>
            <Button
              onClick={() => { setEditingCat(null); setDialogOpen(true); }}
              className="gap-2 bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </CardHeader>
          <CardContent>
            {catsLoading ? (
              <div className="text-muted-foreground font-medium text-sm py-4 text-center">Loading…</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border border-border border-dashed rounded-2xl">
                <Layers className="h-10 w-10 mx-auto mb-2 opacity-30 text-muted-foreground/70" />
                <p className="text-sm font-medium text-foreground/80">No categories yet. Add one to get started.</p>
                <p className="text-xs font-medium text-muted-foreground mt-1">Items without a category appear in "All Items."</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedCats.map((cat) => {
                  const count = itemRows.filter(
                    (r) => r.posCategoryId === String(cat.id)
                  ).length;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white hover:bg-muted/50 transition-colors"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl font-bold flex-shrink-0"
                        style={{ backgroundColor: cat.color + "33", border: `2px solid ${cat.color}`, color: cat.color }}
                      >
                        {cat.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{cat.name}</p>
                        <p className="text-xs font-medium text-muted-foreground">
                          {count} item{count !== 1 ? "s" : ""} · sort {cat.sortOrder}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full border border-white ring-1 ring-border"
                          style={{ backgroundColor: cat.color }}
                        />
                        <Badge variant="outline" className="text-xs ml-1 border-border text-foreground/80 bg-white">
                          {cat.color}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingCat(cat); setDialogOpen(true); }}
                          className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirmId(cat.id)}
                          className="h-8 w-8 p-0 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ITEM ASSIGNMENTS SECTION */}
        <Card className="bg-white border border-border rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-foreground">Item Assignments</CardTitle>
              <CardDescription className="text-muted-foreground font-medium mt-1">
                Assign each menu item to a category, set its order, and hide it from the POS if needed.
              </CardDescription>
            </div>
            {assignmentsDirty && (
              <Button
                onClick={saveAssignments}
                disabled={savingAssignments}
                className="gap-2 bg-primary text-white rounded-xl hover:bg-primary/90 shadow-sm font-medium"
              >
                <Save className="h-4 w-4" />
                {savingAssignments ? "Saving…" : "Save Changes"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="text-muted-foreground font-medium text-sm py-4 text-center">Loading…</div>
            ) : itemRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-medium text-sm border border-border border-dashed rounded-2xl">
                No menu items found.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr className="text-left">
                      <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-1/3">Item</th>
                      <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-1/3">Category</th>
                      <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider w-20 text-center">Order</th>
                      <th className="py-3 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wider text-center">Hidden</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {itemRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`transition-colors hover:bg-muted/50 ${row.posHidden ? "opacity-50" : ""}`}
                      >
                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground truncate block max-w-xs">
                            {row.name}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Select
                            value={row.posCategoryId ?? "none"}
                            onValueChange={(val) =>
                              updateItemRow(row.id, {
                                posCategoryId: val === "none" ? null : val,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs rounded-lg border-border focus:ring-ring">
                              <SelectValue>
                                {row.posCategoryId
                                  ? (() => {
                                      const cat = categories.find(
                                        (c) => String(c.id) === row.posCategoryId
                                      );
                                      return cat ? `${cat.emoji} ${cat.name}` : "Unknown";
                                    })()
                                  : "— No category —"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border">
                              <SelectItem value="none" className="text-xs text-muted-foreground">
                                — No category —
                              </SelectItem>
                              {sortedCats.map((cat) => (
                                <SelectItem key={cat.id} value={String(cat.id)} className="text-xs">
                                  {cat.emoji} {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            type="number"
                            value={row.posSortOrder}
                            onChange={(e) =>
                              updateItemRow(row.id, { posSortOrder: parseInt(e.target.value) || 0 })
                            }
                            className="h-8 w-16 text-xs text-center mx-auto rounded-lg border-border focus:ring-ring"
                            min={0}
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center">
                            <Switch
                              checked={row.posHidden}
                              onCheckedChange={(v) => updateItemRow(row.id, { posHidden: v })}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* POS PREVIEW */}
        {categories.length > 0 && (
          <Card className="bg-white border border-border rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold tracking-tight text-foreground">Category Preview</CardTitle>
              <CardDescription className="text-muted-foreground font-medium mt-1">How category tabs will look on the POS screen.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 p-4 rounded-xl border border-border bg-muted/50">
                {sortedCats.map((cat, i) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
                    style={
                      i === 0
                        ? { backgroundColor: cat.color, color: "#fff" }
                        : { backgroundColor: cat.color + "22", color: "#4D2A1A", border: `1px solid ${cat.color}55` }
                    }
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.name}</span>
                  </div>
                ))}
                {uncategorized.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-border bg-white text-foreground">
                    <List className="h-4 w-4 text-muted-foreground" />
                    <span>Other ({uncategorized.length})</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category Create/Edit Dialog */}
      <CategoryDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingCat(null); }}
        initial={editingCat}
        onSave={handleSaveCategory}
        isSaving={isSavingCat}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(v) => !v && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm bg-white border border-border rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Delete Category?</DialogTitle>
          </DialogHeader>
          <p className="text-sm font-medium text-muted-foreground">
            This will remove the category and unassign all items from it. Items won't be deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="rounded-xl border-border text-foreground/80 hover:bg-muted/50">Cancel</Button>
            <Button
              className="text-white hover:bg-red-700 border border-red-200 bg-red-600 rounded-xl"
              onClick={() => deleteConfirmId !== null && handleDeleteCategory(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OwnerLayout>
  );
}
