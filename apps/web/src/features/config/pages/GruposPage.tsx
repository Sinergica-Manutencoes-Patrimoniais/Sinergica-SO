import { Button, Field, Modal, Textarea } from "@sinergica/ui";
import { UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { criarGrupo } from "../application/criar-grupo";
import { editarGrupo } from "../application/editar-grupo";
import { listarGrupos } from "../application/listar-grupos";
import { ModuloPermissaoGrid } from "../components/ModuloPermissaoGrid";
import type { Grupo, PermissaoModulo } from "../domain/grupo";
import type { ModuloId, NivelAcesso } from "../domain/modulo";
import { supabaseConfigAdapter } from "../infrastructure/supabase-config-adapter";

type PermissoesMap = Partial<Record<ModuloId, NivelAcesso>>;

function paraMapa(permissoes: PermissaoModulo[]): PermissoesMap {
  const mapa: PermissoesMap = {};
  for (const p of permissoes) mapa[p.modulo] = p.nivel;
  return mapa;
}

function paraLista(mapa: PermissoesMap): PermissaoModulo[] {
  return (Object.entries(mapa) as Array<[ModuloId, NivelAcesso | undefined]>)
    .filter((entry): entry is [ModuloId, NivelAcesso] => entry[1] !== undefined)
    .map(([modulo, nivel]) => ({ modulo, nivel }));
}

interface FormState {
  nome: string;
  descricao: string;
  ativo: boolean;
  permissoes: PermissoesMap;
}

const FORM_VAZIO: FormState = { nome: "", descricao: "", ativo: true, permissoes: {} };

export function GruposPage() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setGrupos(await listarGrupos(supabaseConfigAdapter));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os grupos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirCriacao() {
    setForm(FORM_VAZIO);
    setErroForm(null);
    setEditandoId(null);
    setCriando(true);
  }

  function abrirEdicao(grupo: Grupo) {
    setForm({
      nome: grupo.nome,
      descricao: grupo.descricao ?? "",
      ativo: grupo.ativo,
      permissoes: paraMapa(grupo.permissoes),
    });
    setErroForm(null);
    setCriando(false);
    setEditandoId(grupo.id);
  }

  function fechar() {
    setCriando(false);
    setEditandoId(null);
  }

  function alterarPermissao(modulo: ModuloId, nivel: NivelAcesso | null) {
    setForm((atual) => {
      const permissoes = { ...atual.permissoes };
      if (nivel === null) delete permissoes[modulo];
      else permissoes[modulo] = nivel;
      return { ...atual, permissoes };
    });
  }

  async function salvar() {
    setSalvando(true);
    setErroForm(null);
    try {
      const permissoes = paraLista(form.permissoes);
      if (editandoId) {
        await editarGrupo(supabaseConfigAdapter, editandoId, {
          nome: form.nome,
          descricao: form.descricao || null,
          ativo: form.ativo,
          permissoes,
        });
      } else {
        await criarGrupo(supabaseConfigAdapter, form.nome, form.descricao || null, permissoes);
      }
      fechar();
      await carregar();
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Não foi possível salvar o grupo.");
    } finally {
      setSalvando(false);
    }
  }

  const editandoGrupo = editandoId ? grupos.find((g) => g.id === editandoId) : null;
  const formAberto = criando || editandoId !== null;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2 className="page-title">Grupos</h2>
          <p className="page-subtitle">Conjuntos reutilizáveis de permissão por módulo.</p>
        </div>
        <Button variant="accent" onClick={abrirCriacao}>
          Novo grupo
        </Button>
      </div>

      {erro && <p className="status-error">{erro}</p>}

      {carregando ? (
        <div
          className="surface-card h-24 animate-pulse bg-line-soft"
          aria-label="Carregando grupos"
        />
      ) : grupos.length === 0 ? (
        <div className="empty-state">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-line-soft text-ink-3">
            <UsersRound className="h-5 w-5" />
          </span>
          <p className="font-semibold text-ink-2">Nenhum grupo criado</p>
          <p className="mt-1 max-w-sm">
            Crie um grupo para reutilizar o mesmo conjunto de permissões.
          </p>
        </div>
      ) : (
        <div className="surface-card divide-y divide-line-soft">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-body font-medium text-ink truncate">{grupo.nome}</p>
                  {!grupo.ativo && (
                    <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-line-soft text-ink-2">
                      Inativo
                    </span>
                  )}
                </div>
                {grupo.descricao && (
                  <p className="text-caption text-ink-3 truncate mt-0.5">{grupo.descricao}</p>
                )}
              </div>
              <span className="text-caption text-ink-3 shrink-0">
                {grupo.permissoes.length} módulo{grupo.permissoes.length === 1 ? "" : "s"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => abrirEdicao(grupo)}>
                Editar
              </Button>
            </div>
          ))}
        </div>
      )}

      {formAberto && (
        <Modal
          open
          onOpenChange={(aberto) => {
            if (!aberto) fechar();
          }}
          titulo={editandoId ? `Editar grupo — ${editandoGrupo?.nome ?? ""}` : "Novo grupo"}
          tamanho="md"
        >
          <div className="flex flex-col gap-4">
            <Field label="Nome">
              {(props) => (
                <input
                  {...props}
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className="input"
                />
              )}
            </Field>

            <Field label="Descrição">
              {(props) => (
                <Textarea
                  {...props}
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  rows={2}
                />
              )}
            </Field>

            <div>
              <p className="block text-body font-medium text-ink-2 mb-1.5">Permissões por módulo</p>
              <ModuloPermissaoGrid permissoes={form.permissoes} onChange={alterarPermissao} />
            </div>

            {editandoId && (
              <label className="flex items-center gap-2 text-body text-ink-2">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                  className="rounded border-line"
                />
                Grupo ativo
              </label>
            )}

            {erroForm && <p className="status-error">{erroForm}</p>}

            <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-4">
              <Button variant="secondary" onClick={fechar}>
                Cancelar
              </Button>
              <Button variant="accent" onClick={salvar} disabled={salvando} loading={salvando}>
                Salvar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
