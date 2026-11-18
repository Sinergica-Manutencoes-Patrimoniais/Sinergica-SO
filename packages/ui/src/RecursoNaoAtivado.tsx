import { Lock } from "lucide-react";

// E00-S28 AC-4/AC-5/AC-6 — substitui o `return null` silencioso de um recurso desligado por flag
// ou gate. 227 pontos do front faziam exatamente esse `return null` em 2026-11-17 (ver
// docs/Apontamentos/alcance-no-front-2026-11-17.md); o efeito era indistinguível de "não existe".
//
// `podeAdministrar` decide o nível de detalhe — nunca o contrário. Quem administra vê o que falta
// (flag, gate) para decidir a ativação; quem não administra só sabe que o recurso existe e ainda
// não foi ativado. Nome de flag, gate ou tabela NUNCA aparece para quem não administra — é
// superfície interna do sistema, não dado do cliente nem do síndico (AC-6).
export interface RecursoNaoAtivadoProps {
  /** Nome humano do recurso, ex.: "Criar OS neste Chamado". */
  recurso: string;
  /** O que falta para ativar — nome de flag, gate ou grant. Só é exibido quando `podeAdministrar`. */
  faltando?: readonly string[];
  podeAdministrar: boolean;
  /** Link para o runbook de ativação, quando existir. Só exibido a quem administra. */
  runbook?: string;
}

export function RecursoNaoAtivado({
  recurso,
  faltando,
  podeAdministrar,
  runbook,
}: RecursoNaoAtivadoProps) {
  return (
    <div
      data-recurso-nao-ativado={recurso}
      className="flex items-start gap-2.5 rounded-lg border border-dashed border-line bg-paper/60 px-3.5 py-3 text-body-sm text-ink-3"
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
      {podeAdministrar ? (
        <div className="flex flex-col gap-1">
          <p className="text-ink-2">
            <strong className="font-semibold">{recurso}</strong> existe e ainda não está ativado.
          </p>
          {faltando && faltando.length > 0 && (
            <ul className="list-disc pl-4 text-caption text-ink-3">
              {faltando.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {runbook && (
            <a
              href={runbook}
              className="text-caption text-accent underline"
              target="_blank"
              rel="noreferrer"
            >
              Procedimento de ativação
            </a>
          )}
        </div>
      ) : (
        <p>Este recurso existe e ainda não está disponível para a sua operação.</p>
      )}
    </div>
  );
}
