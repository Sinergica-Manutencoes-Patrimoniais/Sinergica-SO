import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const item = z.object({ declaracao_id: z.string().guid(), os_id: z.string().guid(), lista_id: z.string().guid(), lista_revisao: z.number().int().positive(),
  descricao_declarada: z.string(), evidencia_declarada: z.string(), proposta_id: z.string().guid(), versao: z.number().int().positive(),
  linha_id: z.string().guid(), descricao_publica: z.string(), quantidade: z.number().int().positive(), preco_unitario_centavos: z.string().regex(/^\d+$/) }).strict();
export function RastreioLinhaMaterial({ usuario, cliente, itemId }: { usuario: string; cliente: string; itemId: string }) {
  const [aberto, setAberto] = useState(false);
  const consulta = useQuery({ queryKey: ["rastreio-linha-material", usuario, cliente, itemId], enabled: aberto, gcTime: 0, staleTime: 0,
    retry: false, refetchOnWindowFocus: true, queryFn: async ({ signal }) => {
      const { data, error } = await supabase.schema("financeiro").rpc("sso_rastrear_candidato_linha", { p_cliente_id: cliente, p_item_id: itemId }).abortSignal(signal);
      if (error) throw error; return z.array(item).max(1).parse(data);
    } });
  if (import.meta.env.VITE_SSO_RASTREIO_LINHA_MATERIAL_ENABLED !== "true") return null;
  return <section><button type="button" onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar origem" : "Ver origem e evidência declarada"}</button>
    {aberto && consulta.isFetching && <p>Consultando origem…</p>}
    {aberto && consulta.isError && <p role="alert">Origem indisponível ou sem acesso. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {aberto && !consulta.isFetching && !consulta.isError && consulta.data?.length === 0 && <p role="alert">Cadeia incompleta ou incompatível. Não conclua a conferência sem investigar.</p>}
    {aberto && !consulta.isFetching && !consulta.isError && consulta.data?.map((d) => <div key={d.declaracao_id}>
      <p>OS {d.os_id} · lista {d.lista_id} revisão {d.lista_revisao} · declaração {d.declaracao_id}</p>
      <p>Material declarado: {d.descricao_declarada}. Evidência textual declarada: {d.evidencia_declarada}.</p>
      <p>Proposta {d.proposta_id} versão {d.versao} · linha {d.linha_id}: {d.descricao_publica} · {d.quantidade} × {d.preco_unitario_centavos} centavos.</p>
      <p>A evidência textual não comprova, por si só, entrega ou consumo.</p>
    </div>)}
  </section>;
}
