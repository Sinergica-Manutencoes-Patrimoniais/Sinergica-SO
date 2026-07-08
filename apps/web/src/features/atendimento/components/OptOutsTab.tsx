import { useState } from "react";
import type { CanalOptOut, OptOutFormData, OptOutItem } from "../domain/automacao";

const LABEL_CANAL: Record<OptOutItem["canal"], string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  todos: "Todos os canais",
};

export function OptOutsTab({
  optOuts,
  temEscrita,
  onRemover,
  onCriar,
}: {
  optOuts: OptOutItem[];
  temEscrita: boolean;
  onRemover: (id: string) => Promise<void>;
  onCriar: (form: OptOutFormData) => Promise<void>;
}) {
  const [contatoId, setContatoId] = useState("");
  const [canal, setCanal] = useState<CanalOptOut>("todos");
  const [motivo, setMotivo] = useState("");
  return (
    <div className="rounded-[10px] border border-line bg-card">
      <div className="border-b border-line-soft px-5 py-3">
        <h3 className="text-sm font-semibold text-ink">Opt-outs</h3>
        <p className="mt-0.5 text-xs text-ink-3">
          Contatos que pediram para não receber mensagens.
        </p>
      </div>
      {temEscrita && (
        <div className="grid gap-2 border-b border-line-soft p-4 sm:grid-cols-[1fr_140px_1fr_auto]">
          <input
            value={contatoId}
            onChange={(e) => setContatoId(e.target.value)}
            placeholder="ID do contato"
            className="input text-sm"
          />
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value as CanalOptOut)}
            className="input text-sm"
          >
            {Object.entries(LABEL_CANAL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            className="input text-sm"
          />
          <button
            type="button"
            onClick={async () => {
              await onCriar({ contatoId, canal, motivo });
              setContatoId("");
              setMotivo("");
            }}
            className="rounded bg-navy px-3 text-sm font-semibold text-white"
          >
            Adicionar
          </button>
        </div>
      )}
      {optOuts.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-3">Nenhum opt-out registrado.</p>
      ) : (
        <div className="divide-y divide-line-soft">
          {optOuts.map((o) => (
            <div key={o.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-ink-2">{o.contatoNome ?? o.contatoId}</p>
                <p className="text-xs text-ink-3">
                  {LABEL_CANAL[o.canal]}
                  {o.motivo ? ` · ${o.motivo}` : ""}
                </p>
              </div>
              {temEscrita && (
                <button
                  type="button"
                  onClick={() => onRemover(o.id)}
                  className="text-xs text-[#A12D24] hover:underline"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
