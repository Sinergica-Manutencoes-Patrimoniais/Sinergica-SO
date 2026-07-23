// PainelItensDoCliente.tsx — E01-S76: dentro da aba "Ativos" da Visão 360, lista os Itens
// editáveis do PCM (`pcm.equipamentos`) deste cliente e permite atribuir Local direto daqui —
// sem precisar ir pra tela global "Equipamentos" e procurar o item lá. Complementa
// `PainelEquipamentos` (cache Auvo, só leitura, fonte de dado diferente).
import { Boxes, FolderTree, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { editarEquipamento, listarEquipamentos } from "../application/equipamentos";
import type { EquipamentoItem } from "../domain/equipamentos";
import { montarArvore } from "../domain/hierarquia";
import type { LocalArvoreNode } from "../domain/hierarquia";
import { supabaseEquipamentosAdapter } from "../infrastructure/supabase-equipamentos-adapter";
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

export function PainelItensDoCliente({
  clienteId,
  temEscrita,
  userId,
}: {
  clienteId: string;
  temEscrita: boolean;
  userId: string;
}) {
  const [carregando, setCarregando] = useState(true);
  const [itens, setItens] = useState<EquipamentoItem[]>([]);
  const [locaisAchatados, setLocaisAchatados] = useState<
    Array<{ local: LocalArvoreNode; profundidade: number }>
  >([]);
  const [erroLinha, setErroLinha] = useState<Record<string, string>>({});
  const [salvandoLinha, setSalvandoLinha] = useState<Record<string, boolean>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [todos, locais] = await Promise.all([
        listarEquipamentos(supabaseEquipamentosAdapter),
        supabaseHierarquiaAdapter.listarLocaisDoCliente(clienteId),
      ]);
      setItens(todos.filter((item) => item.clientId === clienteId));
      setLocaisAchatados(flattenArvore(montarArvore(locais)));
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atribuirLocal(item: EquipamentoItem, localId: string) {
    setErroLinha((atual) => ({ ...atual, [item.id]: "" }));
    setSalvandoLinha((atual) => ({ ...atual, [item.id]: true }));
    try {
      await editarEquipamento(supabaseEquipamentosAdapter, {
        nome: item.nome,
        identificador: item.identificador,
        categoria: item.categoria,
        clientId: item.clientId,
        localizacao: item.localizacao,
        observacoes: item.observacoes,
        tipo: item.tipo,
        localId: localId || null,
        parentItemId: item.parentItemId,
        id: item.id,
        userId,
      });
      await carregar();
    } catch (e) {
      setErroLinha((atual) => ({
        ...atual,
        [item.id]: e instanceof Error ? e.message : "Não foi possível atribuir o Local.",
      }));
    } finally {
      setSalvandoLinha((atual) => ({ ...atual, [item.id]: false }));
    }
  }

  if (carregando) {
    return (
      <div className="bg-card rounded-[10px] border border-line px-5 py-8 text-center text-sm text-ink-3">
        Carregando…
      </div>
    );
  }

  return (
    <div className="bg-card rounded-[10px] border border-line">
      <div className="border-b border-line-soft px-5 py-4">
        <h3 className="text-sm font-semibold text-ink">Itens PCM (estrutura)</h3>
        <p className="mt-0.5 text-xs text-ink-3">
          Cadastro editável — atribua o Local (Área&gt;Local) de cada Item deste cliente
        </p>
      </div>

      {itens.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Wrench className="mx-auto h-8 w-8 text-ink-3" />
          <p className="mt-2 text-sm text-ink-3">Nenhum Item PCM cadastrado para este cliente.</p>
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {itens.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {item.tipo === "componente" ? (
                  <Boxes className="h-4 w-4 shrink-0 text-ink-3" />
                ) : (
                  <Wrench className="h-4 w-4 shrink-0 text-ink-3" />
                )}
                <span className="truncate text-sm text-ink">{item.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <FolderTree className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                {temEscrita ? (
                  <select
                    value={item.localId ?? ""}
                    onChange={(e) => atribuirLocal(item, e.target.value)}
                    disabled={salvandoLinha[item.id]}
                    className="input h-8 w-56 text-xs"
                    aria-label={`Local de ${item.nome}`}
                  >
                    <option value="">Sem Local</option>
                    {locaisAchatados.map(({ local, profundidade }) => (
                      <option key={local.id} value={local.id}>
                        {"— ".repeat(profundidade)}
                        {local.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-ink-3">
                    {locaisAchatados.find((l) => l.local.id === item.localId)?.local.nome ??
                      "Sem Local"}
                  </span>
                )}
              </div>
              {erroLinha[item.id] && (
                <span className="text-xs text-[#A23B25]">{erroLinha[item.id]}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
