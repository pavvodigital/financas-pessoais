import { useRef } from "react";
import { FileText } from "../ui/icons";

interface Props {
  onFiles: (files: File[]) => void;
}

function accepted(f: File): boolean {
  const n = f.name.toLowerCase();
  return f.type === "application/pdf" || n.endsWith(".pdf") || n.endsWith(".zip") || f.type.includes("zip");
}

export default function DropZone({ onFiles }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(accepted);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => ref.current?.click()}
      className="border-2 border-dashed border-hairline rounded-xl p-10 text-center cursor-pointer hover:border-accent hover:bg-accent-tint transition-colors"
    >
      <FileText className="w-9 h-9 mx-auto mb-2 text-muted" />
      <p className="text-ink">Arraste PDFs ou ZIP aqui ou clique para selecionar</p>
      <p className="text-muted text-sm mt-1">
        Extrato ou fatura do cartão Itaú · vários PDFs ou um .zip com vários dentro
      </p>
      <input
        ref={ref}
        type="file"
        accept=".pdf,.zip"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []).filter(accepted);
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
