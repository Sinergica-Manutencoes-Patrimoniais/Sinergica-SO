import { useState } from "react";
import type { IgAutomationFormData, IgAutomationItem } from "../domain/automacao";
import type { CanalExternoItem } from "../domain/canais-externos";

export function IgCommentAutomationsTab({
  automacoes,
  canaisInstagram,
  temEscrita,
  onCriar,
  onDesativar,
}: {
  automacoes: IgAutomationItem[];
  canaisInstagram: CanalExternoItem[];
  temEscrita: boolean;
  onCriar: (form: IgAutomationFormData) => Promise<void>;
  onDesativar: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    canalId: canaisInstagram[0]?.id ?? "",
    nome: "",
    palavras: "",
    respostaDm: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onCriar({
        canalId: form.canalId,
        nome: form.nome,
        palavrasGatilho: form.palavras.split(","),
        respostaDm: form.respostaDm,
      });
      setForm((f) => ({ ...f, nome: "", palavras: "", respostaDm: "" }));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {automacoes.length === 0 ? (
        <div className="rounded-[10px] border border-line bg-card p-8 text-center text-sm text-ink-3">
          Nenhuma automação de comentário cadastrada ainda.
        </div>
      ) : (
        <div className="divide-y divide-line-soft rounded-[10px] border border-line bg-card">
          {automacoes.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink-2">{a.nome}</p>
                <p className="text-xs text-ink-3">Gatilhos: {a.palavrasGatilho.join(", ")}</p>
              </div>
              {temEscrita && (
                <button
                  type="button"
                  onClick={() => onDesativar(a.id)}
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
          <h3 className="text-sm font-semibold text-ink">Nova regra</h3>
          {canaisInstagram.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">
              Conecte uma conta na aba "Instagram" antes de criar regras.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <select
                value={form.canalId}
                onChange={(e) => setForm((f) => ({ ...f, canalId: e.target.value }))}
                className="w-full rounded-[6px] border border-line p-2 text-sm"
              >
                {canaisInstagram.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Nome da regra"
                className="w-full rounded-[6px] border border-line p-2 text-sm"
              />
              <input
                value={form.palavras}
                onChange={(e) => setForm((f) => ({ ...f, palavras: e.target.value }))}
                placeholder="Palavras-chave separadas por vírgula"
                className="w-full rounded-[6px] border border-line p-2 text-sm"
              />
              <textarea
                value={form.respostaDm}
                onChange={(e) => setForm((f) => ({ ...f, respostaDm: e.target.value }))}
                placeholder="Mensagem do Direct (use {{username}})"
                rows={2}
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
                {salvando ? "Salvando…" : "Criar regra"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
