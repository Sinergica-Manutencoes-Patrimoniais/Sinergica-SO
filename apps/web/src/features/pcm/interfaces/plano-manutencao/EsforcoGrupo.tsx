import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../../lib/supabase-client";
type Esforco = {
  estado: "estimativa" | "tempo_a_validar";
  motivo?: string;
  quantidadeAprovada?: string;
  tempoPorUnidadeMinutos?: string;
  esforcoMinutos: string | null;
  capacidadeReservada: false;
};
export function EsforcoGrupo(props: { userId: string; clienteId: string; ocorrenciaId: string }) {
  if (import.meta.env.VITE_SSO_ESFORCO_GRUPO_MEDIADO_ENABLED !== "true")
    return <p>Consulta de esforço mediada indisponível.</p>;
  return <EsforcoGrupoMediado {...props} />;
}
function EsforcoGrupoMediado({
  userId,
  clienteId,
  ocorrenciaId,
}: { userId: string; clienteId: string; ocorrenciaId: string }) {
  const consulta = useQuery({
    queryKey: ["esforco-grupo", userId, clienteId, ocorrenciaId],
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const requisicao = supabase.schema("pcm").rpc("sso_prever_esforco_grupo_mediado", {
        p_cliente_id: clienteId,
        p_ocorrencia_id: ocorrenciaId,
        p_ator_id: userId,
      });
      const { data, error } = await requisicao.abortSignal(signal);
      if (error) throw error;
      if (
        !data ||
        data.ocorrenciaId !== ocorrenciaId ||
        !["estimativa", "tempo_a_validar"].includes(data.estado) ||
        data.capacidadeReservada !== false
      )
        throw new Error("Estimativa inválida.");
      if (data.estado === "estimativa") {
        // Valores chegam como texto para preservar precisão além do limite de Number.
        if (
          typeof data.quantidadeAprovada !== "string" ||
          !/^[1-9][0-9]{0,15}$/.test(data.quantidadeAprovada) ||
          typeof data.tempoPorUnidadeMinutos !== "string" ||
          !/^[1-9][0-9]{0,9}$/.test(data.tempoPorUnidadeMinutos) ||
          typeof data.esforcoMinutos !== "string" ||
          !/^[1-9][0-9]{0,25}$/.test(data.esforcoMinutos) ||
          BigInt(data.quantidadeAprovada) > 9007199254740991n ||
          BigInt(data.tempoPorUnidadeMinutos) > 2147483647n ||
          BigInt(data.quantidadeAprovada) * BigInt(data.tempoPorUnidadeMinutos) !==
            BigInt(data.esforcoMinutos)
        )
          throw new Error("Estimativa inválida.");
      } else if (
        data.esforcoMinutos !== null ||
        (data.motivo !== undefined && typeof data.motivo !== "string")
      ) {
        throw new Error("Estimativa inválida.");
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return data as Esforco;
    },
  });
  return (
    <section aria-label="Esforço estimado do Grupo">
      <h5>Esforço do Grupo</h5>
      <p>Estimativa não reserva capacidade e não comprova execução.</p>
      {consulta.isFetching && <p>Consultando…</p>}
      {consulta.isError && (
        <p role="alert">
          Estimativa indisponível.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data?.estado === "tempo_a_validar" && (
        <p>Tempo a validar · {consulta.data.motivo ?? "dados históricos insuficientes"}.</p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data?.estado === "estimativa" && (
        <p>
          {consulta.data.quantidadeAprovada} unidades aprovadas ×{" "}
          {consulta.data.tempoPorUnidadeMinutos} minutos por unidade ={" "}
          {consulta.data.esforcoMinutos} minutos estimados.
        </p>
      )}
    </section>
  );
}
