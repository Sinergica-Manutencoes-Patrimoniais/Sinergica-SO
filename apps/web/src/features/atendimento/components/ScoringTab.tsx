import { useEffect, useId, useState } from "react";
import type { LeadScoringConfigFormData, LeadScoringConfigItem } from "../domain/scoring-clusters";

export function ScoringTab({
  config,
  temEscrita,
  onSalvar,
}: {
  config: LeadScoringConfigItem | null;
  temEscrita: boolean;
  onSalvar: (form: LeadScoringConfigFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<LeadScoringConfigFormData>({
    windowDays: "14",
    behaviorCap: "50",
    rescoreCooldownSeconds: "90",
    scoreReachedThreshold: "60",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!config) return;
    setForm({
      windowDays: String(config.windowDays),
      behaviorCap: String(config.behaviorCap),
      rescoreCooldownSeconds: String(config.rescoreCooldownSeconds),
      scoreReachedThreshold: String(config.scoreReachedThreshold),
    });
  }, [config]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(form);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-xl rounded-[10px] border border-line bg-card p-5">
      <h3 className="text-sm font-semibold text-ink">Lead scoring por comportamento</h3>
      <p className="mt-0.5 text-xs text-ink-3">
        Regras globais de pontuação de lead (superadmin edita).
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Campo
          label="Janela (dias)"
          value={form.windowDays}
          onChange={(v) => setForm((f) => ({ ...f, windowDays: v }))}
          disabled={!temEscrita}
        />
        <Campo
          label="Teto de comportamento"
          value={form.behaviorCap}
          onChange={(v) => setForm((f) => ({ ...f, behaviorCap: v }))}
          disabled={!temEscrita}
        />
        <Campo
          label="Cooldown de recálculo (s)"
          value={form.rescoreCooldownSeconds}
          onChange={(v) => setForm((f) => ({ ...f, rescoreCooldownSeconds: v }))}
          disabled={!temEscrita}
        />
        <Campo
          label="Limiar de score atingido"
          value={form.scoreReachedThreshold}
          onChange={(v) => setForm((f) => ({ ...f, scoreReachedThreshold: v }))}
          disabled={!temEscrita}
        />
      </div>
      {erro && (
        <div className="mt-4 rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-3 py-2 text-sm text-[#A12D24]">
          {erro}
        </div>
      )}
      {temEscrita && (
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="mt-4 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar configuração"}
        </button>
      )}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  disabled,
}: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-ink-2">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 w-full rounded-[6px] border border-line p-2 text-sm disabled:opacity-60"
      />
    </div>
  );
}
