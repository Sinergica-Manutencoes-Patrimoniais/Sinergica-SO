import { Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarCategoria,
  desativarCategoria,
  editarCategoria,
  listarCategorias,
} from "../application/categorias";
import { categoriasRaiz, subcategoriasDe } from "../domain/categoria";
import type { CategoriaFormData, CategoriaItem, CategoriaTipo } from "../domain/categoria";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; categorias: CategoriaItem[] };

type Modal =
  | { modo: "novo"; categoria?: undefined }
  | { modo: "editar"; categoria: CategoriaItem }
  | null;

export function CategoriasPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      setEstado({ fase: "pronto", categorias: await listarCategorias(supabaseFinanceiroAdapter) });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar categorias.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: CategoriaFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarCategoria(supabaseFinanceiroAdapter, {
        ...input,
        id: modal.categoria.id,
        userId: user.id,
      });
    } else {
      await criarCategoria(supabaseFinanceiroAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar(categoria: CategoriaItem) {
    if (!user || !confirm(`Desativar "${categoria.nome}"?`)) return;
    try {
      setErroAcao(null);
      await desativarCategoria(supabaseFinanceiroAdapter, { id: categoria.id, userId: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível desativar.");
    }
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">
          Você não tem permissão de leitura no módulo Financeiro.
        </p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const raizes = categoriasRaiz(estado.categorias);
  const entradas = raizes.filter((c) => c.tipo === "entrada");
  const saidas = raizes.filter((c) => c.tipo === "saida");

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Plano de contas</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Categorias de entrada e saída, até 2 níveis. Editável — o seed é só o ponto de
              partida.
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Nova categoria
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ArvoreCategorias
          titulo="Entrada"
          raizes={entradas}
          categorias={estado.categorias}
          temEscrita={temEscrita}
          onEditar={(categoria) => setModal({ modo: "editar", categoria })}
          onDesativar={desativar}
        />
        <ArvoreCategorias
          titulo="Saída"
          raizes={saidas}
          categorias={estado.categorias}
          temEscrita={temEscrita}
          onEditar={(categoria) => setModal({ modo: "editar", categoria })}
          onDesativar={desativar}
        />
      </div>

      {modal && (
        <CategoriaModal
          categoria={modal.modo === "editar" ? modal.categoria : undefined}
          raizesDisponiveis={raizes}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function ArvoreCategorias({
  titulo,
  raizes,
  categorias,
  temEscrita,
  onEditar,
  onDesativar,
}: {
  titulo: string;
  raizes: CategoriaItem[];
  categorias: CategoriaItem[];
  temEscrita: boolean;
  onEditar: (categoria: CategoriaItem) => void;
  onDesativar: (categoria: CategoriaItem) => void;
}) {
  return (
    <div className="rounded-[8px] border border-line bg-card p-4">
      <h4 className="text-sm font-semibold text-ink">{titulo}</h4>
      {raizes.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">Nenhuma categoria de {titulo.toLowerCase()}.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {raizes.map((raiz) => (
            <li key={raiz.id}>
              <LinhaCategoria
                categoria={raiz}
                temEscrita={temEscrita}
                onEditar={onEditar}
                onDesativar={onDesativar}
              />
              {subcategoriasDe(categorias, raiz.id).length > 0 && (
                <ul className="ml-5 mt-1 flex flex-col gap-1 border-l border-line pl-3">
                  {subcategoriasDe(categorias, raiz.id).map((sub) => (
                    <li key={sub.id}>
                      <LinhaCategoria
                        categoria={sub}
                        temEscrita={temEscrita}
                        onEditar={onEditar}
                        onDesativar={onDesativar}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinhaCategoria({
  categoria,
  temEscrita,
  onEditar,
  onDesativar,
}: {
  categoria: CategoriaItem;
  temEscrita: boolean;
  onEditar: (categoria: CategoriaItem) => void;
  onDesativar: (categoria: CategoriaItem) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 hover:bg-line-soft">
      <span className={`text-sm ${categoria.ativo ? "text-ink" : "text-ink-3 line-through"}`}>
        {categoria.nome}
      </span>
      {temEscrita && (
        <div className="flex gap-1">
          <button
            type="button"
            title="Editar"
            onClick={() => onEditar(categoria)}
            className="text-ink-3 hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {categoria.ativo && (
            <button
              type="button"
              title="Desativar"
              onClick={() => onDesativar(categoria)}
              className="text-ink-3 hover:text-[#A23B25]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CategoriaModal({
  categoria,
  raizesDisponiveis,
  onCancel,
  onSalvar,
}: {
  categoria?: CategoriaItem;
  raizesDisponiveis: CategoriaItem[];
  onCancel: () => void;
  onSalvar: (input: CategoriaFormData) => Promise<void>;
}) {
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [tipo, setTipo] = useState<CategoriaTipo>(categoria?.tipo ?? "saida");
  const [parentId, setParentId] = useState(categoria?.parentId ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const opcoesRaiz = raizesDisponiveis.filter((r) => r.tipo === tipo && r.id !== categoria?.id);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({ nome, tipo, parentId: parentId || null });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar categoria.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {categoria ? "Editar categoria" : "Nova categoria"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Nome *</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Tipo *</span>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as CategoriaTipo);
                setParentId("");
              }}
              className="input w-full"
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">
              Categoria pai (opcional — máx. 2 níveis)
            </span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="input w-full"
            >
              <option value="">Nenhuma (categoria raiz)</option>
              {opcoesRaiz.map((raiz) => (
                <option key={raiz.id} value={raiz.id}>
                  {raiz.nome}
                </option>
              ))}
            </select>
          </label>
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
