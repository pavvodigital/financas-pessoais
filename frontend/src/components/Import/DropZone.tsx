import { useRef } from "react";

interface Props {
  onFile: (file: File) => void;
}

export default function DropZone({ onFile }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") onFile(file);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => ref.current?.click()}
      className="border-2 border-dashed border-[#7c6af7] rounded-xl p-10 text-center cursor-pointer hover:bg-[#1a1a2e] transition-colors"
    >
      <p className="text-4xl mb-2">📄</p>
      <p className="text-gray-300">Arraste um PDF aqui ou clique para selecionar</p>
      <p className="text-gray-500 text-sm mt-1">
        Extrato conta corrente ou fatura do cartão Itaú
      </p>
      <input
        ref={ref}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </div>
  );
}
