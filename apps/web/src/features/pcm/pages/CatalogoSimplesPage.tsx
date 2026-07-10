import { Edit3, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarCatalogoSimples,
  editarCatalogoSimples,
  excluirCatalogoSimples,
  listarCatalogoSimples,
} from "../application/catalogos-simples";
import { BannerEscritaAuvoPendente } from "../components/BannerEscritaAuvoPendente";
import type { CatalogoSimplesItem, CatalogoSimplesTipo } from "../domain/catalogos-simples";
import { campoCatalogoSimples, labelCatalogoSimples } from "../domain/catalogos-simples";
import { syncStatusLabel } from "../domain/tipos-tarefa";
import { supabaseCatalogosSimplesAdapter } from "../infrastructure/supabase-catalogos-simples-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; itens: CatalogoSimplesItem[] };

interface ModalState {
  modo: "criar" | "editar";
  item?: CatalogoSimplesItem;
}

export function SegmentosPage() {
  return <CatalogoSimplesPage tipo="segmentos" />;
}

export function PalavrasChavePage() {
  return <CatalogoSimplesPage tipo="palavras_chave" />;
}

export function ProdutoCategoriasPage() {
  return <CatalogoSimplesPage tipo="produto_categorias" />;
}

export function EquipamentoCategoriasPage() {
  return <CatalogoSimplesPage tipo="equipamento_categorias" />;
}

function CatalogoSimplesPage({ tipo }: { tipo: CatalogoSimplesTipo }) {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<ModalState | null>(null);
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const titulo = labelCatalogoSimples(tipo);
  const campo = campoCatalogoSimples(tipo);
  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    setErroAcao(null);
    try {
      const itens = await listarCatalogoSimples(supabaseCatalogosSimplesAdapter, tipo);
      setEstado({ fase: "pronto", itens });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : `Não foi possível carregar ${titulo}.`,
      });
    }
  }, [tipo, titulo]);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const itensFiltrados = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    const termo = busca.trim().toLowerCase();
    return estado.itens.filter(
      (item) => termo.length === 0 || item.descricao.toLowerCase().includes(termo),
    );
  }, [estado, busca]);

  function abrirModal(next: ModalState) {
    setModal(next);
    setDescricao(next.item?.descricao ?? "");
    setErroAcao(null);
  }

  async function onSalvar() {
    if (!user || !modal) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      if (modal.modo === "criar") {
        await criarCatalogoSimples(supabaseCatalogosSimplesAdapter, {
          tipo,
          descricao,
          userId: user.id,
        });
      } else if (modal.item) {
        await editarCatalogoSimples(supabaseCatalogosSimplesAdapter, {
          tipo,
          id: modal.item.id,
          descricao,
          userId: user.id,
        });
      }
      setModal(null);
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function onExcluir(item: CatalogoSimplesItem) {
    if (!user) return;
    const confirmado = window.confirm(`Excluir "${item.descricao}"?`);
    if (!confirmado) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      await excluirCatalogoSimples(supabaseCatalogosSimplesAdapter, {
        tipo,
        id: item.id,
        userId: user.id,
      });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível excluir.");
    } finally {
      setSalvando(false);
    }
  }

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando {titulo}…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BannerEscritaAuvoPendente entidade={titulo.toLowerCase()} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{titulo}</h2>
          <p className="text-sm text-ink-3">Catálogo simples sincronizado com o Auvo</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={carregar}
            className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          {temEscrita && (
            <button
              type="button"
              onClick={() => abrirModal({ modo: "criar" })}
              className="inline-flex items-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
            >
              <Plus className="h-4 w-4" />
              Novo
            </button>
          )}
        </div>
      </div>

      {erroAcao && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erroAcao}
        </div>
      )}

      <section className="rounded-[10px] border border-line bg-card">
        <div className="border-b border-line-soft px-5 py-4">
          <input
            className="input"
            placeholder={`Buscar por ${campo.toLowerCase()}`}
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </div>

        <div className="divide-y divide-line-soft">
          {itensFiltrados.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-3">
              Nenhum registro encontrado.
            </div>
          ) : (
            itensFiltrados.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[1fr_180px_96px] md:items-center"
              >
                <div>
                  <p className="font-semibold text-ink">{item.descricao}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {item.auvoId ? `Auvo #${item.auvoId}` : "Ainda sem id Auvo"}
                  </p>
                </div>
                <div>
                  <span className="rounded-full bg-[#EFF1F4] px-2 py-1 text-xs font-semibold text-[#5A6175]">
                    {syncStatusLabel(item.auvoSyncStatus)}
                  </span>
                </div>
                {temEscrita && (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => abrirModal({ modo: "editar", item })}
                      className="rounded-[6px] border border-line p-2 text-ink-2 hover:bg-line-soft"
                      title="Editar"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => onExcluir(item)}
                      className="rounded-[6px] border border-[#F0C2BD] p-2 text-[#A12D24] hover:bg-[#FFF4F2] disabled:opacity-50"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-[10px] border border-line bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
              <h3 className="text-base font-semibold text-ink">
                {modal.modo === "criar" ? `Novo ${titulo}` : `Editar ${titulo}`}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-[6px] p-2 text-ink-3 hover:bg-line-soft"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              className="space-y-4 px-5 py-4"
              onSubmit={(event) => {
                event.preventDefault();
                void onSalvar();
              }}
            >
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  {campo}
                </span>
                <input
                  className="input mt-1"
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                />
              </label>

              {erroAcao && (
                <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
                  {erroAcao}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-[6px] border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
