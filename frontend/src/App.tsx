import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Import from "./pages/Import";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Plans from "./pages/Plans";
import Trends from "./pages/Trends";
import Installments from "./pages/Installments";
import FixedCosts from "./pages/FixedCosts";
import Layout from "./components/Layout/Sidebar";
import { ToastProvider } from "./components/ui/toast";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="import" element={<Import />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="categories" element={<Categories />} />
          <Route path="plans" element={<Plans />} />
          <Route path="trends" element={<Trends />} />
          <Route path="installments" element={<Installments />} />
          <Route path="fixed-costs" element={<FixedCosts />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
