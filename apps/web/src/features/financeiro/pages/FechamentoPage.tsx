import { Lock, LockOpen, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { fecharMes, listarFechamentos, reabrirMes } from "../application/fechamento";
import type { FechamentoMensal, StatusFechamento } from "../domain/fechamento";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; fechamentos: FechamentoMensal[] };

function ultimasCompetencias(qtd: number): string[] {
  const hoje = new Date();
  return Array.from({ length: qtd }, (_, i) => {
    const ano = hoje.getUTCFullYear();
    const mes = hoje.getUTCMonth() - i;
    const data = new Date(Date.UTC(ano, mes, 1));
    return data.toISOString().slice(0, 10);
  });
}

export function FechamentoPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");
  const ehSuperadmin = user?.papel === "superadmin";

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const fechamentos = await listarFechamentos(supabaseFinanceiroAdapter);
      setEstado({ fase: "pronto", fechamentos });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar fechamentos.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function fechar(competencia: string) {
    if (!user) return;
    setProcessando(competencia);
    setErroAcao(null);
    try {
      await fecharMes(supabaseFinanceiroAdapter, competencia);
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível fechar o mês.");
    } finally {
      setProcessando(null);
    }
  }

  async function reabrir(competencia: string) {
    if (!user) return;
    const motivo = prompt("Motivo da reabertura (obrigatório, fica registrado):");
    if (motivo === null) return;
    setProcessando(competencia);
    setErroAcao(null);
    try {
      await reabrirMes(supabaseFinanceiroAdapter, competencia, motivo);
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível reabrir o mês.");
    } finally {
      setProcessando(null);
    }
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">
          Você não tem permissão de leitura no módulo Financeiro.
        </p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const statusPorCompetencia = new Map(estado.fechamentos.map((f) => [f.competencia, f.status]));
  const competencias = ultimasCompetencias(12);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <h3 className="text-base font-semibold text-ink">Fechamento mensal</h3>
        <p className="mt-0.5 text-sm text-ink-3">
          Mês fechado trava novos lançamentos/edições naquela competência. Reabertura exige motivo e
          fica auditada.
        </p>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      <div className="overflow-x-auto rounded-[8px] border border-line bg-card">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-3">
            <tr>
              <th className="px-3 py-2">Competência</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {competencias.map((competencia) => {
              const status: StatusFechamento = statusPorCompetencia.get(competencia) ?? "aberto";
              const [ano, mes] = competencia.split("-");
              return (
                <tr key={competencia} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-semibold text-ink">{`${mes}/${ano}`}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status === "fechado" ? "bg-[#EFF1F4] text-[#5A6175]" : "bg-[#E7F6EC] text-[#1E8E45]"}`}
                    >
                      {status === "fechado" ? "Fechado" : "Aberto"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      {status === "aberto" && temEscrita && (
                        <button
                          type="button"
                          onClick={() => fechar(competencia)}
                          disabled={processando === competencia}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink disabled:opacity-50"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Fechar mês
                        </button>
                      )}
                      {status === "fechado" && ehSuperadmin && (
                        <button
                          type="button"
                          onClick={() => reabrir(competencia)}
                          disabled={processando === competencia}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-orange hover:text-orange-deep disabled:opacity-50"
                        >
                          <LockOpen className="h-3.5 w-3.5" />
                          Reabrir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
