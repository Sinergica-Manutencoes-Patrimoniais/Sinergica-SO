import { Button, ConfirmDialog, Modal } from "@sinergica/ui";
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
  const [personaParaDesativar, setPersonaParaDesativar] = useState<PersonaItem | null>(null);

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

  async function desativar() {
    if (!personaParaDesativar) return;
    await onDesativar(personaParaDesativar.id);
  }

  return (
    <section className="rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div>
          <h3 className="text-heading font-semibold text-ink">Personas de IA</h3>
          <p className="text-body text-ink-3">
            Prompt de sistema e base de conhecimento por agente (Zé/comercial)
          </p>
        </div>
        {temEscrita && (
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => abrirModal({ modo: "criar" })}
          >
            Nova persona
          </Button>
        )}
      </div>

      {erro && !modal && (
        <div className="mx-5 mt-4 rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-body text-danger">
          {erro}
        </div>
      )}

      <div className="divide-y divide-line-soft">
        {personas.length === 0 ? (
          <div className="px-5 py-8 text-center text-body text-ink-3">
            Nenhuma persona cadastrada.
          </div>
        ) : (
          personas.map((persona) => (
            <div key={persona.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Bot className="h-4 w-4 shrink-0 text-ink-3" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{persona.nome}</p>
                  <p className="text-caption text-ink-3">
                    {labelTipoPersona(persona.tipo)}
                    {!persona.ativo && " · inativa"}
                  </p>
                </div>
              </div>
              {temEscrita && (
                <div className="flex shrink-0 justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Edit3 className="h-4 w-4" />}
                    onClick={() => abrirModal({ modo: "editar", item: persona })}
                    title="Editar"
                  />
                  {persona.ativo && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<X className="h-4 w-4" />}
                      disabled={salvando}
                      onClick={() => setPersonaParaDesativar(persona)}
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
        titulo={modal?.modo === "criar" ? "Nova persona" : "Editar persona"}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void salvar();
          }}
        >
          <label className="block">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-3">
              Nome
            </span>
            <input
              className="input mt-1"
              value={form.nome}
              onChange={(event) => setForm({ ...form, nome: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-3">
              Tipo
            </span>
            <select
              className="input mt-1"
              value={form.tipo}
              onChange={(event) => setForm({ ...form, tipo: event.target.value as TipoPersona })}
            >
              {TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {labelTipoPersona(tipo)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-3">
              Prompt de sistema
            </span>
            <textarea
              className="input mt-1 min-h-[120px]"
              value={form.promptSistema}
              onChange={(event) => setForm({ ...form, promptSistema: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-3">
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
            <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-body text-danger">
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
        open={personaParaDesativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setPersonaParaDesativar(null);
        }}
        titulo={`Desativar a persona "${personaParaDesativar?.nome}"`}
        descricao="A persona deixará de ser usada nos atendimentos."
        rotuloConfirmar="Desativar"
        onConfirmar={desativar}
      />
    </section>
  );
}
