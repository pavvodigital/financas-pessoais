import { create } from "zustand";

interface FilterState {
  month: number;
  year: number;
  categoryId: string | null;
  source: "credit_card" | "bank" | null;
  query: string;
  setMonth: (month: number, year: number) => void;
  setCategory: (id: string | null) => void;
  setSource: (source: "credit_card" | "bank" | null) => void;
  setQuery: (q: string) => void;
  clear: () => void;
}

const now = new Date();

export const useFilterStore = create<FilterState>((set) => ({
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  categoryId: null,
  source: null,
  query: "",
  setMonth: (month, year) => set({ month, year }),
  setCategory: (categoryId) => set({ categoryId }),
  setSource: (source) => set({ source }),
  setQuery: (query) => set({ query }),
  clear: () => set({ categoryId: null, source: null, query: "" }),
}));
