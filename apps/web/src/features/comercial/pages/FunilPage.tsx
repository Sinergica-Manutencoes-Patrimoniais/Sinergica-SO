/** Board Kanban do funil comercial (E03-S02).
 *
 * Drag-and-drop HTML5 nativo, sem biblioteca — mesmo padrão do Kanban de OS (E01-S61/S84,
 * `OsKanbanView.tsx`): `draggable` + `dataTransfer` com MIME custom, coluna com `onDragOver`/
 * `onDrop`. Não reinventa a roda nem importa `dnd-kit`/`react-beautiful-dnd` para isto. */

import { Badge, Button, Card, EmptyState } from "@sinergica/ui";
import { RefreshCw } from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type { OportunidadeComConta } from "../application/comercial-gateway";
import {
  useEtapas,
  useMotivosPerda,
  useMoverOportunidade,
  useOportunidadesAbertas,
} from "../application/comercial-queries";
import { MotivoPerdaModal } from "../components/MotivoPerdaModal";
import {
  type Etapa,
  agruparOportunidadesPorEtapa,
  etapasVisiveis,
  resumirColuna,
  transicaoInvalida,
} from "../domain/funil";
import { supabaseComercialAdapter } from "../infrastructure/supabase-comercial-adapter";

const DRAG_MIME = "application/x-sinergica-oportunidade-id";

