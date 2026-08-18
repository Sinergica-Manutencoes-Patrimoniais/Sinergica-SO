// E01-S81 AC-1: Configurações > IA. Superadmin cadastra a credencial do OpenRouter (API key,
// write-only, nunca reexibida) e escolhe o modelo — mesmo padrão de `IntegracoesPage` (E00-S12).
import { KeyRound, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import {
  definirSegredoIntegracao,
  listarIntegracoes,
  salvarMetadadoIntegracao,
} from "../application/integracoes";
import type { Integracao } from "../application/integracoes-gateway";
import { supabaseIntegracoesAdapter } from "../infrastructure/supabase-integracoes-adapter";

const CHAVE_IA = "openrouter";
const MODELOS = [
  { value: "openai/gpt-4o-mini", label: "GPT-4o mini (OpenAI)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Google)" },
  { value: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku (Anthropic)" },
];

export function ConfigIaPage() {
  const { user } = useAuth();
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [modelo, setModelo] = useState(MODELOS[0]?.value ?? "openai/gpt-4o-mini");
  const [modeloImport, setModeloImport] = useState("google/gemini-2.5-flash");
  const [ativo, setAtivo] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await listarIntegracoes(supabaseIntegracoesAdapter);
      setIntegracoes(lista);
      const ia = lista.find((i) => i.chave === CHAVE_IA);
      if (ia) {
        setModelo(
          (ia.configPublico.modelo as string | undefined) ??
            MODELOS[0]?.value ??
            "openai/gpt-4o-mini",
        );
        setAtivo(ia.ativo);
        setModeloImport(
          (ia.configPublico.import_model as string | undefined) ?? "google/gemini-2.5-flash",
        );
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a configuração de IA.");
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
        <p className="mt-1 text-body text-ink-3">Só superadmin configura a IA.</p>
      </div>
    );
  }

  const iaIntegracao = integracoes.find((i) => i.chave === CHAVE_IA);

  async function salvarMetadado() {
    setSalvando(true);
    setErro(null);
    try {
      await salvarMetadadoIntegracao(supabaseIntegracoesAdapter, {
        chave: CHAVE_IA,
        provedor: "openrouter",
        ativo,
        configPublico: { modelo, import_model: modeloImport },
      });
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarChave() {
    if (!apiKey.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await definirSegredoIntegracao(supabaseIntegracoesAdapter, "openrouter_api_key", apiKey);
      setApiKey("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a chave.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-heading font-semibold text-ink">IA</h2>
        <p className="text-body text-ink-3">
          Credencial do OpenRouter usada pra gerar título de OS (E01-S81). A chave nunca é exibida
          de novo depois de salva. A mesma credencial classifica relatórios de inspeção importados.
        </p>
      </div>

      {erro && (
        <div className="rounded-md border border-danger-line bg-danger-soft px-4 py-2 text-body text-danger">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="p-8 text-center text-body text-ink-3">Carregando…</div>
      ) : (
        <section className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ink-3" />
              <h3 className="text-body font-semibold text-ink">OpenRouter</h3>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-micro font-semibold ${
                iaIntegracao?.temSegredo
                  ? "bg-success-soft text-success"
                  : "bg-line-soft text-ink-3"
              }`}
            >
              {iaIntegracao?.temSegredo ? "Chave configurada" : "Chave não configurada"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-caption font-semibold text-ink-3">Modelo</span>
              <select
                className="input w-full"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              >
                {MODELOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="h-4 w-4 accent-orange"
              />
              <span className="text-body text-ink-2">
                Ativo (habilita "Gerar título" no form de OS)
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-caption font-semibold text-ink-3">
                Modelo para importar inspeção
              </span>
              <select
                className="input w-full"
                value={modeloImport}
                onChange={(e) => setModeloImport(e.target.value)}
              >
                {MODELOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={salvarMetadado}
            disabled={salvando}
            className="mt-3 h-9 rounded-md bg-navy px-3 text-body font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
          >
            Salvar configurações
          </button>

          <div className="mt-5 border-t border-line-soft pt-4">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-caption font-semibold text-ink-3">
                <KeyRound className="h-3.5 w-3.5" />
                API key {iaIntegracao?.temSegredo && "(substituir)"}
              </span>
              <div className="flex gap-2">
                <input
                  type="password"
                  className="input flex-1"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    iaIntegracao?.temSegredo ? "•••••••• (já configurada)" : "sk-or-v1-xxxxxxxx"
                  }
                />
                <button
                  type="button"
                  onClick={salvarChave}
                  disabled={salvando || !apiKey.trim()}
                  className="h-9 shrink-0 rounded-md bg-orange px-3 text-body font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
                >
                  Salvar chave
                </button>
              </div>
            </label>
          </div>
        </section>
      )}
    </div>
  );
}
