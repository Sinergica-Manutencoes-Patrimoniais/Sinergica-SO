import { useDecisoesOnda } from "../../application/decisoes-onda-queries";

export function HistoricoDecisoesOnda({ userId, clienteId, onda }: { userId: string; clienteId: string; onda: number }) {
  if (import.meta.env.VITE_SSO_DECISAO_ONDA_ENABLED !== "true") return null;
  return <Conteudo key={`${userId}:${clienteId}:${onda}`} userId={userId} clienteId={clienteId} onda={onda} />;
}
function Conteudo({ userId, clienteId, onda }: { userId: string; clienteId: string; onda: number }) {
  const consulta = useDecisoesOnda(userId, clienteId, onda);
  const paginas = consulta.data?.pages ?? [];
  const itens = paginas.flatMap((p) => p.itens);
  const atual = paginas[0]?.revisionAtual;
  const revisoesDiferentes = paginas.some((p) => p.revisionAtual !== atual);
  return <section aria-label="Histórico de decisões da onda">
    <h4>Decisões declaradas</h4>
    <p>Histórico informativo, não libera operação. A paginação não é uma fotografia única; decisões podem chegar durante a consulta.</p>
    {consulta.isFetching && <p>Consultando decisões…</p>}
    {consulta.isError && <p role="alert">Histórico indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && revisoesDiferentes && <p role="alert">Evidências mudaram entre páginas. Recarregue para conferir.</p>}
    {!consulta.isFetching && !consulta.isError && !revisoesDiferentes && consulta.data && (itens.length === 0 ? <p>Nenhuma decisão declarada nesta onda.</p> : <ol>
      {itens.map((item) => <li key={item.id}>
        <p>Decisão {item.id} · {item.criadoEm} · responsável {item.atorId}.</p>
        <p>Versão {item.versao} · ambiente {item.ambiente} · revisão {item.revision} {item.revision !== atual ? "(fotografia anterior)" : "(mesma revisão observada)"}.</p>
        <p>Cenários declarados: {item.evidencias.length ? item.evidencias.map((e) => `${e.cenario} (${e.id})`).join(", ") : "nenhum vinculado diretamente"}.</p>
        <ul>{Object.entries(item.referencias).map(([nome, valor]) => <li key={nome}>{nome}: {valor}</li>)}</ul>
        {item.ressalva && <p>Ressalva: {item.ressalva}</p>}
      </li>)}
    </ol>)}
    {consulta.hasNextPage && !consulta.isError && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais decisões</button>}
  </section>;
}
