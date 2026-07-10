import { Info } from "lucide-react";

/** E01-S46: avisa nas telas cujo `writeEnabled` do descriptor Auvo ainda é `false` — sem isso, uma
 * edição que não reflete no Auvo parece bug silencioso (feedback real do Lucas, 2026-07-09).
 * `writeEnabled` é decisão consciente da E01-S36/S47 (mapeamento de escrita ainda não confirmado
 * contra a API real pra essa entidade), não descuido. */
export function BannerEscritaAuvoPendente({ entidade }: { entidade: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[6px] border border-[#F0D4B0] bg-orange-soft px-3 py-2 text-sm text-[#7A3F00]">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Alterações em {entidade} aqui gravam só no PCM. Sincronização automática de volta pro Auvo
        ainda não está habilitada pra esta entidade (mapeamento de escrita em verificação) — a
        próxima importação do Auvo pode sobrescrever o que for editado só aqui.
      </p>
    </div>
  );
}
