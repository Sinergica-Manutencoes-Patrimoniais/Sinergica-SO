import { Copy, KeyRound, Plus, RefreshCw, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { supabaseUrl } from "../../../lib/supabase-client";
import {
  definirSegredoIntegracao,
  listarIntegracoes,
  salvarMetadadoIntegracao,
} from "../../config/application/integracoes";
import type { Integracao } from "../../config/application/integracoes-gateway";
import { supabaseIntegracoesAdapter } from "../../config/infrastructure/supabase-integracoes-adapter";
import type {
  EvolutionAcaoResultado,
  EvolutionCriarForm,
  EvolutionInstancia,
} from "../domain/evolution";

const CORES_STATUS: Record<EvolutionInstancia["status"], string> = {
  conectado: "bg-[#E7F5EC] text-[#1E8E45]",
  desconectado: "bg-line-soft text-ink-3",
  erro: "bg-[#FFF4F2] text-[#A12D24]",
};

const CHAVE_EVOLUTION = "evolution";

function ConfiguracaoEvolution({ temEscrita }: { temEscrita: boolean }) {
  const { user } = useAuth();
  const [integracao, setIntegracao] = useState<Integracao | null>(null);
  const [url, setUrl] = useState("");
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const webhookUrl = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/pcm-whatsapp-webhook`;

  const carregar = useCallback(async () => {
    const item = (await listarIntegracoes(supabaseIntegracoesAdapter)).find(
      (candidata) => candidata.chave === CHAVE_EVOLUTION,
    );
    setIntegracao(item ?? null);
    setUrl(typeof item?.configPublico.api_url === "string" ? item.configPublico.api_url : "");
  }, []);

  useEffect(() => {
    if (user?.papel === "superadmin") void carregar().catch(() => undefined);
  }, [carregar, user?.papel]);

  if (user?.papel !== "superadmin") return null;

  async function salvar() {
    setErro(null);
    let apiUrl: string;
    try {
      apiUrl = new URL(url.trim()).toString().replace(/\/+$/, "");
    } catch {
      setErro("Informe uma URL válida da Evolution, incluindo https://.");
      return;
    }
    setSalvando(true);
    try {
      await salvarMetadadoIntegracao(supabaseIntegracoesAdapter, {
        chave: CHAVE_EVOLUTION,
        provedor: "evolution",
        ativo: true,
        configPublico: { api_url: apiUrl },
      });
      if (chave.trim()) {
        await definirSegredoIntegracao(supabaseIntegracoesAdapter, "evolution_api_key", chave);
        setChave("");
      }
      await carregar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível salvar a configuração.");
    } finally {
      setSalvando(false);
    }
  }

  async function copiarWebhook() {
    try {
      await navigator.clipboard.writeText(webhookUrl);
    } catch {
      setErro("Não foi possível copiar o endereço do webhook.");
    }
  }

  return (
    <section className="rounded-[10px] border border-line bg-card p-4">
      <h3 className="text-sm font-semibold text-ink">API Evolution</h3>
      <p className="mt-1 text-xs text-ink-3">
        URL e chave são usadas para criar e administrar instâncias. A chave vai ao Vault e nunca
        volta para esta tela.
      </p>
      {erro ? <p className="mt-3 text-sm text-[#A12D24]">{erro}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-3">URL de conexão</span>
          <input
            className="input w-full"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://api.evolution.exemplo"
            disabled={!temEscrita}
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink-3">
            <KeyRound className="h-3.5 w-3.5" />
            Chave {integracao?.temSegredo ? "(substituir)" : ""}
          </span>
          <input
            type="password"
            className="input w-full"
            value={chave}
            onChange={(event) => setChave(event.target.value)}
            placeholder={integracao?.temSegredo ? "•••••••• (configurada)" : "Chave da Evolution"}
            disabled={!temEscrita}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => void salvar()}
        disabled={!temEscrita || salvando || !url.trim()}
        className="mt-3 btn-primary"
      >
        {salvando ? "Salvando…" : "Salvar API"}
      </button>
      <div className="mt-4 border-t border-line-soft pt-3">
        <p className="text-xs font-semibold text-ink-3">Webhook do SO</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="break-all rounded bg-paper px-2 py-1 text-xs text-ink">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => void copiarWebhook()}
            className="btn-secondary text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </button>
        </div>
      </div>
    </section>
  );
}

export function EvolutionTab({
  instancias,
  temEscrita,
  onAtualizar,
  onCriar,
  onConectar,
  onSincronizarWebhook,
  onDesconectar,
}: {
  instancias: EvolutionInstancia[];
  temEscrita: boolean;
  onAtualizar: () => Promise<void>;
  onCriar: (form: EvolutionCriarForm) => Promise<EvolutionAcaoResultado>;
  onConectar: (id: string) => Promise<EvolutionAcaoResultado>;
  onSincronizarWebhook: (id: string) => Promise<void>;
  onDesconectar: (id: string) => Promise<void>;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState<EvolutionCriarForm>({ label: "", instanceName: "" });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(id: string, acao: () => Promise<EvolutionAcaoResultado | undefined>) {
    setProcessando(id);
    setErro(null);
    try {
      const resultado = await acao();
      if (resultado?.qrCode) setQrCode(resultado.qrCode);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao acessar a Evolution API.");
    } finally {
      setProcessando(null);
    }
  }

  async function criar() {
    await executar("nova", async () => {
      const resultado = await onCriar(form);
      setForm({ label: "", instanceName: "" });
      setMostrarForm(false);
      return resultado;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ConfiguracaoEvolution temEscrita={temEscrita} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-2">Conexões Evolution</h2>
          <p className="text-sm text-ink-3">
            Crie a instância, leia o QR no WhatsApp e acompanhe a conexão real.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              executar("atualizar", async () => {
                await onAtualizar();
                return undefined;
              })
            }
            disabled={processando !== null}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar status
          </button>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setMostrarForm((valor) => !valor)}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-navy px-3 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
            >
              <Plus className="h-4 w-4" /> Nova instância
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-3 py-2 text-sm text-[#A12D24]">
          {erro}
        </div>
      )}

      {mostrarForm && (
        <div className="grid gap-3 rounded-[10px] border border-line bg-card p-4 sm:grid-cols-2">
          <input
            value={form.label}
            onChange={(event) => setForm((atual) => ({ ...atual, label: event.target.value }))}
            placeholder="Nome, ex.: Atendimento"
            className="rounded-[6px] border border-line p-2 text-sm"
          />
          <input
            value={form.instanceName}
            onChange={(event) =>
              setForm((atual) => ({ ...atual, instanceName: event.target.value }))
            }
            placeholder="Instance ID, ex.: sinergica_atendimento"
            className="rounded-[6px] border border-line p-2 text-sm"
          />
          <button
            type="button"
            onClick={criar}
            disabled={processando !== null}
            className="w-fit rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {processando === "nova" ? "Criando…" : "Criar e exibir QR"}
          </button>
        </div>
      )}

      {qrCode && (
        <div className="rounded-[10px] border border-line bg-card p-4 text-center">
          <p className="mb-3 text-sm font-semibold text-ink-2">Leia este QR no WhatsApp</p>
          {qrCode.startsWith("data:image") ? (
            <img src={qrCode} alt="QR Code da instância Evolution" className="mx-auto h-64 w-64" />
          ) : (
            <pre className="overflow-auto whitespace-pre-wrap break-all text-xs">{qrCode}</pre>
          )}
          <button
            type="button"
            onClick={() => setQrCode(null)}
            className="mt-3 text-xs font-semibold text-orange"
          >
            Fechar QR
          </button>
        </div>
      )}

      {instancias.length === 0 ? (
        <div className="rounded-[10px] border border-line bg-card p-8 text-center text-sm text-ink-3">
          Nenhuma instância Evolution cadastrada.
        </div>
      ) : (
        <div className="divide-y divide-line-soft rounded-[10px] border border-line bg-card">
          {instancias.map((instancia) => (
            <div
              key={instancia.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ink-2">{instancia.label}</p>
                <p className="text-xs text-ink-3">
                  {instancia.instanceName} · {instancia.numeroVinculado ?? "sem número vinculado"}
                </p>
                <p
                  className={`mt-1 text-[11px] ${
                    instancia.webhookRegistrado ? "text-[#1E8E45]" : "text-[#A12D24]"
                  }`}
                >
                  {instancia.webhookRegistrado
                    ? "Webhook de mensagens registrado"
                    : "Webhook pendente — reconecte a instância"}
                </p>
                {instancia.erro && <p className="mt-1 text-xs text-[#A12D24]">{instancia.erro}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CORES_STATUS[instancia.status]}`}
                >
                  {instancia.status}
                </span>
                {temEscrita && instancia.status !== "conectado" && (
                  <button
                    type="button"
                    onClick={() => executar(instancia.id, () => onConectar(instancia.id))}
                    disabled={processando !== null}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange disabled:opacity-60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reconectar
                  </button>
                )}
                {temEscrita && !instancia.webhookRegistrado && (
                  <button
                    type="button"
                    onClick={() =>
                      executar(instancia.id, async () => {
                        await onSincronizarWebhook(instancia.id);
                        return undefined;
                      })
                    }
                    disabled={processando !== null}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-orange disabled:opacity-60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Registrar webhook
                  </button>
                )}
                {temEscrita && instancia.status === "conectado" && (
                  <button
                    type="button"
                    onClick={() =>
                      executar(instancia.id, async () => {
                        await onDesconectar(instancia.id);
                        return undefined;
                      })
                    }
                    disabled={processando !== null}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#A12D24] disabled:opacity-60"
                  >
                    <Unplug className="h-3.5 w-3.5" /> Desconectar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-3">
        O vínculo desta instância com uma persona continua na aba Agentes; groupJid e botJid
        continuam na aba Canal.
      </p>
    </div>
  );
}
