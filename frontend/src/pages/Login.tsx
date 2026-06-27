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
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <form onSubmit={handleSubmit} className="bg-surface border border-hairline p-8 rounded-xl w-80 space-y-5">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-ink text-white text-sm flex items-center justify-center font-semibold">F</span>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Finanças</h1>
        </div>
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-paper border border-hairline rounded-lg px-4 py-2 text-ink outline-none focus:border-accent"
        />
        {error && <p className="text-danger text-sm">{error}</p>}
        <button type="submit" className="w-full bg-accent text-white rounded-lg py-2 font-semibold hover:opacity-90">
          Entrar
        </button>
      </form>
    </div>
  );
}
