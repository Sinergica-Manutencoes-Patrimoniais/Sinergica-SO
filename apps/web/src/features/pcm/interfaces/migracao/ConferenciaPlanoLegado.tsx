import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { RegistrarTarefaLegada } from "./RegistrarTarefaLegada";

const recorrencia = z.object({ inicio: z.string().date().nullable(), intervalo: z.number().int().positive().nullable(), unidade: z.string().nullable() });
const resposta = z.discriminatedUnion("mapeado", [z.object({ planoId: z.string().guid(), mapeado: z.literal(false) }).strict(), z.object({ planoId: z.string().guid(), mapeado: z.literal(true), versao: z.number().int().positive(), estadoVersao: z.string(), origemAlterada: z.boolean(), identidadePreservada: z.boolean(), nomePreservado: z.boolean(), alvoPreservado: z.boolean(), questionarioPreservado: z.boolean(), recorrenciaOrigem: recorrencia.strict(), recorrenciaDestino: recorrencia.extend({ modo: z.string() }).strict(), tempoValidado: z.boolean(), tipoTarefaOrigem: z.string().guid(), revisaoPlano: z.number().int().positive(), estadoPlano: z.string(), equivalenciaComprovada: z.literal(false) }).strict()]);
export function ConferenciaPlanoLegado({ userId, clienteId, planoId }: { userId: string; clienteId: string; planoId: string }) {
  const [aberto, setAberto] = useState(false);
  const consulta = useQuery({ queryKey: ["migracao-conferencia-plano", userId, clienteId, planoId], enabled: aberto, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => { const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_conferir_mapeamento_plano", { p_ator_id: userId, p_cliente_id: clienteId, p_plano_legado_id: planoId }).abortSignal(signal); if (error) throw error;
      const r = resposta.parse(data); if (r.planoId.toLowerCase() !== planoId.toLowerCase()) throw new Error("Plano divergente."); const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return r; } });
  const r = consulta.data;
  return <section aria-label="Conferência do Plano legado"><button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>{aberto ? "Ocultar conferência" : "Comparar origem e rascunho"}</button>
    {aberto && <>{consulta.isFetching && <output>Consultando Plano…</output>}{consulta.isError && <p role="alert">Conferência indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
      {!consulta.isFetching && !consulta.isError && r && (!r.mapeado ? <p>Nenhum mapeamento registrado.</p> : <><p>Versão {r.versao} · {r.estadoVersao}. A comparação não comprova equivalência operacional nem migra histórico.</p>
        <ul><li>Origem {r.origemAlterada ? "alterada após o registro" : "igual à fotografia registrada"}</li><li>Identidade {r.identidadePreservada ? "preservada" : "divergente"}</li><li>Nome {r.nomePreservado ? "preservado" : "divergente"}</li><li>Alvo {r.alvoPreservado ? "preservado" : "divergente"}</li><li>Questionário {r.questionarioPreservado ? "referência preservada" : "divergente"}</li><li>Tempo {r.tempoValidado ? "informado" : "a validar"}</li></ul>
        <p>Origem: {r.recorrenciaOrigem.inicio ?? "sem data"}, a cada {r.recorrenciaOrigem.intervalo ?? "?"} {r.recorrenciaOrigem.unidade ?? "?"}. Destino: {r.recorrenciaDestino.inicio ?? "sem data"}, a cada {r.recorrenciaDestino.intervalo ?? "?"} {r.recorrenciaDestino.unidade ?? "?"}, modo {r.recorrenciaDestino.modo}. Confira a regra declarada.</p><p>Tipo de tarefa da origem: {r.tipoTarefaOrigem}; vínculo no destino exige conferência.</p>
        {import.meta.env.VITE_SSO_REFERENCIA_TAREFA_LEGADA_ENABLED === "true" && <RegistrarTarefaLegada userId={userId} clienteId={clienteId} planoId={planoId} revisao={r.revisaoPlano} tipoTarefaId={r.tipoTarefaOrigem} disponivel={!r.origemAlterada && r.estadoPlano === "rascunho" && r.estadoVersao === "rascunho"} />}</>)}
    </>}
  </section>;
}
