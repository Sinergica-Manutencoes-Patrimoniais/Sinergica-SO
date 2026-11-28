import { Lock } from "lucide-react";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

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

export function RecursoNaoAtivado(info: RecursoNaoAtivadoProps) {
  const agrupado = useRegistrarRecurso(info, true);
  return agrupado ? null : <CartaoRecurso {...info} />;
}

function CartaoRecurso({ recurso, faltando, podeAdministrar, runbook }: RecursoNaoAtivadoProps) {
  return (
    <div
      data-recurso-nao-ativado={recurso}
      className="flex items-start gap-2.5 rounded-lg border border-dashed border-line bg-paper/60 px-3.5 py-3 text-body-sm text-ink-3"
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
      {podeAdministrar ? (
        <DetalhesRecurso recurso={recurso} faltando={faltando} runbook={runbook} />
      ) : (
        <p>Este recurso existe e ainda não está disponível para a sua operação.</p>
      )}
    </div>
  );
}

function DetalhesRecurso({
  recurso,
  faltando,
  runbook,
}: Omit<RecursoNaoAtivadoProps, "podeAdministrar">) {
  return (
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
  );
}

interface GrupoContextValue {
  compacto: boolean;
  registrar: (id: string, info: RecursoNaoAtivadoProps) => void;
  remover: (id: string) => void;
}

const GrupoContext = createContext<GrupoContextValue | null>(null);

/** Envolve a região do painel onde várias sub-telas guardadas por flag podem aparecer. */
export function RecursosNaoAtivadosGrupo({
  children,
  compacto = false,
}: { children: ReactNode; compacto?: boolean }) {
  const [itens, setItens] = useState<Record<string, RecursoNaoAtivadoProps>>({});

  const value = useMemo<GrupoContextValue>(
    () => ({
      compacto,
      registrar: (id, info) => setItens((atual) => ({ ...atual, [id]: info })),
      remover: (id) =>
        setItens((atual) => {
          if (!(id in atual)) return atual;
          const { [id]: _removido, ...resto } = atual;
          return resto;
        }),
    }),
    [compacto],
  );

  const lista = Object.entries(itens);
  const administraveis = lista.filter(([, info]) => info.podeAdministrar);
  const titulo =
    lista.length === 1
      ? "1 recurso deste painel ainda não está ativado"
      : `${lista.length} recursos deste painel ainda não estão ativados`;

  return (
    <GrupoContext.Provider value={value}>
      {compacto && lista.length > 0 && (
        <div
          data-recursos-nao-ativados-grupo=""
          className="rounded-lg border border-dashed border-line bg-paper/60 px-3.5 py-3 text-body-sm text-ink-3"
        >
          <p className="flex items-start gap-2.5">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {titulo}.
          </p>
          {administraveis.length > 0 && (
            <details className="mt-2 pl-6">
              <summary className="cursor-pointer font-semibold text-ink-2">
                Detalhes de ativação
              </summary>
              <ul className="mt-2 space-y-2">
                {administraveis.map(([id, info]) => (
                  <li key={id}>
                    <DetalhesRecurso {...info} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {children}
      {!compacto && lista.length > 0 && (
        <div
          data-recursos-nao-ativados-grupo=""
          className="flex flex-col gap-2 border-t border-line-soft px-4 py-3"
        >
          <p className="text-micro font-semibold uppercase tracking-wider text-ink-3">{titulo}</p>
          {lista.map(([id, info]) => (
            <CartaoRecurso key={id} {...info} />
          ))}
        </div>
      )}
    </GrupoContext.Provider>
  );
}

/**
 * Sub-tela chama com `info` (as mesmas props que passaria pra `RecursoNaoAtivado`) quando sua
 * flag está desligada, ou `null` quando está ligada (ou fora de contexto, ex.: chamado diferente
 * do esperado). Devolve `true` quando existe um `RecursosNaoAtivadosGrupo` acima — nesse caso o
 * grupo desenha o aviso e a sub-tela deve retornar `null`. Devolve `false` fora de um grupo — a
 * sub-tela desenha seu próprio `RecursoNaoAtivado`, igual a antes.
 */
export function useRecursoNaoAtivadoAgrupado(info: RecursoNaoAtivadoProps | null): boolean {
  return useRegistrarRecurso(info, false);
}

function useRegistrarRecurso(
  info: RecursoNaoAtivadoProps | null,
  apenasCompacto: boolean,
): boolean {
  const grupo = useContext(GrupoContext);
  const ctx = apenasCompacto && !grupo?.compacto ? null : grupo;
  const id = useId();
  // Chave estável por conteúdo: evita registrar/remover a cada render só porque o chamador cria
  // um novo objeto `info` (literal inline) com o mesmo conteúdo. O objeto em si fica numa ref,
  // para o efeito depender da chave e não da identidade do literal.
  const chave = info
    ? `${info.recurso}|${info.podeAdministrar}|${(info.faltando ?? []).join(",")}|${info.runbook ?? ""}`
    : null;
  const infoAtual = useRef(info);
  infoAtual.current = info;

  useEffect(() => {
    if (!ctx) return;
    const registro = chave === null ? null : infoAtual.current;
    if (!registro) {
      ctx.remover(id);
      return undefined;
    }
    ctx.registrar(id, registro);
    return () => ctx.remover(id);
  }, [ctx, id, chave]);

  return ctx !== null;
}
