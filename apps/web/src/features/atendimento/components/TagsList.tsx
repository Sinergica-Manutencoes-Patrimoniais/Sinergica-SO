import { Edit3, Plus, Tag as TagIcon, X } from "lucide-react";
import { useState } from "react";
import type { TagItem } from "../domain/tags";

interface ModalState {
  modo: "criar" | "editar";
  item?: TagItem;
}

export function TagsList({
  tags,
  temEscrita,
  onCriar,
  onEditar,
  onDesativar,
}: {
  tags: TagItem[];
  temEscrita: boolean;
  onCriar: (nome: string) => Promise<void>;
  onEditar: (id: string, nome: string) => Promise<void>;
  onDesativar: (id: string) => Promise<void>;
}) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrirModal(next: ModalState) {
    setModal(next);
    setNome(next.item?.nome ?? "");
    setErro(null);
  }

  async function salvar() {
    if (!modal) return;
    setSalvando(true);
    setErro(null);
    try {
      if (modal.modo === "criar") await onCriar(nome);
      else if (modal.item) await onEditar(modal.item.id, nome);
      setModal(null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a tag.");
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(item: TagItem) {
    if (
      !window.confirm(`Desativar a tag "${item.nome}"? Conversas que já a usam não são afetadas.`)
    )
      return;
    setSalvando(true);
    setErro(null);
    try {
      await onDesativar(item.id);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível desativar a tag.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-[10px] border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Tags de conversa</h3>
          <p className="text-sm text-ink-3">Catálogo usado para classificar conversas no Inbox</p>
        </div>
        {temEscrita && (
          <button
            type="button"
            onClick={() => abrirModal({ modo: "criar" })}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Nova tag
          </button>
        )}
      </div>

      {erro && !modal && (
        <div className="mx-5 mt-4 rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erro}
        </div>
      )}

      <div className="divide-y divide-line-soft">
        {tags.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-3">Nenhuma tag cadastrada.</div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between gap-3 px-5 py-3 md:items-center"
            >
              <div className="flex items-center gap-2">
                <TagIcon className="h-4 w-4 text-ink-3" />
                <span className="font-semibold text-ink">{tag.nome}</span>
                {!tag.ativo && (
                  <span className="rounded-full bg-[#EFF1F4] px-2 py-0.5 text-[10px] font-semibold text-[#5A6175]">
                    Inativa
                  </span>
                )}
              </div>
              {temEscrita && (
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => abrirModal({ modo: "editar", item: tag })}
                    className="rounded-[6px] border border-line p-2 text-ink-2 hover:bg-line-soft"
                    title="Editar"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  {tag.ativo && (
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => desativar(tag)}
                      className="rounded-[6px] border border-[#F0C2BD] p-2 text-[#A12D24] hover:bg-[#FFF4F2] disabled:opacity-50"
                      title="Desativar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {modal && (
        <div className="modal-backdrop">
          <div className="w-full max-w-md rounded-[10px] border border-line bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
              <h3 className="text-base font-semibold text-ink">
                {modal.modo === "criar" ? "Nova tag" : "Editar tag"}
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
                void salvar();
              }}
            >
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Nome
                </span>
                <input
                  className="input mt-1"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                />
              </label>
              {erro && (
                <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
                  {erro}
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
    </section>
  );
}
