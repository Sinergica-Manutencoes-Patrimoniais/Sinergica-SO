import { Button, Skeleton } from "@sinergica/ui";
import { ExternalLink, Puzzle, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useCadastroSistema,
  useComponentesSistema,
  useOsSistema,
  usePreventivasSistema,
} from "../application/detalhe-sistema-queries";
import { linkAuvoDaOs, separarOsSistema, ultimaManutencaoSistema } from "../domain/detalhe-sistema";
import type { OsSistema, PreventivaSistema } from "../domain/detalhe-sistema";
import { auvoTaskDeepLink } from "../domain/ordens-servico";
import { supabaseDetalheSistemaAdapter } from "../infrastructure/supabase-detalhe-sistema-adapter";
import { DrawerDetalheAtivo } from "./DrawerDetalheAtivo";

function dataBr(valor: string | null | undefined, comHora = false): string {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(comHora ? { timeStyle: "short" } : {}),
  }).format(data);
}

function statusSync(status: string | null): string {
  if (status === "synced") return "Sincronizado";
  if (status === "error") return "Erro de sincronização";
  if (status === "pending") return "Pendente";
  return "Não informado";
}

function resultadoPreventiva(resultado: "pendente" | "ok" | "nao_ok") {
  if (resultado === "ok") return "OK";
  if (resultado === "nao_ok") return "Não OK";
  return "Pendente";
}

