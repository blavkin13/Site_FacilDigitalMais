"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Product } from "../lib/product-types";

type CartItem = Pick<Product, "slug" | "title" | "price" | "cover" | "coverClass">;
type ShopContextValue = { cart: CartItem[]; add: (product: Product) => void; remove: (slug: string) => void; open: boolean; setOpen: (open: boolean) => void };
const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]); const [open, setOpen] = useState(false); const [hydrated,setHydrated]=useState(false);
  useEffect(() => { try { setCart(JSON.parse(localStorage.getItem("fd-cart") || "[]")); } catch {} finally { setHydrated(true); } }, []);
  useEffect(() => { if(hydrated)localStorage.setItem("fd-cart", JSON.stringify(cart)); }, [cart,hydrated]);
  const add = (product: Product) => { setCart((items) => items.some((item) => item.slug === product.slug) ? items : [...items, product]); setOpen(true); };
  const remove = (slug: string) => setCart((items) => items.filter((item) => item.slug !== slug));
  return <ShopContext.Provider value={{ cart, add, remove, open, setOpen }}>{children}</ShopContext.Provider>;
}
export function useShop() { const value = useContext(ShopContext); if (!value) throw new Error("useShop must be used within ShopProvider"); return value; }
