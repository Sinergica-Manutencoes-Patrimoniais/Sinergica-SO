import { type FormEvent, useState } from "react";
import { useAuth } from "../../../app/auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError("Credenciais inválidas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <img
            src="/logos/logo-horizontal-positivo.png"
            alt="Sinérgica Manutenções Patrimoniais"
            className="mx-auto h-14 object-contain mb-2"
          />
          <p className="text-sm text-ink-3 mt-1">Sistema Operacional</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-line p-8">
          <h2 className="text-lg font-semibold text-ink mb-1">Entrar na sua conta</h2>
          <p className="text-sm text-ink-3 mb-6">Acesso restrito à equipe Sinérgica.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-2 mb-1.5">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@sinergica.com.br"
                className="w-full px-3.5 py-2.5 rounded-lg border border-line text-ink placeholder-ink-4 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-2 mb-1.5">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-line text-ink placeholder-ink-4 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition"
              />
            </div>

            {error && (
              <p className="text-sm text-[#C5362B] bg-[#FCEAE8] border border-[#F2C4C0] rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-orange hover:bg-orange-deep disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition shadow-[0_2px_0_0_#C5590C] hover:shadow-none focus:outline-none focus:ring-2 focus:ring-orange/30 focus:ring-offset-2 cursor-pointer"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-3 mt-6">
          Sinérgica SO · Padrão SO v2 · Trívia Studio
        </p>
      </div>
    </div>
  );
}
