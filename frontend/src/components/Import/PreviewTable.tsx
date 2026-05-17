interface TxPreview {
  date: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  category_name: string | null;
  source: string;
}

interface Props {
  transactions: TxPreview[];
  categories: Array<{ id: string; name: string }>;
  onChange: (idx: number, category_name: string) => void;
}

export default function PreviewTable({ transactions, categories, onChange }: Props) {
  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-left border-b border-[#333]">
            <th className="py-2 pr-4">Data</th>
            <th className="py-2 pr-4">Descrição</th>
            <th className="py-2 pr-4">Valor</th>
            <th className="py-2">Categoria</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, i) => (
            <tr key={i} className="border-b border-[#222] hover:bg-[#1a1a2e]">
              <td className="py-2 pr-4 text-gray-400">{tx.date}</td>
              <td className="py-2 pr-4">{tx.merchant_name || tx.description}</td>
              <td
                className={`py-2 pr-4 ${
                  tx.amount < 0 ? "text-red-400" : "text-green-400"
                }`}
              >
                R${" "}
                {Math.abs(tx.amount).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="py-2">
                <select
                  value={tx.category_name || ""}
                  onChange={(e) => onChange(i, e.target.value)}
                  className="bg-[#0f0f1a] border border-[#333] rounded px-2 py-1 text-sm text-gray-200"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
