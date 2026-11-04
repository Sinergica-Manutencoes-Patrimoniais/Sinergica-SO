import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const resposta = z.object({ grupoId: z.string().uuid(), clienteId: z.string().uuid(),
  codigoAtual: z.string().min(1).max(200), codigoHistorico: z.boolean() }).strict().nullable();

export function ConsultaCodigoGrupo({ userId, clienteId }: { userId: string; clienteId: string }) {
  if (import.meta.env.VITE_SSO_CONSULTA_CODIGO_GRUPO_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([userId, clienteId])} userId={userId} clienteId={clienteId} />;
}

function Conteudo({ userId, clienteId }: { userId: string; clienteId: string }) {
  const [entrada, setEntrada] = useState("");
  const [busca, setBusca] = useState("");
  const consulta = useQuery({
    queryKey: ["codigos-publicos", userId, clienteId, "grupo", busca],
    enabled: Boolean(busca) && busca === entrada,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_consultar_codigo_grupo", {
        p_cliente_id: clienteId, p_codigo: busca,
      }).abortSignal(signal);
      if (error) throw error;
      const resultado = resposta.parse(data);
      if (resultado && resultado.clienteId !== clienteId) throw new Error("Cliente divergente.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return resultado;
    },
  });
  const visivel = Boolean(busca) && busca === entrada && !consulta.isFetching && !consulta.isError;
  return <section aria-label="Localizar código de Grupo Quantitativo">
    <h3>Localizar código de Grupo Quantitativo</h3>
    <p>Consulta separada por código atual ou anterior neste Cliente; não confirma ausência de conflitos em outros cadastros.</p>
    <form onSubmit={(e) => { e.preventDefault(); if (!entrada.trim()) return; if (entrada === busca) void consulta.refetch(); else setBusca(entrada); }}>
      <label>Código do Grupo <input required maxLength={200} value={entrada} onChange={(e) => setEntrada(e.target.value)} /></label>
      <button type="submit" disabled={consulta.isFetching}>Consultar Grupo</button>
    </form>
    {busca === entrada && consulta.isFetching && <output>Consultando Grupo…</output>}
    {busca === entrada && consulta.isError && <p role="alert">Consulta indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {visivel && consulta.data === null && <p>Grupo não encontrado neste Cliente.</p>}
    {visivel && consulta.data && <p>Grupo {consulta.data.grupoId} · código atual {consulta.data.codigoAtual} · {consulta.data.codigoHistorico ? "código consultado é anterior" : "código consultado é atual"}.</p>}
  </section>;
}
