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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy shadow-lg mb-4">
            <svg
              className="w-9 h-9 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
              aria-label="Sinérgica SO"
              role="img"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Sinérgica SO</h1>
          <p className="text-sm text-ink-3 mt-1">Sistema Operacional · Sinérgica Manutenções</p>
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
