import { ExternalLink, Send, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { OcorrenciaPreventiva, PlanoPreventivo } from "../application/preventivas-gateway";

function dataHoraBr(valor: string | null): string {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: valor.includes("T") ? "short" : undefined,
  }).format(data);
}

function resultado(resultado: OcorrenciaPreventiva["resultado_estado"]): string {
  if (resultado === "ok") return "OK";
  if (resultado === "nao_ok") return "Não OK";
  return "Pendente";
}

/** Contexto completo de uma ocorrência sem retirar o operador da visão preventiva escolhida. */
export function PreventivaDetalheDrawer({
  ocorrencia,
  plano,
  ocorrenciasDoPlano,
  temEscrita,
  onClose,
  onConfirmarVisita,
  onAbrirOs,
}: {
  ocorrencia: OcorrenciaPreventiva;
  plano: PlanoPreventivo | null;
  ocorrenciasDoPlano: readonly OcorrenciaPreventiva[];
  temEscrita: boolean;
  onClose: () => void;
  onConfirmarVisita: (ocorrencia: OcorrenciaPreventiva) => void;
  onAbrirOs?: (osId: string) => void;
}) {
  const focoAnterior = useRef<HTMLElement | null>(null);

  useEffect(() => {
    focoAnterior.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      focoAnterior.current?.focus();
    };
  }, [onClose]);

  const outras = ocorrenciasDoPlano
    .filter((item) => item.id !== ocorrencia.id)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const proximas = outras.filter((item) => item.vencimento >= ocorrencia.vencimento).slice(0, 5);
  const historico = outras
    .filter((item) => item.os_concluida_em || item.resultado_estado !== "pendente")
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape oferece o equivalente por teclado. */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <aside
        aria-label={`Detalhe da preventiva ${plano?.nome ?? ""}`.trim()}
        className="drawer-panel relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-card shadow-modal"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card px-4 py-3">
          <div>
            <p className="text-micro font-semibold uppercase tracking-wider text-ink-3">
              Detalhe da preventiva
            </p>
            <h2 className="text-heading font-semibold text-ink">
              {plano?.nome ?? "Plano removido"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhe da preventiva"
            className="text-ink-3 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-col gap-5 p-4">
          <section className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-body font-semibold text-ink">Ocorrência</h3>
                <p className="mt-1 text-caption text-ink-3">
                  Vencimento {dataHoraBr(ocorrencia.vencimento)} · Visita{" "}
                  {dataHoraBr(ocorrencia.visita_em)}
                </p>
              </div>
              <span className="rounded-full bg-line-soft px-2 py-1 text-caption font-semibold text-ink-2">
                Resultado: {resultado(ocorrencia.resultado_estado)}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-3 text-caption sm:grid-cols-2">
              <Campo titulo="Técnico" valor={ocorrencia.tecnico_nome ?? "Não atribuído"} />
              <Campo
                titulo="Situação Auvo"
                valor={
                  ocorrencia.envio_estado === "disponivel"
                    ? "Disponível"
                    : ocorrencia.envio_estado === "falha"
                      ? "Falha ao enviar"
                      : ocorrencia.envio_estado
                }
              />
              <Campo
                titulo="OS"
                valor={ocorrencia.os_numero ? `OS ${ocorrencia.os_numero}` : "Não criada"}
              />
              <Campo titulo="Executada" valor={dataHoraBr(ocorrencia.os_concluida_em ?? null)} />
            </dl>
            {ocorrencia.erro_envio && (
              <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">
                {ocorrencia.erro_envio}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {ocorrencia.os_id && onAbrirOs && (
                <button
                  type="button"
                  onClick={() => onAbrirOs(ocorrencia.os_id as string)}
                  className="rounded-md border border-line px-3 py-1.5 text-caption font-semibold text-ink hover:bg-line-soft"
                >
                  {ocorrencia.os_numero ? `Abrir OS ${ocorrencia.os_numero}` : "Abrir OS"}
                </button>
              )}
              {ocorrencia.auvo_task_url && (
                <a
                  href={ocorrencia.auvo_task_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-caption font-semibold text-ink hover:bg-line-soft"
                >
                  Abrir no Auvo <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {temEscrita && ocorrencia.envio_estado !== "disponivel" && (
                <button
                  type="button"
                  onClick={() => onConfirmarVisita(ocorrencia)}
                  className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-caption font-semibold text-ink hover:bg-line-soft"
                >
                  <Send className="h-3.5 w-3.5" /> Confirmar visita
                </button>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-body font-semibold text-ink">Plano</h3>
            {plano ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface p-4 text-caption sm:grid-cols-2">
                <Campo titulo="Alvo" valor={plano.alvo_nome ?? "Não informado"} />
                <Campo titulo="Estado" valor={plano.estado} />
                <Campo
                  titulo="Recorrência"
                  valor={`A cada ${plano.intervalo_n} ${plano.intervalo_unidade}`}
                />
                <Campo titulo="Início" valor={dataHoraBr(plano.primeira_data)} />
              </dl>
            ) : (
              <p className="mt-2 text-caption text-ink-3">Plano não está mais disponível.</p>
            )}
          </section>

          <OcorrenciasSecao
            titulo="Próximas ocorrências"
            ocorrencias={proximas}
            vazio="Não há próximas ocorrências materializadas."
          />
          <OcorrenciasSecao
            titulo="Histórico de execuções"
            ocorrencias={historico}
            vazio="Ainda não há execução concluída neste plano."
          />
        </div>
      </aside>
    </div>
  );
}

function Campo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-micro font-semibold uppercase tracking-wider text-ink-3">{titulo}</dt>
      <dd className="mt-0.5 text-caption text-ink">{valor}</dd>
    </div>
  );
}

function OcorrenciasSecao({
  titulo,
  ocorrencias,
  vazio,
}: {
  titulo: string;
  ocorrencias: readonly OcorrenciaPreventiva[];
  vazio: string;
}) {
  return (
    <section>
      <h3 className="text-body font-semibold text-ink">{titulo}</h3>
      {ocorrencias.length === 0 ? (
        <p className="mt-2 text-caption text-ink-3">{vazio}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
          {ocorrencias.map((item) => (
            <li key={item.id} className="px-3 py-2 text-caption text-ink-2">
              {dataHoraBr(item.visita_em ?? item.vencimento)} · {item.os_numero ?? "Sem OS"} ·{" "}
              {resultado(item.resultado_estado)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
