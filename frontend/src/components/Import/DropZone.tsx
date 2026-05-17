import { useRef } from "react";

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
      className="border-2 border-dashed border-[#7c6af7] rounded-xl p-10 text-center cursor-pointer hover:bg-[#1a1a2e] transition-colors"
    >
      <p className="text-4xl mb-2">📄</p>
      <p className="text-gray-300">Arraste PDFs aqui ou clique para selecionar</p>
      <p className="text-gray-500 text-sm mt-1">
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
