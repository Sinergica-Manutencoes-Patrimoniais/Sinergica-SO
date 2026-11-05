import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

type Vigencia = { id: string; inicio: string; fim: string | null; revisao: number };
type Pedido = {
  requestId: string;
  clienteId: string;
  planoId: string;
  rotinaId: string;
  serieId: string;
  vigenciaId: string;
  revision: number;
  acao: "criar" | "encerrar";
  data: string;
  motivo: string;
  tentativaIncerta?: boolean;
};
export function VigenciaSerieRotina({
  userId,
  clienteId,
  planoId,
  rotinaId,
  serieId,
}: { userId: string; clienteId: string; planoId: string; rotinaId: string; serieId: string }) {
  const chave = `sso-vigencia-rotina-serie:${JSON.stringify([userId, clienteId, planoId, rotinaId, serieId])}`;
  const cache = useQueryClient();
  const primeira = useRef(false);
  const trava = useRef(false);
  async function atualizarProjecoesRelacionadas() {
    await Promise.all([
      cache.invalidateQueries({
        queryKey: ["previa-ocorrencia-visita", userId, clienteId, planoId],
      }),
      cache.invalidateQueries({ queryKey: ["ciclos-uniformes", userId, clienteId, planoId] }),
      cache.invalidateQueries({ queryKey: ["reserva-futuro-visitas", userId, clienteId, planoId] }),
      cache.invalidateQueries({ queryKey: ["reserva-futuro", userId, clienteId, planoId] }),
    ]);
  }
  const [selecionado, setSelecionado] = useState("");
  const [acao, setAcao] = useState<Pedido["acao"]>("criar");
  const [data, setData] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const p = JSON.parse(salvo) as Pedido;
      return p &&
        p.clienteId === clienteId &&
        p.planoId === planoId &&
        p.rotinaId === rotinaId &&
        p.serieId === serieId &&
        typeof p.requestId === "string" &&
        typeof p.vigenciaId === "string" &&
        Number.isSafeInteger(p.revision) &&
        ["criar", "encerrar"].includes(p.acao) &&
        typeof p.data === "string" &&
        typeof p.motivo === "string" &&
        (p.tentativaIncerta === undefined || typeof p.tentativaIncerta === "boolean")
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const vigencias = useInfiniteQuery({
    queryKey: ["rotina-serie-vigencias", userId, clienteId, planoId, rotinaId, serieId],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data: rows, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_vigencias_serie_mediada", {
          p_ator: userId,
          p_cliente: clienteId,
          p_plano: planoId,
          p_rotina: rotinaId,
          p_serie: serieId,
          p_apos: pageParam,
          p_limite: 30,
        })
        .abortSignal(signal);
      if (error) throw error;
      await conferirSessaoDiagnostico(userId, signal);
      if (
        !Array.isArray(rows) ||
        rows.some(
          (v) =>
            typeof v.id !== "string" ||
            typeof v.inicio !== "string" ||
            !Number.isSafeInteger(v.revisao),
        )
      )
        throw new Error("Vigências inválidas.");
      return rows as Vigencia[];
    },
    getNextPageParam: (pagina) => (pagina.length === 30 ? pagina.at(-1)?.id : undefined),
  });
  const eventos = useInfiniteQuery({
    queryKey: ["rotina-serie-eventos", userId, clienteId, planoId, selecionado],
    gcTime: 0,
    enabled: !!selecionado,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data: rows, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_eventos_vigencia_mediada", {
          p_ator: userId,
          p_cliente: clienteId,
          p_plano: planoId,
          p_vigencia: selecionado,
          p_apos: pageParam,
          p_limite: 30,
        })
        .abortSignal(signal);
      if (error) throw error;
      await conferirSessaoDiagnostico(userId, signal);
      if (
        !Array.isArray(rows) ||
        rows.some(
          (e) =>
            typeof e.id !== "string" ||
            !Number.isSafeInteger(e.revisao) ||
            typeof e.acao !== "string" ||
            typeof e.motivo !== "string",
        )
      )
        throw new Error("Histórico inválido.");
      return rows as {
        id: string;
        revisao: number;
        acao: string;
        motivo: string;
        ator_id: string;
        criado_em: string;
      }[];
    },
    getNextPageParam: (pagina) => (pagina.length === 30 ? pagina.at(-1)?.revisao : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessaoDiagnostico(userId);
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada");
      const { data: resultado, error } = await supabase
        .schema("pcm")
        .rpc("sso_decidir_vigencia_serie_mediada", {
          p_ator: userId,
          p_cliente: p.clienteId,
          p_request: p.requestId,
          p_plano: p.planoId,
          p_rotina: p.rotinaId,
          p_serie: p.serieId,
          p_vigencia: p.vigenciaId,
          p_revisao: p.revision,
          p_acao: p.acao,
          p_data: p.data,
          p_motivo: p.motivo,
        });
      if (error) throw error;
      if (
        !resultado ||
        resultado.requestId !== p.requestId ||
        resultado.vigenciaId !== p.vigenciaId ||
        resultado.revision !== p.revision + 1
      )
        throw new Error("Resposta inválida.");
    },
    onSuccess: async (_r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        if (sessionStorage.getItem(chave) !== JSON.stringify(p))
          throw new Error("Tentativa alterada");
        sessionStorage.removeItem(chave);
      } catch {
        setMensagem("Vigência registrada, mas tentativa não foi removida. Procure suporte.");
        return;
      }
      setPedido(null);
      setMensagem("Vigência registrada sem criar ocorrências.");
      await cache.invalidateQueries({
        queryKey: ["rotina-serie-vigencias", userId, clienteId, planoId, rotinaId, serieId],
      });
      await cache.invalidateQueries({
        queryKey: ["rotina-serie-eventos", userId, clienteId, planoId],
      });
      await atualizarProjecoesRelacionadas();
    },
    onError: async (error, p) => {
      const e = error as { code?: string; message?: string };
      if (primeira.current && e.code === "P0011" && e.message === "revisao_obsoleta") {
        try {
          await conferirSessaoDiagnostico(userId);
          if (sessionStorage.getItem(chave) !== JSON.stringify(p))
            throw new Error("Tentativa alterada");
          sessionStorage.removeItem(chave);
          setPedido(null);
          setMensagem("A vigência mudou. Atualize e confira novamente.");
          await cache.invalidateQueries({
            queryKey: ["rotina-serie-vigencias", userId, clienteId, planoId, rotinaId, serieId],
          });
          await atualizarProjecoesRelacionadas();
          return;
        } catch {
          /* Preserva tentativa se houver dúvida. */
        }
      }
      setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte.");
    },
    onSettled: () => {
      primeira.current = false;
      trava.current = false;
    },
  });
  function enviar(p: Pedido) {
    if (trava.current) return;
    trava.current = true;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada");
      primeira.current = p.tentativaIncerta === false;
      const marcado = { ...p, tentativaIncerta: true };
      sessionStorage.setItem(chave, JSON.stringify(marcado));
      setPedido(marcado);
      envio.mutate(marcado);
    } catch {
      trava.current = false;
      setMensagem("Não foi possível guardar a tentativa; nada foi enviado.");
    }
  }
  const vigente = vigencias.data?.pages.flat().find((v) => v.id === selecionado);
  return (
    <section aria-label={`Vigências da série ${serieId}`}>
      <h5>Vigências da série</h5>
      <p>
        Encerramento preserva histórico e não cancela ocorrências; datas retroativas não são aceitas
        nesta etapa.
      </p>
      {vigencias.isFetching && <output>Carregando vigências…</output>}
      {vigencias.isError && (
        <p role="alert">
          Vigências indisponíveis.{" "}
          <button type="button" onClick={() => void vigencias.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!vigencias.isFetching && !vigencias.isError && (
        <ul>
          {vigencias.data?.pages.flat().map((v) => (
            <li key={v.id}>
              {v.inicio} a {v.fim ?? "sem fim"} · revisão {v.revisao}{" "}
              <button type="button" onClick={() => setSelecionado(v.id)}>
                Histórico
              </button>
            </li>
          ))}
        </ul>
      )}
      {vigencias.hasNextPage && (
        <button type="button" onClick={() => void vigencias.fetchNextPage()}>
          Mais vigências
        </button>
      )}
      {selecionado && (
        <>
          {eventos.isFetching && <output>Carregando histórico…</output>}
          {eventos.isError && (
            <p role="alert">
              Histórico indisponível.{" "}
              <button type="button" onClick={() => void eventos.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {!eventos.isFetching && !eventos.isError && (
            <ul>
              {eventos.data?.pages.flat().map((e) => (
                <li key={e.id}>
                  {e.acao} · {e.motivo} · {e.ator_id} · {e.criado_em}
                </li>
              ))}
            </ul>
          )}
          {eventos.hasNextPage && (
            <button type="button" onClick={() => void eventos.fetchNextPage()}>
              Mais eventos
            </button>
          )}
        </>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (
            pedido ||
            !data ||
            !motivo.trim() ||
            vigencias.isFetching ||
            vigencias.isError ||
            (acao === "encerrar" && (!vigente || vigente.fim !== null))
          )
            return;
          const p: Pedido = {
            requestId: crypto.randomUUID(),
            clienteId,
            planoId,
            rotinaId,
            serieId,
            vigenciaId: acao === "criar" ? crypto.randomUUID() : vigente!.id,
            revision: acao === "criar" ? 0 : vigente!.revisao,
            acao,
            data,
            motivo: motivo.trim(),
            tentativaIncerta: false,
          };
          try {
            if (sessionStorage.getItem(chave) !== null) {
              setMensagem("Há tentativa anterior; reabra para recuperar.");
              return;
            }
            sessionStorage.setItem(chave, JSON.stringify(p));
          } catch {
            setMensagem("Não foi possível guardar tentativa; nada foi enviado.");
            return;
          }
          setPedido(p);
          enviar(p);
        }}
      >
        <fieldset
          disabled={!!pedido || envio.isPending || vigencias.isFetching || vigencias.isError}
        >
          <label>
            Ação{" "}
            <select value={acao} onChange={(e) => setAcao(e.target.value as Pedido["acao"])}>
              <option value="criar">Criar vigência</option>
              <option value="encerrar">Encerrar vigência selecionada</option>
            </select>
          </label>
          {acao === "encerrar" && (
            <p>
              Período selecionado:{" "}
              {vigente ? `${vigente.inicio} a ${vigente.fim ?? "sem fim"}` : "nenhum"}
            </p>
          )}
          <label>
            Data {acao === "criar" ? "inicial" : "final"}{" "}
            <input required type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label>
            Motivo{" "}
            <input
              required
              maxLength={2000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={acao === "encerrar" && (!vigente || vigente.fim !== null)}
          >
            Confirmar vigência
          </button>
        </fieldset>
      </form>
      {pedido === "invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
      {pedido && pedido !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pedido)}>
          Repetir mesmo pedido
        </button>
      )}
      {mensagem && <p role="status">{mensagem}</p>}
    </section>
  );
}
