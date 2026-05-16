import { create } from "zustand";

type Person = "diogo" | "lis" | "ambos";

interface PersonStore {
  person: Person;
  setPerson: (p: Person) => void;
}

export const usePersonStore = create<PersonStore>((set) => ({
  person: "ambos",
  setPerson: (person) => set({ person }),
}));
