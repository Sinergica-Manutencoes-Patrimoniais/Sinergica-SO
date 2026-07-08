import { MessageCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { canalSuportaIa, filtrarConversas, labelCanal } from "../domain/conversas";
import type { ConversaItem } from "../domain/conversas";

export function ConversaLista({
  conversas,
  conversaSelecionadaId,
  onSelecionar,
}: {
  conversas: ConversaItem[];
  conversaSelecionadaId: string | null;
  onSelecionar: (conversa: ConversaItem) => void;
}) {
  const [busca, setBusca] = useState("");
  const conversasFiltradas = useMemo(
    () => filtrarConversas(conversas, { busca }),
    [conversas, busca],
  );

  return (
    <div className="flex h-full flex-col rounded-[8px] border border-line bg-card">
      <div className="border-b border-line p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar conversa"
            className="input w-full"
            style={{ paddingLeft: "2rem" }}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversasFiltradas.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-ink-3" />
            <p className="mt-2 text-sm text-ink-3">Nenhuma conversa encontrada.</p>
          </div>
        ) : (
          conversasFiltradas.map((conversa) => (
            <button
              key={conversa.id}
              type="button"
              onClick={() => onSelecionar(conversa)}
              className={`flex w-full flex-col gap-1 border-b border-line-soft px-3 py-3 text-left hover:bg-line-soft ${
                conversa.id === conversaSelecionadaId ? "bg-orange-soft/40" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">
                  {conversa.clienteNome ?? conversa.contatoNome ?? "Contato sem nome"}
                </span>
                {conversa.naoLidas > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1.5 text-[11px] font-semibold text-white">
                    {conversa.naoLidas}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-ink-3">
                {conversa.ultimaMensagemPreview ?? "sem mensagens"}
              </p>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#EFF1F4] px-2 py-0.5 text-[10px] font-semibold text-[#5A6175]">
                  {labelCanal(conversa.canal)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    !canalSuportaIa(conversa.canal)
                      ? "bg-[#EEF2FF] text-[#4056A1]"
                      : conversa.modo === "pausado"
                        ? "bg-[#FDF1DF] text-[#B26A00]"
                        : "bg-[#E7F6EC] text-[#1E8E45]"
                  }`}
                >
                  {!canalSuportaIa(conversa.canal)
                    ? "Humano"
                    : conversa.modo === "pausado"
                      ? "Assumida"
                      : "Zé ativo"}
                </span>
                {!conversa.clienteNome && (
                  <span className="rounded-full bg-[#EFF1F4] px-2 py-0.5 text-[10px] font-semibold text-[#5A6175]">
                    Sem cliente vinculado
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
