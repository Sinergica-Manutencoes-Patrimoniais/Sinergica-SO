import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { ConhecimentoEntradaFormData, ConhecimentoEntradaItem } from "../domain/conhecimento";
import type { PersonaItem } from "../domain/personas";

interface ModalState {
  modo: "criar" | "editar";
  item?: ConhecimentoEntradaItem;
}

const FORM_VAZIO: ConhecimentoEntradaFormData = {
  personaId: "",
  titulo: "",
  conteudo: "",
  categoria: "geral",
  tags: [],
  prioridade: 5,
};

export function ConhecimentoList({
  entradas,
  personas,
  temEscrita,
  onCriar,
  onEditar,
  onDesativar,
}: {
  entradas: ConhecimentoEntradaItem[];
  personas: PersonaItem[];
  temEscrita: boolean;
  onCriar: (form: ConhecimentoEntradaFormData) => Promise<void>;
  onEditar: (id: string, form: ConhecimentoEntradaFormData) => Promise<void>;
  onDesativar: (id: string) => Promise<void>;
}) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [form, setForm] = useState<ConhecimentoEntradaFormData>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ativas = entradas.filter((e) => e.ativo);
  const porCategoria = new Map<string, ConhecimentoEntradaItem[]>();
  for (const e of entradas) {
    porCategoria.set(e.categoria, [...(porCategoria.get(e.categoria) ?? []), e]);
  }

  function abrirModal(next: ModalState) {
    setModal(next);
    setForm(
      next.item
        ? {
            personaId: next.item.personaId ?? "",
            titulo: next.item.titulo,
            conteudo: next.item.conteudo,
            categoria: next.item.categoria,
            tags: next.item.tags,
            prioridade: next.item.prioridade,
          }
        : FORM_VAZIO,
    );
    setErro(null);
  }

  async function salvar() {
    if (!modal) return;
    setSalvando(true);
    setErro(null);
    try {
      if (modal.modo === "criar") await onCriar(form);
      else if (modal.item) await onEditar(modal.item.id, form);
      setModal(null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a entrada.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">
          {ativas.length} entrada(s) ativa(s) de {entradas.length} total.
        </p>
        {temEscrita && (
          <button
            type="button"
            onClick={() => abrirModal({ modo: "criar" })}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
          >
            <Plus className="h-4 w-4" /> Nova entrada
          </button>
        )}
      </div>

      {entradas.length === 0 ? (
        <div className="rounded-[10px] border border-line bg-card p-8 text-center text-sm text-ink-3">
          Nenhuma entrada de conhecimento ainda.
        </div>
      ) : (
        [...porCategoria.entries()].map(([categoria, itens]) => (
          <div key={categoria} className="rounded-[10px] border border-line bg-card">
            <div className="border-b border-line-soft px-4 py-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
                {categoria}
              </h3>
            </div>
            <div className="divide-y divide-line-soft">
              {itens.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${item.ativo ? "text-ink-2" : "text-ink-3 line-through"}`}
                    >
                      {item.titulo}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-3">{item.conteudo}</p>
                  </div>
                  {temEscrita && (
                    <div className="flex shrink-0 gap-2 pl-3">
                      <button
                        type="button"
                        onClick={() => abrirModal({ modo: "editar", item })}
                        className="rounded-[6px] border border-line p-1.5 text-xs text-ink-2 hover:bg-line-soft"
                      >
                        Editar
                      </button>
                      {item.ativo && (
                        <button
                          type="button"
                          onClick={() => onDesativar(item.id)}
                          className="rounded-[6px] border border-[#F0C2BD] p-1.5 text-xs text-[#A12D24] hover:bg-[#FFF4F2]"
                        >
                          Desativar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {modal && (
        <div className="modal-backdrop">
          <div className="w-full max-w-lg rounded-[10px] bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">
                {modal.modo === "criar" ? "Nova entrada" : "Editar entrada"}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-ink-3 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Título"
                className="w-full rounded-[6px] border border-line p-2 text-sm"
              />
              <textarea
                value={form.conteudo}
                onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))}
                placeholder="Conteúdo"
                rows={4}
                className="w-full rounded-[6px] border border-line p-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                  placeholder="Categoria"
                  className="w-full rounded-[6px] border border-line p-2 text-sm"
                />
                <select
                  value={form.personaId}
                  onChange={(e) => setForm((f) => ({ ...f, personaId: e.target.value }))}
                  className="w-full rounded-[6px] border border-line p-2 text-sm"
                >
                  <option value="">Todas as personas</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-xs font-semibold text-ink-2"
                  htmlFor="conhecimento-prioridade"
                >
                  Prioridade ({form.prioridade})
                </label>
                <input
                  id="conhecimento-prioridade"
                  type="range"
                  min={1}
                  max={10}
                  value={form.prioridade}
                  onChange={(e) => setForm((f) => ({ ...f, prioridade: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              {erro && (
                <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-3 py-2 text-sm text-[#A12D24]">
                  {erro}
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-[6px] border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
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
