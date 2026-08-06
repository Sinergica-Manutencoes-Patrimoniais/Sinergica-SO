import { AlertTriangle, CalendarDays, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { obterResumoRelatorioDiario } from "../application/relatorio-diario";
import { formatarHorasMinutos } from "../domain/apontamento-horas";
import type { ResumoRelatorioDiario } from "../domain/relatorio-diario";
import { supabaseApontamentoHorasAdapter } from "../infrastructure/supabase-apontamento-horas-adapter";
import { supabaseChamadosAdapter } from "../infrastructure/supabase-chamados-adapter";
import { supabaseDashboardPcmAdapter } from "../infrastructure/supabase-dashboard-pcm-adapter";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function CardResumo({
  label,
  valor,
  detalhe,
}: { label: string; valor: string | number; detalhe?: string }) {
  return (
    <div className="rounded-[8px] border border-line bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-ink-3">{detalhe}</p> : null}
    </div>
  );
}

export function RelatorioDiarioPage() {
  const [data, setData] = useState(hoje);
  const [resumo, setResumo] = useState<ResumoRelatorioDiario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setResumo(
        await obterResumoRelatorioDiario(data, {
          ordens: supabaseHubOsAdapter,
          chamados: supabaseChamadosAdapter,
          apontamentos: supabaseApontamentoHorasAdapter,
          saude: supabaseDashboardPcmAdapter,
        }),
      );
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível gerar o relatório.");
    } finally {
      setCarregando(false);
    }
  }, [data]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Relatório do Dia</h2>
          <p className="text-sm text-ink-3">Resumo gerencial da operação, por data</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="relatorio-diario-data">
            Data do relatório
          </label>
          <input
            id="relatorio-diario-data"
            aria-label="Data do relatório"
            type="date"
            value={data}
            onChange={(event) => setData(event.target.value)}
            className="input"
          />
          <button
            type="button"
            onClick={() => void carregar()}
            className="btn-secondary"
            disabled={carregando}
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
      </header>

      {erro ? (
        <p className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-[#A12D24]">
          {erro}
        </p>
      ) : null}
      {carregando ? <p className="text-sm text-ink-3">Gerando relatório…</p> : null}
      {!carregando && resumo ? (
        <>
          {resumo.semMovimento ? (
            <div className="rounded-[8px] border border-line bg-card p-6 text-center">
              <CalendarDays className="mx-auto mb-2 h-6 w-6 text-ink-3" />
              <p className="font-semibold text-ink">Sem movimento neste dia</p>
              <p className="mt-1 text-sm text-ink-3">
                Escolha outra data para consultar a operação.
              </p>
            </div>
          ) : null}

          <section aria-label="Resumo do dia" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CardResumo label="OS abertas" valor={resumo.ordensAbertas} />
            <CardResumo label="OS finalizadas" valor={resumo.ordensFinalizadas} />
            <CardResumo label="Chamados novos" valor={resumo.chamadosNovos} />
            <CardResumo
              label="Horas apontadas"
              valor={formatarHorasMinutos(resumo.horasApontadas)}
            />
            <CardResumo
              label="Backlog atual"
              valor={resumo.itensBacklog}
              detalhe={`${resumo.emergenciais} C1 aberta(s)`}
            />
            <CardResumo
              label="Planejado × executado"
              valor={
                resumo.percentualPlanejadoExecutado == null
                  ? "—"
                  : `${resumo.percentualPlanejadoExecutado}%`
              }
              detalhe={
                resumo.percentualPlanejadoExecutado == null
                  ? "Sem OS planejada"
                  : "Concluídas no mesmo dia"
              }
            />
          </section>

          <section className="rounded-[8px] border border-line bg-card">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <Users className="h-4 w-4 text-ink-3" />
              <h3 className="font-semibold text-ink">Por técnico</h3>
            </div>
            {resumo.porTecnico.length === 0 ? (
              <p className="p-4 text-sm text-ink-3">Sem apontamentos no dia.</p>
            ) : (
              <ul className="divide-y divide-line">
                {resumo.porTecnico.map((tecnico) => (
                  <li
                    key={tecnico.nome}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-ink">{tecnico.nome}</span>
                    <span className="text-ink-3">
                      {formatarHorasMinutos(tecnico.horas)} · {tecnico.ordens} OS
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-label="Atenção"
            className="rounded-[8px] border border-[#F2D2A7] bg-[#FFF8EE] p-4"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#B26A00]" />
              <h3 className="font-semibold text-ink">Atenção</h3>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-ink-2 sm:grid-cols-2">
              <p>
                OS atrasadas: <strong>{resumo.ordensAtrasadas}</strong>
              </p>
              <p>
                OS sem técnico: <strong>{resumo.ordensSemTecnico}</strong>
              </p>
              <p>
                Chamados sem tratativa: <strong>{resumo.chamadosSemTratativa}</strong>
              </p>
              <p>
                Sync Auvo:{" "}
                <strong>
                  {resumo.errosSyncAuvo == null
                    ? "indisponível"
                    : `${resumo.errosSyncAuvo} erro(s), ${resumo.pendenciasSyncAuvo ?? 0} pendência(s)`}
                </strong>
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
