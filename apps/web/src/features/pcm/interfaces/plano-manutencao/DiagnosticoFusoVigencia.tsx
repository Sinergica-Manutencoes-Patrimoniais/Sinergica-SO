import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

export function DiagnosticoFusoVigencia({
  userId,
  clienteId,
  planoId,
  revisao,
}: { userId: string; clienteId: string; planoId: string; revisao: number }) {
  const habilitado = import.meta.env.VITE_SSO_DIAGNOSTICOS_REVISAO_MEDIADOS_ENABLED === "true";
  const consulta = useQuery({
    queryKey: ["diagnostico-fuso-vigencia", userId, clienteId, planoId, revisao],
    enabled: habilitado,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_diagnosticar_fuso_mediado", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_expected_revision: revisao,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = z
        .object({
          revisao: z.number().int().positive(),
          instante: z.string().datetime({ offset: true }),
          dataUtc: z.string().date(),
          fusos: z
            .array(
              z
                .object({
                  fusoDeclaradoVisitas: z.string().min(1).max(100),
                  dataCivil: z.string().date(),
                  divergeUtc: z.boolean(),
                })
                .strict(),
            )
            .max(50),
          totalFusosDeclarados: z.number().int().nonnegative().safe(),
          fusosInvalidos: z.number().int().nonnegative().safe(),
          listaLimitada: z.boolean(),
          fusoPlanoDefinido: z.literal(false),
          decisaoVigencia: z.literal(false),
        })
        .passthrough()
        .parse(data);
      if (
        r.revisao !== revisao ||
        r.fusosInvalidos > r.totalFusosDeclarados ||
        new Set(r.fusos.map((item) => item.fusoDeclaradoVisitas)).size !== r.fusos.length
      )
        throw new Error("Diagnóstico divergente.");
      await conferirSessaoDiagnostico(userId, signal);
      return r;
    },
  });
  return (
    <aside aria-label="Fuso e vigência">
      {!habilitado && <p>Diagnóstico mediado indisponível.</p>}
      <p>
        O fuso civil do Plano não está definido. Fusos registrados em Visitas não definem
        automaticamente o fuso do Plano; esta comparação não autoriza aprovação.
      </p>
      {consulta.isError && (
        <p role="alert">
          Diagnóstico indisponível ou revisão alterada.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {consulta.data && !consulta.isFetching && !consulta.isError && (
        <>
          <p>
            Instante {consulta.data.instante} · data UTC {consulta.data.dataUtc} · fusos de Visitas{" "}
            {consulta.data.totalFusosDeclarados} · inválidos {consulta.data.fusosInvalidos}
            {consulta.data.listaLimitada && " · lista limitada a 50"}
          </p>
          <ul>
            {consulta.data.fusos.map((f) => (
              <li key={f.fusoDeclaradoVisitas}>
                {f.fusoDeclaradoVisitas}: {f.dataCivil}
                {f.divergeUtc ? " — data diferente da UTC" : " — mesma data UTC neste instante"}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
