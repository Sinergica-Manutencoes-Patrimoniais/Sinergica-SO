import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { haSobreposicaoIntervalos } from "../../domain/sobreposicao-intervalos";
import { converterHorarioLocal } from "../visitas/horario-local";
import { VinculoIntervalo } from "./VinculoIntervalo";

type Pedido = {
  requestId: string;
  intervaloId: string;
  clienteId: string;
  disponibilidadeId: string;
  revision: number;
  tipo: string;
  inicio: string;
  fim: string;
  fuso: string;
  referencia: string;
};
export function IntervalosDeclarados({
  userId,
  clienteId,
  disponibilidadeId,
  revision,
}: { userId: string; clienteId: string; disponibilidadeId: string; revision: number }) {
  const chave = `sso-capacidade-intervalo:${JSON.stringify([userId, clienteId, disponibilidadeId])}`;
  const cache = useQueryClient();
  const [tipo, setTipo] = useState("ausencia");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [referencia, setReferencia] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [pedido, setPedido] = useState<Pedido | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return null;
      const p = JSON.parse(salvo) as Pedido;
      return p &&
        p.clienteId === clienteId &&
        p.disponibilidadeId === disponibilidadeId &&
        typeof p.requestId === "string" &&
        typeof p.intervaloId === "string" &&
        Number.isSafeInteger(p.revision) &&
        typeof p.inicio === "string" &&
        typeof p.fim === "string" &&
        typeof p.fuso === "string" &&
        typeof p.referencia === "string" &&
        ["ausencia", "reserva"].includes(p.tipo)
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const lista = useInfiniteQuery({
    queryKey: ["capacidade-intervalos", userId, clienteId, disponibilidadeId],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_intervalos_capacidade", {
          p_disponibilidade_id: disponibilidadeId,
          p_apos: pageParam,
          p_limite: 30,
        })
        .abortSignal(signal);
      if (error) throw error;
      if (
        !Array.isArray(data) ||
        data.some(
          (i) =>
            typeof i.id !== "string" ||
            typeof i.tipo !== "string" ||
            typeof i.inicio !== "string" ||
            typeof i.fim !== "string" ||
            typeof i.fuso !== "string" ||
            typeof i.referencia !== "string",
        )
      )
        throw new Error("Resposta inválida.");
      return data as {
        id: string;
        tipo: string;
        inicio: string;
        fim: string;
        fuso: string;
        referencia: string;
      }[];
    },
    getNextPageParam: (pagina) => (pagina.length === 30 ? pagina.at(-1)?.id : undefined),
  });
  let sobreposicao: boolean | null = null;
  if (lista.data && !lista.isError && !lista.isFetching) {
    try {
      sobreposicao = haSobreposicaoIntervalos(lista.data.pages.flat());
    } catch {
      sobreposicao = null;
    }
  }
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_declarar_intervalo_capacidade", {
          p_request_id: p.requestId,
          p_intervalo_id: p.intervaloId,
          p_disponibilidade_id: p.disponibilidadeId,
          p_expected_revision: p.revision,
          p_tipo: p.tipo,
          p_inicio: p.inicio,
          p_fim: p.fim,
          p_fuso: p.fuso,
          p_referencia: p.referencia,
        });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.intervaloId !== p.intervaloId ||
        data.descontadoAutomaticamente !== false
      )
        throw new Error("Resposta inválida.");
    },
    onSuccess: async (_resultado, p) => {
      let retirada = false;
      try {
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) {
          setMensagem(
            "Intervalo registrado, mas tentativa divergente não foi removida. Procure suporte.",
          );
        } else {
          sessionStorage.removeItem(chave);
          retirada = true;
        }
      } catch {
        setMensagem("Intervalo registrado, mas tentativa não foi removida. Procure suporte.");
      }
      if (retirada) {
        setPedido(null);
        setMensagem("Intervalo declarado. Totais não foram alterados nem descontados novamente.");
      }
      await cache.invalidateQueries({
        queryKey: ["capacidade-intervalos", userId, clienteId, disponibilidadeId],
      });
      await cache.invalidateQueries({
        queryKey: ["capacidade-conflitos", userId, clienteId, disponibilidadeId],
      });
      await cache.invalidateQueries({
        queryKey: ["capacidade-conflitos-global", userId, clienteId, disponibilidadeId],
      });
    },
    onError: () =>
      setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte."),
  });
  const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <section aria-label="Intervalos declarados">
      <h4>Ausências e reservas declaradas</h4>
      <p>
        Informação manual, não vinculada a RH. Intervalos não são somados ou descontados dos totais;
        confira sobreposições com outros Clientes. Horários no fuso deste dispositivo: {fuso}.
      </p>
      {lista.isFetching && <output>Carregando intervalos…</output>}
      {lista.isError && (
        <p role="alert">
          Intervalos indisponíveis.{" "}
          <button type="button" onClick={() => void lista.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {sobreposicao === true && (
        <p role="alert">
          Intervalos carregados se sobrepõem. Revise os descontos declarados; nada foi ajustado
          automaticamente.
        </p>
      )}
      {lista.data && !lista.isFetching && !lista.isError && sobreposicao === null && (
        <p role="alert">Não foi possível conferir sobreposições: intervalo inválido.</p>
      )}
      {lista.hasNextPage && (
        <p>A conferência é parcial: existem intervalos ainda não carregados.</p>
      )}
      {!lista.isFetching && !lista.isError && (
        <ul>
          {lista.data?.pages.flat().map((i) => (
            <li key={i.id}>
              {i.tipo} · {i.inicio} a {i.fim} · {i.fuso} · fonte declarada {i.referencia}
              {import.meta.env.VITE_SSO_VINCULO_INTERVALO_ENABLED === "true" && (
                <VinculoIntervalo
                  userId={userId}
                  clienteId={clienteId}
                  disponibilidadeId={disponibilidadeId}
                  intervaloId={i.id}
                  revision={revision}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {lista.hasNextPage && (
        <button type="button" onClick={() => void lista.fetchNextPage()}>
          Mais intervalos
        </button>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (pedido || !referencia.trim() || lista.isFetching || lista.isError) return;
          try {
            const inicioUtc = converterHorarioLocal(inicio);
            const fimUtc = converterHorarioLocal(fim);
            if (fimUtc <= inicioUtc) {
              setMensagem("Fim deve ser posterior ao início.");
              return;
            }
            const p: Pedido = {
              requestId: crypto.randomUUID(),
              intervaloId: crypto.randomUUID(),
              clienteId,
              disponibilidadeId,
              revision,
              tipo,
              inicio: inicioUtc,
              fim: fimUtc,
              fuso,
              referencia: referencia.trim(),
            };
            if (sessionStorage.getItem(chave) !== null) {
              setMensagem("Há tentativa anterior; reabra para recuperar.");
              return;
            }
            sessionStorage.setItem(chave, JSON.stringify(p));
            setPedido(p);
            envio.mutate(p);
          } catch {
            setMensagem("Confira horários e armazenamento. Nada foi enviado.");
          }
        }}
      >
        <fieldset disabled={!!pedido || envio.isPending}>
          <label>
            Tipo{" "}
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="ausencia">Ausência</option>
              <option value="reserva">Reserva</option>
            </select>
          </label>
          <label>
            Início{" "}
            <input
              required
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </label>
          <label>
            Fim{" "}
            <input
              required
              type="datetime-local"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </label>
          <label>
            Fonte declarada{" "}
            <input
              required
              maxLength={500}
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </label>
          <button type="submit">Registrar intervalo</button>
        </fieldset>
      </form>
      {pedido === "invalido" && <p role="alert">Tentativa ilegível. Procure suporte.</p>}
      {pedido && pedido !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => envio.mutate(pedido)}>
          Repetir mesmo pedido
        </button>
      )}
      {mensagem && <output>{mensagem}</output>}
    </section>
  );
}
