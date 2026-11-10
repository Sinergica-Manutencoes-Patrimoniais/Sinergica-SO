import { useEffect, useId, useRef, useState } from "react";
import { Composicoes } from "./Composicoes";
import { RankingUnificadoExperimental } from "./RankingUnificadoExperimental";
import { RetornosCicloExperimental } from "./RetornosCicloExperimental";
import { RetornosParciais } from "./RetornosParciais";
import { DetalheRetornoParcial } from "./DetalheRetornoParcial";

/** A fonte canônica permanece separada da listagem legada de OS. */
export function PainelLateralBacklog({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [aberto, setAberto] = useState(false); const botao = useRef<HTMLButtonElement>(null); const dialogo = useRef<HTMLDialogElement>(null);
  const [rankingAberto, setRankingAberto] = useState(false);
  const [retornosAbertos, setRetornosAbertos] = useState(false);
  const [parciaisAbertos, setParciaisAbertos] = useState(false);
  const [parcialSelecionado, setParcialSelecionado] = useState<string | null>(null);
  const tituloId = useId();
  useEffect(() => { if (aberto && dialogo.current && !dialogo.current.open) dialogo.current.showModal(); }, [aberto]);
  const limpar = () => { setRankingAberto(false); setRetornosAbertos(false); setParciaisAbertos(false); setParcialSelecionado(null); setAberto(false); botao.current?.focus(); };
  const fechar = () => { if (dialogo.current?.open) dialogo.current.close(); else limpar(); };
  return <><button ref={botao} type="button" onClick={() => setAberto(true)}>Abrir backlog de escopo</button>{aberto && <dialog ref={dialogo} aria-labelledby={tituloId} onCancel={(e) => { e.preventDefault(); fechar(); }} onClose={limpar} className="fixed inset-y-0 right-0 left-auto m-0 h-full w-full max-w-2xl overflow-y-auto border border-line bg-card p-5 backdrop:bg-black/45"><div className="flex items-center justify-between gap-3"><h2 id={tituloId}>Backlog de escopo do Cliente</h2><button type="button" onClick={fechar}>Fechar</button></div><p>A fonte de composições é separada das OS em aberto e não cria cards de Chamado ou OS.</p><Composicoes userId={userId} clienteId={clienteId} />
    {import.meta.env.VITE_SSO_RANKING_UNIFICADO_ENABLED === "true" && <section><button type="button" aria-expanded={rankingAberto} onClick={() => setRankingAberto(!rankingAberto)}>{rankingAberto ? "Fechar ranking experimental" : "Consultar ranking experimental"}</button>{rankingAberto && <RankingUnificadoExperimental userId={userId} clienteId={clienteId} onAbrirParcial={import.meta.env.VITE_SSO_DETALHE_RETORNO_PARCIAL_ENABLED === "true" || import.meta.env.VITE_SSO_FILA_RETORNO_PARCIAL_ENABLED === "true" ? (id) => { setParcialSelecionado(id); if (import.meta.env.VITE_SSO_DETALHE_RETORNO_PARCIAL_ENABLED !== "true") setParciaisAbertos(true); } : undefined} />}</section>}
    {import.meta.env.VITE_SSO_DETALHE_RETORNO_PARCIAL_ENABLED === "true" && parcialSelecionado && <DetalheRetornoParcial key={`${userId}:${clienteId}:${parcialSelecionado}`} userId={userId} clienteId={clienteId} retornoId={parcialSelecionado} />}
    {import.meta.env.VITE_SSO_RETORNO_CICLO_ENABLED === "true" && <section><button type="button" aria-expanded={retornosAbertos} onClick={() => setRetornosAbertos(!retornosAbertos)}>{retornosAbertos ? "Fechar retornos experimentais" : "Consultar retornos experimentais"}</button>{retornosAbertos && <RetornosCicloExperimental userId={userId} clienteId={clienteId} />}</section>}
    {import.meta.env.VITE_SSO_FILA_RETORNO_PARCIAL_ENABLED === "true" && <section><button type="button" aria-expanded={parciaisAbertos} onClick={() => setParciaisAbertos(!parciaisAbertos)}>{parciaisAbertos ? "Fechar retornos parciais" : "Consultar retornos parciais"}</button>{parciaisAbertos && <RetornosParciais userId={userId} clienteId={clienteId} destaqueId={parcialSelecionado} />}</section>}
  </dialog>}</>;
}
