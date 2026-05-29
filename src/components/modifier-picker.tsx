import { useListModifiers } from "@workspace/api-client-react";
import type { MenuItem } from "@workspace/api-client-react";
import type { SelectedModifier } from "./cart-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles } from "lucide-react";

interface ModifierPickerProps {
  menuItem: MenuItem;
  selected: SelectedModifier[];
  onChange: (modifiers: SelectedModifier[]) => void;
}

type ModGroup = { label: string; emoji: string; items: { id: number; name: string; price: number }[] };

function groupModifiers(mods: { id: number; name: string; price: number }[]): ModGroup[] {
  const creams: typeof mods = [];
  const syrups: typeof mods = [];
  const lotus: typeof mods = [];
  const sfShots: typeof mods = [];
  const shots: typeof mods = [];
  const free: typeof mods = [];

  for (const m of mods) {
    const n = m.name.toLowerCase();
    if (m.price === 0) { free.push(m); continue; }
    if (n === "lotus shot") { lotus.push(m); continue; }
    if (n.includes("syrup") || n === "sweet cream-sc" || n === "coconut cream") {
      creams.push(m); continue;
    }
    if (n.startsWith("sf ")) { sfShots.push(m); continue; }
    shots.push(m);
  }

  const groups: ModGroup[] = [];
  if (creams.length) groups.push({ label: "Creams & Syrups", emoji: "🥛", items: creams });
  if (lotus.length) groups.push({ label: "Lotus Energy", emoji: "⚡", items: lotus });
  if (shots.length) groups.push({ label: "Flavor Shots", emoji: "✨", items: shots });
  if (sfShots.length) groups.push({ label: "Sugar-Free Shots", emoji: "🌿", items: sfShots });
  if (free.length) groups.push({ label: "Free Add-ons", emoji: "🎁", items: free });
  return groups;
}

export function ModifierPicker({ menuItem, selected, onChange }: ModifierPickerProps) {
  const { data: allModifiers, isLoading } = useListModifiers();

  const itemModifierIds = (menuItem as any).modifierIds as number[] | null | undefined;
  const available = allModifiers?.filter((m) => {
    if (!m.available) return false;
    if (!itemModifierIds || itemModifierIds.length === 0) return false;
    return itemModifierIds.includes(m.id);
  }) ?? [];

  const toggle = (mod: { id: number; name: string; price: number }) => {
    const already = selected.some((s) => s.id === mod.id);
    if (already) {
      onChange(selected.filter((s) => s.id !== mod.id));
    } else {
      onChange([...selected, { id: mod.id, name: mod.name, price: mod.price }]);
    }
  };

  if (!itemModifierIds || itemModifierIds.length === 0) return null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary/60" />
          <span className="text-sm font-semibold text-foreground">Customize</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[80, 110, 95, 120, 90, 100].map((w, i) => (
            <Skeleton key={i} className="h-8 rounded-full" style={{ width: w }} />
          ))}
        </div>
      </div>
    );
  }

  if (available.length === 0) return null;

  const groups = groupModifiers(available.map((m) => ({ id: m.id, name: m.name, price: Number(m.price) })));
  const totalAdded = selected.reduce((s, m) => s + m.price, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary/70" />
          <span className="text-sm font-semibold text-foreground">Customize</span>
        </div>
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full"
            >
              {selected.length} add-on{selected.length !== 1 ? "s" : ""}
              {totalAdded > 0 && ` · +$${totalAdded.toFixed(2)}`}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Groups */}
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
              {group.emoji} {group.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.items.map((mod) => {
                const checked = selected.some((s) => s.id === mod.id);
                return (
                  <motion.button
                    key={mod.id}
                    onClick={() => toggle(mod)}
                    whileTap={{ scale: 0.94 }}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                      checked
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-white/70 text-foreground border-border/60 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      {checked && (
                        <motion.span
                          key="check"
                          initial={{ opacity: 0, scale: 0.5, width: 0 }}
                          animate={{ opacity: 1, scale: 1, width: "auto" }}
                          exit={{ opacity: 0, scale: 0.5, width: 0 }}
                          className="overflow-hidden"
                        >
                          <Check className="h-3 w-3 mr-0.5" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {mod.name}
                    {mod.price > 0 && (
                      <span className={`ml-0.5 ${checked ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        +${mod.price.toFixed(2)}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
