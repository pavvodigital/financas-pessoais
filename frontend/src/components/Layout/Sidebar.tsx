import { Outlet, NavLink } from "react-router-dom";
import PersonFilter from "./PersonFilter";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/import", label: "Importar" },
  { to: "/transactions", label: "Transações" },
  { to: "/installments", label: "Parcelas" },
  { to: "/fixed-costs", label: "Custos Fixos" },
  { to: "/categories", label: "Categorias" },
  { to: "/plans", label: "Planos" },
  { to: "/trends", label: "Tendências" },
];

export default function Sidebar() {
  return (
    <div className="flex h-screen bg-paper">
      <aside className="w-56 bg-surface border-r border-hairline flex flex-col py-6 shrink-0">
        <div className="px-5 pb-6 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-ink text-white text-sm flex items-center justify-center font-semibold">F</span>
          <span className="text-ink font-semibold text-lg tracking-tight">Finanças</span>
        </div>
        <nav className="flex-1 flex flex-col">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-5 py-2.5 text-sm border-l-2 transition-colors ${
                  isActive
                    ? "border-accent bg-accent-tint text-ink font-semibold"
                    : "border-transparent text-muted hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-hairline pt-4 px-3">
          <p className="px-2 text-[11px] uppercase tracking-wider text-muted mb-2">Visualizar</p>
          <PersonFilter />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
