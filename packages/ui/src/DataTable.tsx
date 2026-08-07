import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "./Card";
import { Skeleton } from "./Skeleton";

export interface DataTableColumn<T> {
  chave: string;
  cabecalho: ReactNode;
  render: (item: T) => ReactNode;
  numerica?: boolean;
  ordenavel?: boolean;
  larguraMin?: string;
}

export interface DataTableOrdenacao {
  coluna: string;
  direcao: "asc" | "desc";
}

export interface DataTableProps<T> {
  colunas: DataTableColumn<T>[];
  itens: T[];
  chaveLinha: (item: T) => string;
  carregando?: boolean;
  linhasCarregando?: number;
  vazio: ReactNode;
  onClickLinha?: (item: T) => void;
  ordenacao?: DataTableOrdenacao;
  onOrdenar?: (coluna: string) => void;
}

// E00-S15 AC-5 — substitui as 13 tabelas manuais: header sticky, scroll horizontal contido no
// wrapper (nunca no body da página), zebra, `tabular-nums` à direita pra número, vazio e
// carregando embutidos (E00-S17 AC-1: linhas fantasma na largura real da coluna, não spinner).
export function DataTable<T>({
  colunas,
  itens,
  chaveLinha,
  carregando,
  linhasCarregando = 5,
  vazio,
  onClickLinha,
  ordenacao,
  onOrdenar,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-paper text-[11px] text-ink-3">
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.chave}
                scope="col"
                style={coluna.larguraMin ? { minWidth: coluna.larguraMin } : undefined}
                className={`px-2 py-2 font-semibold ${coluna.numerica ? "text-right" : "text-left"}`}
              >
                {coluna.ordenavel && onOrdenar ? (
                  <button
                    type="button"
                    onClick={() => onOrdenar(coluna.chave)}
                    className="inline-flex items-center gap-1 hover:text-ink"
                    aria-sort={
                      ordenacao?.coluna === coluna.chave
                        ? ordenacao.direcao === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    {coluna.cabecalho}
                    {ordenacao?.coluna === coluna.chave &&
                      (ordenacao.direcao === "asc" ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      ))}
                  </button>
                ) : (
                  coluna.cabecalho
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {carregando
            ? Array.from({ length: linhasCarregando }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: linha fantasma, sem identidade real
                <tr key={i} className="border-b border-line-soft">
                  {colunas.map((coluna) => (
                    <td key={coluna.chave} className="px-2 py-2.5">
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))
            : itens.map((item, i) => (
                <tr
                  key={chaveLinha(item)}
                  onClick={onClickLinha ? () => onClickLinha(item) : undefined}
                  onKeyDown={
                    onClickLinha
                      ? (evento) => {
                          if (evento.key === "Enter" || evento.key === " ") {
                            evento.preventDefault();
                            onClickLinha(item);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onClickLinha ? 0 : undefined}
                  role={onClickLinha ? "button" : undefined}
                  className={`border-b border-line-soft ${i % 2 === 1 ? "bg-paper/40" : ""} ${
                    onClickLinha
                      ? "cursor-pointer hover:bg-line-soft focus-visible:outline-2 focus-visible:outline-orange/75 focus-visible:-outline-offset-2"
                      : ""
                  }`}
                >
                  {colunas.map((coluna) => (
                    <td
                      key={coluna.chave}
                      className={`px-2 py-2 ${coluna.numerica ? "text-right tabular-nums" : ""}`}
                    >
                      {coluna.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!carregando && itens.length === 0 && (
        <div className="py-2">
          <EmptyState titulo={vazio} />
        </div>
      )}
    </div>
  );
}
