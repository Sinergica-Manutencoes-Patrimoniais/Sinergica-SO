import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";

export function LoginPage() {
  const { login, erroSessao, limparErroSessao } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // AC-4: sessão restaurada sem perfil (config.usuarios) mostra a mensagem uma vez, ao chegar
  // no login — depois o auth-context já limpou a sessão via signOut automático.
  useEffect(() => {
    if (erroSessao) {
      setError(erroSessao);
      limparErroSessao();
    }
  }, [erroSessao, limparErroSessao]);

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
    } catch (err) {
      // CredenciaisInvalidasError e ContaSemPerfilError já trazem mensagem apropriada
      // (AC-2 nunca revela qual campo está errado; AC-4 é explícita sobre perfil ausente).
      setError(err instanceof Error ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-paper lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
      <section className="relative hidden overflow-hidden bg-navy-deep p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-white/10" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-orange/10 blur-3xl" />
        <img
          src="/logos/logo-horizontal-branco.png"
          alt="Sinérgica Manutenções Patrimoniais"
          className="relative h-9 w-fit object-contain"
        />
        <div className="relative max-w-lg">
          <p className="font-brand text-[11px] font-semibold uppercase tracking-[0.22em] text-orange">
            Sistema Operacional
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.035em] xl:text-4xl">
            Operação, atendimento e gestão em um só lugar.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#B9C1D8]">
            Informação operacional clara para a equipe decidir mais rápido e executar melhor.
          </p>
        </div>
        <p className="relative text-xs text-[#8792B2]">Sinérgica Manutenções Patrimoniais</p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-7 lg:hidden">
            <img
              src="/logos/logo-horizontal-positivo.png"
              alt="Sinérgica Manutenções Patrimoniais"
              className="h-11 object-contain"
            />
            <p className="mt-2 text-xs text-ink-3">Sistema Operacional</p>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <p className="font-brand text-[10px] font-semibold uppercase tracking-[0.18em] text-orange">
              Área segura
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-ink">
              Bem-vindo de volta
            </h2>
            <p className="mb-5 mt-1 text-xs leading-relaxed text-ink-3">
              Entre com as credenciais da sua conta Sinérgica.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-ink-2">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@sinergica.com.br"
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-ink-2">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                />
              </div>

              {error && (
                <p className="status-error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-accent mt-1 w-full shadow-[0_2px_0_0_#C5590C] hover:translate-y-px hover:shadow-none"
              >
                {loading ? "Entrando…" : "Entrar"}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-[11px] text-ink-3">
            Acesso restrito · Ambiente monitorado
          </p>
        </div>
      </section>
    </main>
  );
}
