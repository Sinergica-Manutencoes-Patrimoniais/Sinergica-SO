import { useState } from "react";
import { useEvidenciasOnda } from "../../application/evidencias-onda-queries";
import { conferirOnda, ONDAS_PILOTO, type EvidenciaCenario, type OndaPiloto } from "../../domain/migracao-programa";
import { RegistrarEvidenciaOnda } from "./RegistrarEvidenciaOnda";
import { DecisaoOnda } from "./DecisaoOnda";
import { HistoricoDecisoesOnda } from "./HistoricoDecisoesOnda";

export function EvidenciasOnda({ userId, clienteId }: { userId: string; clienteId: string }) {
  if (import.meta.env.VITE_SSO_EVIDENCIAS_ONDA_ENABLED !== "true") return null;
  return <Conteudo key={`${userId}:${clienteId}`} userId={userId} clienteId={clienteId} />;
}

function Conteudo({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [onda, setOnda] = useState(1);
  const consulta = useEvidenciasOnda(userId, clienteId, onda);
  const itens = consulta.data?.pages.flatMap((pagina) => pagina.itens) ?? [];
  return <section aria-label="Evidências declaradas por onda">
    <h3>Evidências declaradas por onda</h3>
    <p>Declarações não comprovam autenticidade dos artefatos, aceite ou liberação de produção.</p>
    <label>Onda <select value={onda} onChange={(evento) => setOnda(Number(evento.target.value))}>
      {ONDAS_PILOTO.map((item) => <option key={item.id} value={item.id}>{item.id} — {item.nome}</option>)}
    </select></label>
    <RegistrarEvidenciaOnda userId={userId} clienteId={clienteId} onda={onda}
      revision={!consulta.isFetching && !consulta.isError ? consulta.data?.pages[0]?.revision ?? null : null} />
    {consulta.isFetching && <output>Consultando evidências…</output>}
    {consulta.isError && <p role="alert">Evidências indisponíveis ou alteradas. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && (itens.length === 0
      ? <p>Nenhuma evidência declarada nesta onda.</p>
      : <ol>{itens.map((item) => <li key={item.id}>
        <strong>{item.cenario}</strong> · {item.resultado} · revisão {item.revision} · versão {item.versao} · ambiente {item.ambiente}
        <p>Executado em {item.executadoEm} por {item.executorId}.</p>
        <p>IDs: {item.identificadores.join(", ")} · Artefatos: {item.artefatos.join(", ")}</p>
        {item.ressalva && <p>Ressalva: {item.ressalva}</p>}
      </li>)}</ol>)}
    {consulta.hasNextPage && !consulta.isError && <button type="button" disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>Mais evidências</button>}
    {!consulta.isFetching && !consulta.isError && consulta.data && consulta.hasNextPage === false && <ConferenciaLocal
      key={`${userId}:${clienteId}:${onda}:${consulta.data.pages[0]?.revision ?? 0}`}
      clienteId={clienteId} onda={ONDAS_PILOTO.find((item) => item.id === onda)!}
      evidencias={itens.map((item) => ({ cenario: item.cenario, clienteId, versao: item.versao,
        ambiente: item.ambiente, executor: item.executorId, data: item.executadoEm,
        identificadores: item.identificadores, resultado: item.resultado, anexos: item.artefatos, ressalva: item.ressalva }))} />}
    {!consulta.isError && consulta.hasNextPage && <p>Carregue todas as páginas para conferir lacunas desta fotografia.</p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && consulta.hasNextPage === false && <DecisaoOnda
      userId={userId} clienteId={clienteId} onda={onda} revision={consulta.data.pages[0]!.revision} />}
    <HistoricoDecisoesOnda userId={userId} clienteId={clienteId} onda={onda} />
    {import.meta.env.VITE_SSO_MATRIZ_EVIDENCIAS_CLIENTE_ENABLED === "true" && <MatrizCliente userId={userId} clienteId={clienteId} />}
  </section>;
}

/** Consolidação por Cliente; não infere cobertura dos demais Clientes ou aceite. */
function MatrizCliente({ userId, clienteId }: { userId: string; clienteId: string }) {
  const q1 = useEvidenciasOnda(userId, clienteId, 1);
  const q2 = useEvidenciasOnda(userId, clienteId, 2);
  const q3 = useEvidenciasOnda(userId, clienteId, 3);
  const q4 = useEvidenciasOnda(userId, clienteId, 4);
  const q5 = useEvidenciasOnda(userId, clienteId, 5);
  const q6 = useEvidenciasOnda(userId, clienteId, 6);
  const consultas = [q1, q2, q3, q4, q5, q6];
  const [versao, setVersao] = useState("");
  const [ambiente, setAmbiente] = useState("");
  const carregando = consultas.some((q) => q.isFetching || q.isPending);
  const falhou = consultas.some((q) => q.isError);
  const faltamPaginas = consultas.some((q) => q.hasNextPage);
  const completa = !carregando && !falhou && !faltamPaginas && consultas.every((q) => Boolean(q.data));
  const evidencias: EvidenciaCenario[] = completa ? consultas.flatMap((q) => (q.data?.pages ?? []).flatMap((pagina) =>
    pagina.itens.map((item) => ({ cenario: item.cenario, clienteId, versao: item.versao, ambiente: item.ambiente,
      executor: item.executorId, data: item.executadoEm, identificadores: item.identificadores,
      resultado: item.resultado, anexos: item.artefatos, ressalva: item.ressalva })))) : [];
  const todosCenarios = Array.from({ length: 30 }, (_, indice) => `CT-${String(indice + 1).padStart(3, "0")}`);
  const resultado = conferirOnda({ id: 0, nome: "Matriz do Cliente", cenarios: todosCenarios, verificacoes: [] },
    { clienteId, versao: versao.trim(), ambiente: ambiente.trim() }, evidencias, []);
  return <section aria-label="Matriz declarada do Cliente">
    <h4>Matriz declarada do Cliente</h4>
    <p>Reúne as seis ondas deste Cliente, incluindo CT-030 transversal. Outros Clientes, CI, segurança, autenticidade e aceite formal exigem conferência separada.</p>
    <label>Versão <input maxLength={120} value={versao} onChange={(e) => setVersao(e.target.value)} /></label>
    <label>Ambiente <input maxLength={120} value={ambiente} onChange={(e) => setAmbiente(e.target.value)} /></label>
    {carregando && <output>Consultando evidências das ondas…</output>}
    {falhou && <p role="alert">Não foi possível conferir todas as ondas. <button type="button" onClick={() => void Promise.all(consultas.filter((q) => q.isError).map((q) => q.refetch()))}>Tentar novamente</button></p>}
    {!carregando && !falhou && faltamPaginas && <button type="button" onClick={() => void Promise.all(consultas.filter((q) => q.hasNextPage).map((q) => q.fetchNextPage()))}>Carregar próximas páginas das ondas</button>}
    {completa && (!versao.trim() || !ambiente.trim() ? <p>Informe versão e ambiente para comparar as declarações.</p> : <>
      <p>Sem declaração completa neste Cliente: {resultado.cenariosPendentes.length ? resultado.cenariosPendentes.join(", ") : "nenhum"}.</p>
      <p>Última declaração falha ou bloqueada: {resultado.cenariosComFalha.length ? resultado.cenariosComFalha.join(", ") : "nenhuma"}.</p>
      <p>{resultado.prontoParaRevisao ? "Sem lacunas nesta comparação local; não constitui homologação." : "Há lacunas nesta comparação local."}</p>
    </>)}
  </section>;
}

function ConferenciaLocal({ clienteId, onda, evidencias }: { clienteId: string; onda: OndaPiloto; evidencias: EvidenciaCenario[] }) {
  const [versao, setVersao] = useState("");
  const [ambiente, setAmbiente] = useState("");
  const [verificacoes, setVerificacoes] = useState<string[]>([]);
  const contexto = { clienteId, versao: versao.trim(), ambiente: ambiente.trim() };
  const resultado = conferirOnda(onda, contexto, evidencias, verificacoes);
  return <section aria-label="Pré-conferência da onda">
    <h4>Pré-conferência local</h4>
    <p>Baseada apenas nas declarações carregadas e marcações desta tela. Não valida artefatos, registra aceite, libera onda ou substitui CI e revisão de segurança. CT-030 é transversal e deve ser conferido separadamente.</p>
    <label>Versão avaliada <input maxLength={120} value={versao} onChange={(evento) => { setVersao(evento.target.value); setVerificacoes([]); }} /></label>
    <label>Ambiente avaliado <input maxLength={120} value={ambiente} onChange={(evento) => { setAmbiente(evento.target.value); setVerificacoes([]); }} /></label>
    <fieldset disabled={!contexto.versao || !contexto.ambiente}>
      <legend>Conferências declaradas somente nesta tela</legend>
      {onda.verificacoes.map((item) => <label key={item}><input type="checkbox" checked={verificacoes.includes(item)} onChange={(evento) => setVerificacoes((anteriores) => evento.target.checked ? [...anteriores, item] : anteriores.filter((valor) => valor !== item))} /> {item}</label>)}
    </fieldset>
    {!contexto.versao || !contexto.ambiente ? <p>Informe versão e ambiente para conferir os cenários.</p> : <>
      <p>Cenários sem declaração completa: {resultado.cenariosPendentes.length ? resultado.cenariosPendentes.join(", ") : "nenhum entre os vinculados à onda"}.</p>
      <p>Cenários com última declaração falha ou bloqueada: {resultado.cenariosComFalha.length ? resultado.cenariosComFalha.join(", ") : "nenhum entre os vinculados à onda"}.</p>
      <p>Conferências não marcadas: {resultado.verificacoesPendentes.length ? resultado.verificacoesPendentes.join("; ") : "nenhuma"}.</p>
      {onda.cenarios.length === 0 && <p>Esta onda ainda não tem cenários CT mapeados; a pré-conferência não pode indicar que está pronta.</p>}
      <p>{resultado.prontoParaRevisao ? "Sem lacunas nesta pré-conferência limitada; ainda exige revisão e aceite formais." : "Há lacunas nesta pré-conferência; não considerar a onda pronta."}</p>
    </>}
  </section>;
}
