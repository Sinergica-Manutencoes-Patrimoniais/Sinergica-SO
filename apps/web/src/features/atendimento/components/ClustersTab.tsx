import { useState } from "react";
import type { ClusterRegraFormData, ClusterRegraItem, LeadTier } from "../domain/scoring-clusters";

const TIERS: LeadTier[] = ["A", "B", "C", "D"];

export function ClustersTab({
  clusters,
  temEscrita,
  onCriar,
  onDesativar,
}: {
  clusters: ClusterRegraItem[];
  temEscrita: boolean;
  onCriar: (form: ClusterRegraFormData) => Promise<void>;
  onDesativar: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState<ClusterRegraFormData>({
    nome: "",
    leadTier: "",
    segmento: "",
    subsegmento: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onCriar(form);
      setForm({ nome: "", leadTier: "", segmento: "", subsegmento: "" });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {clusters.length === 0 ? (
        <div className="rounded-[10px] border border-line bg-card p-8 text-center text-sm text-ink-3">
          Nenhum cluster cadastrado ainda.
        </div>
      ) : (
        <div className="divide-y divide-line-soft rounded-[10px] border border-line bg-card">
          {clusters.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink-2">{c.nome}</p>
                <p className="text-xs text-ink-3">
                  {c.leadTier ? `Tier ${c.leadTier}` : "Qualquer tier"}
                  {c.segmento ? ` · ${c.segmento}` : ""}
                  {c.subsegmento ? ` · ${c.subsegmento}` : ""}
                </p>
              </div>
              {temEscrita && (
                <button
                  type="button"
                  onClick={() => onDesativar(c.id)}
                  className="text-xs text-[#A12D24] hover:underline"
                >
                  Desativar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {temEscrita && (
        <div className="rounded-[10px] border border-line bg-card p-4">
          <h3 className="text-sm font-semibold text-ink">Novo cluster</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Nome do cluster"
              className="rounded-[6px] border border-line p-2 text-sm"
            />
            <select
              value={form.leadTier}
              onChange={(e) =>
                setForm((f) => ({ ...f, leadTier: e.target.value as LeadTier | "" }))
              }
              className="rounded-[6px] border border-line p-2 text-sm"
            >
              <option value="">Qualquer tier</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  Tier {t}
                </option>
              ))}
            </select>
            <input
              value={form.segmento}
              onChange={(e) => setForm((f) => ({ ...f, segmento: e.target.value }))}
              placeholder="Segmento (opcional)"
              className="rounded-[6px] border border-line p-2 text-sm"
            />
            <input
              value={form.subsegmento}
              onChange={(e) => setForm((f) => ({ ...f, subsegmento: e.target.value }))}
              placeholder="Subsegmento (opcional)"
              className="rounded-[6px] border border-line p-2 text-sm"
            />
          </div>
          {erro && (
            <div className="mt-2 rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-3 py-2 text-sm text-[#A12D24]">
              {erro}
            </div>
          )}
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="mt-3 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Criar cluster"}
          </button>
        </div>
      )}
    </div>
  );
}