function formatarValor(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Pendência de soltar numa etapa `perdida`: guarda a origem para devolver o card se o usuário
 * cancelar o modal de motivo (AC-4 — nada é gravado no cancelamento). */
interface SolturaPendente {
  oportunidade: OportunidadeComConta;
  etapaDestino: Etapa;
}

export function FunilPage({
  onAbrirConta,
}: {
  onAbrirConta?: (clienteId: string) => void;
}) {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const temLeitura = podeAcessar("comercial", "leitura");
  const temEscrita = podeAcessar("comercial", "escrita");
  const habilitado = !permissoesCarregando && temLeitura;

  const etapasQuery = useEtapas(supabaseComercialAdapter, habilitado);
  const motivosQuery = useMotivosPerda(supabaseComercialAdapter, habilitado);
  const oportunidadesQuery = useOportunidadesAbertas(supabaseComercialAdapter, habilitado);
  const mover = useMoverOportunidade(supabaseComercialAdapter);

  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);
  const [pendente, setPendente] = useState<SolturaPendente | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const etapas = etapasQuery.data ?? [];
  const oportunidades = oportunidadesQuery.data ?? [];
  const visiveis = useMemo(() => etapasVisiveis(etapas), [etapas]);
  const porEtapa = useMemo(() => agruparOportunidadesPorEtapa(oportunidades), [oportunidades]);

  async function mover_(
    oportunidade: OportunidadeComConta,
    destino: Etapa,
    motivoPerdaId?: string,
  ) {
    setErro(null);
    // AC-5: card só sai visualmente da origem se a escrita der certo — `onSuccess`/`onError` do
    // TanStack cuidam disso: sem atualização otimista aqui, a lista só reflete o servidor.
    try {
      await mover.mutateAsync({
        oportunidadeId: oportunidade.id,
        etapaDestinoId: destino.id,
        motivoPerdaId: motivoPerdaId ?? null,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao mover a oportunidade.");
    }
  }

  function onDropNaColuna(destino: Etapa, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setColunaAlvo(null);
    const id = event.dataTransfer.getData(DRAG_MIME);
    const oportunidade = oportunidades.find((op) => op.id === id);
    if (!oportunidade || oportunidade.etapaId === destino.id) return;

    // Perda exige motivo ANTES de gravar (AC-4) — abre o modal em vez de escrever direto.
    if (destino.tipo === "perdida") {
      setPendente({ oportunidade, etapaDestino: destino });
      return;
    }

    const problema = transicaoInvalida({ destino });
    if (problema) {
      setErro(problema);
      return;
    }
    mover_(oportunidade, destino);
  }

  if (permissoesCarregando) return null;

  if (!temLeitura) {
    return (
      <EmptyState titulo="Sem acesso ao Comercial">
        Seu usuário não tem permissão no módulo Comercial.
      </EmptyState>
    );
  }

  const erroCarga = etapasQuery.error ?? oportunidadesQuery.error ?? motivosQuery.error;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-xl font-bold text-ink">Funil</h1>
          <p className="text-sm text-ink-2">
            Arraste o card para mudar a etapa. Etapas e motivos: Configuração do funil.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            etapasQuery.refetch();
            oportunidadesQuery.refetch();
          }}
        >
          <RefreshCw className="size-4" aria-hidden />
          Atualizar
        </Button>
      </header>

      {erro && (
        <Card>
          <p className="p-3 text-sm text-danger">{erro}</p>
        </Card>
      )}

      {erroCarga && (
        <Card>
          <p className="p-4 text-sm text-danger">
            {erroCarga instanceof Error ? erroCarga.message : "Falha ao carregar o funil."}
          </p>
        </Card>
      )}

      {!erroCarga && visiveis.length === 0 && (
        <EmptyState titulo="Nenhuma etapa ativa">
          Configure ao menos uma etapa aberta em "Configuração do funil".
        </EmptyState>
      )}

      {!erroCarga && visiveis.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {visiveis.map((etapa) => {
            const opsColuna = porEtapa.get(etapa.id) ?? [];
            const resumo = resumirColuna(etapa.id, opsColuna);
            return (
              <div
                key={etapa.id}
                onDragOver={(event) => {
                  if (!temEscrita) return;
                  event.preventDefault();
                  if (colunaAlvo !== etapa.id) setColunaAlvo(etapa.id);
                }}
                onDragLeave={() => setColunaAlvo((atual) => (atual === etapa.id ? null : atual))}
                onDrop={(event) => temEscrita && onDropNaColuna(etapa, event)}
                className={`flex w-72 shrink-0 flex-col rounded-lg border bg-paper transition-colors ${
                  colunaAlvo === etapa.id ? "border-orange bg-orange-soft/40" : "border-line"
                }`}
              >
                <div className="flex items-center gap-2 border-b border-line p-3">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: etapa.cor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{etapa.nome}</p>
                    <p className="text-xs text-ink-2">
                      {resumo.quantidade} · {formatarValor(resumo.somaValorCentavos)}
                    </p>
                  </div>
                </div>
                <div className="flex max-h-[600px] flex-col gap-2 overflow-y-auto p-2">
                  {opsColuna.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-ink-3">Vazio</p>
                  ) : (
                    opsColuna.map((op) => (
                      <div
                        key={op.id}
                        draggable={temEscrita && !mover.isPending}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(DRAG_MIME, op.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        className={`rounded-md border border-line bg-card p-3 hover:border-ink-3 ${
                          temEscrita && !mover.isPending ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onAbrirConta?.(op.clienteId)}
                          className="w-full text-left"
                        >
                          <p className="truncate text-xs font-semibold text-ink-2">
                            {op.clienteNome}
                          </p>
                          <p className="mt-0.5 text-sm font-semibold text-ink">{op.titulo}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {op.valorEstimadoCentavos !== null && (
                              <span className="text-xs tabular-nums text-ink-2">
                                {formatarValor(op.valorEstimadoCentavos)}
                              </span>
                            )}
                            {op.score !== null && (
                              <Badge tone={op.score >= 60 ? "success" : "neutral"}>
                                Score {op.score}
                                {op.leadTier && ` · ${op.leadTier}`}
                              </Badge>
                            )}
                          </div>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendente && (
        <MotivoPerdaModal
          motivos={motivosQuery.data ?? []}
          onCancelar={() => setPendente(null)}
          onConfirmar={(motivoPerdaId) => {
            mover_(pendente.oportunidade, pendente.etapaDestino, motivoPerdaId);
            setPendente(null);
          }}
        />
      )}
    </div>
  );
}
