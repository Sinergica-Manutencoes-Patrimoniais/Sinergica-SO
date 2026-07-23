import { Plus, RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";
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
