// PainelSistemasCliente.tsx — E01-S86 AC-2: Visão 360 usa o MESMO componente de composição
// (checkbox+filtro) do PCM. Só compõe Sistemas já existentes — criar/editar o registro do Sistema
// continua em `SistemasPage.tsx` (fora de escopo desta story, ver spec.md).
import { Link2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { listarSistemas } from "../application/sistemas";
import { ComposicaoSistema } from "../components/ComposicaoSistema";
import type { Sistema } from "../domain/sistemas";
import { supabaseSistemasAdapter } from "../infrastructure/supabase-sistemas-adapter";

export function PainelSistemasCliente({
  clienteId,
  temEscrita,
  userId,
}: {
  clienteId: string;
  temEscrita: boolean;
  userId: string;
}) {
  const [sistemas, setSistemas] = useState<Sistema[] | "carregando">("carregando");
  const [sistemaAbertoId, setSistemaAbertoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setSistemas(await listarSistemas(supabaseSistemasAdapter, clienteId));
  }, [clienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (sistemas === "carregando") {
    return <p className="p-4 text-sm text-ink-3">Carregando sistemas…</p>;
  }

  if (sistemas.length === 0) {
    return (
      <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
        <Link2 className="mx-auto h-9 w-9 text-ink-3" />
        <p className="mt-3 text-sm text-ink-3">
          Nenhum Sistema cadastrado para este cliente. Cadastre em PCM → Configurações → Sistemas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sistemas.map((sistema) => (
        <section key={sistema.id} className="rounded-[8px] border border-line bg-card">
          <button
            type="button"
            onClick={() => setSistemaAbertoId(sistemaAbertoId === sistema.id ? null : sistema.id)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{sistema.nome}</p>
              {sistema.tipo && <p className="truncate text-xs text-ink-3">{sistema.tipo}</p>}
            </div>
            <span className="shrink-0 text-xs font-semibold text-orange">
              {sistemaAbertoId === sistema.id ? "Fechar" : "Compor itens"}
            </span>
          </button>
          {sistemaAbertoId === sistema.id && (
            <div className="border-t border-line-soft px-4 py-3">
              <ComposicaoSistema
                gateway={supabaseSistemasAdapter}
                sistema={sistema}
                temEscrita={temEscrita}
                userId={userId}
              />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
