import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { GrupoQuantitativo } from "../../application/estrutura-tecnica-gateway";
import { estruturaTecnicaQueryKeys } from "../../application/estrutura-tecnica-queries";

const schema = z
  .object({
    requestId: z.string().uuid(),
    userId: z.string().uuid(),
    clienteId: z.string().uuid(),
    grupoId: z.string().uuid(),
    revision: z.number().int().positive(),
    localDestinoId: z.string().uuid(),
    motivo: z.string().min(1).max(2000),
  })
  .strict();
type Pedido = z.infer<typeof schema>;
type Props = {
  userId: string;
  clienteId: string;
  grupo: GrupoQuantitativo;
  locais: { id: string; nome: string }[];
  disponivel: boolean;
};
export function MoverGrupo(props: Props) {
  if (import.meta.env.VITE_SSO_MOVER_GRUPO_ENABLED !== "true") return null;
  return (
    <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.grupo.id])} {...props} />
  );
}
function Conteudo({ userId, clienteId, grupo, locais, disponivel }: Props) {
  const key = `sso-mover-grupo:${JSON.stringify([userId, clienteId, grupo.id])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const p = schema.parse(JSON.parse(raw));
      return p.userId === userId && p.clienteId === clienteId && p.grupoId === grupo.id
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const [aberto, setAberto] = useState(false);
  const [revisaoConferida, setRevisaoConferida] = useState(grupo.revisao);
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState("");
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const client = useQueryClient();
  const impacto = useQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, grupo.id, "impacto-rotinas", grupo.revisao],
    enabled: aberto && import.meta.env.VITE_SSO_IMPACTO_GRUPO_ENABLED === "true",
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada");
      const mediado = import.meta.env.VITE_SSO_IMPACTO_GRUPO_MEDIADO_ENABLED === "true";
      const { data, error } = await (mediado
        ? supabase.schema("pcm").rpc("sso_impacto_rotinas_grupo_mediado", {
            p_ator_id: userId,
            p_cliente_id: clienteId,
            p_grupo_id: grupo.id,
          })
        : supabase.schema("pcm").rpc("sso_impacto_rotinas_grupo", { p_grupo_id: grupo.id })
      ).abortSignal(signal);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada");
      if (error) throw error;
      const r = z
        .object({
          grupoId: z.string().uuid(),
          rotinasDiretasVigentes: z.number().int().nonnegative(),
        })
        .strict()
        .parse(data);
      if (r.grupoId !== grupo.id) throw new Error("Grupo divergente");
      return r;
    },
  });
  const execucao = useQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, grupo.id, "impacto-execucao", grupo.revisao],
    enabled: aberto && import.meta.env.VITE_SSO_IMPACTO_EXECUCAO_GRUPO_ENABLED === "true",
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada");
      const mediado = import.meta.env.VITE_SSO_IMPACTO_GRUPO_MEDIADO_ENABLED === "true";
      const { data, error } = await (mediado
        ? supabase.schema("pcm").rpc("sso_impacto_execucao_grupo_mediado", {
            p_ator_id: userId,
            p_cliente_id: clienteId,
            p_grupo_id: grupo.id,
          })
        : supabase.schema("pcm").rpc("sso_impacto_execucao_grupo", { p_grupo_id: grupo.id })
      ).abortSignal(signal);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada");
      if (error) throw error;
      const r = z
        .object({
          grupoId: z.string().uuid(),
          ocorrenciasPreparadas: z.number().int().nonnegative(),
          osReferenciadasPorPendencia: z.number().int().nonnegative(),
        })
        .strict()
        .parse(data);
      if (r.grupoId !== grupo.id) throw new Error("Grupo divergente");
      return r;
    },
  });
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  async function conferirSessao() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || !montado.current) throw new Error("Sessão alterada.");
  }
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao();
      if (sessionStorage.getItem(key) !== JSON.stringify(p)) throw new Error("Tentativa alterada.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_mover_grupo_autorizado", {
        p_request_id: p.requestId,
        p_grupo_id: p.grupoId,
        p_expected_revision: p.revision,
        p_local_destino_id: p.localDestinoId,
        p_motivo: p.motivo,
      });
      if (error) throw error;
      const r = z
        .object({
          aggregateId: z.string().uuid(),
          revision: z.number().int().positive(),
          requestId: z.string().uuid(),
          localId: z.string().uuid(),
        })
        .strict()
        .parse(data);
      if (
        r.aggregateId !== p.grupoId ||
        r.revision !== p.revision + 1 ||
        r.requestId !== p.requestId ||
        r.localId !== p.localDestinoId
      )
        throw new Error("Resposta divergente");
    },
    onSuccess: async (_r, p) => {
      try {
        await conferirSessao();
        if (sessionStorage.getItem(key) !== JSON.stringify(p))
          throw new Error("Tentativa divergente");
        sessionStorage.removeItem(key);
      } catch {
        setAviso("Movimentação confirmada; tentativa local não foi limpa. Consulte suporte.");
        return;
      }
      setPendente(null);
      setAberto(false);
      setAviso("Movimentação registrada.");
      await Promise.all([
        client.invalidateQueries({ queryKey: estruturaTecnicaQueryKeys.grupos(userId, clienteId) }),
        client.invalidateQueries({
          queryKey: estruturaTecnicaQueryKeys.historico(userId, clienteId, grupo.id),
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
    if (trava.current || !disponivel) return;
    trava.current = true;
    envio.mutate(p);
  }
  function iniciar() {
    if (
      !disponivel ||
      grupo.revisao !== revisaoConferida ||
      pendente ||
      trava.current ||
      destino === grupo.localId ||
      !locais.some((l) => l.id === destino)
    )
      return;
    try {
      const p = schema.parse({
        requestId: crypto.randomUUID(),
        userId,
        clienteId,
        grupoId: grupo.id,
        revision: revisaoConferida,
        localDestinoId: destino,
        motivo: motivo.trim(),
      });
      if (sessionStorage.getItem(key) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(key, JSON.stringify(p));
      setPendente(p);
      enviar(p);
    } catch {
      setAviso("Confira os dados e a sessão. Nada foi enviado.");
    }
  }
  return (
    <section aria-label={`Mover ${grupo.nome}`}>
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
      {pendente && pendente !== "invalido" ? (
        <button
          type="button"
          disabled={!disponivel || envio.isPending}
          onClick={() => enviar(pendente)}
        >
          Repetir movimentação
        </button>
      ) : (
        !pendente && (
          <>
            <button
              type="button"
              disabled={!disponivel}
              onClick={() => {
                if (!aberto) {
                  setRevisaoConferida(grupo.revisao);
                  setDestino("");
                  setMotivo("");
                }
                setAberto((v) => !v);
              }}
            >
              Mover Grupo
            </button>
            {aberto && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  iniciar();
                }}
              >
                <p>
                  Sistema, quantidade e características serão preservados. Revisão conferida:{" "}
                  {revisaoConferida}.
                </p>
                {import.meta.env.VITE_SSO_IMPACTO_GRUPO_ENABLED === "true" && (
                  <p>
                    {impacto.isPending
                      ? "Consultando rotinas diretamente vinculadas…"
                      : impacto.isError
                        ? "Impacto em rotinas indisponível; confira a programação antes de prosseguir."
                        : `${impacto.data.rotinasDiretasVigentes} rotina(s) aprovada(s) e vigente(s) apontam diretamente para este Grupo.`}{" "}
                    A prévia não cobre vínculos indiretos, ocorrências ou OS e não altera a
                    programação.
                  </p>
                )}
                {import.meta.env.VITE_SSO_IMPACTO_EXECUCAO_GRUPO_ENABLED === "true" && (
                  <p>
                    {execucao.isPending
                      ? "Consultando referências de execução…"
                      : execucao.isError
                        ? "Referências de execução indisponíveis; confira antes de prosseguir."
                        : `${execucao.data.ocorrenciasPreparadas} ocorrência(s) preparada(s) e ${execucao.data.osReferenciadasPorPendencia} OS referenciada(s) por pendências apontam para este Grupo.`}{" "}
                    Contagem parcial, sem indicação de estado; não altera ocorrências ou OS.
                  </p>
                )}
                {grupo.revisao !== revisaoConferida && (
                  <p role="alert">
                    O grupo mudou. Feche e abra novamente para conferir a revisão atual.
                  </p>
                )}
                <label>
                  Local de destino{" "}
                  <select required value={destino} onChange={(e) => setDestino(e.target.value)}>
                    <option value="">Selecione</option>
                    {locais
                      .filter((l) => l.id !== grupo.localId)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nome}
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
                <button
                  type="submit"
                  disabled={
                    !disponivel ||
                    grupo.revisao !== revisaoConferida ||
                    envio.isPending ||
                    !motivo.trim() ||
                    !destino
                  }
                >
                  Confirmar movimentação
                </button>
              </form>
            )}
          </>
        )
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
