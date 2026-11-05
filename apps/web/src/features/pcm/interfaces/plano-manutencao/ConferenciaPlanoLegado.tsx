import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { CompararCalendarioLegado } from "./CompararCalendarioLegado";
import { ReservaCicloFuturo } from "./ReservaCicloFuturo";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
type Item = {
  rotinaId: string | null;
  rotinaLogicaId: string;
  nome: string;
  alvoMesmoId: boolean | null;
  intervaloMesmo: boolean | null;
  dataBaseIgual: boolean | null;
  questionarioMesmoId: boolean | null;
};
const comparacao = (v: boolean | null) =>
  v === null ? "indeterminado" : v ? "igual" : "diferente";

export function ConferenciaPlanoLegado({
  userId,
  clienteId,
  planoId,
  legadoId,
  revision,
}: { userId: string; clienteId: string; planoId: string; legadoId: string; revision?: number }) {
  const [versao, setVersao] = useState("");
  const [rotina, setRotina] = useState("");
  const [rotinaFuturo, setRotinaFuturo] = useState("");
  const versoes = useInfiniteQuery({
    queryKey: ["versoes-conferencia-legado", userId, clienteId, planoId],
    initialPageParam: 0,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_versoes_legadas_mediadas", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Lista inválida.");
      await conferirSessaoDiagnostico(userId, signal);
      return data as { id: string; numero: number; estado: string }[];
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.numero : undefined),
  });
  const consulta = useInfiniteQuery({
    queryKey: ["conferencia-plano-legado", userId, clienteId, planoId, legadoId, versao],
    enabled: !!versao,
    initialPageParam: null as string | null,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_conferencia_legada_mediada", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_versao_id: versao,
          p_legado_id: legadoId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (
        !data ||
        !Array.isArray(data.items) ||
        data.equivalenciaComprovada !== false ||
        data.impactoCalculado !== false
      )
        throw new Error("Conferência inválida.");
      await conferirSessaoDiagnostico(userId, signal);
      return data as { items: Item[]; nextCursor: string | null; fonteMutavel: boolean };
    },
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  return (
    <section aria-label="Conferência da relação">
      <h5>Conferência informativa</h5>
      <p>
        Campos iguais não comprovam equivalência, conteúdo do questionário, ausência de impacto ou
        deduplicação. Fontes podem mudar entre páginas; dados ausentes são indeterminados.
      </p>
      {versoes.isError && (
        <p role="alert">
          Versões indisponíveis.{" "}
          <button type="button" onClick={() => void versoes.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      <label>
        Versão{" "}
        <select
          value={versao}
          onChange={(e) => {
            setVersao(e.target.value);
            setRotina("");
            setRotinaFuturo("");
          }}
        >
          <option value="">Selecione</option>
          {versoes.data?.pages.flat().map((v) => (
            <option key={v.id} value={v.id}>
              Versão {v.numero} · {v.estado}
            </option>
          ))}
        </select>
      </label>
      {versoes.hasNextPage && (
        <button type="button" onClick={() => void versoes.fetchNextPage()}>
          Mais versões
        </button>
      )}
      {consulta.isError && (
        <p role="alert">
          Conferência indisponível, relação retirada ou snapshot incompleto.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {consulta.data?.pages[0]?.fonteMutavel && <p>Rascunho: fonte mutável, não congelada.</p>}
      <ul>
        {consulta.data?.pages
          .flatMap((p) => p.items)
          .map((r) => (
            <li key={r.rotinaLogicaId}>
              {r.nome} · alvo {comparacao(r.alvoMesmoId)} · intervalo {comparacao(r.intervaloMesmo)}{" "}
              · data-base {comparacao(r.dataBaseIgual)} · ID questionário{" "}
              {comparacao(r.questionarioMesmoId)}
              {import.meta.env.VITE_SSO_APROVAR_REVISAO_ENABLED === "true" &&
                revision !== undefined &&
                r.rotinaId && (
                  <button type="button" onClick={() => setRotinaFuturo(r.rotinaId ?? "")}>
                    Reservar ciclo futuro desta Rotina
                  </button>
                )}
              {import.meta.env.VITE_SSO_COMPARAR_CALENDARIO_LEGADO_ENABLED === "true" &&
                r.rotinaId &&
                !consulta.data?.pages[0]?.fonteMutavel && (
                  <button type="button" onClick={() => setRotina(r.rotinaId ?? "")}>
                    Comparar calendário desta Rotina
                  </button>
                )}
            </li>
          ))}
      </ul>
      {consulta.hasNextPage && (
        <button type="button" onClick={() => void consulta.fetchNextPage()}>
          Mais Rotinas
        </button>
      )}
      {rotinaFuturo && revision !== undefined && (
        <ReservaCicloFuturo
          key={`${versao}:${rotinaFuturo}`}
          userId={userId}
          clienteId={clienteId}
          planoId={planoId}
          versaoId={versao}
          rotinaId={rotinaFuturo}
          legadoId={legadoId}
          revision={revision}
          rascunho={!!consulta.data?.pages[0]?.fonteMutavel}
        />
      )}
      {rotina && (
        <CompararCalendarioLegado
          key={`${versao}:${rotina}`}
          userId={userId}
          clienteId={clienteId}
          planoId={planoId}
          versaoId={versao}
          rotinaId={rotina}
          legadoId={legadoId}
        />
      )}
    </section>
  );
}
