// EstruturaClientePage.tsx — E01-S76 (AC-1, AC-2, AC-3): CRUD de Área > Local (árvore) de um
// cliente. Mora como aba dentro de VisaoClientePage (design.md — "aba em VisaoClientePage.tsx").
import { Button, ConfirmDialog, Modal, useToast } from "@sinergica/ui";
import { ChevronDown, ChevronRight, FolderTree, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  criarArea,
  criarLocal,
  criarTipoDeLocal,
  desativarArea,
  desativarLocal,
  desativarTipoDeLocal,
  editarArea,
  editarLocal,
} from "../application/hierarquia";
import type {
  Area,
  AreaFormData,
  LocalArvoreNode,
  LocalFormData,
  LocalTipo,
} from "../domain/hierarquia";
import { montarArvore } from "../domain/hierarquia";
import { supabaseHierarquiaAdapter } from "../infrastructure/supabase-hierarquia-adapter";

type ModalArea = { modo: "novo" } | { modo: "editar"; area: Area } | null;
type ModalLocal =
  | { modo: "novo"; areaId: string; parentId: string | null }
  | { modo: "editar"; areaId: string; local: LocalArvoreNode }
  | null;

export function EstruturaClientePage({
  clienteId,
  temEscrita,
  userId,
}: {
  clienteId: string;
  temEscrita: boolean;
  userId: string;
}) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [arvores, setArvores] = useState<Record<string, LocalArvoreNode[]>>({});
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [modalArea, setModalArea] = useState<ModalArea>(null);
  const [modalLocal, setModalLocal] = useState<ModalLocal>(null);
  const [tiposDeLocal, setTiposDeLocal] = useState<LocalTipo[]>([]);
  const [tipoParaRemover, setTipoParaRemover] = useState<LocalTipo | null>(null);
  const [areaParaExcluir, setAreaParaExcluir] = useState<Area | null>(null);
  const [localParaExcluir, setLocalParaExcluir] = useState<LocalArvoreNode | null>(null);
  const toast = useToast();

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaAreas, locais, tipos] = await Promise.all([
        supabaseHierarquiaAdapter.listarAreas(clienteId),
        supabaseHierarquiaAdapter.listarLocaisDoCliente(clienteId),
        supabaseHierarquiaAdapter.listarTiposDeLocal(clienteId),
      ]);
      const porArea: Record<string, LocalArvoreNode[]> = {};
      for (const area of listaAreas) {
        porArea[area.id] = montarArvore(locais.filter((l) => l.areaId === area.id));
      }
      setAreas(listaAreas);
      setArvores(porArea);
      setTiposDeLocal(tipos);
      setExpandidas(new Set(listaAreas.map((a) => a.id)));
    } catch {
      setErro("Não foi possível carregar a estrutura do cliente.");
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function alternarExpandida(areaId: string) {
    setExpandidas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(areaId)) proxima.delete(areaId);
      else proxima.add(areaId);
      return proxima;
    });
  }

  async function salvarArea(dados: AreaFormData) {
    if (modalArea?.modo === "editar") {
      await editarArea(supabaseHierarquiaAdapter, {
        ...dados,
        id: modalArea.area.id,
        userId,
      });
    } else {
      await criarArea(supabaseHierarquiaAdapter, { ...dados, userId });
    }
    setModalArea(null);
    await carregar();
  }

  async function salvarLocal(dados: LocalFormData) {
    if (modalLocal?.modo === "editar") {
      await editarLocal(supabaseHierarquiaAdapter, {
        ...dados,
        id: modalLocal.local.id,
        userId,
      });
    } else {
      await criarLocal(supabaseHierarquiaAdapter, { ...dados, userId });
    }
    setModalLocal(null);
    await carregar();
  }

  async function adicionarTipoDeLocal(nome: string) {
    await criarTipoDeLocal(supabaseHierarquiaAdapter, { clienteId, nome, userId });
    await carregar();
  }

  async function removerTipoDeLocal() {
    if (!tipoParaRemover) return;
    await desativarTipoDeLocal(supabaseHierarquiaAdapter, tipoParaRemover.id, userId);
    await carregar();
  }

  async function excluirArea() {
    if (!areaParaExcluir) return;
    await desativarArea(supabaseHierarquiaAdapter, areaParaExcluir.id, userId);
    await carregar();
  }

  function pedirExclusaoLocal(local: LocalArvoreNode) {
    if (local.filhos.length > 0) {
      toast.aviso("Este Local tem sub-locais. Remova-os primeiro.");
      return;
    }
    setLocalParaExcluir(local);
  }

  async function excluirLocal() {
    if (!localParaExcluir) return;
    await desativarLocal(supabaseHierarquiaAdapter, localParaExcluir.id, userId);
    await carregar();
  }

  if (carregando) return <div className="p-8 text-center text-body text-ink-3">Carregando…</div>;
  if (erro) {
    return (
      <div className="p-8 text-center text-body text-ink-3">
        {erro}
        <Button variant="ghost" size="sm" onClick={carregar} className="ml-2">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-body font-semibold text-ink">Estrutura do cliente</h3>
          <p className="mt-0.5 text-caption text-ink-3">
            Áreas e Locais (árvore) — onde os Itens estão instalados
          </p>
        </div>
        {temEscrita && (
          <Button
            variant="secondary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setModalArea({ modo: "novo" })}
          >
            Nova Área
          </Button>
        )}
      </div>

      <TiposDeLocalPainel
        tipos={tiposDeLocal}
        temEscrita={temEscrita}
        onAdicionar={adicionarTipoDeLocal}
        onRemover={setTipoParaRemover}
      />

      {areas.length === 0 ? (
        <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
          <FolderTree className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-body text-ink-3">Nenhuma Área cadastrada.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {areas.map((area) => (
            <section key={area.id} className="rounded-lg border border-line bg-card">
              <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
                <button
                  type="button"
                  onClick={() => alternarExpandida(area.id)}
                  className="text-ink-3 hover:text-ink"
                  aria-label={expandidas.has(area.id) ? "Recolher" : "Expandir"}
                >
                  {expandidas.has(area.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <span className="flex-1 text-body font-semibold text-ink">{area.nome}</span>
                {temEscrita && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setModalLocal({ modo: "novo", areaId: area.id, parentId: null })
                      }
                    >
                      Local
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModalArea({ modo: "editar", area })}
                      aria-label="Editar Área"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAreaParaExcluir(area)}
                      aria-label="Desativar Área"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  </div>
                )}
              </div>
              {expandidas.has(area.id) && (
                <div className="px-4 py-2">
                  {(arvores[area.id]?.length ?? 0) === 0 ? (
                    <p className="py-3 text-caption text-ink-3">
                      Nenhum Local cadastrado nesta Área.
                    </p>
                  ) : (
                    <LocalTree
                      nodes={arvores[area.id] ?? []}
                      areaId={area.id}
                      nivel={0}
                      temEscrita={temEscrita}
                      onNovoFilho={(parentId) =>
                        setModalLocal({ modo: "novo", areaId: area.id, parentId })
                      }
                      onEditar={(local) =>
                        setModalLocal({ modo: "editar", areaId: area.id, local })
                      }
                      onExcluir={pedirExclusaoLocal}
                    />
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {modalArea && (
        <AreaModal
          clienteId={clienteId}
          area={modalArea.modo === "editar" ? modalArea.area : undefined}
          onCancel={() => setModalArea(null)}
          onSalvar={salvarArea}
        />
      )}

      {modalLocal && (
        <LocalModal
          areaId={modalLocal.areaId}
          parentId={
            modalLocal.modo === "novo" ? modalLocal.parentId : (modalLocal.local.parentId ?? null)
          }
          local={modalLocal.modo === "editar" ? modalLocal.local : undefined}
          tiposDeLocal={tiposDeLocal}
          onCancel={() => setModalLocal(null)}
          onSalvar={salvarLocal}
        />
      )}

      <ConfirmDialog
        open={tipoParaRemover !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setTipoParaRemover(null);
        }}
        titulo={`Remover o tipo "${tipoParaRemover?.nome}"`}
        descricao="Locais que já usam esse tipo mantêm a atribuição atual."
        rotuloConfirmar="Remover"
        onConfirmar={removerTipoDeLocal}
      />

      <ConfirmDialog
        open={areaParaExcluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setAreaParaExcluir(null);
        }}
        titulo={`Desativar a Área "${areaParaExcluir?.nome}"`}
        descricao="Os Locais dentro dela deixam de aparecer na estrutura ativa."
        rotuloConfirmar="Desativar"
        onConfirmar={excluirArea}
      />

      <ConfirmDialog
        open={localParaExcluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setLocalParaExcluir(null);
        }}
        titulo={`Desativar o Local "${localParaExcluir?.nome}"`}
        descricao="Itens instalados neste Local precisam ser realocados separadamente."
        rotuloConfirmar="Desativar"
        onConfirmar={excluirLocal}
      />
    </div>
  );
}

/** Catálogo de Tipos de Local do cliente (ex.: "Andar", "Sala") — cadastrado uma vez aqui,
 * selecionado (nunca digitado de novo) ao criar/editar um Local. Evita divergência de escrita. */
function TiposDeLocalPainel({
  tipos,
  temEscrita,
  onAdicionar,
  onRemover,
}: {
  tipos: LocalTipo[];
  temEscrita: boolean;
  onAdicionar: (nome: string) => Promise<void>;
  onRemover: (tipo: LocalTipo) => void;
}) {
  const [novoNome, setNovoNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!novoNome.trim()) return;
    try {
      setSalvando(true);
      await onAdicionar(novoNome.trim());
      setNovoNome("");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-lg border border-line bg-card p-3">
      <div className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-ink-3">
        <Tag className="h-3.5 w-3.5" />
        Tipos de Local
      </div>
      <p className="mt-0.5 text-caption text-ink-3">
        Cadastre aqui (ex.: "Andar", "Sala") — a atribuição no Local sempre seleciona, nunca digita.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tipos.length === 0 && (
          <span className="text-caption text-ink-3">Nenhum tipo cadastrado.</span>
        )}
        {tipos.map((tipo) => (
          <span
            key={tipo.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-line-soft px-2.5 py-1 text-caption font-semibold text-ink-2"
          >
            {tipo.nome}
            {temEscrita && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemover(tipo)}
                aria-label={`Remover ${tipo.nome}`}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </span>
        ))}
        {temEscrita && (
          <div className="flex items-center gap-1">
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") adicionar();
              }}
              placeholder="Novo tipo…"
              className="input h-7 w-32 text-caption"
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={adicionar}
              disabled={salvando || !novoNome.trim()}
              loading={salvando}
            >
              Adicionar
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function LocalTree({
  nodes,
  areaId,
  nivel,
  temEscrita,
  onNovoFilho,
  onEditar,
  onExcluir,
}: {
  nodes: LocalArvoreNode[];
  areaId: string;
  nivel: number;
  temEscrita: boolean;
  onNovoFilho: (parentId: string) => void;
  onEditar: (local: LocalArvoreNode) => void;
  onExcluir: (local: LocalArvoreNode) => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((node) => (
        <li key={node.id}>
          <div
            className="flex items-center gap-2 rounded-md py-1.5 hover:bg-line-soft"
            style={{ paddingLeft: `${nivel * 20}px` }}
          >
            <span className="flex-1 text-body text-ink-2">
              {node.nome}
              {node.tipoNome && (
                <span className="ml-1.5 text-caption text-ink-3">({node.tipoNome})</span>
              )}
            </span>
            {temEscrita && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNovoFilho(node.id)}
                  aria-label="Novo sub-local"
                  title="Novo sub-local"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditar(node)}
                  aria-label="Editar Local"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onExcluir(node)}
                  aria-label="Desativar Local"
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              </div>
            )}
          </div>
          {node.filhos.length > 0 && (
            <LocalTree
              nodes={node.filhos}
              areaId={areaId}
              nivel={nivel + 1}
              temEscrita={temEscrita}
              onNovoFilho={onNovoFilho}
              onEditar={onEditar}
              onExcluir={onExcluir}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function AreaModal({
  clienteId,
  area,
  onCancel,
  onSalvar,
}: {
  clienteId: string;
  area?: Area;
  onCancel: () => void;
  onSalvar: (dados: AreaFormData) => Promise<void>;
}) {
  const [nome, setNome] = useState(area?.nome ?? "");
  const [descricao, setDescricao] = useState(area?.descricao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({ clienteId, nome, descricao });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a Área.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={area ? "Editar Área" : "Nova Área"}
      tamanho="sm"
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Nome *</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Descrição</span>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="input w-full"
          />
        </label>
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={salvar} disabled={salvando} loading={salvando}>
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LocalModal({
  areaId,
  parentId,
  local,
  tiposDeLocal,
  onCancel,
  onSalvar,
}: {
  areaId: string;
  parentId: string | null;
  local?: LocalArvoreNode;
  tiposDeLocal: LocalTipo[];
  onCancel: () => void;
  onSalvar: (dados: LocalFormData) => Promise<void>;
}) {
  const [nome, setNome] = useState(local?.nome ?? "");
  const [tipoId, setTipoId] = useState(local?.tipoId ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({ areaId, parentId, nome, tipoId });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o Local.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={local ? "Editar Local" : parentId ? "Novo sub-local" : "Novo Local"}
      tamanho="sm"
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Nome *</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="input w-full"
            placeholder='ex.: "3º andar", "Sala 302"'
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Tipo</span>
          <select
            value={tipoId ?? ""}
            onChange={(e) => setTipoId(e.target.value)}
            className="input w-full"
          >
            <option value="">Sem tipo</option>
            {tiposDeLocal.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          {tiposDeLocal.length === 0 && (
            <span className="mt-1 block text-caption text-ink-3">
              Nenhum tipo cadastrado — crie um em "Tipos de Local" acima.
            </span>
          )}
        </label>
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={salvar} disabled={salvando} loading={salvando}>
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
