import { useEffect, useState } from "react";
import api from "../api/client";
import type { Category } from "../types";

interface Rule {
  id: string;
  keyword: string;
  match_type: string;
  priority: number;
}

export default function Categories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Category | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    color: "#808080",
    icon: "❓",
    monthly_budget: "",
  });

  useEffect(() => {
    api.get<Category[]>("/categories").then((r) => setCats(r.data));
  }, []);

  async function selectCat(cat: Category) {
    setSelected(cat);
    setForm({
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      monthly_budget: String(cat.monthly_budget || ""),
    });
    const r = await api.get<Rule[]>(`/categories/${cat.id}/rules`);
    setRules(r.data);
  }

  async function saveCategory() {
    const body = {
      ...form,
      monthly_budget: form.monthly_budget ? Number(form.monthly_budget) : null,
    };
    if (selected) {
      await api.put(`/categories/${selected.id}`, body);
    } else {
      await api.post("/categories", body);
    }
    const r = await api.get<Category[]>("/categories");
    setCats(r.data);
    setEditing(false);
    setSelected(null);
  }

  async function deleteCategory(id: string) {
    if (!confirm("Remover categoria? Transações serão movidas para Outros.")) return;
    await api.delete(`/categories/${id}`);
    setCats((prev) => prev.filter((c) => c.id !== id));
    setSelected(null);
  }

  async function addRule() {
    if (!selected || !newKeyword.trim()) return;
    const r = await api.post(`/categories/${selected.id}/rules`, {
      keyword: newKeyword.trim().toUpperCase(),
      match_type: "contains",
      priority: 0,
    });
    setRules((prev) => [...prev, r.data]);
    setNewKeyword("");
  }

  async function deleteRule(ruleId: string) {
    if (!selected) return;
    await api.delete(`/categories/${selected.id}/rules/${ruleId}`);
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Categorias</h1>
        <button
          onClick={() => {
            setSelected(null);
            setForm({ name: "", color: "#808080", icon: "❓", monthly_budget: "" });
            setEditing(true);
          }}
          className="bg-[#7c6af7] text-white px-4 py-2 rounded-lg text-sm"
        >
          + Nova
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cats.map((cat) => (
          <div
            key={cat.id}
            onClick={() => { selectCat(cat); setEditing(false); }}
            className={`bg-[#1a1a2e] rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-[#252540] ${
              selected?.id === cat.id ? "ring-1 ring-[#7c6af7]" : ""
            }`}
          >
            <span className="text-2xl">{cat.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{cat.name}</p>
              <p className="text-xs text-gray-500">{cat.rule_count} regras</p>
            </div>
          </div>
        ))}
      </div>
      {selected && !editing && (
        <div className="bg-[#1a1a2e] rounded-xl p-5 space-y-4">
          <div className="flex justify-between">
            <h2 className="font-bold">
              {selected.icon} {selected.name}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-[#7c6af7] border border-[#7c6af7] px-3 py-1 rounded"
              >
                Editar
              </button>
              <button
                onClick={() => deleteCategory(selected.id)}
                className="text-xs text-red-400 border border-red-400 px-3 py-1 rounded"
              >
                Remover
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">
              Regras de categorização automática
            </p>
            <div className="space-y-1 mb-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex justify-between items-center bg-[#0f0f1a] px-3 py-1.5 rounded"
                >
                  <span className="text-sm font-mono">{rule.keyword}</span>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="text-gray-500 hover:text-red-400 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRule()}
                placeholder="Nova keyword (ex: SUPERMERCAD)"
                className="flex-1 bg-[#0f0f1a] border border-[#333] rounded px-3 py-1.5 text-sm"
              />
              <button
                onClick={addRule}
                className="bg-[#7c6af7] text-white px-4 py-1.5 rounded text-sm"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <div className="bg-[#1a1a2e] rounded-xl p-5 space-y-3">
          <h2 className="font-bold">{selected ? "Editar" : "Nova"} categoria</h2>
          {(
            [
              { label: "Nome", key: "name", type: "text" },
              { label: "Ícone (emoji)", key: "icon", type: "text" },
              { label: "Cor (hex)", key: "color", type: "text" },
              { label: "Orçamento mensal (R$)", key: "monthly_budget", type: "number" },
            ] as const
          ).map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs text-gray-400">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-[#0f0f1a] border border-[#333] rounded px-3 py-1.5 text-sm mt-1"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={saveCategory}
              className="bg-[#7c6af7] text-white px-5 py-2 rounded-lg text-sm"
            >
              Salvar
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-gray-400 px-5 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
