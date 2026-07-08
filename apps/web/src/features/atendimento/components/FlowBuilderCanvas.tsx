import {
  Background,
  type Connection,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  type OnNodesChange,
  Position,
  ReactFlow,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { PassoFluxo } from "../domain/fluxos";

interface PassoNodeData extends Record<string, unknown> {
  passo: PassoFluxo;
  readOnly: boolean;
  onEditar: (id: string, patch: Partial<PassoFluxo>) => void;
  onExcluir: (id: string) => void;
}

function PassoNode({ data }: NodeProps<Node<PassoNodeData>>) {
  const { passo, readOnly, onEditar, onExcluir } = data;
  return (
    <div className="w-64 rounded-[8px] border border-line bg-card p-3 shadow-sm">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center justify-between gap-2">
        <input
          className="input text-sm font-semibold"
          value={passo.campo}
          placeholder="nome_do_campo"
          disabled={readOnly}
          onChange={(event) => onEditar(passo.id, { campo: event.target.value })}
        />
        {!readOnly && (
          <button
            type="button"
            onClick={() => onExcluir(passo.id)}
            className="shrink-0 rounded-[6px] p-1.5 text-ink-3 hover:bg-line-soft hover:text-[#A12D24]"
            title="Excluir passo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <textarea
        className="input mt-2 min-h-[60px] text-sm"
        value={passo.pergunta}
        placeholder="Pergunta que o agente faz…"
        disabled={readOnly}
        onChange={(event) => onEditar(passo.id, { pergunta: event.target.value })}
      />
      <select
        className="input mt-2 text-xs"
        value={passo.tipo ?? "pergunta"}
        disabled={readOnly}
        onChange={(event) =>
          onEditar(passo.id, { tipo: event.target.value as "pergunta" | "decisao" })
        }
      >
        <option value="pergunta">Pergunta</option>
        <option value="decisao">Decisão/condição</option>
      </select>
      {(passo.tipo ?? "pergunta") === "decisao" && (
        <input
          className="input mt-2 text-xs"
          value={passo.condicao ?? ""}
          placeholder="Condição desta saída"
          disabled={readOnly}
          onChange={(event) => onEditar(passo.id, { condicao: event.target.value })}
        />
      )}
      <label className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
        <input
          type="checkbox"
          checked={passo.obrigatorio}
          disabled={readOnly}
          onChange={(event) => onEditar(passo.id, { obrigatorio: event.target.checked })}
        />
        Obrigatório
      </label>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const NODE_TYPES = { passo: PassoNode };

export function FlowBuilderCanvas({
  passos,
  readOnly,
  onChange,
}: {
  passos: PassoFluxo[];
  readOnly: boolean;
  onChange: (passos: PassoFluxo[]) => void;
}) {
  const editarPasso = useCallback(
    (id: string, patch: Partial<PassoFluxo>) => {
      onChange(passos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [passos, onChange],
  );

  const excluirPasso = useCallback(
    (id: string) => {
      onChange(
        passos
          .filter((p) => p.id !== id)
          .map((p, index) => ({
            ...p,
            ordem: index,
            proximoIds: (p.proximoIds ?? []).filter((destino) => destino !== id),
          })),
      );
    },
    [passos, onChange],
  );

  const nodes: Node<PassoNodeData>[] = useMemo(
    () =>
      [...passos]
        .sort((a, b) => a.ordem - b.ordem)
        .map((passo) => ({
          id: passo.id,
          type: "passo",
          position: { x: passo.x, y: passo.y },
          data: { passo, readOnly, onEditar: editarPasso, onExcluir: excluirPasso },
        })),
    [passos, readOnly, editarPasso, excluirPasso],
  );

  const edges: Edge[] = useMemo(() => {
    const ordenados = [...passos].sort((a, b) => a.ordem - b.ordem);
    const explicitas = ordenados.flatMap((passo) =>
      (passo.proximoIds ?? []).map((destino) => ({
        id: `${passo.id}-${destino}`,
        source: passo.id,
        target: destino,
      })),
    );
    if (explicitas.length > 0) return explicitas;
    const pares: Edge[] = [];
    for (let i = 1; i < ordenados.length; i++) {
      const anterior = ordenados[i - 1];
      const atual = ordenados[i];
      if (!anterior || !atual) continue;
      pares.push({ id: `${anterior.id}-${atual.id}`, source: anterior.id, target: atual.id });
    }
    return pares;
  }, [passos]);

  const conectar = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target)
        return;
      onChange(
        passos.map((passo) =>
          passo.id === connection.source
            ? {
                ...passo,
                proximoIds: [
                  ...new Set([...(passo.proximoIds ?? []), connection.target as string]),
                ],
              }
            : passo,
        ),
      );
    },
    [passos, onChange],
  );
  const excluirArestas = useCallback(
    (removidas: Edge[]) => {
      const ids = new Set(removidas.map((aresta) => `${aresta.source}:${aresta.target}`));
      onChange(
        passos.map((passo) => ({
          ...passo,
          proximoIds: (passo.proximoIds ?? []).filter(
            (destino) => !ids.has(`${passo.id}:${destino}`),
          ),
        })),
      );
    },
    [passos, onChange],
  );

  const onNodesChange: OnNodesChange<Node<PassoNodeData>> = useCallback(
    (changes) => {
      const proximos = applyNodeChanges(changes, nodes);
      const posicoesMudaram = changes.some((change) => change.type === "position");
      if (!posicoesMudaram) return;
      onChange(
        passos.map((passo) => {
          const node = proximos.find((n) => n.id === passo.id);
          return node ? { ...passo, x: node.position.x, y: node.position.y } : passo;
        }),
      );
    },
    [nodes, passos, onChange],
  );

  return (
    <div className="h-[500px] rounded-[10px] border border-line bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onConnect={readOnly ? undefined : conectar}
        onEdgesDelete={readOnly ? undefined : excluirArestas}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        fitView
      >
        <Background />
      </ReactFlow>
    </div>
  );
}
