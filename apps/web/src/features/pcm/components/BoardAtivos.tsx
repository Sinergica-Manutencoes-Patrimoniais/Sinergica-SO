// E01-S78: Board de ativos por Local — aba "Board" da Visão do Cliente. Colunas = Locais nível-1
// da Área selecionada; sub-locais viram subgrupos; itens sem local vão pra coluna "Sem local".
// Clicar num card abre o drawer de detalhe. Leitura + navegação sobre o dado de E01-S76.
import { LayoutGrid, Package, Puzzle, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { carregarBoardCliente } from "../application/board-ativos";
import type { ColunaBoard, ItemCard } from "../domain/board-ativos";
import { montarColunasBoard } from "../domain/board-ativos";
import type { EquipamentoItem } from "../domain/equipamentos";
import type { Area, Local } from "../domain/hierarquia";
import { supabaseBoardAtivosAdapter } from "../infrastructure/supabase-board-ativos-adapter";
import { supabaseHierarquiaAdapter } from "../infrastructure/supabase-hierarquia-adapter";
import { DrawerDetalheAtivo } from "./DrawerDetalheAtivo";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; areas: Area[]; locais: Local[]; itens: EquipamentoItem[] };

export function BoardAtivos({
  clienteId,
  onIrParaEstrutura,
}: {
  clienteId: string;
  /** atalho pra aba "Estrutura" quando o cliente ainda não tem Áreas (AC-7). */
  onIrParaEstrutura?: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [areaId, setAreaId] = useState<string | null>(null);
  const [itemSelecionado, setItemSelecionado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setEstado({ fase: "carregando" });
    carregarBoardCliente(supabaseHierarquiaAdapter, supabaseBoardAtivosAdapter, clienteId)
      .then((d) => {
        if (!vivo) return;
        setEstado({ fase: "pronto", ...d });
        setAreaId((atual) => atual ?? d.areas[0]?.id ?? null);
      })
      .catch(() => {
        if (vivo) setEstado({ fase: "erro", mensagem: "Não foi possível carregar o board." });
      });
    return () => {
      vivo = false;
    };
  }, [clienteId]);

  const area = estado.fase === "pronto" ? estado.areas.find((a) => a.id === areaId) : undefined;

  const colunas = useMemo<ColunaBoard[]>(() => {
    if (estado.fase !== "pronto" || !area) return [];
    return montarColunasBoard(area, estado.locais, estado.itens);
  }, [estado, area]);

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando board...</div>;
  }
  if (estado.fase === "erro") {
    return <div className="p-8 text-center text-sm text-[#A23B25]">{estado.mensagem}</div>;
  }
  if (estado.areas.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-line bg-card px-5 py-10 text-center">
        <LayoutGrid className="mx-auto h-9 w-9 text-ink-3" />
        <p className="mt-3 text-sm text-ink-2">Este cliente ainda não tem Áreas cadastradas.</p>
        <p className="mt-1 text-xs text-ink-3">
          Crie Áreas e Locais na aba <strong>Estrutura</strong> para montar o board.
        </p>
        {onIrParaEstrutura && (
          <button
            type="button"
            onClick={onIrParaEstrutura}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
          >
            Ir para Estrutura
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-3">Área:</span>
        {estado.areas.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAreaId(a.id)}
            className={`h-8 rounded-[6px] border px-3 text-xs font-semibold ${
              a.id === areaId
                ? "border-orange bg-orange-soft text-orange-deep"
                : "border-line text-ink-2 hover:bg-line-soft"
            }`}
          >
            {a.nome}
          </button>
        ))}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {colunas.map((coluna) => (
          <ColunaLocal
            key={coluna.localId ?? "sem-local"}
            coluna={coluna}
            onAbrir={setItemSelecionado}
          />
        ))}
      </div>

      {itemSelecionado && (
        <DrawerDetalheAtivo itemId={itemSelecionado} onClose={() => setItemSelecionado(null)} />
      )}
    </div>
  );
}

function ColunaLocal({
  coluna,
  onAbrir,
}: {
  coluna: ColunaBoard;
  onAbrir: (itemId: string) => void;
}) {
  return (
    <section className="flex w-64 shrink-0 flex-col rounded-[8px] border border-line bg-card">
      <header className="flex items-center justify-between border-b border-line-soft px-3 py-2">
        <h4 className="truncate text-sm font-semibold text-ink">{coluna.localNome}</h4>
        <span className="shrink-0 rounded-full bg-line-soft px-2 py-0.5 text-[11px] font-semibold text-ink-3">
          {coluna.totalItens}
        </span>
      </header>
      <div className="flex flex-col gap-2 p-2">
        {coluna.itensDiretos.map((item) => (
          <CardAtivo key={item.id} item={item} onAbrir={onAbrir} />
        ))}
        {coluna.subgrupos.map((sg) => (
          <div key={sg.localId} className="flex flex-col gap-1">
            <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              {sg.localNome}
            </p>
            {sg.itens.map((item) => (
              <CardAtivo key={item.id} item={item} onAbrir={onAbrir} />
            ))}
          </div>
        ))}
        {coluna.totalItens === 0 && (
          <p className="px-1 py-3 text-center text-[11px] text-ink-3">Sem ativos</p>
        )}
      </div>
    </section>
  );
}

function CardAtivo({ item, onAbrir }: { item: ItemCard; onAbrir: (itemId: string) => void }) {
  const Icone = item.tipo === "componente" ? Puzzle : Wrench;
  return (
    <button
      type="button"
      onClick={() => onAbrir(item.id)}
      className={`flex items-center gap-2 rounded-[6px] border border-line px-2 py-1.5 text-left hover:border-orange hover:bg-orange-soft/40 ${
        item.ativo ? "" : "opacity-60"
      }`}
    >
      {item.urlImagem ? (
        <img
          src={item.urlImagem}
          alt=""
          className="h-8 w-8 shrink-0 rounded object-cover"
          loading="lazy"
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-line-soft">
          <Icone className="h-4 w-4 text-ink-3" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-ink">{item.nome}</span>
        <span className="flex items-center gap-1 text-[10px] text-ink-3">
          <Package className="h-3 w-3" />
          {item.tipo === "componente" ? "Componente" : "Equipamento"}
          {!item.ativo && " · inativo"}
        </span>
      </span>
    </button>
  );
}
