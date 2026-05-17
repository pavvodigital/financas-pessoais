import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { password });
      localStorage.setItem("token", data.token);
      nav("/dashboard");
    } catch {
      setError("Senha incorreta");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <form onSubmit={handleSubmit} className="bg-[#1e293b] p-8 rounded-xl w-80 space-y-4">
        <h1 className="text-2xl font-bold text-[#38bdf8]">Finanças</h1>
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-4 py-2 text-white"
        />
        {error && <p className="text-[#fb923c] text-sm">{error}</p>}
        <button type="submit" className="w-full bg-sky-500 text-white rounded-lg py-2 font-semibold">
          Entrar
        </button>
      </form>
    </div>
  );
}
