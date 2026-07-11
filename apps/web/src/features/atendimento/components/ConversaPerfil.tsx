import { ClipboardList, User } from "lucide-react";
import type { ConversaItem } from "../domain/conversas";

export function ConversaPerfil({ conversa }: { conversa: ConversaItem | null }) {
  if (!conversa) {
    return null;
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
      </div>

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
