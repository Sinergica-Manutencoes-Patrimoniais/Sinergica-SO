// E02-S31: dashboard de gasto de IA — consumo por módulo (inspeção, atendimento, previsões),
// limite de quota e histórico. Mesmo padrão visual de `ConfigIaPage` (cards + tabela simples).
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { listarIntegracoes } from "../application/integracoes";
import {
  type GastoLogItem,
  type ModuloIa,
  formatarCustoIA,
  formatarCustoTotalIA,
  resumoGastoMes,
  verificarQuotaExcedida,
} from "../domain/ia-gasto";
import { supabaseIaAdapter } from "../infrastructure/supabase-ia-adapter";
import { supabaseIntegracoesAdapter } from "../infrastructure/supabase-integracoes-adapter";

const LABEL_MODULO: Record<ModuloIa, string> = {
  inspecao: "Inspeção",
  atendimento: "Atendimento",
  previsoes: "Previsões",
};

function mesAtualInput(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export function RelatorioGastoIaPage() {
  const { user } = useAuth();
  const podeVer = user?.papel === "superadmin" || user?.papel === "supervisor";

  const [mesInput, setMesInput] = useState(mesAtualInput());
  const [logs, setLogs] = useState<GastoLogItem[]>([]);
  const [historico, setHistorico] = useState<GastoLogItem[]>([]);
  const [filtroModulo, setFiltroModulo] = useState<ModuloIa | "">("");
  const [limiteQuotaIaUsd, setLimiteQuotaIaUsd] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [anoStr, mesStr] = mesInput.split("-");
      const ano = Number(anoStr) || new Date().getFullYear();
      const mes = Number(mesStr) || 1;
      const mesRef = new Date(Date.UTC(ano, mes - 1, 1));
      const [logsDoMes, hist, integracoes] = await Promise.all([
        supabaseIaAdapter.listarLogsDoMes(mesRef),
        supabaseIaAdapter.listarHistorico({ modulo: filtroModulo || undefined, limite: 50 }),
        listarIntegracoes(supabaseIntegracoesAdapter),
      ]);
      setLogs(logsDoMes);
      setHistorico(hist);
      const ia = integracoes.find((i) => i.chave === "openrouter");
      setLimiteQuotaIaUsd(ia?.limiteQuotaIaUsd ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o gasto de IA.");
    } finally {
      setCarregando(false);
    }
  }, [mesInput, filtroModulo]);

  useEffect(() => {
    if (podeVer) void carregar();
  }, [podeVer, carregar]);

  if (!podeVer) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Só superadmin e supervisor veem o gasto de IA.</p>
      </div>
    );
  }

  const resumo = resumoGastoMes(logs);
  const statusQuota = verificarQuotaExcedida(resumo.usdTotal, limiteQuotaIaUsd);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Gasto de IA</h2>
          <p className="text-sm text-ink-3">
            Consumo de OpenRouter por módulo — inspeção, atendimento e previsões.
          </p>
        </div>
        <input
          type="month"
          className="input"
          value={mesInput}
          onChange={(e) => setMesInput(e.target.value)}
        />
      </div>

      {erro && (
        <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-sm text-danger">
          {erro}
        </div>
      )}

      {!carregando && statusQuota.excedida && (
        <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-sm text-danger">
          Quota de IA excedida este mês — IA desabilitada até o limite ser aumentado.
        </div>
      )}
      {!carregando && statusQuota.aviso90 && (
        <div className="rounded-md border border-warning-line bg-warning-soft px-4 py-2 text-sm text-warning">
          Aviso: {Math.round(statusQuota.percentual ?? 0)}% da quota de IA já foi consumida.
        </div>
      )}

      {carregando ? (
        <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>
      ) : (
        <>
          <section className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-ink-3">Total do mês</span>
              <span className="text-2xl font-bold text-ink">
                {formatarCustoTotalIA(resumo.usdTotal)}
              </span>
            </div>
            {limiteQuotaIaUsd != null && limiteQuotaIaUsd > 0 && (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-line-soft">
                  <div
                    className={`h-full rounded-full ${statusQuota.excedida ? "bg-danger" : statusQuota.aviso90 ? "bg-warning" : "bg-orange"}`}
                    style={{ width: `${Math.min(100, statusQuota.percentual ?? 0)}%` }}
                  />
                </div>
                <span className="mt-1 block text-micro text-ink-3">
                  {formatarCustoTotalIA(resumo.usdTotal)} de{" "}
                  {formatarCustoTotalIA(limiteQuotaIaUsd)} (
                  {Math.round(statusQuota.percentual ?? 0)}%)
                </span>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {resumo.porModulo.map((m) => (
              <section key={m.modulo} className="rounded-xl border border-line bg-card p-4">
                <span className="text-xs font-semibold text-ink-3">{LABEL_MODULO[m.modulo]}</span>
                <div className="mt-1 text-xl font-bold text-ink">
                  {formatarCustoTotalIA(m.usdTotal)}
                </div>
                <div className="mt-1 text-micro text-ink-3">
                  {m.qtde} chamada{m.qtde === 1 ? "" : "s"} · média {formatarCustoIA(m.usdMedio)}
                </div>
              </section>
            ))}
          </div>

          <section className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-3 border-b border-line-soft pb-3">
              <h3 className="text-sm font-semibold text-ink">Histórico (últimas 50)</h3>
              <select
                className="input"
                value={filtroModulo}
                onChange={(e) => setFiltroModulo(e.target.value as ModuloIa | "")}
              >
                <option value="">Todos os módulos</option>
                <option value="inspecao">Inspeção</option>
                <option value="atendimento">Atendimento</option>
                <option value="previsoes">Previsões</option>
              </select>
            </div>
            {historico.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-3">Nenhum gasto registrado ainda.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-3">
                      <th className="py-1.5 pr-3">Data</th>
                      <th className="py-1.5 pr-3">Módulo</th>
                      <th className="py-1.5 pr-3">Modelo</th>
                      <th className="py-1.5 pr-3">Tokens (in/out)</th>
                      <th className="py-1.5 text-right">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((log) => (
                      <tr key={log.id} className="border-t border-line-soft">
                        <td className="py-1.5 pr-3 text-ink-2">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-1.5 pr-3 text-ink-2">{LABEL_MODULO[log.modulo]}</td>
                        <td className="py-1.5 pr-3 text-ink-2">{log.modelo ?? "—"}</td>
                        <td className="py-1.5 pr-3 text-ink-2">
                          {log.promptTokens ?? "—"} / {log.completionTokens ?? "—"}
                        </td>
                        <td className="py-1.5 text-right font-medium text-ink">
                          {formatarCustoIA(log.usdCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
