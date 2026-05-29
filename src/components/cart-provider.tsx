import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { MenuItem } from "@workspace/api-client-react";

export type DrinkSize = "16oz" | "24oz" | "34oz";
export type DrinkTemp = "hot" | "cold" | null;
export type SelectedModifier = { id: number; name: string; price: number };

export interface CartItem {
  menuItem: MenuItem;
  size: DrinkSize;
  temperature: DrinkTemp;
  quantity: number;
  specialInstructions: string;
  modifiers: SelectedModifier[];
}

function cartKey(menuItemId: number, size: DrinkSize, temperature: DrinkTemp, modifierIds: number[]) {
  const mKey = [...modifierIds].sort((a, b) => a - b).join(",");
  return `${menuItemId}-${size}-${temperature ?? "x"}-${mKey}`;
}

function getItemPrice(item: MenuItem, size: DrinkSize): number {
  const sp = item.sizePrices as Record<string, number> | undefined;
  if (sp && sp[size] && sp[size] > 0) return sp[size];
  return item.price;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem, size: DrinkSize, quantity: number, specialInstructions: string, temperature?: DrinkTemp, modifiers?: SelectedModifier[]) => void;
  removeItem: (menuItemId: number, size: DrinkSize, temperature: DrinkTemp, modifierIds: number[]) => void;
  updateQuantity: (menuItemId: number, size: DrinkSize, temperature: DrinkTemp, modifierIds: number[], quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("sweet_street_cart");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CartItem[];
        const migrated = parsed.map((i) => ({
          ...i,
          size: (i.size || "16oz") as DrinkSize,
          temperature: (i.temperature ?? null) as DrinkTemp,
          modifiers: i.modifiers ?? [],
        }));
        setItems(migrated);
      } catch (e) {
        console.error("Failed to parse cart", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sweet_street_cart", JSON.stringify(items));
  }, [items]);

  const addItem = (menuItem: MenuItem, size: DrinkSize, quantity: number, specialInstructions: string, temperature: DrinkTemp = null, modifiers: SelectedModifier[] = []) => {
    setItems((prev) => {
      const modIds = modifiers.map((m) => m.id);
      const key = cartKey(menuItem.id, size, temperature, modIds);
      const existing = prev.find((i) => cartKey(i.menuItem.id, i.size, i.temperature, i.modifiers.map(m => m.id)) === key);
      if (existing) {
        return prev.map((i) =>
          cartKey(i.menuItem.id, i.size, i.temperature, i.modifiers.map(m => m.id)) === key
            ? { ...i, quantity: i.quantity + quantity, specialInstructions: specialInstructions || i.specialInstructions }
            : i
        );
      }
      return [...prev, { menuItem, size, temperature, quantity, specialInstructions, modifiers }];
    });
  };

  const removeItem = (menuItemId: number, size: DrinkSize, temperature: DrinkTemp, modifierIds: number[]) => {
    setItems((prev) => prev.filter((i) => cartKey(i.menuItem.id, i.size, i.temperature, i.modifiers.map(m => m.id)) !== cartKey(menuItemId, size, temperature, modifierIds)));
  };

  const updateQuantity = (menuItemId: number, size: DrinkSize, temperature: DrinkTemp, modifierIds: number[], quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId, size, temperature, modifierIds);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        cartKey(i.menuItem.id, i.size, i.temperature, i.modifiers.map(m => m.id)) === cartKey(menuItemId, size, temperature, modifierIds) ? { ...i, quantity } : i
      )
    );
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((acc, item) => {
    const modifierSum = item.modifiers.reduce((s, m) => s + m.price, 0);
    return acc + (getItemPrice(item.menuItem, item.size) + modifierSum) * item.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

export { getItemPrice };

export function formatSize(size: DrinkSize | string | undefined | null): string {
  if (!size) return "";
  if (size === "34oz") return "32 oz";
  if (size === "24oz") return "24 oz";
  if (size === "16oz") return "16 oz";
  return String(size);
}
