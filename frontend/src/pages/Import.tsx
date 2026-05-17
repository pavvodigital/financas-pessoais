import { useEffect, useState } from "react";
import api from "../api/client";
import DropZone from "../components/Import/DropZone";
import PreviewTable from "../components/Import/PreviewTable";
import type { Category } from "../types";

interface TxPreview {
  date: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  category_name: string | null;
  source: string;
  raw_text: string | null;
}

export default function Import() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [person, setPerson] = useState<"diogo" | "lis">("diogo");
  const [preview, setPreview] = useState<TxPreview[]>([]);
  const [fileIdTemp, setFileIdTemp] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [fileType, setFileType] = useState("credit_card");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    api.get<Category[]>("/categories").then((r) => setCategories(r.data));
  }, []);

  async function handleFile(file: File) {
    setLoading(true);
    setSaved(null);
    const form = new FormData();
    form.append("file", file);
    form.append("person", person);
    const { data } = await api.post("/upload", form);
    setPreview(data.transactions);
    setFileIdTemp(data.file_id_temp);
    setFilename(file.name);
    setFileType(
      file.name.toLowerCase().includes("fatura") ? "credit_card" : "statement"
    );
    setLoading(false);
  }

  function updateCategory(idx: number, catName: string) {
    setPreview((prev) =>
      prev.map((tx, i) => (i === idx ? { ...tx, category_name: catName } : tx))
    );
  }

  async function handleConfirm() {
    const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));
    const txs = preview.map((tx) => ({
      ...tx,
      category_id: tx.category_name ? catMap[tx.category_name] : null,
    }));
    const { data } = await api.post("/upload/confirm", {
      file_id_temp: fileIdTemp,
      person,
      filename,
      file_type: fileType,
      transactions: txs,
    });
    setSaved(data.saved);
    setPreview([]);
    setFileIdTemp(null);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Importar PDF</h1>
      <div className="flex gap-4 items-center">
        <span className="text-gray-400 text-sm">Pessoa:</span>
        {(["diogo", "lis"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPerson(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
              person === p
                ? "bg-[#7c6af7] text-white"
                : "bg-[#1a1a2e] text-gray-400"
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      {!preview.length && <DropZone onFile={handleFile} />}
      {loading && <p className="text-gray-400">Processando PDF...</p>}
      {saved != null && (
        <p className="text-green-400">✅ {saved} transações salvas!</p>
      )}
      {preview.length > 0 && (
        <div className="bg-[#1a1a2e] rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">
              {preview.length} transações encontradas
            </h3>
            <button
              onClick={handleConfirm}
              className="bg-[#7c6af7] text-white px-6 py-2 rounded-lg font-semibold"
            >
              Confirmar importação
            </button>
          </div>
          <PreviewTable
            transactions={preview}
            categories={categories}
            onChange={updateCategory}
          />
        </div>
      )}
    </div>
  );
}
