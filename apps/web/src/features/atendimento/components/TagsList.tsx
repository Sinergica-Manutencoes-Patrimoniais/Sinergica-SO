import { Button, ConfirmDialog, Modal } from "@sinergica/ui";
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
  const [tagParaDesativar, setTagParaDesativar] = useState<TagItem | null>(null);

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

  async function desativar() {
    if (!tagParaDesativar) return;
    await onDesativar(tagParaDesativar.id);
  }

  return (
    <section className="rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Tags de conversa</h3>
          <p className="text-sm text-ink-3">Catálogo usado para classificar conversas no Inbox</p>
        </div>
        {temEscrita && (
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => abrirModal({ modo: "criar" })}
          >
            Nova tag
          </Button>
        )}
      </div>

      {erro && !modal && (
        <div className="mx-5 mt-4 rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-sm text-danger">
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
                  <span className="rounded-full bg-line-soft px-2 py-0.5 text-micro font-semibold text-ink-2">
                    Inativa
                  </span>
                )}
              </div>
              {temEscrita && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Edit3 className="h-4 w-4" />}
                    onClick={() => abrirModal({ modo: "editar", item: tag })}
                    title="Editar"
                  />
                  {tag.ativo && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<X className="h-4 w-4" />}
                      disabled={salvando}
                      onClick={() => setTagParaDesativar(tag)}
                      title="Desativar"
                    />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Modal
        open={modal !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setModal(null);
        }}
        titulo={modal?.modo === "criar" ? "Nova tag" : "Editar tag"}
        tamanho="sm"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void salvar();
          }}
        >
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Nome</span>
            <input
              className="input mt-1"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
            />
          </label>
          {erro && (
            <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-sm text-danger">
              {erro}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={salvando} loading={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={tagParaDesativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setTagParaDesativar(null);
        }}
        titulo={`Desativar a tag "${tagParaDesativar?.nome}"`}
        descricao="Conversas que já usam essa tag não são afetadas."
        rotuloConfirmar="Desativar"
        onConfirmar={desativar}
      />
    </section>
  );
}
