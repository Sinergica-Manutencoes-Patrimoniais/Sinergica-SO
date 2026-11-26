import { RecursoNaoAtivado } from "@sinergica/ui";
import { useQuery } from "@tanstack/react-query";
import { FLAGS_SSO, flagLigada } from "../../../../config/flags-sso";
import { useRecursoNaoAtivadoAgrupado } from "../../components/recursos-nao-ativados-grupo";
import { supabaseChamadosOsEncerramentoAdapter } from "../../infrastructure/supabase-chamados-os-encerramento-adapter";

const FLAG = "VITE_SSO_ESCOPO_CHAMADO_ENABLED" as const;

/** Não habilitar antes de contratos de escopo, concorrência e autorização estarem implementados. */
export function AvaliacaoEscopo({
  usuario,
  cliente,
  chamado,
  chamadoEsperado,
  podeAdministrar,
}: {
  usuario: string;
  cliente: string;
  chamado: string;
  chamadoEsperado: string;
  podeAdministrar: boolean;
}) {
  const correspondeChamado = chamado === chamadoEsperado;
  const flagDesligada = !flagLigada(FLAG);
  const agrupado = useRecursoNaoAtivadoAgrupado(
    correspondeChamado && flagDesligada
      ? {
          recurso: "Conferência de escopo do Chamado",
          podeAdministrar,
          faltando: [FLAG, FLAGS_SSO.find((f) => f.nome === FLAG)?.gate].filter((v): v is string =>
            Boolean(v),
          ),
        }
      : null,
  );
  if (!correspondeChamado) return null;
  if (flagDesligada) {
    return agrupado ? null : (
      <RecursoNaoAtivado
        recurso="Conferência de escopo do Chamado"
        podeAdministrar={podeAdministrar}
        faltando={[FLAG, FLAGS_SSO.find((f) => f.nome === FLAG)?.gate].filter((v): v is string =>
          Boolean(v),
        )}
      />
    );
  }
  return (
    <Conteudo
      key={JSON.stringify([usuario, cliente, chamado])}
      usuario={usuario}
      cliente={cliente}
      chamado={chamado}
    />
  );
}

function Conteudo({
  usuario,
  cliente,
  chamado,
}: { usuario: string; cliente: string; chamado: string }) {
  const consulta = useQuery({
    queryKey: ["chamado-escopo-avaliacao", usuario, cliente, chamado],
    queryFn: ({ signal }) =>
      supabaseChamadosOsEncerramentoAdapter.avaliar(cliente, chamado, signal),
    enabled: Boolean(usuario && cliente && chamado),
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  return (
    <section aria-label="Conferência de escopo do Chamado">
      <h3>Conferência de escopo</h3>
      {consulta.isFetching && <output>Conferindo escopo…</output>}
      {consulta.isError && !consulta.isFetching && (
        <p role="alert">
          Não foi possível conferir o escopo.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data && (
        <>
          <p>
            Composição{" "}
            {consulta.data.composicaoCompleta ? "declarada completa" : "não declarada completa"};{" "}
            {consulta.data.parcelas} parcela(s), {consulta.data.parcelasPendentes} pendente(s).
          </p>
          <p>
            {consulta.data.ordens} OS, {consulta.data.ordensNaoFinalizadas} não finalizada(s);{" "}
            {consulta.data.continuacoesPendentes} continuidade(s) pendente(s).
          </p>
          <p>Conferência informativa; não autoriza nem executa encerramento.</p>
        </>
      )}
    </section>
  );
}
