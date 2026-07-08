import { useState } from "react";
import type {
  CanalExternoItem,
  WaTemplateFormData,
  WaTemplateItem,
} from "../domain/canais-externos";

const CORES_STATUS: Record<WaTemplateItem["status"], string> = {
  approved: "bg-[#E7F5EC] text-[#1E8E45]",
  pending: "bg-[#FDF1DF] text-[#B26A00]",
  rejected: "bg-[#FFF4F2] text-[#A12D24]",
};

export function WaTemplatesTab({
  templates,
  canaisWa,
  temEscrita,
  onCriar,
  onEditar,
}: {
  templates: WaTemplateItem[];
  canaisWa: CanalExternoItem[];
  temEscrita: boolean;
  onCriar: (form: WaTemplateFormData) => Promise<void>;
  onEditar: (id: string, form: WaTemplateFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<WaTemplateFormData>({
    canalId: canaisWa[0]?.id ?? "",
    nome: "",
    idioma: "pt_BR",
    categoria: "utility",
    corpo: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (editandoId) await onEditar(editandoId, form);
      else await onCriar(form);
      setForm((f) => ({ ...f, nome: "", corpo: "" }));
      setEditandoId(null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {templates.length === 0 ? (
        <div className="rounded-[10px] border border-line bg-card p-8 text-center text-sm text-ink-3">
          Nenhum template cadastrado ainda.
        </div>
      ) : (
        <div className="divide-y divide-line-soft rounded-[10px] border border-line bg-card">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-2">
                  {t.nome} · {t.idioma}
                </p>
                <p className="truncate text-xs text-ink-3">{t.corpo}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-3">
                <span className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] text-ink-2">
                  {t.categoria}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CORES_STATUS[t.status]}`}
                >
                  {t.status}
                </span>
                {temEscrita && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditandoId(t.id);
                      setForm({
                        canalId: t.canalId,
                        nome: t.nome,
                        idioma: t.idioma,
                        categoria: t.categoria,
                        corpo: t.corpo,
                      });
                    }}
                    className="text-xs text-orange"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {temEscrita && (
        <div className="rounded-[10px] border border-line bg-card p-4">
          <h3 className="text-sm font-semibold text-ink">
            {editandoId ? "Editar template" : "Novo template"}
          </h3>
          {canaisWa.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">
              Conecte uma conta na aba "Meta WA" antes de criar templates.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.canalId}
                  onChange={(e) => setForm((f) => ({ ...f, canalId: e.target.value }))}
                  className="rounded-[6px] border border-line p-2 text-sm"
                >
                  {canaisWa.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={form.categoria}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      categoria: e.target.value as WaTemplateFormData["categoria"],
                    }))
                  }
                  className="rounded-[6px] border border-line p-2 text-sm"
                >
                  <option value="utility">Utility</option>
                  <option value="marketing">Marketing</option>
                  <option value="authentication">Authentication</option>
                </select>
              </div>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome do template"
                className="w-full rounded-[6px] border border-line p-2 text-sm"
              />
              <textarea
                value={form.corpo}
                onChange={(e) => setForm((f) => ({ ...f, corpo: e.target.value }))}
                placeholder="Corpo (use {{1}}, {{2}}… para variáveis)"
                rows={3}
                className="w-full rounded-[6px] border border-line p-2 text-sm"
              />
              {erro && (
                <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-3 py-2 text-sm text-[#A12D24]">
                  {erro}
                </div>
              )}
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
              >
                {salvando ? "Salvando…" : editandoId ? "Salvar template" : "Criar template"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
