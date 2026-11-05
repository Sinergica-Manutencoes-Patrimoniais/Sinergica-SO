import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { DecisaoPmoc } from "./DecisaoPmoc";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
type Pedido = {
  requestId: string;
  clienteId: string;
  planoId: string;
  revision: number;
  versaoId: string;
  rotinaId: string;
  vencimento: string;
  agendamentoId: string;
  justificativa: string;
};

export function PropostaPmoc(props: Parameters<typeof Conteudo>[0]) {
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.versaoId,
        props.rotinaId,
        props.vencimento,
      ])}
      {...props}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  planoId,
  versaoId,
  rotinaId,
  revision,
  vencimento,
}: {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  revision: number;
  vencimento: string;
}) {
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const emEnvio = useRef(false);
  const primeiraTentativa = useRef(false);
  const cache = useQueryClient();
  const storageKey = `sso-pmoc-proposta:${JSON.stringify([userId, clienteId, planoId, rotinaId, vencimento])}`;
  const [agendamento, setAgendamento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      return p.clienteId === clienteId &&
        p.planoId === planoId &&
        p.versaoId === versaoId &&
        p.rotinaId === rotinaId &&
        p.vencimento === vencimento &&
        typeof p.requestId === "string" &&
        Number.isSafeInteger(p.revision) &&
        typeof p.agendamentoId === "string" &&
        typeof p.justificativa === "string"
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const candidatos = useInfiniteQuery({
    queryKey: ["pmoc-candidatos", userId, clienteId, vencimento],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_candidatos_pmoc_mediados", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_data: vencimento,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z
        .array(
          z
            .object({
              id: z.string().uuid(),
              scheduled_date: z.string().date(),
              maintenance_type: z.string().min(1),
              status: z.string().min(1),
            })
            .strict(),
        )
        .max(20)
        .parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const item of pagina) {
        if (item.scheduled_date !== vencimento || item.id.toLowerCase() <= anterior)
          throw new Error("Página divergente.");
        anterior = item.id.toLowerCase();
      }
      await conferirSessaoDiagnostico(userId, signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.id : undefined),
  });
  const propostas = useInfiniteQuery({
    queryKey: ["pmoc-propostas", userId, clienteId, planoId, rotinaId],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_propostas_pmoc_mediadas", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_rotina_id: rotinaId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z
        .array(
          z
            .object({
              id: z.string().uuid(),
              versao_id: z.string().uuid(),
              vencimento: z.string().date(),
              agendamento_pmoc_id: z.string().uuid(),
              alvo_tipo: z.string().min(1),
              alvo_id: z.string().uuid(),
              revisao_plano: z.number().int().positive(),
              justificativa: z.string(),
              ator_id: z.string().uuid(),
              criado_em: z.string().datetime({ offset: true }),
            })
            .strict(),
        )
        .max(20)
        .parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const item of pagina) {
        if (item.id.toLowerCase() <= anterior) throw new Error("Página divergente.");
        anterior = item.id.toLowerCase();
      }
      await conferirSessaoDiagnostico(userId, signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.id : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_propor_pmoc_mediado", {
        p_ator_id: userId,
        p_request_id: p.requestId,
        p_cliente_id: p.clienteId,
        p_plano_id: p.planoId,
        p_expected_revision: p.revision,
        p_versao_id: p.versaoId,
        p_rotina_id: p.rotinaId,
        p_vencimento: p.vencimento,
        p_agendamento_id: p.agendamentoId,
        p_justificativa: p.justificativa,
      });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.state !== "pendente" ||
        typeof data.propostaId !== "string"
      )
        throw new Error("Resposta inválida.");
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
    },
    onSuccess: async (_r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        if (!montado.current) throw new Error("Tela desmontada.");
        if (sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(storageKey);
      } catch {
        setAviso("Tentativa local não pôde ser removida; procure suporte.");
        return;
      }
      setPendente(null);
      setAviso("Proposta pendente registrada; nenhuma equivalência foi comprovada.");
      await cache.invalidateQueries({
        queryKey: ["pmoc-propostas", userId, clienteId, planoId, rotinaId],
      });
    },
    onError: async (error, p) => {
      const e = error as { code?: string; message?: string };
      if (
        primeiraTentativa.current &&
        ((e.code === "P0011" && e.message === "revisao_obsoleta") ||
          (e.code === "P0017" && e.message === "plano_alterado"))
      ) {
        try {
          await conferirSessaoDiagnostico(userId);
          if (!montado.current) throw new Error("Tela desmontada.");
          if (sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(storageKey);
          setPendente(null);
          setAviso("Os dados mudaram. Atualize e confira novamente antes de registrar.");
          await cache.invalidateQueries({
            queryKey: ["pmoc-propostas", userId, clienteId, planoId, rotinaId],
          });
          return;
        } catch {
          /* Preservar se não confirmar a sessão ou pedido. */
        }
      }
      setAviso(
        "Resultado não confirmado ou revisão obsoleta. Repita a mesma tentativa; procure suporte em conflito.",
      );
    },
    onSettled: () => {
      emEnvio.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (emEnvio.current) return;
    try {
      const anterior = sessionStorage.getItem(storageKey);
      if (anterior !== null && anterior !== JSON.stringify(p)) throw new Error();
      primeiraTentativa.current = anterior === null;
      sessionStorage.setItem(storageKey, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível guardar tentativa; nada enviado.");
      return;
    }
    emEnvio.current = true;
    setPendente(p);
    envio.mutate(p);
  };
  return (
    <section aria-label={`Proposta PMOC ${vencimento}`}>
      <p>
        Proposta humana não valida equivalência de contrato ou alvo, não deduplica nem altera PMOC.
      </p>
      {candidatos.isError && (
        <p role="alert">
          Agendamentos indisponíveis.{" "}
          <button type="button" onClick={() => void candidatos.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            pendente ||
            !agendamento ||
            !motivo.trim() ||
            candidatos.isFetching ||
            candidatos.isError
          )
            return;
          enviar({
            requestId: crypto.randomUUID(),
            clienteId,
            planoId,
            revision,
            versaoId,
            rotinaId,
            vencimento,
            agendamentoId: agendamento,
            justificativa: motivo.trim(),
          });
        }}
      >
        <fieldset
          disabled={!!pendente || envio.isPending || candidatos.isFetching || candidatos.isError}
        >
          <label>
            Agendamento PMOC da mesma data{" "}
            <select required value={agendamento} onChange={(e) => setAgendamento(e.target.value)}>
              <option value="">Selecione</option>
              {!candidatos.isFetching &&
                !candidatos.isError &&
                candidatos.data?.pages.flat().map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} · {c.maintenance_type} · {c.status}
                  </option>
                ))}
            </select>
          </label>{" "}
          <label>
            Justificativa{" "}
            <textarea
              required
              maxLength={2000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <button type="submit">Registrar proposta pendente</button>
        </fieldset>
      </form>
      {candidatos.hasNextPage && (
        <button type="button" onClick={() => void candidatos.fetchNextPage()}>
          Mais agendamentos
        </button>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <output className="block">{aviso}</output>}
      {propostas.isError && (
        <p role="alert">
          Histórico indisponível.{" "}
          <button type="button" onClick={() => void propostas.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!propostas.isFetching && !propostas.isError && propostas.data && (
        <ul>
          {propostas.data.pages
            .flat()
            .filter((p) => p.vencimento === vencimento)
            .map((p) => (
              <li key={p.id}>
                Proposta · PMOC {p.agendamento_pmoc_id} · alvo {p.alvo_tipo} {p.alvo_id} ·{" "}
                {p.justificativa} · {p.criado_em}
                {import.meta.env.VITE_SSO_DECISAO_PMOC_ENABLED === "true" && (
                  <DecisaoPmoc userId={userId} clienteId={clienteId} propostaId={p.id} />
                )}
              </li>
            ))}
        </ul>
      )}
      {propostas.hasNextPage && (
        <button type="button" onClick={() => void propostas.fetchNextPage()}>
          Mais histórico
        </button>
      )}
    </section>
  );
}
