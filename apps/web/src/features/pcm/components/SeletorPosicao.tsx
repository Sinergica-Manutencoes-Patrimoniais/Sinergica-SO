// SeletorPosicao.tsx — E01-S155: Componente e Sistema podem ficar em Cliente, Área ou Local.
// Escolher um Local trava e preenche a Área dele (a Área é sempre derivada do Local, tanto aqui
// quanto no banco — trigger `fn_equipamentos_normalizar_posicao`/`fn_sistemas_normalizar_posicao`).
import { useMemo } from "react";
import { useAreasDoCliente, useLocaisDoCliente } from "../application/ativos-cliente-queries";
import type { LocalArvoreNode } from "../domain/hierarquia";
import { montarArvore } from "../domain/hierarquia";
import { supabaseHierarquiaAdapter } from "../infrastructure/supabase-hierarquia-adapter";

function flattenArvore(
  nodes: LocalArvoreNode[],
  profundidade = 0,
): Array<{ local: LocalArvoreNode; profundidade: number }> {
  return nodes.flatMap((node) => [
    { local: node, profundidade },
    ...flattenArvore(node.filhos, profundidade + 1),
  ]);
}

export interface Posicao {
  areaId: string | null;
  localId: string | null;
}

export function SeletorPosicao({
  clienteId,
  areaId,
  localId,
  onChange,
  disabled = false,
}: {
  clienteId: string | null;
  areaId: string | null;
  localId: string | null;
  onChange: (posicao: Posicao) => void;
  disabled?: boolean;
}) {
  const areasQuery = useAreasDoCliente(supabaseHierarquiaAdapter, clienteId);
  const locaisQuery = useLocaisDoCliente(supabaseHierarquiaAdapter, clienteId);
  const areas = areasQuery.data ?? [];
  const locaisDoCliente = locaisQuery.data ?? [];

  // Sem Área escolhida: lista todos os Locais do cliente (cada Área forma sua própria subárvore,
  // já que Local.parentId nunca aponta pra Local de outra Área).
  const locaisFiltrados = useMemo(() => {
    const base = areaId ? locaisDoCliente.filter((l) => l.areaId === areaId) : locaisDoCliente;
    return flattenArvore(montarArvore(base));
  }, [locaisDoCliente, areaId]);

  const localTravaArea = Boolean(localId);

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-caption font-semibold text-ink-3">Área</span>
        <select
          value={areaId ?? ""}
          onChange={(event) => onChange({ areaId: event.target.value || null, localId: null })}
          className="input w-full"
          disabled={disabled || !clienteId || localTravaArea}
        >
          <option value="">Sem Área</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-caption font-semibold text-ink-3">Local</span>
        <select
          value={localId ?? ""}
          onChange={(event) => {
            const novoLocalId = event.target.value || null;
            if (!novoLocalId) {
              onChange({ areaId, localId: null });
              return;
            }
            const local = locaisDoCliente.find((l) => l.id === novoLocalId);
            onChange({ areaId: local?.areaId ?? areaId, localId: novoLocalId });
          }}
          className="input w-full"
          disabled={disabled || !clienteId}
        >
          <option value="">Sem Local</option>
          {locaisFiltrados.map(({ local, profundidade }) => (
            <option key={local.id} value={local.id}>
              {"— ".repeat(profundidade)}
              {local.nome}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
