import { Button, ConfirmDialog, Skeleton } from "@sinergica/ui";
import { Boxes, Pencil, Plus, Search, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useAreasDoCliente,
  useComponentesDoCliente,
  useCriarComponente,
  useDesativarComponente,
  useEditarComponente,
  useLocaisDoCliente,
  useMembrosSistemasDoCliente,
  useSistemasDoCliente,
} from "../application/ativos-cliente-queries";
import {
  FILTROS_COMPONENTES_360_VAZIO,
  SEM_SISTEMA,
  filtrarComponentes360,
} from "../domain/cliente-360-filtros";
import type { EquipamentoFormData, EquipamentoItem } from "../domain/equipamentos";
import { montarArvore } from "../domain/hierarquia";
import { supabaseEquipamentosAdapter } from "../infrastructure/supabase-equipamentos-adapter";
import { supabaseHierarquiaAdapter } from "../infrastructure/supabase-hierarquia-adapter";
import { supabaseIdentificadorAtivoAdapter } from "../infrastructure/supabase-identificador-ativo-adapter";
import { supabaseSistemasAdapter } from "../infrastructure/supabase-sistemas-adapter";
import { EquipamentoModal } from "./EquipamentoModal";

type Modal = { modo: "novo" } | { modo: "editar"; item: EquipamentoItem } | null;

