import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { VinculoCicloPmoc } from "./VinculoCicloPmoc";
type Pedido = {
  requestId: string;
  clienteId: string;
  propostaId: string;
  revision: number;
  decisao: "validada_pcm" | "rejeitada";
  evidencia: string;
  justificativa: string;
};

export function DecisaoPmoc({
  userId,
  clienteId,
  propostaId,
}: { userId: string; clienteId: string; propostaId: string }) {
  const emEnvio = useRef(false);
  const primeiraTentativa = useRef(false);
  const cache = useQueryClient();
  const storageKey = `sso-pmoc-decisao:${JSON.stringify([userId, clienteId, propostaId])}`;
  const [decisao, setDecisao] = useState<Pedido["decisao"]>("rejeitada");
  const [evidencia, setEvidencia] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      return p.clienteId === clienteId &&
        p.propostaId === propostaId &&
        typeof p.requestId === "string" &&
        Number.isSafeInteger(p.revision) &&
        ["validada_pcm", "rejeitada"].includes(p.decisao) &&
        typeof p.evidencia === "string" &&
        typeof p.justificativa === "string"
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const permissao = useQuery({
    queryKey: ["pmoc-decisao-permissao", userId, clienteId],
    gcTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () =>
      (await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId)) &&
      (await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.aprovar", clienteId)),
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const historico = useInfiniteQuery({
    queryKey: ["pmoc-decisoes", userId, clienteId, propostaId],
    enabled: permitido,
    gcTime: 0,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_decisoes_pmoc_mediadas", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_proposta_id: propostaId,
          p_antes: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z
        .array(
          z
            .object({
              id: z.string().uuid(),
              revisao: z.number().int().positive(),
              decisao: z.enum(["validada_pcm", "rejeitada"]),
              evidencia_referencia: z.string(),
              justificativa: z.string(),
              ator_id: z.string().uuid(),
              criado_em: z.string().datetime({ offset: true }),
            })
            .strict(),
        )
        .max(20)
        .parse(data);
      let anterior = pageParam ?? Infinity;
      for (const item of pagina) {
        if (item.revisao >= anterior) throw new Error("Página divergente.");
        anterior = item.revisao;
      }
      await conferirSessaoDiagnostico(userId, signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.revisao : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessaoDiagnostico(userId);
      if (sessionStorage.getItem(storageKey) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_decidir_pmoc_mediado", {
        p_ator_id: userId,
        p_request_id: p.requestId,
        p_cliente_id: p.clienteId,
        p_proposta_id: p.propostaId,
        p_expected_revision: p.revision,
        p_decisao: p.decisao,
        p_evidencia_referencia: p.evidencia,
        p_justificativa: p.justificativa,
      });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.revision !== p.revision + 1 ||
        data.state !== p.decisao ||
        typeof data.decisaoId !== "string"
      )
        throw new Error("Resposta inválida.");
      await conferirSessaoDiagnostico(userId);
    },
    onSuccess: async (_r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        if (sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(storageKey);
      } catch {
        setAviso("Tentativa local não pôde ser removida; procure suporte.");
        return;
      }
      setPendente(null);
      setAviso("Decisão humana registrada; deduplicação permanece desativada.");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["pmoc-decisoes", userId, clienteId, propostaId] }),
        cache.invalidateQueries({ queryKey: ["inventario-pmoc", userId, clienteId] }),
        cache.invalidateQueries({ queryKey: ["avaliacao-inventario-pmoc", userId, clienteId] }),
      ]);
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
          if (sessionStorage.getItem(storageKey) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(storageKey);
          setPendente(null);
          setAviso("Os dados mudaram. Atualize e confira novamente antes de registrar.");
          await cache.invalidateQueries({
            queryKey: ["pmoc-decisoes", userId, clienteId, propostaId],
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
  if (permissao.isPending || permissao.isFetching) return <p>Verificando autorização…</p>;
  if (permissao.isError)
    return (
      <p role="alert">
        Autorização indisponível.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permitido) return null;
  const revisao = historico.data?.pages[0]?.[0]?.revisao ?? 0;
  return (
    <section aria-label="Decisão PCM sobre proposta">
      <p>
        A referência é declarada pelo PCM: o sistema não lê o documento nem comprova automaticamente
        equivalência de alvo ou contrato. Esta decisão não ativa deduplicação.
      </p>
      {historico.isError && (
        <p role="alert">
          Histórico indisponível.{" "}
          <button type="button" onClick={() => void historico.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            pendente ||
            !historico.data ||
            historico.isFetching ||
            historico.isError ||
            !evidencia.trim() ||
            !justificativa.trim()
          )
            return;
          enviar({
            requestId: crypto.randomUUID(),
            clienteId,
            propostaId,
            revision: revisao,
            decisao,
            evidencia: evidencia.trim(),
            justificativa: justificativa.trim(),
          });
        }}
      >
        <fieldset
          disabled={
            !!pendente ||
            envio.isPending ||
            !historico.data ||
            historico.isFetching ||
            historico.isError
          }
        >
          <label>
            Decisão{" "}
            <select
              value={decisao}
              onChange={(e) => setDecisao(e.target.value as Pedido["decisao"])}
            >
              <option value="rejeitada">Rejeitar</option>
              <option value="validada_pcm">Validar pelo PCM</option>
            </select>
          </label>{" "}
          <label>
            Referência da evidência formal{" "}
            <input
              required
              maxLength={500}
              value={evidencia}
              onChange={(e) => setEvidencia(e.target.value)}
            />
          </label>{" "}
          <label>
            Justificativa{" "}
            <textarea
              required
              maxLength={2000}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          </label>
          <button type="submit">Registrar decisão</button>
        </fieldset>
      </form>
      {!historico.isFetching && !historico.isError && historico.data && (
        <ul>
          {historico.data.pages.flat().map((d) => (
            <li key={d.id}>
              Revisão {d.revisao}: {d.decisao} · evidência declarada {d.evidencia_referencia} ·{" "}
              {d.justificativa} · {d.ator_id} · {d.criado_em}
            </li>
          ))}
        </ul>
      )}
      {!historico.isFetching &&
        !historico.isError &&
        historico.data?.pages[0]?.[0]?.decisao === "validada_pcm" && (
          <VinculoCicloPmoc
            userId={userId}
            clienteId={clienteId}
            propostaId={propostaId}
            decisaoRevision={revisao}
          />
        )}
      {historico.hasNextPage && (
        <button type="button" onClick={() => void historico.fetchNextPage()}>
          Mais histórico
        </button>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <output className="block">{aviso}</output>}
    </section>
  );
}
