import { Button, ConfirmDialog, Modal as ModalPrimitivo } from "@sinergica/ui";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  const [categoriaParaDesativar, setCategoriaParaDesativar] = useState<CategoriaItem | null>(null);

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

  async function desativar() {
    if (!user || !categoriaParaDesativar) return;
    await desativarCategoria(supabaseFinanceiroAdapter, {
      id: categoriaParaDesativar.id,
      userId: user.id,
    });
    await carregar();
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-body text-ink-3">Carregando…</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-body text-ink-3">
          Você não tem permissão de leitura no módulo Financeiro.
        </p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-body text-ink-3">{estado.mensagem}</p>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={carregar}
          className="mt-4"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const raizes = categoriasRaiz(estado.categorias);
  const entradas = raizes.filter((c) => c.tipo === "entrada");
  const saidas = raizes.filter((c) => c.tipo === "saida");

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-heading font-semibold text-ink">Plano de contas</h3>
            <p className="mt-0.5 text-body text-ink-3">
              Categorias de entrada e saída, até 2 níveis. Editável — o seed é só o ponto de
              partida.
            </p>
          </div>
          {temEscrita && (
            <Button
              variant="accent"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setModal({ modo: "novo" })}
            >
              Nova categoria
            </Button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ArvoreCategorias
          titulo="Entrada"
          raizes={entradas}
          categorias={estado.categorias}
          temEscrita={temEscrita}
          onEditar={(categoria) => setModal({ modo: "editar", categoria })}
          onDesativar={setCategoriaParaDesativar}
        />
        <ArvoreCategorias
          titulo="Saída"
          raizes={saidas}
          categorias={estado.categorias}
          temEscrita={temEscrita}
          onEditar={(categoria) => setModal({ modo: "editar", categoria })}
          onDesativar={setCategoriaParaDesativar}
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

      <ConfirmDialog
        open={categoriaParaDesativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setCategoriaParaDesativar(null);
        }}
        titulo={`Desativar "${categoriaParaDesativar?.nome}"`}
        descricao="A categoria deixa de aparecer para novos lançamentos."
        rotuloConfirmar="Desativar"
        onConfirmar={desativar}
      />
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
    <div className="rounded-lg border border-line bg-card p-4">
      <h4 className="text-body font-semibold text-ink">{titulo}</h4>
      {raizes.length === 0 ? (
        <p className="mt-3 text-body text-ink-3">Nenhuma categoria de {titulo.toLowerCase()}.</p>
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
    <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-line-soft">
      <span className={`text-body ${categoria.ativo ? "text-ink" : "text-ink-3 line-through"}`}>
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
              className="text-ink-3 hover:text-danger"
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
    <ModalPrimitivo
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={categoria ? "Editar categoria" : "Nova categoria"}
      tamanho="md"
    >
      <div className="grid grid-cols-1 gap-3">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Nome *</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Tipo *</span>
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
          <span className="mb-1 block text-caption font-semibold text-ink-3">
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
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="accent" onClick={salvar} loading={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </ModalPrimitivo>
  );
}
