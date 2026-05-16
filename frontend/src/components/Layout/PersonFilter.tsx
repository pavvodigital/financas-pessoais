import { usePersonStore } from "../../store/person";

export default function PersonFilter() {
  const { person, setPerson } = usePersonStore();
  const options = [
    { value: "ambos", label: "Ambos" },
    { value: "diogo", label: "Diogo" },
    { value: "lis", label: "Lis" },
  ] as const;
  return (
    <div className="flex gap-1 px-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setPerson(o.value)}
          className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
            person === o.value
              ? "bg-[#7c6af7] text-white"
              : "bg-[#252540] text-gray-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
