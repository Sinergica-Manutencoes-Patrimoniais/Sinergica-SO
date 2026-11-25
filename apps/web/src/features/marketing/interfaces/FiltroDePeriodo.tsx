/** Faixa de período dos relatórios do Marketing (E06-S01, AC-7).
 *
 * Atalhos cobrem quase todo uso real; "livre" existe para o caso em que alguém precisa comparar
 * exatamente a janela de uma veiculação. O estado é de UI pura — quem busca dado é o TanStack
 * Query lá na página, pela chave que contém as duas datas. */

import { Field, Input } from "@sinergica/ui";
import type { Periodo } from "../domain/periodo";
import { mesAtual, problemaDoPeriodo, ultimosDias } from "../domain/periodo";

export type AtalhoDePeriodo = "7" | "30" | "90" | "mes" | "livre";

export const ATALHOS: ReadonlyArray<{ id: AtalhoDePeriodo; rotulo: string }> = [
  { id: "7", rotulo: "7 dias" },
  { id: "30", rotulo: "30 dias" },
  { id: "90", rotulo: "90 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "livre", rotulo: "Escolher" },
];

export function periodoDoAtalho(atalho: AtalhoDePeriodo, atual: Periodo): Periodo {
  if (atalho === "mes") return mesAtual();
  if (atalho === "livre") return atual;
  return ultimosDias(Number(atalho));
}

interface FiltroDePeriodoProps {
  atalho: AtalhoDePeriodo;
  periodo: Periodo;
  onAtalho: (atalho: AtalhoDePeriodo) => void;
  onPeriodo: (periodo: Periodo) => void;
}

export function FiltroDePeriodo({ atalho, periodo, onAtalho, onPeriodo }: FiltroDePeriodoProps) {
  const problema = problemaDoPeriodo(periodo);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {ATALHOS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onAtalho(item.id)}
            aria-pressed={atalho === item.id}
            className={`rounded-md border px-2.5 py-1 text-caption font-medium transition-colors cursor-pointer ${
              atalho === item.id
                ? "border-orange bg-orange-soft text-orange-deep"
                : "border-line text-ink-3 hover:bg-line-soft hover:text-ink"
            }`}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      {atalho === "livre" && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="De">
            {(campo) => (
              <Input
                {...campo}
                type="date"
                value={periodo.de}
                onChange={(e) => onPeriodo({ ...periodo, de: e.target.value })}
              />
            )}
          </Field>
          <Field label="Até">
            {(campo) => (
              <Input
                {...campo}
                type="date"
                value={periodo.ate}
                onChange={(e) => onPeriodo({ ...periodo, ate: e.target.value })}
              />
            )}
          </Field>
        </div>
      )}

      {problema && (
        // Recusar aqui evita mandar a consulta e receber `22023` de volta — e dá uma frase em
        // vez de um código.
        <p role="alert" className="text-caption text-danger">
          {problema}
        </p>
      )}
    </div>
  );
}