export function DrawerDetalheSistema({
  sistemaId,
  clienteEsperadoId,
  onClose,
  onAbrirOs,
}: {
  sistemaId: string;
  clienteEsperadoId?: string;
  onClose: () => void;
  onAbrirOs?: (osId: string) => void;
}) {
  const focoAnterior = useRef<HTMLElement | null>(null);
  const [componenteAbertoId, setComponenteAbertoId] = useState<string | null>(null);
  const componenteAbertoIdRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  componenteAbertoIdRef.current = componenteAbertoId;
  onCloseRef.current = onClose;
  const cadastro = useCadastroSistema(supabaseDetalheSistemaAdapter, sistemaId, clienteEsperadoId);
  const clienteId = cadastro.data?.clienteId ?? null;
  const componentes = useComponentesSistema(supabaseDetalheSistemaAdapter, sistemaId, clienteId);
  const ordens = useOsSistema(supabaseDetalheSistemaAdapter, sistemaId, clienteId);
  const preventivas = usePreventivasSistema(supabaseDetalheSistemaAdapter, sistemaId, clienteId);
  const quantidadeComponentes = componentes.data?.length ?? cadastro.data?.quantidadeComponentes;

  useEffect(() => {
    focoAnterior.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !componenteAbertoIdRef.current) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      focoAnterior.current?.focus();
    };
  }, []);

  const abrirOs = (osId: string) => {
    if (onAbrirOs) onAbrirOs(osId);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape oferece o equivalente por teclado. */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside
        aria-label="Detalhe operacional do Sistema"
        className="drawer-panel relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-card shadow-modal"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-card px-4 py-3">
          <h2 className="text-heading font-semibold text-ink">Detalhe operacional do Sistema</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhe do Sistema"
            className="text-ink-3 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {cadastro.isLoading && <Carregando />}
        {cadastro.error && (
          <ErroSecao
            mensagem="Não foi possível carregar o cadastro do Sistema."
            onRetry={() => void cadastro.refetch()}
          />
        )}
        {cadastro.data === null && !cadastro.isLoading && !cadastro.error && (
          <div className="p-8 text-center">
            <p className="text-body text-ink-3">Este Sistema não está mais disponível.</p>
            <Button className="mt-4" onClick={onClose}>
              Fechar
            </Button>
          </div>
        )}
        {cadastro.data && (
          <div className="flex flex-col gap-4 p-4">
            <section className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-body font-semibold text-ink">{cadastro.data.nome}</h3>
                  <p className="mt-1 font-mono text-caption text-ink-3">
                    {cadastro.data.identificador ?? "—"}
                  </p>
                </div>
                <span className="rounded-full bg-line-soft px-2 py-1 text-caption text-ink-2">
                  {statusSync(cadastro.data.syncStatus)}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 text-caption sm:grid-cols-2">
                <Campo titulo="Cliente" valor={cadastro.data.clienteNome ?? "Não informado"} />
                <Campo titulo="Categoria" valor={cadastro.data.categoria ?? "Não informado"} />
                <Campo titulo="Área / Local" valor={cadastro.data.posicao ?? "—"} />
                <Campo
                  titulo="Componentes atuais"
                  valor={quantidadeComponentes == null ? "—" : String(quantidadeComponentes)}
                />
                <Campo titulo="Descrição" valor={cadastro.data.descricao ?? "Não informado"} />
                <Campo titulo="Cadastrado em" valor={dataBr(cadastro.data.criadoEm, true)} />
                <Campo titulo="Atualizado em" valor={dataBr(cadastro.data.atualizadoEm, true)} />
              </dl>
            </section>

            <Secao titulo="OS abertas">
              <ConteudoOs
                ordens={ordens.data}
                erro={Boolean(ordens.error)}
                carregando={ordens.isLoading}
                onRetry={() => void ordens.refetch()}
                onAbrirOs={abrirOs}
                abertas
              />
            </Secao>

            <Secao titulo="Histórico de OS">
              {ordens.data && (
                <p className="mb-2 text-caption text-ink-3">
                  Última manutenção:{" "}
                  <strong className="text-ink-2">
                    {dataBr(ultimaManutencaoSistema(ordens.data))}
                  </strong>
                </p>
              )}
              <ConteudoOs
                ordens={ordens.data}
                erro={Boolean(ordens.error)}
                carregando={ordens.isLoading}
                onRetry={() => void ordens.refetch()}
                onAbrirOs={abrirOs}
              />
            </Secao>

            <Secao titulo="Preventivas">
              {preventivas.isLoading && <Skeleton className="h-16 w-full" />}
              {preventivas.error && (
                <ErroSecao
                  mensagem="Não foi possível carregar as preventivas."
                  onRetry={() => void preventivas.refetch()}
                />
              )}
              {preventivas.data && (
                <ListaPreventivas preventivas={preventivas.data} onAbrirOs={abrirOs} />
              )}
            </Secao>

            <Secao
              titulo={`Componentes (${quantidadeComponentes == null ? "—" : quantidadeComponentes})`}
            >
              {componentes.isLoading && <Skeleton className="h-16 w-full" />}
              {componentes.error && (
                <ErroSecao
                  mensagem="Não foi possível carregar os componentes."
                  onRetry={() => void componentes.refetch()}
                />
              )}
              {componentes.data && componentes.data.length === 0 && (
                <Vazio texto="Nenhum componente faz parte deste Sistema atualmente." />
              )}
              {componentes.data && componentes.data.length > 0 && (
                <ul className="divide-y divide-line-soft rounded-lg border border-line">
                  {componentes.data.map((componente) => (
                    <li key={componente.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-line-soft"
                        onClick={() => setComponenteAbertoId(componente.id)}
                      >
                        <Puzzle className="h-4 w-4 shrink-0 text-orange" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-caption font-semibold text-ink">
                            {componente.nome}
                          </span>
                          <span className="block truncate text-micro text-ink-3">
                            {[componente.identificador, componente.posicao ?? "—"]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
          </div>
        )}
      </aside>
      {componenteAbertoId && (
        <DrawerDetalheAtivo
          itemId={componenteAbertoId}
          onClose={() => setComponenteAbertoId(null)}
        />
      )}
    </div>
  );
}

function Campo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-micro font-semibold uppercase tracking-wide text-ink-3">{titulo}</dt>
      <dd className="mt-0.5 text-ink-2">{valor}</dd>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-body font-semibold text-ink">{titulo}</h3>
      {children}
    </section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed border-line px-3 py-4 text-caption text-ink-3">
      {texto}
    </p>
  );
}

function ErroSecao({ mensagem, onRetry }: { mensagem: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-danger-line bg-danger-soft px-3 py-3 text-caption text-danger">
      <p>{mensagem}</p>
      <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>
        <RefreshCw className="mr-1 h-3.5 w-3.5" />
        Tentar novamente
      </Button>
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function ConteudoOs({
  ordens,
  erro,
  carregando,
  onRetry,
  onAbrirOs,
  abertas = false,
}: {
  ordens: OsSistema[] | undefined;
  erro: boolean;
  carregando: boolean;
  onRetry: () => void;
  onAbrirOs: (id: string) => void;
  abertas?: boolean;
}) {
  if (carregando) return <Skeleton className="h-16 w-full" />;
  if (erro) return <ErroSecao mensagem="Não foi possível carregar as OS." onRetry={onRetry} />;
  const lista = ordens
    ? abertas
      ? separarOsSistema(ordens).abertas
      : separarOsSistema(ordens).historico
    : [];
  if (lista.length === 0)
    return (
      <Vazio
        texto={abertas ? "Nenhuma OS aberta para este Sistema." : "Sem manutenções registradas."}
      />
    );
  return (
    <ul className="divide-y divide-line-soft rounded-lg border border-line">
      {lista.map((os) => (
        <LinhaOs key={os.id} os={os} onAbrirOs={onAbrirOs} />
      ))}
    </ul>
  );
}

function LinhaOs({ os, onAbrirOs }: { os: OsSistema; onAbrirOs: (id: string) => void }) {
  const linkAuvo = linkAuvoDaOs(os);
  return (
    <li className="px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onAbrirOs(os.id)}
          className="min-w-0 text-left hover:underline"
        >
          <span className="block text-caption font-semibold text-ink">
            {os.numero} · {os.titulo}
          </span>
          <span className="block text-micro text-ink-3">
            {os.status} · {os.tecnicoNome ?? "Técnico não informado"} · {dataBr(os.dataAgendada)}
          </span>
        </button>
        {linkAuvo && (
          <a
            href={linkAuvo}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ver ${os.numero} no Auvo`}
            className="shrink-0 text-orange hover:text-orange-deep"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      <p className="mt-1 text-micro text-ink-3">
        Origem:{" "}
        {os.origens
          .map((origem) => (origem.tipo === "sistema" ? "Sistema" : origem.nome))
          .join(" + ")}
        {os.prioridade ? ` · Prioridade ${os.prioridade}` : ""}
      </p>
    </li>
  );
}

function ListaPreventivas({
  preventivas,
  onAbrirOs,
}: { preventivas: PreventivaSistema[]; onAbrirOs: (id: string) => void }) {
  if (preventivas.length === 0)
    return <Vazio texto="Nenhuma preventiva vinculada ao Sistema ou aos componentes atuais." />;
  return (
    <div className="flex flex-col gap-2">
      {preventivas.map((preventiva) => (
        <article key={preventiva.id} className="rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-caption font-semibold text-ink">{preventiva.plano}</p>
              <p className="text-micro text-ink-3">
                Alvo: {preventiva.alvo} · A cada {preventiva.periodicidade}
              </p>
            </div>
            <span className="text-micro text-ink-3">
              {preventiva.planoPausado
                ? "Plano pausado"
                : `Próximo vencimento: ${dataBr(preventiva.proximoVencimento)}`}
            </span>
          </div>
          {preventiva.ocorrencias.length === 0 ? (
            <p className="mt-2 text-micro text-ink-3">Sem execuções registradas.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line-soft">
              {preventiva.ocorrencias.map((ocorrencia) => {
                const linkAuvo = auvoTaskDeepLink(ocorrencia.auvoTaskId);
                return (
                  <li
                    key={ocorrencia.id}
                    className="flex items-center justify-between gap-2 py-1.5 text-micro"
                  >
                    <span>
                      {dataBr(ocorrencia.visitaEm ?? ocorrencia.vencimento)} ·{" "}
                      {ocorrencia.tecnicoNome ?? "Técnico não informado"} ·{" "}
                      {resultadoPreventiva(ocorrencia.resultado)} · {ocorrencia.estado}
                    </span>
                    <span className="flex gap-2">
                      {ocorrencia.osId && (
                        <button
                          type="button"
                          onClick={() => onAbrirOs(ocorrencia.osId as string)}
                          className="font-semibold text-orange hover:underline"
                        >
                          {ocorrencia.osNumero ?? ocorrencia.osId ?? "Abrir OS"}
                        </button>
                      )}
                      {linkAuvo && (
                        <a
                          href={linkAuvo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-orange hover:underline"
                        >
                          Ver OS no Auvo
                        </a>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}
