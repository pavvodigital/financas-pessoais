import { useRef } from "react";
import { FileText } from "../ui/icons";

interface Props {
  onFiles: (files: File[]) => void;
}

export default function DropZone({ onFiles }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
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
      <p className="text-ink">Arraste PDFs aqui ou clique para selecionar</p>
      <p className="text-muted text-sm mt-1">
        Extrato conta corrente ou fatura do cartão Itaú · múltiplos arquivos permitidos
      </p>
      <input
        ref={ref}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []).filter(
            (f) => f.type === "application/pdf"
          );
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
