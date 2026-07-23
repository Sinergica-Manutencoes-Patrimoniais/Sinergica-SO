import { centavosParaReais } from "../../domain/dinheiro";

/** Não é gráfico — comparação previsto×realizado do mês corrente é melhor lida como par de
 * estatísticas com barra de proporção do que como chart (heurística "às vezes não é um gráfico"). */
export function PrevistoRealizadoCard({
  entradaPrevista,
  entradaRealizada,
  saidaPrevista,
  saidaRealizada,
}: {
  entradaPrevista: number;
  entradaRealizada: number;
  saidaPrevista: number;
  saidaRealizada: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Linha
        titulo="Entradas"
        previsto={entradaPrevista}
        realizado={entradaRealizada}
        cor="#1E8E45"
      />
      <Linha titulo="Saídas" previsto={saidaPrevista} realizado={saidaRealizada} cor="#A23B25" />
    </div>
  );
}

function Linha({
  titulo,
  previsto,
  realizado,
  cor,
}: { titulo: string; previsto: number; realizado: number; cor: string }) {
  const proporcao =
    previsto > 0 ? Math.min((realizado / previsto) * 100, 100) : realizado > 0 ? 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink-2">{titulo}</span>
        <span className="text-ink-3">
          R$ {centavosParaReais(realizado)} de R$ {centavosParaReais(previsto)} previstos
        </span>
      </div>
      <div className="mt-1 h-2.5 w-full rounded-full bg-line-soft">
        <div
          className="h-2.5 rounded-full"
          style={{ width: `${proporcao}%`, backgroundColor: cor }}
        />
      </div>
    </div>
  );
}
