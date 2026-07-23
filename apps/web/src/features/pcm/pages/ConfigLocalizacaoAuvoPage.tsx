// E01-S85 AC-1: Configurações > Localização Auvo. Superadmin ajusta separador/ordem da
// concatenação Área+Local+Sublocal enviada ao Auvo (o Auvo só entende um campo de texto plano).
import { MapPin } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import {
  obterPreferenciaLocalizacaoAuvo,
  salvarPreferenciaLocalizacaoAuvo,
} from "../application/localizacao-auvo";
import { PREFERENCIA_LOCALIZACAO_PADRAO, montarLocalizacaoAuvo } from "../domain/localizacao-auvo";
import type { PreferenciaLocalizacaoAuvo } from "../domain/localizacao-auvo";
import { supabaseLocalizacaoAuvoAdapter } from "../infrastructure/supabase-localizacao-auvo-adapter";

const EXEMPLO_AREA = "Torre A";
const EXEMPLO_LOCAIS = ["1º andar", "Sala 001"];

export function ConfigLocalizacaoAuvoPage() {
  const { user } = useAuth();
  const [preferencia, setPreferencia] = useState<PreferenciaLocalizacaoAuvo>(
    PREFERENCIA_LOCALIZACAO_PADRAO,
  );
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPreferencia(await obterPreferenciaLocalizacaoAuvo(supabaseLocalizacaoAuvoAdapter));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a preferência.");
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
        <p className="mt-1 text-sm text-ink-3">Só superadmin configura a localização Auvo.</p>
      </div>
    );
  }

  async function salvar() {
    if (!user?.id) return;
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    try {
      await salvarPreferenciaLocalizacaoAuvo(supabaseLocalizacaoAuvoAdapter, preferencia, user.id);
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a preferência.");
    } finally {
      setSalvando(false);
    }
  }

  const preview = montarLocalizacaoAuvo(EXEMPLO_AREA, EXEMPLO_LOCAIS, preferencia);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-ink">Localização Auvo</h2>
        <p className="text-sm text-ink-3">
          O Auvo não entende hierarquia — só um campo de texto. Aqui você define como Área, Local e
          Sublocal se concatenam nesse campo (E01-S85).
        </p>
      </div>

      {erro && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="rounded-[6px] border border-[#C7E8D2] bg-[#EAF8EF] px-4 py-2 text-sm text-[#267343]">
          Preferência salva.
        </div>
      )}

      {carregando ? (
        <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>
      ) : (
        <section className="rounded-[10px] border border-line bg-card p-4">
          <div className="flex items-center gap-2 border-b border-line-soft pb-3">
            <MapPin className="h-4 w-4 text-ink-3" />
            <h3 className="text-sm font-semibold text-ink">Separador e ordem</h3>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-3">Separador</span>
              <input
                type="text"
                className="input w-full"
                value={preferencia.separador}
                onChange={(e) => setPreferencia((p) => ({ ...p, separador: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-3">Ordem</span>
              <select
                className="input w-full"
                value={preferencia.ordem}
                onChange={(e) =>
                  setPreferencia((p) => ({
                    ...p,
                    ordem: e.target.value as PreferenciaLocalizacaoAuvo["ordem"],
                  }))
                }
              >
                <option value="area_primeiro">Área primeiro</option>
                <option value="area_por_ultimo">Área por último</option>
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-[6px] border border-line bg-paper px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
              Preview (Torre A · 1º andar · Sala 001)
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{preview || "—"}</p>
          </div>

          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !preferencia.separador.trim()}
            className="mt-3 h-9 rounded-[6px] bg-navy px-3 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
          >
            Salvar
          </button>
        </section>
      )}
    </div>
  );
}
