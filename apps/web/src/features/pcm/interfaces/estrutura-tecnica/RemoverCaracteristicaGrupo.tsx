import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { GrupoQuantitativo } from "../../application/estrutura-tecnica-gateway";
import { estruturaTecnicaQueryKeys } from "../../application/estrutura-tecnica-queries";
type Props = { userId: string; clienteId: string; grupo: GrupoQuantitativo; disponivel: boolean };
const pedido = z
  .object({
    requestId: z.string().uuid(),
    userId: z.string().uuid(),
    clienteId: z.string().uuid(),
    grupoId: z.string().uuid(),
    revision: z.number().int().positive(),
    chave: z.string().min(1).max(200),
    motivo: z.string().min(1).max(2000),
  })
  .strict();
type Pedido = z.infer<typeof pedido>;
const evento = z
  .object({
    request_id: z.string().uuid(),
    revisao_anterior: z.number().int().positive(),
    revisao_nova: z.number().int().positive(),
    chave: z.string(),
    motivo: z.string(),
    antes: z.record(z.unknown()),
    depois: z.record(z.unknown()),
    ator_id: z.string().uuid(),
    criado_em: z.string().datetime({ offset: true }),
  })
  .strict();
export function RemoverCaracteristicaGrupo(props: Props) {
  if (import.meta.env.VITE_SSO_REMOVER_CARACTERISTICA_GRUPO_ENABLED !== "true") return null;
  return (
    <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.grupo.id])} {...props} />
  );
}
function Conteudo({ userId, clienteId, grupo, disponivel }: Props) {
  const key = `sso-remover-caracteristica:${JSON.stringify([userId, clienteId, grupo.id])}`;
  const client = useQueryClient();
  const trava = useRef(false);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const p = pedido.parse(JSON.parse(raw));
      return p.userId === userId && p.clienteId === clienteId && p.grupoId === grupo.id
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const [aberto, setAberto] = useState(false);
  const [revision, setRevision] = useState(grupo.revisao);
  const [chave, setChave] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirma, setConfirma] = useState(false);
  const [aviso, setAviso] = useState("");
  const hist = useInfiniteQuery({
    queryKey: ["grupo-remocoes-caracteristicas", userId, clienteId, grupo.id],
    enabled: aberto,
    gcTime: 0,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_historico_remocao_caracteristica", {
          p_cliente_id: clienteId,
          p_grupo_id: grupo.id,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      return z.array(evento).max(20).parse(data);
    },
    getNextPageParam: (p) => (p.length === 20 ? p[p.length - 1]?.revisao_nova : undefined),
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      const { data, error } = await supabase.schema("pcm").rpc("sso_remover_caracteristica_grupo", {
        p_request_id: p.requestId,
        p_grupo_id: p.grupoId,
        p_expected_revision: p.revision,
        p_chave: p.chave,
        p_motivo: p.motivo,
      });
      if (error) throw error;
      const r = z
        .object({
          requestId: z.string().uuid(),
          grupoId: z.string().uuid(),
          revision: z.number().int().positive(),
          chave: z.string(),
        })
        .strict()
        .parse(data);
      if (
        r.requestId !== p.requestId ||
        r.grupoId !== p.grupoId ||
        r.revision !== p.revision + 1 ||
        r.chave !== p.chave
      )
        throw new Error("Resposta divergente");
    },
    onSuccess: async (_r, p) => {
      try {
        if (sessionStorage.getItem(key) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(key);
      } catch {
        setAviso("Remoção registrada; tentativa local não foi limpa. Consulte suporte.");
        return;
      }
      setPendente(null);
      setConfirma(false);
      setAviso("Característica removida; histórico preservado.");
      await Promise.all([
        client.invalidateQueries({ queryKey: estruturaTecnicaQueryKeys.grupos(userId, clienteId) }),
        client.invalidateQueries({
          queryKey: estruturaTecnicaQueryKeys.historico(userId, clienteId, grupo.id),
        }),
        client.invalidateQueries({
          queryKey: ["grupo-remocoes-caracteristicas", userId, clienteId, grupo.id],
        }),
      ]);
    },
    onError: () =>
      setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),
    onSettled: () => {
      trava.current = false;
    },
  });
  function enviar(p: Pedido) {
    if (!disponivel || trava.current) return;
    trava.current = true;
    envio.mutate(p);
  }
  function iniciar() {
    if (
      !disponivel ||
      pendente ||
      trava.current ||
      grupo.revisao !== revision ||
      !confirma ||
      !motivo.trim() ||
      !Object.prototype.hasOwnProperty.call(grupo.caracteristicas, chave)
    )
      return;
    try {
      const p = pedido.parse({
        requestId: crypto.randomUUID(),
        userId,
        clienteId,
        grupoId: grupo.id,
        revision,
        chave,
        motivo: motivo.trim(),
      });
      if (sessionStorage.getItem(key) !== null) throw new Error();
      sessionStorage.setItem(key, JSON.stringify(p));
      setPendente(p);
      enviar(p);
    } catch {
      setAviso("Confira chave, revisão e motivo. Nada foi enviado.");
    }
  }
  return (
    <section>
      <button
        type="button"
        disabled={!disponivel}
        aria-expanded={aberto}
        onClick={() => {
          if (!aberto) {
            setRevision(grupo.revisao);
            setChave("");
            setConfirma(false);
          }
          setAberto(!aberto);
        }}
      >
        {aberto ? "Ocultar remoção de característica" : "Remover característica com motivo"}
      </button>
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button
          type="button"
          disabled={!disponivel || envio.isPending}
          onClick={() => enviar(pendente)}
        >
          Repetir remoção
        </button>
      )}
      {aberto && (
        <>
          <p>Revisão conferida {revision}; somente a chave selecionada será removida.</p>
          {grupo.revisao !== revision && (
            <p role="alert">Grupo alterado. Feche e abra novamente para conferir.</p>
          )}
          {!pendente && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                iniciar();
              }}
            >
              <label>
                Característica{" "}
                <select required value={chave} onChange={(e) => setChave(e.target.value)}>
                  <option value="">Selecione</option>
                  {Object.entries(grupo.caracteristicas).map(([k, v]) => (
                    <option key={k} value={k}>
                      {k}: {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Motivo{" "}
                <textarea
                  required
                  maxLength={2000}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={confirma}
                  onChange={(e) => setConfirma(e.target.checked)}
                />{" "}
                Confirmo remover esta característica.
              </label>
              <button
                type="submit"
                disabled={
                  !disponivel ||
                  grupo.revisao !== revision ||
                  !chave ||
                  !motivo.trim() ||
                  !confirma ||
                  envio.isPending
                }
              >
                Remover
              </button>
            </form>
          )}
          <h5>Histórico de remoções</h5>
          <p>Somente remoções registradas nesta trilha.</p>
          {hist.isPending && <output>Consultando…</output>}
          {hist.isError && (
            <p role="alert">
              Histórico indisponível.{" "}
              <button type="button" onClick={() => void hist.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {hist.data && (
            <ol>
              {hist.data.pages.flat().map((e) => (
                <li key={e.request_id}>
                  Chave {e.chave} · revisão {e.revisao_anterior} para {e.revisao_nova} · motivo{" "}
                  {e.motivo} · {e.ator_id} ·{" "}
                  <time dateTime={e.criado_em}>
                    {new Date(e.criado_em).toLocaleString("pt-BR")}
                  </time>
                  <details>
                    <summary>Antes e depois</summary>
                    <pre>{JSON.stringify({ antes: e.antes, depois: e.depois }, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ol>
          )}
          {hist.hasNextPage && (
            <button
              type="button"
              disabled={hist.isFetchingNextPage}
              onClick={() => void hist.fetchNextPage()}
            >
              Mais registros
            </button>
          )}
        </>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
