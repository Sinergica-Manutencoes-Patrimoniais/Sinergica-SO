import { Button, Skeleton } from "@sinergica/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { carregarDadosAberturaOs } from "../application/abrir-ordem-servico";
import type { OrdemServicoResumo } from "../application/cliente-360-gateway";
import { cliente360QueryKeys } from "../application/cliente-360-query-keys";
import { registrarEventoCliente360 } from "../application/cliente-360-telemetria";
import { operacaoQueryKeys, useAlterarStatusOperacao } from "../application/operacao-queries";
import type { StatusOrdemServico } from "../domain/ordens-servico";
import { rotuloStatusOs } from "../domain/ordens-servico";
import { supabaseOperacaoAdapter } from "../infrastructure/supabase-operacao-adapter";
import { supabaseOrdemServicoAdapter } from "../infrastructure/supabase-ordem-servico-adapter";
import { ChamadoPainel } from "./ChamadoPainel";
import { Cliente360Drawer } from "./Cliente360Drawer";

const STATUS: StatusOrdemServico[] = [
  "solicitacao",
  "corretiva",
  "backlog",
  "planejamento",
  "em_execucao",
  "finalizado",
  "cancelado",
];

/** Detalhe contextual de OS no Cliente 360; usa as mesmas mutações da Operação global. */
export function OrdemServicoDetalheDrawer({
  ordem,
  clienteId,
  temEscrita,
  aberto,
  originElementId,
  onFechar,
  onMutada,
}: {
  ordem: OrdemServicoResumo;
  clienteId: string;
  temEscrita: boolean;
  aberto: boolean;
  originElementId?: string;
  onFechar: () => void;
  onMutada: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [statusAtual, setStatusAtual] = useState(ordem.status);
  const detalhe = useQuery({
    queryKey: cliente360QueryKeys.detalheOs(clienteId, ordem.id),
    queryFn: ({ signal }) => supabaseOperacaoAdapter.obterDetalhe(ordem.id, signal),
    enabled: aberto,
  });
  const dadosAbertura = useQuery({
    queryKey: cliente360QueryKeys.dadosAberturaOs(clienteId),
    queryFn: () => carregarDadosAberturaOs(supabaseOrdemServicoAdapter),
    enabled: aberto && Boolean(ordem.chamadoId),
    staleTime: 5 * 60 * 1000,
  });
  const alterarStatus = useAlterarStatusOperacao(supabaseOperacaoAdapter);

  useEffect(() => {
    if (aberto) {
      registrarEventoCliente360({ nome: "cliente360_drawer_opened", clienteId, tipo: "os" });
    }
  }, [aberto, clienteId]);

  useEffect(() => {
    setStatusAtual(ordem.status);
  }, [ordem.status]);

  async function mudarStatus(status: StatusOrdemServico) {
    try {
      await alterarStatus.mutateAsync({ ids: [ordem.id], status });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cliente360QueryKeys.raiz(clienteId) }),
        queryClient.invalidateQueries({ queryKey: operacaoQueryKeys.detalhe(ordem.id) }),
        onMutada(),
      ]);
      setStatusAtual(status);
      registrarEventoCliente360({
        nome: "cliente360_mutation_finished",
        clienteId,
        recurso: "os",
        resultado: "sucesso",
      });
    } catch (error) {
      registrarEventoCliente360({
        nome: "cliente360_mutation_finished",
        clienteId,
        recurso: "os",
        resultado: "falha",
      });
      throw error;
    }
  }

  return (
    <Cliente360Drawer
      aberto={aberto}
      titulo={`OS ${ordem.numero}`}
      descricao={`${ordem.titulo} · ${ordem.status}`}
      originElementId={originElementId}
      onFechar={onFechar}
    >
      {detalhe.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : detalhe.isError ? (
        <div className="rounded-lg border border-danger-line bg-danger-soft p-4 text-body text-danger">
          Não foi possível carregar o detalhe desta OS.
          <Button
            className="ml-3"
            size="sm"
            variant="secondary"
            onClick={() => void detalhe.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <section>
            <h3 className="text-body font-semibold text-ink">{ordem.titulo}</h3>
            <p className="mt-1 whitespace-pre-wrap text-body text-ink-2">
              {detalhe.data?.descricao ??
                ordem.descricao ??
                "Sem descrição informada para esta OS."}
            </p>
          </section>
          <dl className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface p-4 text-caption sm:grid-cols-2">
            <Campo titulo="Status" valor={rotuloStatusOs(statusAtual)} />
            <Campo titulo="Categoria" valor={ordem.categoria} />
            <Campo titulo="Técnico" valor={ordem.tecnicoNome ?? "Não atribuído"} />
            <Campo
              titulo="Solicitante"
              valor={detalhe.data?.solicitante ?? ordem.solicitante ?? "—"}
            />
            <Campo
              titulo="Local"
              valor={detalhe.data?.localDescricao ?? ordem.localDescricao ?? "—"}
            />
            <Campo titulo="Origem" valor={detalhe.data?.origem ?? "—"} />
          </dl>
          {temEscrita && (
            <label className="text-caption font-semibold text-ink-2">
              Alterar status
              <select
                className="input mt-1 w-full"
                value={statusAtual}
                disabled={alterarStatus.isPending}
                onChange={(event) => void mudarStatus(event.target.value as StatusOrdemServico)}
              >
                {STATUS.map((status) => (
                  <option key={status} value={status}>
                    {rotuloStatusOs(status)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {ordem.chamadoId && (
            <section className="border-t border-line pt-5" aria-label="Chamado associado">
              <h3 className="text-body font-semibold text-ink">Chamado associado</h3>
              {dadosAbertura.isLoading ? (
                <Skeleton className="mt-3 h-24 w-full" />
              ) : (
                <>
                  {dadosAbertura.isError && (
                    <p className="mb-2 text-caption text-ink-2">
                      As ações que exigem dados de abertura estão indisponíveis no momento; o
                      histórico do chamado continua acessível.
                    </p>
                  )}
                  <ChamadoPainel
                    chamadoId={ordem.chamadoId}
                    dadosOs={dadosAbertura.data ?? null}
                    temEscrita={temEscrita}
                    auvoTaskId={ordem.auvoTaskId ?? null}
                    onMutou={() => void onMutada()}
                  />
                </>
              )}
            </section>
          )}
        </div>
      )}
    </Cliente360Drawer>
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
