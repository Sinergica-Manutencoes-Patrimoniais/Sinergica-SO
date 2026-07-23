// E01-S82 AC-2: Configurações > Priorização. Superadmin ajusta os pesos G/U/T/D usados no cálculo
// do score GUTD do backlog — sempre em runtime (nunca persistido na OS, ver `hub-os.ts`).
import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { obterPesosGutdConfig, salvarPesosGutd } from "../application/priorizacao-gutd";
import { PESOS_GUTD_PADRAO, type PesosGutd } from "../domain/priorizacao-backlog";
import { supabasePriorizacaoGutdAdapter } from "../infrastructure/supabase-priorizacao-gutd-adapter";

const CAMPOS: Array<{ key: keyof PesosGutd; label: string }> = [
  { key: "gravidade", label: "Gravidade" },
  { key: "urgencia", label: "Urgência" },
  { key: "tendencia", label: "Tendência" },
  { key: "dorCliente", label: "Dor do cliente" },
];

export function ConfigPriorizacaoPage() {
  const { user } = useAuth();
  const [pesos, setPesos] = useState<PesosGutd>(PESOS_GUTD_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPesos(await obterPesosGutdConfig(supabasePriorizacaoGutdAdapter));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os pesos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (user?.papel === "superadmin") void carregar();
  }, [user, carregar]);

  if (user?.papel !== "superadmin") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Só superadmin configura a priorização.</p>
      </div>
    );
  }

  const soma = pesos.gravidade + pesos.urgencia + pesos.tendencia + pesos.dorCliente;

  async function salvar() {
    if (!user?.id) return;
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    try {
      await salvarPesosGutd(supabasePriorizacaoGutdAdapter, pesos, user.id);
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar os pesos.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-ink">Priorização (GUTD)</h2>
        <p className="text-sm text-ink-3">
          Peso de cada fator no score do backlog PCM. A soma precisa fechar em 100%. Nunca é gravado
          na OS — recalculado em runtime a cada carregamento do backlog.
        </p>
      </div>

      {erro && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="rounded-[6px] border border-[#C7E8D2] bg-[#EAF8EF] px-4 py-2 text-sm text-[#267343]">
          Pesos salvos.
        </div>
      )}

      {carregando ? (
        <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>
      ) : (
        <section className="rounded-[10px] border border-line bg-card p-4">
          <div className="flex items-center gap-2 border-b border-line-soft pb-3">
            <SlidersHorizontal className="h-4 w-4 text-ink-3" />
            <h3 className="text-sm font-semibold text-ink">Pesos (%)</h3>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
            {CAMPOS.map((campo) => (
              <label key={campo.key} className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-3">{campo.label}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input w-full"
                  value={pesos[campo.key]}
                  onChange={(e) => setPesos((p) => ({ ...p, [campo.key]: Number(e.target.value) }))}
                />
              </label>
            ))}
          </div>

          <p
            className={`mt-3 text-xs font-semibold ${soma === 100 ? "text-ink-3" : "text-[#A12D24]"}`}
          >
            Soma atual: {soma}% {soma !== 100 && "(precisa somar 100%)"}
          </p>

          <button
            type="button"
            onClick={salvar}
            disabled={salvando || soma !== 100}
            className="mt-3 h-9 rounded-[6px] bg-navy px-3 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
          >
            Salvar pesos
          </button>
        </section>
      )}
    </div>
  );
}
