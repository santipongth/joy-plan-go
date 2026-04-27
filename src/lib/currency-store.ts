import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CurrencyCode = "USD" | "THB" | "EUR" | "JPY" | "GBP";

interface State {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
}

export const useCurrencyStore = create<State>()(
  persist(
    (set) => ({
      currency: "USD",
      setCurrency: (currency) => set({ currency }),
    }),
    { name: "budget-currency-v1" },
  ),
);
