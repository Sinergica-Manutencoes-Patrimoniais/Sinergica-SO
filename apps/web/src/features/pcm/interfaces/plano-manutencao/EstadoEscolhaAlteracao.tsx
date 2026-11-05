import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
import { ResolverRetiradaImpacto } from "./ResolverRetiradaImpacto";

type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  rascunhoId: string;
  preparadaId: string;
  planoRevision: number;
  decisaoRevision: number;
  tipo: "calendario" | "visita";
};
export function EstadoEscolhaAlteracao(props: Props) {
  if (
    import.meta.env.VITE_SSO_ALTERACAO_CICLO_ENABLED !== "true" &&
    (props.tipo !== "calendario" || import.meta.env.VITE_SSO_NOVA_DATA_CICLO_ENABLED !== "true") &&
    (props.tipo !== "visita" || import.meta.env.VITE_SSO_NOVA_DATA_VISITA_ENABLED !== "true")
  )
    return <ResolverRetiradaImpacto {...props} />;
  return <Consulta key={JSON.stringify(props)} {...props} />;
}
function Consulta(props: Props) {
  const {
    userId,
    clienteId,
    planoId,
    rascunhoId,
    preparadaId,
    planoRevision,
    decisaoRevision,
    tipo,
  } = props;
  const q = useQuery({
    queryKey: [
      "escolha-alteracao-ciclo",
      userId,
      clienteId,
      planoId,
      rascunhoId,
      preparadaId,
      planoRevision,
      decisaoRevision,
      tipo,
    ],
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_consultar_escolha_alteracao_ciclo", {
          p_ator: userId,
          p_cliente: clienteId,
          p_plano: planoId,
          p_rascunho: rascunhoId,
          p_preparada: preparadaId,
          p_revisao_plano: planoRevision,
          p_revisao_decisao: decisaoRevision,
          p_tipo: tipo,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = z
        .object({
          preparadaId: z.string().uuid(),
          revisaoDecisao: z.number().int().positive(),
          registrada: z.boolean(),
          atual: z.boolean(),
        })
        .strict()
        .parse(data);
      if (
        r.preparadaId !== preparadaId ||
        r.revisaoDecisao !== decisaoRevision ||
        (r.atual && !r.registrada)
      )
        throw new Error("Resposta divergente.");
      let novaData: {
        registrada: boolean;
        atual: boolean;
        data: string | null;
        indice: number | null;
      } | null = null;
      if (
        !r.registrada &&
        tipo === "calendario" &&
        import.meta.env.VITE_SSO_NOVA_DATA_CICLO_ENABLED === "true"
      ) {
        const nova = await supabase
          .schema("pcm")
          .rpc("sso_consultar_nova_data_calendario", {
            p_ator: userId,
            p_cliente: clienteId,
            p_plano: planoId,
            p_rascunho: rascunhoId,
            p_preparada: preparadaId,
            p_revisao_plano: planoRevision,
            p_revisao_decisao: decisaoRevision,
          })
          .abortSignal(signal);
        if (nova.error) throw nova.error;
        const x = z
          .object({
            preparadaId: z.string().uuid(),
            revisaoDecisao: z.number().int().positive(),
            registrada: z.boolean(),
            atual: z.boolean(),
            data: z.string().date().nullable(),
            indice: z.number().int().nonnegative().nullable(),
          })
          .strict()
          .parse(nova.data);
        if (
          x.preparadaId !== preparadaId ||
          x.revisaoDecisao !== decisaoRevision ||
          (x.atual && !x.registrada) ||
          x.registrada !== (x.data !== null && x.indice !== null)
        )
          throw new Error("Resposta divergente.");
        novaData = x;
      }
      let novaVisita: { data: string; atual: boolean; substituicaoAplicada: boolean } | null = null;
      if (
        !r.registrada &&
        tipo === "visita" &&
        import.meta.env.VITE_SSO_NOVA_DATA_VISITA_ENABLED === "true"
      ) {
        const nova = await supabase
          .schema("pcm")
          .rpc("sso_consultar_escolha_nova_visita", {
            p_ator: userId,
            p_cliente: clienteId,
            p_plano: planoId,
            p_rascunho: rascunhoId,
            p_preparada: preparadaId,
            p_revisao: planoRevision,
          })
          .abortSignal(signal);
        if (nova.error) throw nova.error;
        const x = z
          .object({
            requestId: z.string().uuid(),
            preparadaId: z.string().uuid(),
            visitaId: z.string().uuid(),
            data: z.string().date(),
            serieId: z.string().uuid(),
            semanaOrigem: z.string().date(),
            fonteFeriados: z.string(),
            atual: z.boolean(),
            fontesFeriadosCompletas: z.literal(false),
            substituicaoAplicada: z.boolean(),
          })
          .strict()
          .nullable()
          .parse(nova.data);
        if (x && x.preparadaId !== preparadaId) throw new Error("Resposta divergente.");
        novaVisita = x;
      }
      await conferirSessaoDiagnostico(userId, signal);
      return { ...r, novaData, novaVisita };
    },
  });
  if (q.isFetching) return <output className="block">Consultando decisão da ocorrência…</output>;
  if (q.isError || !q.data)
    return (
      <p role="alert">
        Não foi possível consultar a decisão.{" "}
        <button type="button" onClick={() => void q.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (q.data.registrada && q.data.atual)
    return (
      <p>
        Alteração escolhida para esta ocorrência. A nova versão só será aplicada após aprovação e
        vigência; a OS existente não será alterada.
      </p>
    );
  if (q.data.registrada)
    return (
      <p role="alert">
        A escolha de alteração está desatualizada. Confira a comparação e registre nova decisão.
      </p>
    );
  if (q.data.novaData?.registrada && q.data.novaData.atual)
    return (
      <p>
        Nova data escolhida: {q.data.novaData.data} · ciclo {q.data.novaData.indice}. A substituição
        depende de aprovação, vigência e tratamento da fila anterior.
      </p>
    );
  if (q.data.novaData?.registrada)
    return (
      <p role="alert">
        A escolha da nova data está desatualizada. Confira a comparação e registre nova decisão.
      </p>
    );
  if (q.data.novaVisita?.atual)
    return (
      <p>
        Nova Visita escolhida: {q.data.novaVisita.data}.{" "}
        {q.data.novaVisita.substituicaoAplicada
          ? "A ocorrência da nova Visita foi vinculada."
          : "A substituição depende de aprovação, vigência e tratamento da fila anterior."}
      </p>
    );
  if (q.data.novaVisita)
    return (
      <p role="alert">
        A escolha da nova Visita está desatualizada. Confira a comparação e registre nova decisão.
      </p>
    );
  return <ResolverRetiradaImpacto {...props} />;
}
