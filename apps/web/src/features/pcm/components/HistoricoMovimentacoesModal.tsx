// E01-S75 (AC-1): extraído de FerramentasPorTecnicoPage.tsx — mesmo render pra histórico de
// unidade (rastreio "quem ficou com FER-0003 quando quebrou") e histórico de técnico.
import { Modal } from "@sinergica/ui";
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
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onFechar();
      }}
      titulo={titulo}
    >
      <div className="max-h-[70vh] space-y-2 overflow-y-auto">
        {itens.length === 0 ? (
          <p className="text-body text-ink-3">Sem movimentações registradas.</p>
        ) : (
          itens.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-line-soft bg-paper p-2.5 text-body"
            >
              <p className="font-semibold text-ink-2">
                {ROTULO_TIPO[item.tipo]} · {item.ferramentaNome} ({item.unidadeCodigo})
                {item.funcionarioNome ? ` · ${item.funcionarioNome}` : ""}
              </p>
              <p className="text-caption text-ink-3">
                {new Date(item.dataMovimento).toLocaleString("pt-BR")}
                {item.condicao && item.condicao !== "ok" ? ` · ${item.condicao}` : ""}
              </p>
              {item.motivo && <p className="mt-1 text-caption text-ink-2">{item.motivo}</p>}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
