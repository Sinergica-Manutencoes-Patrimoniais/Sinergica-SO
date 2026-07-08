import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FluxoItem, PassoFluxo } from "../domain/fluxos";
import { novoPasso } from "../domain/fluxos";
import type { PersonaItem } from "../domain/personas";
import { FlowBuilderCanvas } from "./FlowBuilderCanvas";

export function FluxosManager({
  fluxos,
  personas,
  temEscrita,
  onCriar,
  onSalvarPassos,
  onDesativar,
}: {
  fluxos: FluxoItem[];
  personas: PersonaItem[];
  temEscrita: boolean;
  onCriar: (nome: string, personaId: string) => Promise<void>;
  onSalvarPassos: (fluxoId: string, passos: PassoFluxo[]) => Promise<void>;
  onDesativar: (id: string) => Promise<void>;
}) {
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [passosLocais, setPassosLocais] = useState<PassoFluxo[]>([]);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [personaId, setPersonaId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const selecionado = fluxos.find((f) => f.id === selecionadoId) ?? null;
  const personasAtivas = personas.filter((p) => p.ativo);

  useEffect(() => {
    setPassosLocais(selecionado?.passos ?? []);
  }, [selecionado]);

  async function criar() {
    setSalvando(true);
    setErro(null);
    try {
      await onCriar(nome, personaId);
      setCriando(false);
      setNome("");
      setPersonaId("");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível criar o fluxo.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvar() {
    if (!selecionado) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvarPassos(selecionado.id, passosLocais);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar os passos.");
    } finally {
      setSalvando(false);
    }
  }

  async function desativar() {
    if (!selecionado) return;
    if (!window.confirm(`Desativar o fluxo "${selecionado.nome}"?`)) return;
    setSalvando(true);
    setErro(null);
    try {
      await onDesativar(selecionado.id);
      setSelecionadoId(null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível desativar o fluxo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[10px] border border-line bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink">Fluxos de qualificação</h3>
            <p className="text-sm text-ink-3">
              Roteiro de perguntas por persona — usado hoje pelo agente comercial (E02-S08)
            </p>
          </div>
          {temEscrita && !criando && (
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="inline-flex items-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
            >
              <Plus className="h-4 w-4" />
              Novo fluxo
            </button>
          )}
        </div>

        {criando && (
          <form
            className="space-y-3 border-b border-line-soft px-5 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              void criar();
            }}
          >
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Nome
              </span>
              <input
                className="input mt-1"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Persona
              </span>
              <select
                className="input mt-1"
                value={personaId}
                onChange={(e) => setPersonaId(e.target.value)}
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
                className="rounded-[6px] border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2 px-5 py-4">
          {fluxos.length === 0 ? (
            <p className="text-sm text-ink-3">Nenhum fluxo cadastrado ainda.</p>
          ) : (
            fluxos.map((fluxo) => (
              <button
                key={fluxo.id}
                type="button"
                onClick={() => setSelecionadoId(fluxo.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  fluxo.id === selecionadoId
                    ? "border-orange bg-orange-soft/40 text-ink"
                    : "border-line text-ink-2 hover:bg-line-soft"
                } ${fluxo.ativo ? "" : "opacity-50"}`}
              >
                {fluxo.nome}
                {!fluxo.ativo && " (inativo)"}
              </button>
            ))
          )}
        </div>
      </section>

      {erro && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erro}
        </div>
      )}

      {selecionado && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {temEscrita && (
                <button
                  type="button"
                  onClick={() => setPassosLocais([...passosLocais, novoPasso(passosLocais)])}
                  className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar passo
                </button>
              )}
            </div>
            {temEscrita && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={desativar}
                  className="inline-flex items-center gap-2 rounded-[6px] border border-[#F0C2BD] px-3 py-2 text-sm font-semibold text-[#A12D24] hover:bg-[#FFF4F2] disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Desativar fluxo
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={salvar}
                  className="rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
                >
                  {salvando ? "Salvando…" : "Salvar passos"}
                </button>
              </div>
            )}
          </div>
          <FlowBuilderCanvas
            passos={passosLocais}
            readOnly={!temEscrita}
            onChange={setPassosLocais}
          />
        </>
      )}
    </div>
  );
}
