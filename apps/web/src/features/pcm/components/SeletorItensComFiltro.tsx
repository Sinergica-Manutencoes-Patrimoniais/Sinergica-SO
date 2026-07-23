// SeletorItensComFiltro.tsx — E01-S86 AC-1: componente compartilhado (PCM + Visão 360, AC-2) — lista
// de itens com checkbox + filtro por nome em tempo real. Puramente controlado: quem usa decide o
// que fazer com a seleção (persistir tudo de uma vez, ver `salvarComposicaoSistema`).
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { filtrarItensPorNome } from "../domain/composicao-sistema";
import type { ItemComposicaoSistema } from "../domain/composicao-sistema";

export function SeletorItensComFiltro({
  itens,
  selecionadosIds,
  onToggle,
  disabled = false,
  placeholderFiltro = "Filtrar por nome…",
}: {
  itens: ItemComposicaoSistema[];
  selecionadosIds: Set<string>;
  onToggle: (id: string) => void;
  disabled?: boolean;
  placeholderFiltro?: string;
}) {
  const [filtro, setFiltro] = useState("");
  const itensFiltrados = useMemo(() => filtrarItensPorNome(itens, filtro), [itens, filtro]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
        <input
          type="text"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder={placeholderFiltro}
          className="input h-9 w-full pl-8 text-sm"
        />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-[6px] border border-line">
        {itensFiltrados.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-ink-3">Nenhum item encontrado.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {itensFiltrados.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-line-soft">
                  <input
                    type="checkbox"
                    checked={selecionadosIds.has(item.id)}
                    onChange={() => onToggle(item.id)}
                    disabled={disabled}
                    className="h-4 w-4 accent-orange"
                  />
                  <span className="truncate text-ink-2">{item.nome}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-ink-3">
        {selecionadosIds.size} selecionado{selecionadosIds.size === 1 ? "" : "s"}
      </p>
    </div>
  );
}
