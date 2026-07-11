import { Bot, Edit3, Plus, X } from "lucide-react";
import { useState } from "react";
import type { PersonaFormData, PersonaItem, TipoPersona } from "../domain/personas";
import { labelTipoPersona } from "../domain/personas";

interface ModalState {
  modo: "criar" | "editar";
  item?: PersonaItem;
}

const TIPOS: TipoPersona[] = ["chamados", "comercial"];

export function PersonasList({
  personas,
  temEscrita,
  onCriar,
  onEditar,
  onDesativar,
}: {
  personas: PersonaItem[];
  temEscrita: boolean;
  onCriar: (form: PersonaFormData) => Promise<void>;
  onEditar: (id: string, form: PersonaFormData) => Promise<void>;
  onDesativar: (id: string) => Promise<void>;
}) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [form, setForm] = useState<PersonaFormData>({
    nome: "",
    tipo: "chamados",
    promptSistema: "",
    baseConhecimento: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrirModal(next: ModalState) {
    setModal(next);
    setForm({
      nome: next.item?.nome ?? "",
      tipo: next.item?.tipo ?? "chamados",
      promptSistema: next.item?.promptSistema ?? "",
      baseConhecimento: next.item?.baseConhecimento ?? "",
    });
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
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a persona.");
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(item: PersonaItem) {
    if (!window.confirm(`Desativar a persona "${item.nome}"?`)) return;
    setSalvando(true);
    setErro(null);
    try {
      await onDesativar(item.id);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível desativar a persona.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-[10px] border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-ink">Personas de IA</h3>
          <p className="text-sm text-ink-3">
            Prompt de sistema e base de conhecimento por agente (Zé/comercial)
          </p>
        </div>
        {temEscrita && (
          <button
            type="button"
            onClick={() => abrirModal({ modo: "criar" })}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Nova persona
          </button>
        )}
      </div>

      {erro && !modal && (
        <div className="mx-5 mt-4 rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erro}
        </div>
      )}

      <div className="divide-y divide-line-soft">
        {personas.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-3">
            Nenhuma persona cadastrada.
          </div>
        ) : (
          personas.map((persona) => (
            <div key={persona.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Bot className="h-4 w-4 shrink-0 text-ink-3" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{persona.nome}</p>
                  <p className="text-xs text-ink-3">
                    {labelTipoPersona(persona.tipo)}
                    {!persona.ativo && " · inativa"}
                  </p>
                </div>
              </div>
              {temEscrita && (
                <div className="flex shrink-0 justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => abrirModal({ modo: "editar", item: persona })}
                    className="rounded-[6px] border border-line p-2 text-ink-2 hover:bg-line-soft"
                    title="Editar"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  {persona.ativo && (
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => desativar(persona)}
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
          <div className="w-full max-w-lg rounded-[10px] border border-line bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
              <h3 className="text-base font-semibold text-ink">
                {modal.modo === "criar" ? "Nova persona" : "Editar persona"}
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
              className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4"
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
                  value={form.nome}
                  onChange={(event) => setForm({ ...form, nome: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Tipo
                </span>
                <select
                  className="input mt-1"
                  value={form.tipo}
                  onChange={(event) =>
                    setForm({ ...form, tipo: event.target.value as TipoPersona })
                  }
                >
                  {TIPOS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {labelTipoPersona(tipo)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Prompt de sistema
                </span>
                <textarea
                  className="input mt-1 min-h-[120px]"
                  value={form.promptSistema}
                  onChange={(event) => setForm({ ...form, promptSistema: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Base de conhecimento (opcional)
                </span>
                <textarea
                  className="input mt-1 min-h-[80px]"
                  value={form.baseConhecimento}
                  onChange={(event) => setForm({ ...form, baseConhecimento: event.target.value })}
                  placeholder="FAQ, instruções extras, política de atendimento…"
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
