import { create } from "zustand";

interface FilterState {
  month: number;
  year: number;
  categoryId: string | null;
  source: "credit_card" | "bank" | null;
  setMonth: (month: number, year: number) => void;
  setCategory: (id: string | null) => void;
  setSource: (source: "credit_card" | "bank" | null) => void;
  clear: () => void;
}

const now = new Date();

export const useFilterStore = create<FilterState>((set) => ({
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  categoryId: null,
  source: null,
  setMonth: (month, year) => set({ month, year }),
  setCategory: (categoryId) => set({ categoryId }),
  setSource: (source) => set({ source }),
  clear: () => set({ categoryId: null, source: null }),
}));
