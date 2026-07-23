// E01-S75 (AC-1): extraído de FerramentasPorTecnicoPage.tsx — mesmo render pra histórico de
// unidade (rastreio "quem ficou com FER-0003 quando quebrou") e histórico de técnico.
import type { MovimentacaoFerramentaItem } from "../domain/ferramenta-unidades";

const ROTULO_TIPO: Record<MovimentacaoFerramentaItem["tipo"], string> = {
  atribuicao: "Atribuição",
  devolucao: "Devolução",
  baixa: "Baixa",
};

export function HistoricoMovimentacoesModal({
  titulo,
  itens,
  onFechar,
}: {
  titulo: string;
  itens: MovimentacaoFerramentaItem[];
  onFechar: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">{titulo}</h3>
          <button type="button" onClick={onFechar} className="text-ink-3 hover:text-ink">
            fechar
          </button>
        </div>
        <div className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
          {itens.length === 0 ? (
            <p className="text-sm text-ink-3">Sem movimentações registradas.</p>
          ) : (
            itens.map((item) => (
              <div
                key={item.id}
                className="rounded-[6px] border border-line-soft bg-paper p-2.5 text-sm"
              >
                <p className="font-semibold text-ink-2">
                  {ROTULO_TIPO[item.tipo]} · {item.ferramentaNome} ({item.unidadeCodigo})
                  {item.funcionarioNome ? ` · ${item.funcionarioNome}` : ""}
                </p>
                <p className="text-xs text-ink-3">
                  {new Date(item.dataMovimento).toLocaleString("pt-BR")}
                  {item.condicao && item.condicao !== "ok" ? ` · ${item.condicao}` : ""}
                </p>
                {item.motivo && <p className="mt-1 text-xs text-ink-2">{item.motivo}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
