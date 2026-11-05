import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

export function InventarioGeracaoLegada({
  userId,
  clienteId,
}: { userId: string; clienteId: string }) {
  const consulta = useQuery({
    queryKey: ["inventario-geracao-legada", userId, clienteId],
    gcTime: 0,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_inventariar_geracao_legada_mediada", { p_ator: userId, p_cliente: clienteId })
        .abortSignal(signal);
      if (error) throw error;
      await conferirSessaoDiagnostico(userId, signal);
      if (
        !data ||
        data.equivalenciaPlanoComprovada !== false ||
        data.guardaLegadaAtivada !== false ||
        data.fontesIncompletas !== true
      )
        throw new Error("Inventário inválido.");
      return data as {
        planosLegados: number;
        semVinculoOcorrencia: number;
        comVinculoOcorrencia: number;
        comMultiplosPlanosAssociadosPorOcorrencia: number;
        comDivergenciaCliente: number;
      };
    },
  });
  return (
    <aside aria-label="Inventário da geração legada">
      <p>
        A suspensão deste Plano não controla o gerador legado. Os números abaixo são agregados do
        Cliente, não deste Plano; vínculos por ocorrência não comprovam equivalência entre Planos.
      </p>
      {consulta.isError && (
        <p role="alert">
          Inventário indisponível.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {consulta.data && (
        <p>
          Planos legados {consulta.data.planosLegados} · sem ponte observada{" "}
          {consulta.data.semVinculoOcorrencia} · com ponte observada{" "}
          {consulta.data.comVinculoOcorrencia} · múltiplos Planos associados{" "}
          {consulta.data.comMultiplosPlanosAssociadosPorOcorrencia} · divergências de Cliente{" "}
          {consulta.data.comDivergenciaCliente}
        </p>
      )}
    </aside>
  );
}