export function PainelItensDoCliente({
  clienteId,
  temEscrita,
  userId,
}: {
  clienteId: string;
  temEscrita: boolean;
  userId: string;
}) {
  const [filtros, setFiltros] = useState(FILTROS_COMPONENTES_360_VAZIO);
  const clienteAnterior = useRef(clienteId);
  const [modal, setModal] = useState<Modal>(null);
  const [paraDesativar, setParaDesativar] = useState<{
    item: EquipamentoItem;
    possuiOs: boolean;
  } | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const componentes = useComponentesDoCliente(supabaseEquipamentosAdapter, clienteId);
  const areas = useAreasDoCliente(supabaseHierarquiaAdapter, clienteId);
  const locais = useLocaisDoCliente(supabaseHierarquiaAdapter, clienteId);
  const sistemas = useSistemasDoCliente(supabaseSistemasAdapter, clienteId);
  const membros = useMembrosSistemasDoCliente(supabaseSistemasAdapter, clienteId);
  const criar = useCriarComponente(supabaseEquipamentosAdapter, supabaseIdentificadorAtivoAdapter);
  const editar = useEditarComponente(
    supabaseEquipamentosAdapter,
    supabaseIdentificadorAtivoAdapter,
  );
  const desativar = useDesativarComponente(supabaseEquipamentosAdapter, clienteId);

  const carregando =
    componentes.isLoading ||
    areas.isLoading ||
    locais.isLoading ||
    sistemas.isLoading ||
    membros.isLoading;
  const erro = componentes.error ?? areas.error ?? locais.error ?? sistemas.error ?? membros.error;
  const locaisPorId = caminhosLocais(locais.data ?? []);
  const areaPorId = new Map((areas.data ?? []).map((area) => [area.id, area.nome]));
  const sistemaPorItem = new Map(
    (membros.data ?? []).map((membro) => [
      membro.itemId,
      (sistemas.data ?? []).find((sistema) => sistema.id === membro.sistemaId)?.nome ?? "—",
    ]),
  );
  const sistemaIdPorItem = Object.fromEntries(
    (membros.data ?? []).map((membro) => [membro.itemId, membro.sistemaId]),
  );
  const itens = filtrarComponentes360(componentes.data ?? [], sistemaIdPorItem, filtros);

  useEffect(() => {
    if (clienteAnterior.current !== clienteId) {
      clienteAnterior.current = clienteId;
      setFiltros(FILTROS_COMPONENTES_360_VAZIO);
    }
  }, [clienteId]);

  async function salvar(dados: EquipamentoFormData) {
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editar.mutateAsync({ ...dados, id: modal.item.id, userId });
    } else {
      await criar.mutateAsync({ ...dados, userId });
    }
    setModal(null);
  }

  async function abrirDesativacao(item: EquipamentoItem) {
    try {
      setErroAcao(null);
      const possuiOs = await supabaseEquipamentosAdapter.possuiOsAberta(item.id);
      setParaDesativar({ item, possuiOs });
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível consultar as OS.");
    }
  }

  if (carregando) return <Skeleton className="h-32 w-full" />;
  if (erro) {
    return (
      <div className="rounded-lg border border-danger-line bg-danger-soft px-5 py-6 text-body text-danger">
        {erro instanceof Error ? erro.message : "Não foi possível carregar Componentes."}
        <Button
          variant="secondary"
          size="sm"
          className="ml-3"
          onClick={() =>
            void Promise.all([
              componentes.refetch(),
              areas.refetch(),
              locais.refetch(),
              sistemas.refetch(),
              membros.refetch(),
            ])
          }
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-card">
      <div className="flex flex-col gap-3 border-b border-line-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-body font-semibold text-ink">Componentes</h3>
          <p className="mt-0.5 text-caption text-ink-3">
            Cadastro e posição dos componentes deste cliente
          </p>
        </div>
        {temEscrita && (
          <Button variant="accent" size="sm" onClick={() => setModal({ modo: "novo" })}>
            <Plus className="h-4 w-4" /> Novo componente
          </Button>
        )}
      </div>
      <div className="grid gap-2 border-b border-line-soft px-4 py-3 lg:grid-cols-8">
        <label className="relative block lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            value={filtros.busca}
            onChange={(event) => setFiltros((atual) => ({ ...atual, busca: event.target.value }))}
            className="input w-full pl-9"
            placeholder="Buscar por nome ou identificador"
          />
        </label>
        <FiltroSelect
          label="Categoria"
          value={filtros.categoriaIds[0] ?? ""}
          onChange={(categoriaId) =>
            setFiltros((atual) => ({
              ...atual,
              categoriaIds: categoriaId ? [categoriaId] : [],
            }))
          }
          opcoes={(componentes.data ?? []).flatMap((item) =>
            item.categoriaId && item.categoria
              ? [{ id: item.categoriaId, nome: item.categoria }]
              : [],
          )}
        />
        <FiltroSelect
          label="Área"
          value={filtros.areaIds[0] ?? ""}
          onChange={(areaId) =>
            setFiltros((atual) => ({ ...atual, areaIds: areaId ? [areaId] : [] }))
          }
          opcoes={(areas.data ?? []).map((area) => ({ id: area.id, nome: area.nome }))}
        />
        <FiltroSelect
          label="Local"
          value={filtros.localIds[0] ?? ""}
          onChange={(localId) =>
            setFiltros((atual) => ({ ...atual, localIds: localId ? [localId] : [] }))
          }
          opcoes={(locais.data ?? []).map((local) => ({ id: local.id, nome: local.nome }))}
        />
        <FiltroSelect
          label="Sistema"
          value={filtros.sistemaIds[0] ?? ""}
          onChange={(sistemaId) =>
            setFiltros((atual) => ({ ...atual, sistemaIds: sistemaId ? [sistemaId] : [] }))
          }
          opcoes={[
            { id: SEM_SISTEMA, nome: "Sem sistema" },
            ...(sistemas.data ?? []).map((sistema) => ({ id: sistema.id, nome: sistema.nome })),
          ]}
        />
        <FiltroSelect
          label="Sincronização"
          value={filtros.syncStatuses[0] ?? ""}
          onChange={(syncStatus) =>
            setFiltros((atual) => ({
              ...atual,
              syncStatuses: syncStatus ? [syncStatus] : [],
            }))
          }
          opcoes={[
            { id: "synced", nome: "Sincronizado" },
            { id: "pending", nome: "Pendente" },
            { id: "error", nome: "Com erro" },
          ]}
        />
        <div className="flex items-center gap-2">
          <FiltroSelect
            label="Situação"
            value={filtros.situacao}
            onChange={(situacao) =>
              setFiltros((atual) => ({
                ...atual,
                situacao: (situacao || "todos") as typeof atual.situacao,
              }))
            }
            opcoes={[
              { id: "todos", nome: "Todas situações" },
              { id: "ativos", nome: "Ativos" },
              { id: "inativos", nome: "Inativos" },
            ]}
            semOpcaoTodos
          />
          <button
            type="button"
            onClick={() => setFiltros(FILTROS_COMPONENTES_360_VAZIO)}
            className="shrink-0 text-caption font-semibold text-orange hover:text-orange-deep"
          >
            Limpar
          </button>
        </div>
        <p className="lg:col-span-8 text-caption text-ink-3">
          {itens.length} visíveis de {(componentes.data ?? []).length}
        </p>
      </div>
      {(componentes.data ?? []).length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Wrench className="mx-auto h-8 w-8 text-ink-3" />
          <p className="mt-2 text-body text-ink-3">
            Nenhum componente cadastrado para este cliente.
          </p>
        </div>
      ) : itens.length === 0 ? (
        <div className="px-5 py-10 text-center text-body text-ink-3">
          Nenhum componente para estes filtros.
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {itens.map((item) => {
            const local = item.localId ? locaisPorId.get(item.localId) : null;
            const posicao =
              local?.caminho ?? (item.areaId ? (areaPorId.get(item.areaId) ?? "—") : "—");
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
              >
                <Boxes className="h-4 w-4 shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-ink">{item.nome}</p>
                  <p className="truncate text-caption text-ink-3">
                    {item.identificador ?? "—"} · {item.categoria ?? "—"} · {posicao} ·{" "}
                    {sistemaPorItem.get(item.id) ?? "—"}
                  </p>
                </div>
                {temEscrita && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModal({ modo: "editar", item })}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => void abrirDesativacao(item)}>
                      Desativar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {erroAcao && <p className="px-4 py-3 text-caption text-danger">{erroAcao}</p>}
      {modal && (
        <EquipamentoModal
          equipamento={modal.modo === "editar" ? modal.item : undefined}
          clientes={[]}
          clienteFixoId={clienteId}
          userId={userId}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
      <ConfirmDialog
        open={paraDesativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setParaDesativar(null);
        }}
        titulo={`Desativar "${paraDesativar?.item.nome}"`}
        descricao={
          paraDesativar?.possuiOs
            ? "Há vínculo com OS; o histórico será preservado."
            : "Esta ação não pode ser desfeita."
        }
        rotuloConfirmar="Desativar"
        onConfirmar={async () => {
          if (!paraDesativar) return;
          await desativar.mutateAsync({ id: paraDesativar.item.id, userId });
        }}
      />
    </section>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  opcoes,
  semOpcaoTodos = false,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
  opcoes: Array<{ id: string; nome: string }>;
  semOpcaoTodos?: boolean;
}) {
  const unicas = [...new Map(opcoes.map((opcao) => [opcao.id, opcao])).values()];
  return (
    <select
      aria-label={`Filtrar componentes por ${label}`}
      className="input min-w-0"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {!semOpcaoTodos && <option value="">Todas as opções</option>}
      {unicas.map((opcao) => (
        <option key={opcao.id} value={opcao.id}>
          {opcao.nome}
        </option>
      ))}
    </select>
  );
}

function caminhosLocais(locais: Parameters<typeof montarArvore>[0]) {
  const porId = new Map<string, { caminho: string }>();
  const visitar = (nodes: ReturnType<typeof montarArvore>, anterior: string[]) => {
    for (const node of nodes) {
      const nomes = [...anterior, node.nome];
      porId.set(node.id, { caminho: nomes.join(" > ") });
      visitar(node.filhos, nomes);
    }
  };
  visitar(montarArvore(locais), []);
  return porId;
}
