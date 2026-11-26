// DEF-30: um painel de detalhe (ex.: ChamadoPainel) pode reunir várias sub-telas, cada uma
// guardada pela sua própria flag/gate (E00-S28 AC-4/AC-5/AC-6 — ver `RecursoNaoAtivado`,
// packages/ui/src/RecursoNaoAtivado.tsx). Sem agrupamento, cada sub-tela desligada empilha seu
// próprio bloco: no detalhe do Chamado CH-3301 isso virou 6 avisos repetidos lado a lado.
//
// `RecursosNaoAtivadosGrupo` junta os registros das sub-telas num único bloco, sem alterar o
// componente `RecursoNaoAtivado` nem seu contrato: cada sub-tela continua decidindo sozinha se, e
// com qual detalhe (`faltando`, `podeAdministrar`), ela está desligada — só o *lugar* onde isso é
// desenhado muda. Fora de um grupo (outras telas que reusam as mesmas sub-telas, ex.:
// DiagnosticoCliente.tsx com CanonicalizarVinculoLegado), `useRecursoNaoAtivadoAgrupado` devolve
// `agrupado = false` e a sub-tela desenha seu próprio `RecursoNaoAtivado` como sempre fez.
import { RecursoNaoAtivado, type RecursoNaoAtivadoProps } from "@sinergica/ui";
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

interface GrupoContextValue {
  registrar: (id: string, info: RecursoNaoAtivadoProps) => void;
  remover: (id: string) => void;
}

const GrupoContext = createContext<GrupoContextValue | null>(null);

/** Envolve a região do painel onde várias sub-telas guardadas por flag podem aparecer. */
export function RecursosNaoAtivadosGrupo({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<Record<string, RecursoNaoAtivadoProps>>({});

  const value = useMemo<GrupoContextValue>(
    () => ({
      registrar: (id, info) => setItens((atual) => ({ ...atual, [id]: info })),
      remover: (id) =>
        setItens((atual) => {
          if (!(id in atual)) return atual;
          const { [id]: _removido, ...resto } = atual;
          return resto;
        }),
    }),
    [],
  );

  const lista = Object.values(itens);

  return (
    <GrupoContext.Provider value={value}>
      {children}
      {lista.length > 0 && (
        <div
          data-recursos-nao-ativados-grupo=""
          className="flex flex-col gap-2 border-t border-line-soft px-4 py-3"
        >
          <p className="text-micro font-semibold uppercase tracking-wider text-ink-3">
            {lista.length === 1
              ? "1 recurso deste painel ainda não está ativado"
              : `${lista.length} recursos deste painel ainda não estão ativados`}
          </p>
          {lista.map((info) => (
            <RecursoNaoAtivado key={info.recurso} {...info} />
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
  const ctx = useContext(GrupoContext);
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
