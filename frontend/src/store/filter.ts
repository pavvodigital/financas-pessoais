import { create } from "zustand";

interface FilterState {
  month: number;
  year: number;
  categoryId: string | null;
  setMonth: (month: number, year: number) => void;
  setCategory: (id: string | null) => void;
  clear: () => void;
}

const now = new Date();

export const useFilterStore = create<FilterState>((set) => ({
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  categoryId: null,
  setMonth: (month, year) => set({ month, year }),
  setCategory: (categoryId) => set({ categoryId }),
  clear: () => set({ categoryId: null }),
}));
