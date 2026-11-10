import { useQuery } from "@tanstack/react-query";
import { supabaseChamadosOsEncerramentoAdapter } from "../../infrastructure/supabase-chamados-os-encerramento-adapter";

/** Não habilitar antes de contratos de escopo, concorrência e autorização estarem implementados. */
export function AvaliacaoEscopo({ habilitado, usuario, cliente, chamado, chamadoEsperado }: {
  habilitado?: string; usuario: string; cliente: string; chamado: string; chamadoEsperado: string;
}) {
  if (habilitado !== "true" || chamado !== chamadoEsperado) return null;
  return <Conteudo key={JSON.stringify([usuario, cliente, chamado])} usuario={usuario} cliente={cliente} chamado={chamado} />;
}

function Conteudo({ usuario, cliente, chamado }: { usuario: string; cliente: string; chamado: string }) {
  const consulta = useQuery({
    queryKey: ["chamado-escopo-avaliacao", usuario, cliente, chamado],
    queryFn: ({ signal }) => supabaseChamadosOsEncerramentoAdapter.avaliar(cliente, chamado, signal),
    enabled: Boolean(usuario && cliente && chamado), gcTime: 0, refetchOnWindowFocus: true,
  });
  return <section aria-label="Conferência de escopo do Chamado">
    <h3>Conferência de escopo</h3>
    {consulta.isFetching && <output>Conferindo escopo…</output>}
    {consulta.isError && !consulta.isFetching && <p role="alert">Não foi possível conferir o escopo. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <>
      <p>Composição {consulta.data.composicaoCompleta ? "declarada completa" : "não declarada completa"}; {consulta.data.parcelas} parcela(s), {consulta.data.parcelasPendentes} pendente(s).</p>
      <p>{consulta.data.ordens} OS, {consulta.data.ordensNaoFinalizadas} não finalizada(s); {consulta.data.continuacoesPendentes} continuidade(s) pendente(s).</p>
      <p>Conferência informativa; não autoriza nem executa encerramento.</p>
    </>}
  </section>;
}
