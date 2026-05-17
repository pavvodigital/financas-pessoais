import { useEffect, useState } from "react";
import api from "../api/client";

interface PlanStatus {
  plan_id: string;
  name: string;
  goal_amount: number;
  target_date: string;
  months_remaining: number;
  category_budgets: Array<{
    category_id: string;
    category_name: string;
    color: string;
    monthly_limit: number;
    spent_this_month: number;
    percentage: number;
    over_budget: boolean;
  }>;
}

export default function Plans() {
  const [statuses, setStatuses] = useState<PlanStatus[]>([]);

  useEffect(() => {
    api.get("/plans").then(async (r) => {
      const s = await Promise.all(
        r.data.map((p: { id: string }) =>
          api.get(`/plans/${p.id}/status`).then((r) => r.data)
        )
      );
      setStatuses(s);
    });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Planos de Economia</h1>
      {statuses.length === 0 && (
        <p className="text-gray-400">Nenhum plano criado ainda.</p>
      )}
      {statuses.map((plan) => (
        <div key={plan.plan_id} className="bg-[#1a1a2e] rounded-xl p-5 space-y-4">
          <div className="flex justify-between">
            <div>
              <h2 className="font-bold text-lg text-[#7c6af7]">{plan.name}</h2>
              <p className="text-gray-400 text-sm">
                Meta: R$ {plan.goal_amount.toLocaleString("pt-BR")} ·{" "}
                {plan.months_remaining} meses restantes
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {plan.category_budgets.map((b) => (
              <div key={b.category_id}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{b.category_name}</span>
                  <span className={b.over_budget ? "text-red-400" : "text-gray-400"}>
                    R${" "}
                    {b.spent_this_month.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    / R${" "}
                    {b.monthly_limit.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                    {b.over_budget && " ⚠️"}
                  </span>
                </div>
                <div className="bg-[#0f0f1a] rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(b.percentage, 100)}%`,
                      background: b.over_budget ? "#e05c5c" : b.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
