import { ConfirmDialog } from "@sinergica/ui";
import { Plus, Radio, X } from "lucide-react";
import { useState } from "react";
import type { InstanciaAgenteItem } from "../domain/instancias-agente";
import type { PersonaItem } from "../domain/personas";

export function InstanciasAgenteList({
  instancias,
  personas,
  temEscrita,
  onCriar,
  onDesativar,
}: {
  instancias: InstanciaAgenteItem[];
  personas: PersonaItem[];
  temEscrita: boolean;
  onCriar: (instanceId: string, personaId: string) => Promise<void>;
  onDesativar: (id: string) => Promise<void>;
}) {
  const [criando, setCriando] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [itemParaDesativar, setItemParaDesativar] = useState<InstanciaAgenteItem | null>(null);

  const personasAtivas = personas.filter((p) => p.ativo);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onCriar(instanceId, personaId);
      setCriando(false);
      setInstanceId("");
      setPersonaId("");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível vincular a instância.");
    } finally {
      setSalvando(false);
    }
  }

  async function desativar() {
    if (!itemParaDesativar) return;
    await onDesativar(itemParaDesativar.id);
  }

  return (
    <section className="rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div>
          <h3 className="text-heading font-semibold text-ink">Instâncias de agente</h3>
          <p className="text-body text-ink-3">
            Mapeia uma instância WhatsApp (Evolution) dedicada a um agente/persona — usado pelo
            agente comercial, que atende contato novo fora do fluxo por condomínio do Zé
          </p>
        </div>
        {temEscrita && !criando && (
          <button type="button" onClick={() => setCriando(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Vincular instância
          </button>
        )}
      </div>

      {erro && (
        <div className="mx-5 mt-4 rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-body text-danger">
          {erro}
        </div>
      )}

      {criando && (
        <form
          className="space-y-3 border-b border-line-soft px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void salvar();
          }}
        >
          <label className="block">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-3">
              Instance ID (Evolution)
            </span>
            <input
              className="input mt-1"
              value={instanceId}
              onChange={(event) => setInstanceId(event.target.value)}
              placeholder="ex.: sinergica-comercial"
            />
          </label>
          <label className="block">
            <span className="text-caption font-semibold uppercase tracking-wider text-ink-3">
              Persona
            </span>
            <select
              className="input mt-1"
              value={personaId}
              onChange={(event) => setPersonaId(event.target.value)}
            >
              <option value="">Selecione…</option>
              {personasAtivas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCriando(false)}
              className="rounded-md border border-line px-4 py-2 text-body font-semibold text-ink-2 hover:bg-line-soft"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-md bg-navy px-4 py-2 text-body font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Vincular"}
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-line-soft">
        {instancias.length === 0 ? (
          <div className="px-5 py-8 text-center text-body text-ink-3">
            Nenhuma instância vinculada ainda.
          </div>
        ) : (
          instancias.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-ink-3" />
                <div>
                  <p className="font-semibold text-ink">{item.instanceId}</p>
                  <p className="text-caption text-ink-3">
                    {item.personaNome}
                    {!item.ativo && " · desligada"}
                  </p>
                </div>
              </div>
              {temEscrita && item.ativo && (
                <button
                  type="button"
                  onClick={() => setItemParaDesativar(item)}
                  className="rounded-md border border-danger-line p-2 text-danger hover:bg-danger-soft disabled:opacity-50"
                  title="Desligar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={itemParaDesativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setItemParaDesativar(null);
        }}
        titulo={`Desligar o agente da instância "${itemParaDesativar?.instanceId}"`}
        descricao="O agente para de responder por essa instância."
        rotuloConfirmar="Desligar"
        onConfirmar={desativar}
      />
    </section>
  );
}
