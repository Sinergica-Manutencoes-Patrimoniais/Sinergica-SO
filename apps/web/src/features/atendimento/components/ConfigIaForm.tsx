import { useEffect, useState } from "react";
import type { ConfigIaFormData, PersonaFormData, PersonaItem } from "../domain/personas";

const DIAS = [
  { valor: 0, label: "Dom" },
  { valor: 1, label: "Seg" },
  { valor: 2, label: "Ter" },
  { valor: 3, label: "Qua" },
  { valor: 4, label: "Qui" },
  { valor: 5, label: "Sex" },
  { valor: 6, label: "Sáb" },
];

export function ConfigIaForm({
  personas,
  temEscrita,
  onSalvar,
  onSalvarIdentidade,
}: {
  personas: PersonaItem[];
  temEscrita: boolean;
  onSalvar: (personaId: string, form: ConfigIaFormData) => Promise<void>;
  onSalvarIdentidade: (personaId: string, form: PersonaFormData) => Promise<void>;
}) {
  const [personaId, setPersonaId] = useState<string>(personas[0]?.id ?? "");
  const [form, setForm] = useState<ConfigIaFormData>({
    modeloLlm: "openrouter/auto",
    janelaInicio: "",
    janelaFim: "",
    janelaDias: [0, 1, 2, 3, 4, 5, 6],
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [identidade, setIdentidade] = useState<PersonaFormData>({
    nome: "",
    tipo: "chamados",
    promptSistema: "",
    baseConhecimento: "",
  });

  const persona = personas.find((p) => p.id === personaId) ?? null;

  useEffect(() => {
    if (!persona) return;
    setForm({
      modeloLlm: persona.modeloLlm,
      janelaInicio: persona.janelaInicio ?? "",
      janelaFim: persona.janelaFim ?? "",
      janelaDias: persona.janelaDias,
    });
    setIdentidade({
      nome: persona.nome,
      tipo: persona.tipo,
      promptSistema: persona.promptSistema,
      baseConhecimento: persona.baseConhecimento ?? "",
    });
    setSalvo(false);
  }, [persona]);

  function toggleDia(dia: number) {
    setForm((f) => ({
      ...f,
      janelaDias: f.janelaDias.includes(dia)
        ? f.janelaDias.filter((d) => d !== dia)
        : [...f.janelaDias, dia].sort(),
    }));
  }

  async function salvar() {
    if (!personaId) return;
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      await Promise.all([onSalvar(personaId, form), onSalvarIdentidade(personaId, identidade)]);
      setSalvo(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (personas.length === 0) {
    return (
      <div className="rounded-[10px] border border-line bg-card p-8 text-center text-sm text-ink-3">
        Crie uma persona na aba "Personas" antes de configurar o modelo/janela de IA.
      </div>
    );
  }

  return (
    <div className="max-w-xl rounded-[10px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">Identidade e modelo</h3>
      <p className="mt-0.5 text-xs text-ink-3">
        Modelo LLM e janela de atendimento por persona (número/instância continua na aba Agentes).
      </p>

      <label className="mt-4 block text-xs font-semibold text-ink-2" htmlFor="config-ia-persona">
        Persona
      </label>
      <select
        id="config-ia-persona"
        value={personaId}
        onChange={(e) => setPersonaId(e.target.value)}
        className="mt-1 w-full rounded-[6px] border border-line p-2 text-sm text-ink"
      >
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-xs font-semibold text-ink-2" htmlFor="config-ia-nome">
        Nome da identidade
      </label>
      <input
        id="config-ia-nome"
        value={identidade.nome}
        onChange={(e) => setIdentidade((atual) => ({ ...atual, nome: e.target.value }))}
        disabled={!temEscrita}
        className="mt-1 w-full rounded-[6px] border border-line p-2 text-sm"
      />
      <label className="mt-4 block text-xs font-semibold text-ink-2" htmlFor="config-ia-prompt">
        Prompt base
      </label>
      <textarea
        id="config-ia-prompt"
        value={identidade.promptSistema}
        onChange={(e) => setIdentidade((atual) => ({ ...atual, promptSistema: e.target.value }))}
        disabled={!temEscrita}
        className="mt-1 min-h-24 w-full rounded-[6px] border border-line p-2 text-sm"
      />

      <label className="mt-4 block text-xs font-semibold text-ink-2" htmlFor="config-ia-modelo">
        Modelo LLM
      </label>
      <input
        id="config-ia-modelo"
        value={form.modeloLlm}
        onChange={(e) => setForm((f) => ({ ...f, modeloLlm: e.target.value }))}
        disabled={!temEscrita}
        placeholder="openai/gpt-4o-mini"
        className="mt-1 w-full rounded-[6px] border border-line p-2 text-sm text-ink disabled:opacity-60"
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label
            className="block text-xs font-semibold text-ink-2"
            htmlFor="config-ia-janela-inicio"
          >
            Janela — início
          </label>
          <input
            id="config-ia-janela-inicio"
            type="time"
            value={form.janelaInicio}
            onChange={(e) => setForm((f) => ({ ...f, janelaInicio: e.target.value }))}
            disabled={!temEscrita}
            className="mt-1 w-full rounded-[6px] border border-line p-2 text-sm text-ink disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-2" htmlFor="config-ia-janela-fim">
            Janela — fim
          </label>
          <input
            id="config-ia-janela-fim"
            type="time"
            value={form.janelaFim}
            onChange={(e) => setForm((f) => ({ ...f, janelaFim: e.target.value }))}
            disabled={!temEscrita}
            className="mt-1 w-full rounded-[6px] border border-line p-2 text-sm text-ink disabled:opacity-60"
          />
        </div>
      </div>
      <p className="mt-1 text-[11px] text-ink-3">
        Em branco = atende o dia todo, sem restrição de horário.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {DIAS.map((d) => (
          <button
            key={d.valor}
            type="button"
            disabled={!temEscrita}
            onClick={() => toggleDia(d.valor)}
            className={`rounded-[6px] border px-2.5 py-1 text-xs font-semibold disabled:opacity-60 ${
              form.janelaDias.includes(d.valor)
                ? "border-navy bg-navy text-white"
                : "border-line text-ink-2 hover:bg-line-soft"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {erro && (
        <div className="mt-4 rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erro}
        </div>
      )}
      {salvo && !erro && (
        <p className="mt-4 text-sm font-medium text-[#1E8E45]">Configuração salva.</p>
      )}

      {temEscrita && (
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="mt-4 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      )}
    </div>
  );
}
