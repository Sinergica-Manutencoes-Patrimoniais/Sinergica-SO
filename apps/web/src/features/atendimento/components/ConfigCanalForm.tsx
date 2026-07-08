import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { ClienteOpcao } from "../application/config-gateway";
import type { ConfigCanalItem, ModoZe } from "../domain/config-canal";

const MODOS: { value: ModoZe; label: string }[] = [
  { value: "off", label: "Desligado" },
  { value: "monitor", label: "Monitorar (sem responder)" },
  { value: "active", label: "Ativo (Zé responde)" },
];

export function ConfigCanalForm({
  clientes,
  clienteSelecionadoId,
  onSelecionarCliente,
  configAtual,
  carregandoConfig,
  temEscrita,
  onSalvar,
}: {
  clientes: ClienteOpcao[];
  clienteSelecionadoId: string | null;
  onSelecionarCliente: (clientId: string) => void;
  configAtual: ConfigCanalItem | null;
  carregandoConfig: boolean;
  temEscrita: boolean;
  onSalvar: (form: { modo: ModoZe; groupJid: string; botJid: string }) => Promise<void>;
}) {
  const [modo, setModo] = useState<ModoZe>("off");
  const [groupJid, setGroupJid] = useState("");
  const [botJid, setBotJid] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    setModo(configAtual?.modo ?? "off");
    setGroupJid(configAtual?.groupJid ?? "");
    setBotJid(configAtual?.botJid ?? "");
    setSalvo(false);
    setErro(null);
  }, [configAtual]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      await onSalvar({ modo, groupJid, botJid });
      setSalvo(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a config.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-[10px] border border-line bg-card">
      <div className="border-b border-line-soft px-5 py-4">
        <h3 className="text-base font-semibold text-ink">Config do Zé por condomínio</h3>
        <p className="text-sm text-ink-3">
          Instância do WhatsApp (Evolution) e modo de operação do Agente Zé para cada cliente
        </p>
      </div>

      <form
        className="space-y-4 px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          void salvar();
        }}
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">Cliente</span>
          <select
            className="input mt-1"
            value={clienteSelecionadoId ?? ""}
            onChange={(event) => onSelecionarCliente(event.target.value)}
          >
            <option value="">Selecione um cliente…</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </label>

        {clienteSelecionadoId && !carregandoConfig && (
          <>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Modo
              </span>
              <select
                className="input mt-1"
                value={modo}
                onChange={(event) => setModo(event.target.value as ModoZe)}
                disabled={!temEscrita}
              >
                {MODOS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Group JID (WhatsApp)
              </span>
              <input
                className="input mt-1"
                value={groupJid}
                onChange={(event) => setGroupJid(event.target.value)}
                placeholder="ex.: 120363012345678901@g.us"
                disabled={!temEscrita}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                Bot JID (WhatsApp)
              </span>
              <input
                className="input mt-1"
                value={botJid}
                onChange={(event) => setBotJid(event.target.value)}
                placeholder="ex.: 5511999999999@s.whatsapp.net"
                disabled={!temEscrita}
              />
            </label>

            {erro && (
              <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
                {erro}
              </div>
            )}

            {temEscrita && (
              <div className="flex items-center gap-3 border-t border-line-soft pt-4">
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
                {salvo && (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1E8E45]">
                    <Check className="h-4 w-4" />
                    Salvo
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {clienteSelecionadoId && carregandoConfig && (
          <p className="text-sm text-ink-3">Carregando config…</p>
        )}
      </form>
    </section>
  );
}
