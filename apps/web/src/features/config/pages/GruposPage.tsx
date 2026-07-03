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
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Grupos</h2>
          <p className="text-sm text-ink-3 mt-0.5">
            Conjuntos reutilizáveis de permissão por módulo.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirCriacao}
          className="text-sm font-semibold text-white bg-orange hover:bg-orange-deep rounded-lg px-4 py-2 transition cursor-pointer"
        >
          Novo grupo
        </button>
      </div>

      {erro && (
        <p className="text-sm text-[#C5362B] bg-[#FCEAE8] border border-[#F2C4C0] rounded-lg px-3 py-2">
          {erro}
        </p>
      )}

      {carregando ? (
        <p className="text-sm text-ink-3">Carregando…</p>
      ) : grupos.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum grupo criado ainda.</p>
      ) : (
        <div className="bg-card rounded-[10px] border border-line divide-y divide-line-soft">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="px-5 py-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink truncate">{grupo.nome}</p>
                  {!grupo.ativo && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EFF1F4] text-[#5A6175]">
                      Inativo
                    </span>
                  )}
                </div>
                {grupo.descricao && (
                  <p className="text-xs text-ink-3 truncate mt-0.5">{grupo.descricao}</p>
                )}
              </div>
              <span className="text-xs text-ink-3 shrink-0">
                {grupo.permissoes.length} módulo{grupo.permissoes.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => abrirEdicao(grupo)}
                className="text-xs font-semibold text-orange hover:text-orange-deep cursor-pointer shrink-0"
              >
                Editar
              </button>
            </div>
          ))}
        </div>
      )}

      {formAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl border border-line w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 flex flex-col gap-4">
            <h3 className="text-base font-semibold text-ink">
              {editandoId ? `Editar grupo — ${editandoGrupo?.nome ?? ""}` : "Novo grupo"}
            </h3>

            <div>
              <label htmlFor="grupo-nome" className="block text-sm font-medium text-ink-2 mb-1.5">
                Nome
              </label>
              <input
                id="grupo-nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line text-ink text-sm bg-card focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition"
              />
            </div>

            <div>
              <label
                htmlFor="grupo-descricao"
                className="block text-sm font-medium text-ink-2 mb-1.5"
              >
                Descrição
              </label>
              <textarea
                id="grupo-descricao"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-lg border border-line text-ink text-sm bg-card focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange transition"
              />
            </div>

            <div>
              <p className="block text-sm font-medium text-ink-2 mb-1.5">Permissões por módulo</p>
              <ModuloPermissaoGrid permissoes={form.permissoes} onChange={alterarPermissao} />
            </div>

            {editandoId && (
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                  className="rounded border-line"
                />
                Grupo ativo
              </label>
            )}

            {erroForm && (
              <p className="text-sm text-[#C5362B] bg-[#FCEAE8] border border-[#F2C4C0] rounded-lg px-3 py-2">
                {erroForm}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={fechar}
                className="text-sm font-medium text-ink-3 hover:text-ink px-4 py-2 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="text-sm font-semibold text-white bg-orange hover:bg-orange-deep disabled:opacity-60 rounded-lg px-4 py-2 transition cursor-pointer"
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
