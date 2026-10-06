import { Button, ConfirmDialog, Skeleton } from "@sinergica/ui";
import { Link2, Pencil, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useAreasDoCliente,
  useCriarSistema,
  useDesativarSistema,
  useEditarSistema,
  useLocaisDoCliente,
  useMembrosSistemasDoCliente,
  useSistemasDoCliente,
} from "../application/ativos-cliente-queries";
import { FILTROS_SISTEMAS_360_VAZIO, filtrarSistemas360 } from "../domain/cliente-360-filtros";
import { montarArvore } from "../domain/hierarquia";
import type { Sistema, SistemaFormData } from "../domain/sistemas";
import { supabaseHierarquiaAdapter } from "../infrastructure/supabase-hierarquia-adapter";
import { supabaseIdentificadorAtivoAdapter } from "../infrastructure/supabase-identificador-ativo-adapter";
import { supabaseSistemasAdapter } from "../infrastructure/supabase-sistemas-adapter";
import { ComposicaoSistema } from "./ComposicaoSistema";
import { DrawerDetalheSistema } from "./DrawerDetalheSistema";
import { SistemaModal } from "./SistemaModal";

type Modal = { modo: "novo" } | { modo: "editar"; sistema: Sistema } | null;

export function PainelSistemasCliente({
  clienteId,
  temEscrita,
  userId,
  onAbrirOs,
}: {
  clienteId: string;
  temEscrita: boolean;
  userId: string;
  onAbrirOs?: (osId: string) => void;
}) {
  const [filtros, setFiltros] = useState(FILTROS_SISTEMAS_360_VAZIO);
  const clienteAnterior = useRef(clienteId);
  const [modal, setModal] = useState<Modal>(null);
  const [sistemaAbertoId, setSistemaAbertoId] = useState<string | null>(null);
  const [paraDesativar, setParaDesativar] = useState<Sistema | null>(null);
  const [detalheAbertoId, setDetalheAbertoId] = useState<string | null>(null);
  const sistemas = useSistemasDoCliente(supabaseSistemasAdapter, clienteId);
  const membros = useMembrosSistemasDoCliente(supabaseSistemasAdapter, clienteId);
  const areas = useAreasDoCliente(supabaseHierarquiaAdapter, clienteId);
  const locais = useLocaisDoCliente(supabaseHierarquiaAdapter, clienteId);
  const criar = useCriarSistema(supabaseSistemasAdapter, supabaseIdentificadorAtivoAdapter);
  const editar = useEditarSistema(supabaseSistemasAdapter, supabaseIdentificadorAtivoAdapter);
  const desativar = useDesativarSistema(supabaseSistemasAdapter, clienteId);
  const carregando = sistemas.isLoading || membros.isLoading || areas.isLoading || locais.isLoading;
  const erro = sistemas.error ?? membros.error ?? areas.error ?? locais.error;
  const localPorId = caminhosLocais(locais.data ?? []);
  const areaPorId = new Map((areas.data ?? []).map((area) => [area.id, area.nome]));
  const quantidadePorSistema = new Map<string, number>();
  for (const membro of membros.data ?? []) {
    quantidadePorSistema.set(
      membro.sistemaId,
      (quantidadePorSistema.get(membro.sistemaId) ?? 0) + 1,
    );
  }
  const sistemasFiltrados = filtrarSistemas360(sistemas.data ?? [], quantidadePorSistema, filtros);

  useEffect(() => {
    if (clienteAnterior.current !== clienteId) {
      clienteAnterior.current = clienteId;
      setFiltros(FILTROS_SISTEMAS_360_VAZIO);
    }
  }, [clienteId]);

  async function salvar(dados: SistemaFormData) {
    if (modal?.modo === "editar") {
      await editar.mutateAsync({ ...dados, id: modal.sistema.id, userId });
    } else {
      await criar.mutateAsync({ ...dados, userId });
    }
    setModal(null);
  }

  if (carregando) return <Skeleton className="h-20 w-full" />;
  if (erro) {
    return (
      <div className="rounded-lg border border-danger-line bg-danger-soft px-5 py-6 text-body text-danger">
        {erro instanceof Error ? erro.message : "Não foi possível carregar Sistemas."}
        <Button
          variant="secondary"
          size="sm"
          className="ml-3"
          onClick={() =>
            void Promise.all([
              sistemas.refetch(),
              membros.refetch(),
              areas.refetch(),
              locais.refetch(),
            ])
          }
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-ink">Sistemas</h3>
          <p className="text-caption text-ink-3">Agrupe componentes por função</p>
        </div>
        {temEscrita && (
          <Button variant="accent" size="sm" onClick={() => setModal({ modo: "novo" })}>
            <Plus className="h-4 w-4" /> Novo sistema
          </Button>
        )}
      </div>
      {(sistemas.data ?? []).length > 0 && (
        <div className="grid gap-2 rounded-lg border border-line bg-card p-3 lg:grid-cols-8">
          <label className="relative block lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={filtros.busca}
              onChange={(event) => setFiltros((atual) => ({ ...atual, busca: event.target.value }))}
              className="input w-full pl-9"
              placeholder="Buscar por nome ou código"
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
            opcoes={(sistemas.data ?? []).flatMap((sistema) =>
              sistema.categoriaId && sistema.categoria
                ? [{ id: sistema.categoriaId, nome: sistema.categoria }]
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
            label="Composição"
            value={filtros.composicao}
            onChange={(composicao) =>
              setFiltros((atual) => ({
                ...atual,
                composicao: (composicao || "todos") as typeof atual.composicao,
              }))
            }
            opcoes={[
              { id: "todos", nome: "Toda composição" },
              { id: "com_itens", nome: "Com itens" },
              { id: "vazios", nome: "Sem itens" },
            ]}
            semOpcaoTodos
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
              onClick={() => setFiltros(FILTROS_SISTEMAS_360_VAZIO)}
              className="shrink-0 text-caption font-semibold text-orange hover:text-orange-deep"
            >
              Limpar
            </button>
          </div>
          <p className="lg:col-span-8 text-caption text-ink-3">
            {sistemasFiltrados.length} visíveis de {(sistemas.data ?? []).length}
          </p>
        </div>
      )}
      {(sistemas.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
          <Link2 className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-body text-ink-3">Nenhum Sistema cadastrado para este cliente.</p>
        </div>
      ) : sistemasFiltrados.length === 0 ? (
        <div className="rounded-lg border border-line bg-card px-5 py-10 text-center text-body text-ink-3">
          Nenhum sistema para estes filtros.
        </div>
      ) : (
        sistemasFiltrados.map((sistema) => {
          const local = sistema.localId ? localPorId.get(sistema.localId) : null;
          const posicao =
            local?.caminho ?? (sistema.areaId ? (areaPorId.get(sistema.areaId) ?? "—") : "—");
          return (
            <section key={sistema.id} className="rounded-lg border border-line bg-card">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setDetalheAbertoId(sistema.id)}
                    className="truncate text-left text-body font-semibold text-ink hover:underline"
                  >
                    {sistema.nome}
                  </button>
                  <p className="truncate text-caption text-ink-3">
                    {sistema.codigo ?? "—"} · {sistema.categoria ?? "—"} · {posicao} ·{" "}
                    {quantidadePorSistema.get(sistema.id) ?? 0} componentes
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setSistemaAbertoId(sistemaAbertoId === sistema.id ? null : sistema.id)
                  }
                >
                  {sistemaAbertoId === sistema.id ? "Fechar" : "Compor itens"}
                </Button>
                {temEscrita && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModal({ modo: "editar", sistema })}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setParaDesativar(sistema)}>
                      Desativar
                    </Button>
                  </>
                )}
              </div>
              {sistemaAbertoId === sistema.id && (
                <div className="border-t border-line-soft px-4 py-3">
                  <ComposicaoSistema
                    gateway={supabaseSistemasAdapter}
                    sistema={sistema}
                    temEscrita={temEscrita}
                    userId={userId}
                    onSalvo={() => void membros.refetch()}
                  />
                </div>
              )}
            </section>
          );
        })
      )}
      {modal && (
        <SistemaModal
          sistema={modal.modo === "editar" ? modal.sistema : undefined}
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
        titulo={`Desativar "${paraDesativar?.nome}"`}
        descricao={`Desativar o Sistema «${paraDesativar?.nome ?? ""}»? Os Componentes continuam cadastrados, só deixam de pertencer a ele.`}
        rotuloConfirmar="Desativar"
        onConfirmar={async () => {
          if (!paraDesativar) return;
          await desativar.mutateAsync({ id: paraDesativar.id, userId });
        }}
      />
      {detalheAbertoId && (
        <DrawerDetalheSistema
          sistemaId={detalheAbertoId}
          clienteEsperadoId={clienteId}
          onClose={() => setDetalheAbertoId(null)}
          onAbrirOs={onAbrirOs}
        />
      )}
    </div>
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
      aria-label={`Filtrar sistemas por ${label}`}
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
