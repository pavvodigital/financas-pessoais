import { useEffect, useState, useCallback } from "react";
import JSZip from "jszip";
import api from "../api/client";
import DropZone from "../components/Import/DropZone";
import PreviewTable from "../components/Import/PreviewTable";
import { useToast } from "../components/ui/toast";
import { Check, X, Clock, Eye, Pause, AlertTriangle } from "../components/ui/icons";
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
  const toast = useToast();
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

  async function expandZips(files: File[]): Promise<File[]> {
    const out: File[] = [];
    for (const f of files) {
      const isZip = f.name.toLowerCase().endsWith(".zip") || f.type.includes("zip");
      if (!isZip) { out.push(f); continue; }
      try {
        const zip = await JSZip.loadAsync(f);
        const pdfs = Object.values(zip.files).filter(
          (e) => !e.dir && e.name.toLowerCase().endsWith(".pdf") && !e.name.split("/").pop()!.startsWith(".")
        );
        if (pdfs.length === 0) { toast("error", `${f.name}: nenhum PDF dentro do zip`); continue; }
        for (const entry of pdfs) {
          const blob = await entry.async("blob");
          out.push(new File([blob], entry.name.split("/").pop()!, { type: "application/pdf" }));
        }
        toast("success", `${f.name}: ${pdfs.length} PDF(s) extraído(s)`);
      } catch {
        toast("error", `Erro ao abrir ${f.name}`);
      }
    }
    return out;
  }

  async function handleFiles(rawFiles: File[]) {
    const files = await expandZips(rawFiles);
    if (files.length === 0) return;
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
    try {
      const { data } = await api.post("/upload/confirm", {
        file_id_temp: item.fileIdTemp,
        person,
        filename: fname,
        file_type: fname.toLowerCase().includes("fatura") ? "credit_card" : "statement",
        transactions: txs,
      });
      updateQueue(fileIdx, { status: "done", saved: data.saved });
      toast("success", `${data.saved} transações importadas de ${fname}`);
      loadUploadedFiles();
    } catch {
      toast("error", `Erro ao confirmar ${fname}`);
      return;
    }

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
    try {
      await api.delete(`/upload/files/${id}`);
      setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
      toast("success", "Arquivo e transações removidos");
    } catch {
      toast("error", "Erro ao remover arquivo");
    }
  }

  const pending = queue.filter((q) => q.status === "pending" || q.status === "processing").length;
  const activeItem = activeIdx !== null ? queue[activeIdx] : null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Importar PDF</h1>

      <div className="flex gap-4 items-center">
        <span className="text-muted text-sm">Pessoa:</span>
        {(["diogo", "lis"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPerson(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
              person === p ? "bg-accent text-white" : "bg-surface text-muted"
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <DropZone onFiles={handleFiles} />

      {/* Queue status */}
      {queue.length > 0 && (
        <div className="bg-surface border border-hairline rounded-xl p-4 space-y-2">
          <h3 className="text-sm text-muted font-medium">
            Fila de importação {pending > 0 && `· ${pending} restante(s)`}
          </h3>
          {queue.map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="w-4">
                {item.status === "done" && <Check className="w-4 h-4 text-accent" />}
                {item.status === "error" && <X className="w-4 h-4 text-danger" />}
                {item.status === "processing" && <Clock className="w-4 h-4 text-muted animate-pulse" />}
                {item.status === "preview" && <Eye className="w-4 h-4 text-accent" />}
                {item.status === "pending" && <Pause className="w-4 h-4 text-muted" />}
              </span>
              <span className="flex-1 truncate text-ink">{item.file.name}</span>
              {item.status === "done" && (
                <span className="text-accent">{item.saved} transações</span>
              )}
              {item.duplicateOf && item.status === "preview" && (
                <span className="flex items-center gap-1 text-danger text-xs"><AlertTriangle className="w-3.5 h-3.5" /> duplicado</span>
              )}
              {item.status === "preview" && i !== activeIdx && (
                <button
                  onClick={() => setActiveIdx(i)}
                  className="text-xs text-accent underline"
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
        <div className="bg-surface border border-hairline rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">
                {activeItem.file.name} · {activeItem.transactions.length} transações
              </h3>
              {activeItem.duplicateOf && (
                <p className="flex items-center gap-1 text-danger text-xs mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Este arquivo já foi importado anteriormente. Confirmar mesmo assim?
                </p>
              )}
            </div>
            <button
              onClick={() => handleConfirm(activeIdx!)}
              className="bg-accent text-white px-6 py-2 rounded-lg font-semibold"
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
        <div className="bg-surface border border-hairline rounded-xl p-4 space-y-3">
          <h3 className="text-sm text-muted font-medium">Arquivos importados</h3>
          {uploadedFiles.map((f) => (
            <div key={f.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-ink">{f.filename}</span>
                <span className="text-muted ml-2">
                  {MONTHS[f.month - 1]}/{f.year} · {f.person} · {f.transaction_count} tx
                </span>
              </div>
              <button
                onClick={() => handleDeleteFile(f.id)}
                className="text-danger hover:text-danger text-xs px-2 py-1 border border-danger rounded"
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
