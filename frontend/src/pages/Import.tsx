import { useEffect, useState, useCallback } from "react";
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

interface PendingFile {
  file: File;
  status: "pending" | "processing" | "preview" | "done" | "error";
  fileIdTemp?: string;
  transactions?: TxPreview[];
  duplicateOf?: string | null;
  saved?: number;
  error?: string;
}

interface UploadedFileRecord {
  id: string;
  filename: string;
  file_type: string;
  person: string;
  month: number;
  year: number;
  imported_at: string;
  transaction_count: number;
}

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function Import() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [person, setPerson] = useState<"diogo" | "lis">("diogo");
  const [queue, setQueue] = useState<PendingFile[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>([]);

  useEffect(() => {
    api.get<Category[]>("/categories").then((r) => setCategories(r.data));
    loadUploadedFiles();
  }, []);

  function loadUploadedFiles() {
    api.get<UploadedFileRecord[]>("/upload/files").then((r) => setUploadedFiles(r.data));
  }

  function updateQueue(idx: number, patch: Partial<PendingFile>) {
    setQueue((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  const processNext = useCallback(
    async (items: PendingFile[], startIdx: number) => {
      if (startIdx >= items.length) return;
      const item = items[startIdx];
      if (item.status !== "pending") {
        processNext(items, startIdx + 1);
        return;
      }

      setActiveIdx(startIdx);
      setQueue((prev) =>
        prev.map((p, i) => (i === startIdx ? { ...p, status: "processing" } : p))
      );

      try {
        const form = new FormData();
        form.append("file", item.file);
        form.append("person", person);
        const { data } = await api.post("/upload", form);
        setQueue((prev) =>
          prev.map((p, i) =>
            i === startIdx
              ? {
                  ...p,
                  status: "preview",
                  fileIdTemp: data.file_id_temp,
                  transactions: data.transactions,
                  duplicateOf: data.duplicate_of ?? null,
                }
              : p
          )
        );
      } catch {
        setQueue((prev) =>
          prev.map((p, i) =>
            i === startIdx ? { ...p, status: "error", error: "Erro ao processar" } : p
          )
        );
        processNext(items, startIdx + 1);
      }
    },
    [person]
  );

  async function handleFiles(files: File[]) {
    const newItems: PendingFile[] = files.map((f) => ({ file: f, status: "pending" }));
    const next = [...queue, ...newItems];
    setQueue(next);
    const firstPending = next.findIndex((p) => p.status === "pending");
    if (firstPending !== -1) processNext(next, firstPending);
  }

  function updateCategory(fileIdx: number, txIdx: number, catName: string) {
    setQueue((prev) =>
      prev.map((item, i) => {
        if (i !== fileIdx || !item.transactions) return item;
        return {
          ...item,
          transactions: item.transactions.map((tx, j) =>
            j === txIdx ? { ...tx, category_name: catName } : tx
          ),
        };
      })
    );
  }

  async function handleConfirm(fileIdx: number) {
    const item = queue[fileIdx];
    if (!item.transactions || !item.fileIdTemp) return;
    const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));
    const txs = item.transactions.map((tx) => ({
      ...tx,
      category_id: tx.category_name ? catMap[tx.category_name] : null,
    }));
    const fname = item.file.name;
    const { data } = await api.post("/upload/confirm", {
      file_id_temp: item.fileIdTemp,
      person,
      filename: fname,
      file_type: fname.toLowerCase().includes("fatura") ? "credit_card" : "statement",
      transactions: txs,
    });
    updateQueue(fileIdx, { status: "done", saved: data.saved });
    loadUploadedFiles();

    // Auto-advance to next pending
    const nextPending = queue.findIndex((p, i) => i > fileIdx && p.status === "pending");
    if (nextPending !== -1) {
      setActiveIdx(nextPending);
      processNext(queue, nextPending);
    } else {
      setActiveIdx(null);
    }
  }

  async function handleDeleteFile(id: string) {
    if (!confirm("Remover arquivo e todas as transações importadas?")) return;
    await api.delete(`/upload/files/${id}`);
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const pending = queue.filter((q) => q.status === "pending" || q.status === "processing").length;
  const activeItem = activeIdx !== null ? queue[activeIdx] : null;

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
              person === p ? "bg-[#7c6af7] text-white" : "bg-[#1a1a2e] text-gray-400"
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <DropZone onFiles={handleFiles} />

      {/* Queue status */}
      {queue.length > 0 && (
        <div className="bg-[#1a1a2e] rounded-xl p-4 space-y-2">
          <h3 className="text-sm text-gray-400 font-medium">
            Fila de importação {pending > 0 && `· ${pending} restante(s)`}
          </h3>
          {queue.map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="w-4">
                {item.status === "done" && "✅"}
                {item.status === "error" && "❌"}
                {item.status === "processing" && "⏳"}
                {item.status === "preview" && "👁"}
                {item.status === "pending" && "⏸"}
              </span>
              <span className="flex-1 truncate text-gray-300">{item.file.name}</span>
              {item.status === "done" && (
                <span className="text-green-400">{item.saved} transações</span>
              )}
              {item.duplicateOf && item.status === "preview" && (
                <span className="text-yellow-400 text-xs">⚠️ duplicado</span>
              )}
              {item.status === "preview" && i !== activeIdx && (
                <button
                  onClick={() => setActiveIdx(i)}
                  className="text-xs text-[#7c6af7] underline"
                >
                  ver
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Active preview */}
      {activeItem && activeItem.status === "preview" && activeItem.transactions && (
        <div className="bg-[#1a1a2e] rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">
                {activeItem.file.name} · {activeItem.transactions.length} transações
              </h3>
              {activeItem.duplicateOf && (
                <p className="text-yellow-400 text-xs mt-0.5">
                  ⚠️ Este arquivo já foi importado anteriormente. Confirmar mesmo assim?
                </p>
              )}
            </div>
            <button
              onClick={() => handleConfirm(activeIdx!)}
              className="bg-[#7c6af7] text-white px-6 py-2 rounded-lg font-semibold"
            >
              Confirmar importação
            </button>
          </div>
          <PreviewTable
            transactions={activeItem.transactions}
            categories={categories}
            onChange={(txIdx, catName) => updateCategory(activeIdx!, txIdx, catName)}
          />
        </div>
      )}

      {/* Imported files list */}
      {uploadedFiles.length > 0 && (
        <div className="bg-[#1a1a2e] rounded-xl p-4 space-y-3">
          <h3 className="text-sm text-gray-400 font-medium">Arquivos importados</h3>
          {uploadedFiles.map((f) => (
            <div key={f.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-300">{f.filename}</span>
                <span className="text-gray-500 ml-2">
                  {MONTHS[f.month - 1]}/{f.year} · {f.person} · {f.transaction_count} tx
                </span>
              </div>
              <button
                onClick={() => handleDeleteFile(f.id)}
                className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-400 rounded"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
