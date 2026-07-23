import { ClipboardList, Link2, User } from "lucide-react";
import { useEffect, useState } from "react";
import type { ClienteVinculoOpcao } from "../application/atendimento-gateway";
import type { ConversaItem } from "../domain/conversas";

export function ConversaPerfil({
  conversa,
  clientes,
  podeVincular,
  onVincular,
}: {
  conversa: ConversaItem | null;
  clientes: ClienteVinculoOpcao[];
  podeVincular: boolean;
  onVincular: (clienteId: string) => Promise<void>;
}) {
  const [clienteId, setClienteId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setClienteId(conversa?.clientId ?? "");
    setErro(null);
  }, [conversa?.clientId]);

  if (!conversa) {
    return null;
  }

  async function vincular() {
    if (!clienteId) return;
    try {
      setSalvando(true);
      setErro(null);
      await onVincular(clienteId);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível vincular o cliente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="hidden h-full flex-col gap-4 overflow-y-auto rounded-[8px] border border-line bg-card p-4 xl:flex">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <User className="h-4 w-4 text-ink-3" />
          {conversa.clienteNome ?? "Cliente não vinculado"}
        </div>
        {conversa.contatoNome && <p className="mt-1 text-xs text-ink-3">{conversa.contatoNome}</p>}
        {!conversa.clientId && (
          <p className="mt-2 rounded-[6px] border border-[#F4D28C] bg-[#FFF8E8] px-2 py-1.5 text-xs text-[#7A4D00]">
            Este contato ainda não está vinculado a um cliente cadastrado no PCM.
          </p>
        )}
        {podeVincular && (
          <div className="mt-3 space-y-2">
            <select
              aria-label="Cliente do CRM"
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
              className="input h-9 w-full text-xs"
            >
              <option value="">Selecione o cliente…</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!clienteId || salvando || clienteId === conversa.clientId}
              onClick={() => void vincular()}
              className="btn-secondary inline-flex h-8 w-full items-center justify-center gap-1.5 text-xs disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5" />
              {salvando ? "Vinculando…" : "Vincular ao CRM"}
            </button>
            {erro && <p className="text-xs text-[#A23B25]">{erro}</p>}
          </div>
        )}
      </div>

      {conversa.handoffMotivo && (
        <div className="rounded-[6px] border border-[#F4D28C] bg-[#FFF8E8] px-2.5 py-2">
          <p className="text-xs font-semibold text-[#7A4D00]">Aguardando atendimento humano</p>
          <p className="mt-1 text-xs text-[#7A4D00]">{conversa.handoffMotivo}</p>
        </div>
      )}

      {conversa.ordemServicoId && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
            Ordem de serviço
          </h4>
          <div className="mt-2 flex items-center gap-1.5 rounded-[6px] border border-line px-2.5 py-1.5 text-xs text-ink-2">
            <ClipboardList className="h-3.5 w-3.5" />
            OS vinculada a esta conversa
          </div>
        </div>
      )}

      {conversa.tags.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Tags</h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {conversa.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-line-soft px-2 py-0.5 text-[11px] text-ink-2"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
