import { Button, Skeleton } from "@sinergica/ui";
import {
  Boxes,
  Building2,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Network,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useArvoreAtivos } from "../application/ativos-cliente-queries";
import { type NoArvore, filtrarArvore } from "../domain/arvore-ativos";
import { supabaseEquipamentosAdapter } from "../infrastructure/supabase-equipamentos-adapter";
import { supabaseHierarquiaAdapter } from "../infrastructure/supabase-hierarquia-adapter";
import { supabaseSistemasAdapter } from "../infrastructure/supabase-sistemas-adapter";
import { DrawerDetalheAtivo } from "./DrawerDetalheAtivo";

export function ArvoreAtivos({
  clienteId,
  clienteNome,
}: { clienteId: string; clienteNome: string }) {
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set([clienteId]));
  const [itemId, setItemId] = useState<string | null>(null);
  const arvore = useArvoreAtivos({
    cliente: { id: clienteId, nome: clienteNome },
    hierarquia: supabaseHierarquiaAdapter,
    equipamentos: supabaseEquipamentosAdapter,
    sistemas: supabaseSistemasAdapter,
  });
  const filtrada = useMemo(
    () => (arvore.data ? filtrarArvore(arvore.data, busca) : undefined),
    [arvore.data, busca],
  );
  const buscaAtiva = busca.trim().length >= 2;
  const todosIds = coletarIds(filtrada);

  if (arvore.isLoading) return <Skeleton className="h-40 w-full" />;
  if (arvore.error || !filtrada)
    return (
      <div className="rounded-lg border border-danger-line bg-danger-soft px-5 py-6 text-body text-danger">
        {arvore.error instanceof Error ? arvore.error.message : "Nenhum ativo encontrado."}
        {arvore.error && (
          <Button size="sm" className="ml-3" onClick={() => void arvore.refetch()}>
            Tentar de novo
          </Button>
        )}
      </div>
    );
  return (
    <section className="rounded-lg border border-line bg-card">
      <div className="flex flex-col gap-3 border-b border-line-soft p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-body font-semibold text-ink">Árvore de ativos</h3>
          <p className="text-caption text-ink-3">Estrutura, Sistemas e Componentes</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setExpandidos(new Set(todosIds))}>
            Expandir tudo
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setExpandidos(new Set())}>
            Recolher tudo
          </Button>
        </div>
      </div>
      <div className="border-b border-line-soft p-3">
        <label htmlFor="busca-arvore-ativos" className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            id="busca-arvore-ativos"
            className="input w-full pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na árvore"
          />
        </label>
      </div>
      <div className="p-3">
        <NoLinha
          no={filtrada}
          nivel={0}
          expandidos={expandidos}
          buscaAtiva={buscaAtiva}
          onAlternar={(id) =>
            setExpandidos((atual) => {
              const proximo = new Set(atual);
              proximo.has(id) ? proximo.delete(id) : proximo.add(id);
              return proximo;
            })
          }
          onAbrir={setItemId}
        />
      </div>
      {itemId && (
        <DrawerDetalheAtivo
          itemId={itemId}
          onClose={() => setItemId(null)}
          onAtualizado={() => void arvore.refetch()}
        />
      )}
    </section>
  );
}

function NoLinha({
  no,
  nivel,
  expandidos,
  buscaAtiva,
  onAlternar,
  onAbrir,
}: {
  no: NoArvore;
  nivel: number;
  expandidos: Set<string>;
  buscaAtiva: boolean;
  onAlternar: (id: string) => void;
  onAbrir: (id: string) => void;
}) {
  const aberto = buscaAtiva || expandidos.has(no.id);
  const temFilhos = no.filhos.length > 0;
  const Icone =
    no.tipo === "cliente"
      ? Building2
      : no.tipo === "area" || no.tipo === "local"
        ? FolderTree
        : no.tipo === "sistema"
          ? Network
          : Boxes;
  const classe =
    no.tipo === "sistema"
      ? "border-warning-line bg-warning-soft"
      : no.tipo === "componente"
        ? "border-orange/30 bg-orange-soft"
        : "border-line bg-card";
  return (
    <div>
      {
        <button
          type="button"
          onClick={() =>
            no.tipo === "componente" ? onAbrir(no.id) : temFilhos ? onAlternar(no.id) : undefined
          }
          style={{ marginLeft: nivel * 20 }}
          className={`mb-1 flex w-[calc(100%-${nivel * 20}px)] items-center gap-2 rounded-md border px-2 py-1.5 text-left ${classe}`}
        >
          {temFilhos ? (
            aberto ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="w-4" />
          )}
          <Icone className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-caption font-semibold">{no.nome}</span>
          {no.identificador && <code className="text-micro text-ink-3">{no.identificador}</code>}
          {no.sigla && <span className="text-micro text-ink-3">· {no.sigla}</span>}
          {no.total > 0 && (
            <span className="rounded-full bg-line-soft px-1.5 text-micro">{no.total}</span>
          )}
        </button>
      }
      {no.posicaoDivergente && (
        <p style={{ marginLeft: nivel * 20 + 42 }} className="mb-1 text-micro text-ink-3">
          {no.posicaoDivergente}
        </p>
      )}
      {aberto &&
        no.filhos.map((filho) => (
          <NoLinha
            key={filho.id}
            no={filho}
            nivel={nivel + 1}
            expandidos={expandidos}
            buscaAtiva={buscaAtiva}
            onAlternar={onAlternar}
            onAbrir={onAbrir}
          />
        ))}
    </div>
  );
}

function coletarIds(no: NoArvore | null | undefined): string[] {
  return no ? [no.id, ...no.filhos.flatMap(coletarIds)] : [];
}
