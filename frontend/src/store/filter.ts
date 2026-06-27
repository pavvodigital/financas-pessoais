import { create } from "zustand";

export type TxType = "all" | "expense" | "income";
export type Method = "all" | "pix" | "boleto" | "debito" | "cartao";

interface FilterState {
  month: number;
  year: number;
  categoryId: string | null;
  source: "credit_card" | "bank" | null;
  query: string;
  valueMin: string;
  valueMax: string;
  txType: TxType;
  method: Method;
  setMonth: (month: number, year: number) => void;
  setCategory: (id: string | null) => void;
  setSource: (source: "credit_card" | "bank" | null) => void;
  setQuery: (q: string) => void;
  setValueMin: (v: string) => void;
  setValueMax: (v: string) => void;
  setTxType: (t: TxType) => void;
  setMethod: (m: Method) => void;
  clearAdvanced: () => void;
  clear: () => void;
}

const now = new Date();

export const useFilterStore = create<FilterState>((set) => ({
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  categoryId: null,
  source: null,
  query: "",
  valueMin: "",
  valueMax: "",
  txType: "all",
  method: "all",
  setMonth: (month, year) => set({ month, year }),
  setCategory: (categoryId) => set({ categoryId }),
  setSource: (source) => set({ source }),
  setQuery: (query) => set({ query }),
  setValueMin: (valueMin) => set({ valueMin }),
  setValueMax: (valueMax) => set({ valueMax }),
  setTxType: (txType) => set({ txType }),
  setMethod: (method) => set({ method }),
  clearAdvanced: () => set({ valueMin: "", valueMax: "", txType: "all", method: "all" }),
  clear: () => set({ categoryId: null, source: null, query: "", valueMin: "", valueMax: "", txType: "all", method: "all" }),
}));
