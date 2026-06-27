import { Outlet, NavLink } from "react-router-dom";
import PersonFilter from "./PersonFilter";

const navItems = [
  { to: "/dashboard", icon: "📊", label: "Dashboard" },
  { to: "/import", icon: "📥", label: "Importar" },
  { to: "/transactions", icon: "💳", label: "Transações" },
  { to: "/installments", icon: "🧾", label: "Parcelas" },
  { to: "/fixed-costs", icon: "🔁", label: "Custos Fixos" },
  { to: "/categories", icon: "🏷️", label: "Categorias" },
  { to: "/plans", icon: "🎯", label: "Planos" },
  { to: "/trends", icon: "📈", label: "Tendências" },
];

export default function Sidebar() {
  return (
    <div className="flex h-screen bg-[#0f172a]">
      <aside className="w-52 bg-[#1e293b] border-r border-[#334155] flex flex-col py-4 gap-2 shrink-0">
        <div className="px-4 pb-2 text-[#38bdf8] font-bold text-lg">Finanças</div>
        <nav className="flex-1 flex flex-col gap-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-sky-500 text-white"
                    : "text-[#94a3b8] hover:text-white hover:bg-[#334155]"
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#334155] pt-3">
          <p className="px-4 text-xs text-[#475569] mb-2">Visualizar</p>
          <PersonFilter />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
