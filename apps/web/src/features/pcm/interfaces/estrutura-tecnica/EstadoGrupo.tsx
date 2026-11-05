import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Base = { userId: string; clienteId: string };
type Props = Base & {
  grupoId: string;
  nome: string;
  revisao: number;
  ativo: boolean;
  disponivel: boolean;
};
const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    userId: z.string().uuid(),
    clienteId: z.string().uuid(),
    grupoId: z.string().uuid(),
    revision: z.number().int().positive(),
    ativo: z.boolean(),
    motivo: z.string().min(1).max(2000),
  })
  .strict();
const linhaSchema = z
  .object({
    id: z.string().uuid(),
    nome: z.string(),
    revisao: z.number().int().positive(),
    local_id: z.string().uuid(),
  })
  .strict();
export function EstadoGrupo(p: Props) {
  if (import.meta.env.VITE_SSO_ESTADO_GRUPO_ENABLED !== "true") return null;
  return <Comando key={JSON.stringify([p.userId, p.clienteId, p.grupoId])} {...p} />;
}
function Comando(p: Props) {
  const key = `sso-estado-grupo:${JSON.stringify([p.userId, p.clienteId, p.grupoId])}`;
  const [pendente, setPendente] = useState<z.infer<typeof pedidoSchema> | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const v = pedidoSchema.parse(JSON.parse(raw));
      return v.userId === p.userId && v.clienteId === p.clienteId && v.grupoId === p.grupoId
        ? v
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const [aberto, setAberto] = useState(false),
    [motivo, setMotivo] = useState(""),
    [revisao, setRevisao] = useState(p.revisao),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false),
    montado = useRef(false),
    client = useQueryClient();
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  async function enviar(v: z.infer<typeof pedidoSchema>) {
    if (trava.current || !p.disponivel) return;
    trava.current = true;
    setOcupado(true);
    setAviso("");
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== p.userId) throw new Error("sessao_alterada");
      if (sessionStorage.getItem(key) !== JSON.stringify(v)) throw new Error("tentativa_alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_alterar_estado_grupo", {
        p_request_id: v.requestId,
        p_grupo_id: v.grupoId,
        p_expected_revision: v.revision,
        p_ativo: v.ativo,
        p_motivo: v.motivo,
      });
      if (error) throw error;
      const r = z
        .object({
          aggregateId: z.string().uuid(),
          revision: z.number().int().positive(),
          requestId: z.string().uuid(),
          ativo: z.boolean(),
        })
        .strict()
        .parse(data);
      if (
        r.aggregateId !== v.grupoId ||
        r.requestId !== v.requestId ||
        r.revision !== v.revision + 1 ||
        r.ativo !== v.ativo
      )
        throw new Error("resposta_divergente");
      const depois = await supabase.auth.getUser();
      if (
        depois.error ||
        depois.data.user?.id !== p.userId ||
        !montado.current ||
        sessionStorage.getItem(key) !== JSON.stringify(v)
      )
        throw new Error("sessao_alterada");
      sessionStorage.removeItem(key);
      setPendente(null);
      setAberto(false);
      setAviso("Estado atualizado; a programação deve ser conferida.");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["estrutura-tecnica", p.userId, p.clienteId] }),
        client.invalidateQueries({ queryKey: ["grupos-inativos", p.userId, p.clienteId] }),
      ]);
    } catch {
      if (montado.current)
        setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte.");
    } finally {
      trava.current = false;
      if (montado.current) setOcupado(false);
    }
  }
  function iniciar() {
    if (pendente || trava.current || !p.disponivel || revisao !== p.revisao) return;
    try {
      const v = pedidoSchema.parse({
        requestId: crypto.randomUUID(),
        userId: p.userId,
        clienteId: p.clienteId,
        grupoId: p.grupoId,
        revision: revisao,
        ativo: !p.ativo,
        motivo: motivo.trim(),
      });
      if (sessionStorage.getItem(key) !== null) throw new Error("tentativa_existente");
      sessionStorage.setItem(key, JSON.stringify(v));
      setPendente(v);
      void enviar(v);
    } catch {
      setAviso("Confira o motivo e a sessão. Nenhuma alteração foi enviada.");
    }
  }
  return (
    <section aria-label={`Estado de ${p.nome}`}>
      {pendente === "invalido" ? (
        <p role="alert">Tentativa local ilegível. Consulte suporte.</p>
      ) : pendente ? (
        <button
          type="button"
          disabled={ocupado || !p.disponivel}
          onClick={() => void enviar(pendente)}
        >
          Repetir alteração de estado
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={!p.disponivel}
            onClick={() => {
              if (!aberto) {
                setRevisao(p.revisao);
                setMotivo("");
              }
              setAberto((v) => !v);
            }}
          >
            {p.ativo ? "Inativar Grupo" : "Reativar Grupo"}
          </button>
          {aberto && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                iniciar();
              }}
            >
              <p>
                A alteração não altera automaticamente Planos, ocorrências ou OS; confira a
                programação antes de prosseguir. Quantidade, vínculos e características serão
                preservados.
              </p>
              {p.revisao !== revisao && (
                <p role="alert">A revisão mudou. Feche e reabra para conferir novamente.</p>
              )}
              <label>
                Motivo da alteração{" "}
                <textarea
                  required
                  maxLength={2000}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={!p.disponivel || ocupado || p.revisao !== revisao || !motivo.trim()}
              >
                {p.ativo ? "Confirmar inativação" : "Confirmar reativação"}
              </button>
            </form>
          )}
        </>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
export function GruposInativos(p: Base & { locais: { id: string; nome: string }[] }) {
  if (import.meta.env.VITE_SSO_ESTADO_GRUPO_ENABLED !== "true") return null;
  return <Lista key={JSON.stringify([p.userId, p.clienteId])} {...p} />;
}
function Lista(p: Base & { locais: { id: string; nome: string }[] }) {
  const consulta = useInfiniteQuery({
    queryKey: ["grupos-inativos", p.userId, p.clienteId],
    initialPageParam: null as string | null,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_grupos_inativos", {
          p_cliente_id: p.clienteId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      return z.array(linhaSchema).max(20).parse(data);
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  return (
    <section aria-label="Grupos inativos">
      <h3>Grupos inativos</h3>
      {consulta.isFetching && <p>Consultando grupos inativos…</p>}
      {consulta.isError && (
        <p role="alert">
          Grupos inativos indisponíveis ou sem acesso.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length === 0 && (
        <p>Nenhum Grupo inativo.</p>
      )}
      {!consulta.isFetching &&
        !consulta.isError &&
        consulta.data?.pages.flat().map((g) => (
          <article key={g.id}>
            <p>
              {g.nome} · {p.locais.find((l) => l.id === g.local_id)?.nome ?? "Local indisponível"}
            </p>
            <EstadoGrupo
              userId={p.userId}
              clienteId={p.clienteId}
              grupoId={g.id}
              nome={g.nome}
              revisao={g.revisao}
              ativo={false}
              disponivel={!consulta.isFetching && !consulta.isError}
            />
          </article>
        ))}
      {!consulta.isError && consulta.hasNextPage && (
        <button type="button" onClick={() => void consulta.fetchNextPage()}>
          Mais Grupos inativos
        </button>
      )}
    </section>
  );
}
