import { usePersonStore } from "../../store/person";

export default function PersonFilter() {
  const { person, setPerson } = usePersonStore();
  const options = [
    { value: "ambos", label: "Ambos" },
    { value: "diogo", label: "Diogo" },
    { value: "lis", label: "Lis" },
  ] as const;
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setPerson(o.value)}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
            person === o.value
              ? "bg-accent text-white"
              : "text-muted hover:text-ink hover:bg-paper"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
