import { Button } from "@sinergica/ui";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { PlanoResumo, RotinaDetalhe } from "../../application/plano-manutencao-gateway";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";

const id = z.string().uuid();
const pedidoSchema = z
  .object({
    requestId: id,
    atorId: id,
    origemClienteId: id,
    origemPlanoId: id,
    origemRevision: z.number().int().positive(),
    origemVersaoId: id,
    origemRotinaId: id,
    destinoClienteId: id,
    destinoPlanoId: id,
    destinoRevision: z.number().int().positive(),
    destinoRotinaId: id,
    alvoTipo: z.enum(["sistema", "componente", "grupo"]),
    alvoId: id,
  })
  .strict()
  .refine((v) => v.origemPlanoId !== v.destinoPlanoId && v.origemRotinaId !== v.destinoRotinaId);
type Pedido = z.infer<typeof pedidoSchema>;
const reciboSchema = z
  .object({
    requestId: id,
    aggregateId: id,
    revision: z.number().int().positive(),
    state: z.literal("rascunho"),
    created: z.literal(true),
    linkedIds: z.object({ clienteId: id, versaoId: id, rotinaId: id }).passthrough(),
    warnings: z.array(z.unknown()),
    origemPlanoId: id,
    origemVersaoId: id,
    origemRotinaId: id,
    snapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
    questionarioRequerConferencia: z.literal(true),
    recorrenciaRequerConferencia: z.literal(true),
    exigenciasRequeremConferencia: z.literal(true),
    execucaoCriada: z.literal(false),
  })
  .strict();
const paginaClientes = z.array(z.object({ id, nome: z.string() })).max(30);
function conferirPagina(ids: string[], apos: string | null) {
  if (ids.length > 30) throw new Error("Página excede o limite.");
  let anterior = apos?.toLowerCase() ?? "";
  for (const id of ids) {
    const atual = id.toLowerCase();
    if (atual <= anterior) throw new Error("Página divergente.");
    anterior = atual;
  }
}

export function CopiarRotinaModelo(props: Parameters<typeof Conteudo>[0]) {
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.plano.id,
        props.versaoId,
        props.rotina.id,
      ])}
      {...props}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  plano,
  versaoId,
  rotina,
}: {
  userId: string;
  clienteId: string;
  plano: PlanoResumo;
  versaoId: string;
  rotina: RotinaDetalhe;
}) {
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const chave = `sso-copia-rotina:${userId}:${clienteId}:${plano.id}:${versaoId}:${rotina.id}`;
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      if (!salvo) return { pedido: null, invalido: false };
      const pedido = pedidoSchema.parse(JSON.parse(salvo));
      if (
        pedido.atorId !== userId ||
        pedido.origemClienteId !== clienteId ||
        pedido.origemPlanoId !== plano.id ||
        pedido.origemVersaoId !== versaoId ||
        pedido.origemRotinaId !== rotina.id ||
        pedido.alvoTipo !== rotina.alvoTipo
      )
        throw new Error("Origem divergente");
      return { pedido, invalido: false };
    } catch {
      return { pedido: null, invalido: true };
    }
  });
  const [pendente, setPendente] = useState<Pedido | null>(recuperacao.pedido);
  const [destinoCliente, setDestinoCliente] = useState(clienteId);
  const [destinoPlano, setDestinoPlano] = useState("");
  const [alvo, setAlvo] = useState("");
  const [busca, setBusca] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const trava = useRef(false);
  const cache = useQueryClient();
  async function conferirConsulta(signal: AbortSignal) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada");
  }
  const clientes = useInfiniteQuery({
    queryKey: ["copia-rotina-clientes", userId],
    initialPageParam: null as string | null,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirConsulta(signal);
      let q = supabase
        .schema("pcm")
        .from("clientes")
        .select("id,nome")
        .is("deleted_at", null)
        .order("id")
        .limit(30);
      if (pageParam) q = q.gt("id", pageParam);
      const { data, error } = await q.abortSignal(signal);
      if (error) throw error;
      const pagina = paginaClientes.parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const cliente of pagina) {
        const atual = cliente.id.toLowerCase();
        if (atual <= anterior) throw new Error("Página de Clientes divergente");
        anterior = atual;
      }
      await conferirConsulta(signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 30 ? p.at(-1)?.id : undefined),
  });
  const autorizacao = useQuery({
    queryKey: ["copia-rotina-permissao", userId, destinoCliente],
    enabled: Boolean(destinoCliente),
    gcTime: 0,
    queryFn: async ({ signal }) => {
      await conferirConsulta(signal);
      const permitida = await supabaseCapacidadesSsoAdapter.autorizarAcao(
        "plano.gerir",
        destinoCliente,
      );
      await conferirConsulta(signal);
      return permitida;
    },
  });
  const podeConsultar =
    autorizacao.data === true && !autorizacao.isFetching && !autorizacao.isError;
  const planos = useInfiniteQuery({
    queryKey: ["copia-rotina-planos", userId, destinoCliente],
    initialPageParam: null as string | null,
    enabled: Boolean(destinoCliente && podeConsultar),
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirConsulta(signal);
      const pagina = await supabasePlanoManutencaoAdapter.listarPlanos(
        destinoCliente,
        30,
        pageParam,
        signal,
      );
      conferirPagina(
        pagina.map((p) => p.id),
        pageParam,
      );
      if (pagina.some((p) => p.clienteId !== destinoCliente))
        throw new Error("Cliente divergente.");
      await conferirConsulta(signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 30 ? p.at(-1)?.id : undefined),
  });
  const planoSelecionado =
    !planos.isFetching && !planos.isError
      ? planos.data?.pages
          .flat()
          .find(
            (p) =>
              p.id === destinoPlano &&
              p.clienteId === destinoCliente &&
              p.estado === "rascunho" &&
              p.id !== plano.id,
          )
      : undefined;
  const alvos = useInfiniteQuery({
    queryKey: ["copia-rotina-alvos", userId, destinoCliente, destinoPlano, rotina.alvoTipo, busca],
    initialPageParam: null as string | null,
    enabled: Boolean(planoSelecionado && podeConsultar),
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirConsulta(signal);
      const pagina = await supabasePlanoManutencaoAdapter.listarAlvos(
        destinoPlano,
        rotina.alvoTipo,
        30,
        pageParam,
        busca.trim() || null,
        signal,
      );
      conferirPagina(
        pagina.map((a) => a.id),
        pageParam,
      );
      await conferirConsulta(signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 30 ? p.at(-1)?.id : undefined),
  });
  const alvosVisiveis = !alvos.isFetching && !alvos.isError ? (alvos.data?.pages.flat() ?? []) : [];
  const alvoSelecionado = alvosVisiveis.find((a) => a.id === alvo);
  const fotografia =
    planoSelecionado && alvoSelecionado
      ? JSON.stringify({
          userId,
          clienteId,
          origemPlanoId: plano.id,
          origemRevision: plano.revisao,
          versaoId,
          rotinaId: rotina.id,
          alvoTipo: rotina.alvoTipo,
          destinoCliente,
          destinoPlano: planoSelecionado.id,
          destinoRevision: planoSelecionado.revisao,
          destinoNome: planoSelecionado.nome,
          alvoId: alvoSelecionado.id,
          alvoNome: alvoSelecionado.nome,
        })
      : null;
  async function conferirAtor() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error("Sessão alterada");
  }
  async function enviar(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setMensagem("");
    const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor();
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { data, error } = await supabase.schema("pcm").rpc("sso_copiar_rotina_modelo", {
        p_request_id: pedido.requestId,
        p_ator_esperado: pedido.atorId,
        p_origem_cliente_id: pedido.origemClienteId,
        p_origem_plano_id: pedido.origemPlanoId,
        p_origem_revision: pedido.origemRevision,
        p_origem_versao_id: pedido.origemVersaoId,
        p_origem_rotina_id: pedido.origemRotinaId,
        p_destino_cliente_id: pedido.destinoClienteId,
        p_destino_plano_id: pedido.destinoPlanoId,
        p_destino_revision: pedido.destinoRevision,
        p_destino_rotina_id: pedido.destinoRotinaId,
        p_alvo_tipo: pedido.alvoTipo,
        p_alvo_id: pedido.alvoId,
      });
      if (error) throw error;
      const recibo = reciboSchema.parse(data);
      if (
        recibo.requestId !== pedido.requestId ||
        recibo.aggregateId !== pedido.destinoPlanoId ||
        recibo.revision !== pedido.destinoRevision + 1 ||
        recibo.linkedIds.clienteId !== pedido.destinoClienteId ||
        recibo.linkedIds.rotinaId !== pedido.destinoRotinaId ||
        recibo.origemPlanoId !== pedido.origemPlanoId ||
        recibo.origemVersaoId !== pedido.origemVersaoId ||
        recibo.origemRotinaId !== pedido.origemRotinaId
      )
        throw new Error("Recibo divergente");
      await conferirAtor();
      if (!montado.current) throw new Error("Tela desmontada.");
      await cache.invalidateQueries({
        queryKey: planoManutencaoKeys.raiz(userId, pedido.destinoClienteId),
      });
      await conferirAtor();
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave);
      setPendente(null);
      setConfirmacao(null);
      setMensagem(
        "Rotina copiada para o rascunho. Confira alvo, questionário, recorrência e exigências antes de aprovar.",
      );
    } catch {
      setMensagem(
        "Não foi possível confirmar a cópia. A tentativa permanece guardada; repita somente o mesmo pedido ou procure suporte.",
      );
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  async function consultarRecibo(pedido: Pedido) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setMensagem("");
    const serializado = JSON.stringify(pedido);
    try {
      await conferirAtor();
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      const { requestId, atorId, ...dados } = pedido;
      const payload: Record<string, unknown> = { ...dados };
      for (const campo of [
        "origemClienteId",
        "origemPlanoId",
        "origemVersaoId",
        "origemRotinaId",
        "destinoClienteId",
        "destinoPlanoId",
        "destinoRotinaId",
        "alvoId",
      ]) {
        if (typeof payload[campo] === "string") payload[campo] = payload[campo].toLowerCase();
      }
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_consultar_recibo_copia_rotina", {
          p_ator_id: atorId,
          p_request_id: requestId,
          p_origem_cliente_id: pedido.origemClienteId,
          p_destino_cliente_id: pedido.destinoClienteId,
          p_payload: payload,
        });
      if (error) throw error;
      const recibo = reciboSchema.parse(data);
      if (
        recibo.requestId !== pedido.requestId ||
        recibo.aggregateId !== pedido.destinoPlanoId ||
        recibo.revision !== pedido.destinoRevision + 1 ||
        recibo.linkedIds.clienteId !== pedido.destinoClienteId ||
        recibo.linkedIds.rotinaId !== pedido.destinoRotinaId ||
        recibo.origemPlanoId !== pedido.origemPlanoId ||
        recibo.origemVersaoId !== pedido.origemVersaoId ||
        recibo.origemRotinaId !== pedido.origemRotinaId
      )
        throw new Error("Recibo divergente");
      await conferirAtor();
      if (!montado.current) throw new Error("Tela desmontada.");
      await cache.invalidateQueries({
        queryKey: planoManutencaoKeys.raiz(userId, pedido.destinoClienteId),
      });
      await conferirAtor();
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(chave) !== serializado) throw new Error("Tentativa alterada");
      sessionStorage.removeItem(chave);
      setPendente(null);
      setConfirmacao(null);
      setMensagem("Cópia confirmada. Confira questionário, recorrência e exigências no destino.");
    } catch {
      setMensagem(
        "Recibo indisponível. A tentativa permanece guardada; ausência de confirmação não prova falha.",
      );
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  function iniciar() {
    if (
      trava.current ||
      pendente ||
      recuperacao.invalido ||
      !podeConsultar ||
      !planoSelecionado ||
      !alvoSelecionado ||
      !fotografia ||
      confirmacao !== fotografia
    )
      return;
    try {
      const pedido = pedidoSchema.parse({
        requestId: crypto.randomUUID(),
        atorId: userId,
        origemClienteId: clienteId,
        origemPlanoId: plano.id,
        origemRevision: plano.revisao,
        origemVersaoId: versaoId,
        origemRotinaId: rotina.id,
        destinoClienteId: destinoCliente,
        destinoPlanoId: planoSelecionado.id,
        destinoRevision: planoSelecionado.revisao,
        destinoRotinaId: crypto.randomUUID(),
        alvoTipo: rotina.alvoTipo,
        alvoId: alvo,
      });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
      sessionStorage.setItem(chave, JSON.stringify(pedido));
      setPendente(pedido);
      void enviar(pedido);
    } catch {
      setMensagem("Não foi possível guardar a tentativa. Confira o destino e a sessão.");
    }
  }
  return (
    <section
      aria-label={`Copiar Rotina ${rotina.nome}`}
      className="mt-2 rounded-md border border-line p-3"
    >
      <h5>Copiar {rotina.nome} para outro Plano</h5>
      <p>A origem aprovada será preservada. Nenhuma ocorrência ou OS será criada.</p>
      {recuperacao.invalido ? (
        <p role="alert">Tentativa local inválida. Procure suporte antes de criar outra cópia.</p>
      ) : pendente ? (
        <>
          <p>
            Pedido pendente para Cliente {pendente.destinoClienteId}, Plano{" "}
            {pendente.destinoPlanoId} e alvo {pendente.alvoId}.
          </p>
          <Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>
            Repetir mesmo pedido
          </Button>
          {import.meta.env.VITE_SSO_RECIBO_COPIA_ROTINA_ENABLED === "true" && (
            <Button
              variant="secondary"
              disabled={ocupado}
              onClick={() => void consultarRecibo(pendente)}
            >
              Consultar confirmação
            </Button>
          )}
        </>
      ) : (
        <>
          <label>
            Cliente de destino{" "}
            <select
              className="input"
              value={destinoCliente}
              disabled={clientes.isFetching || clientes.isError || ocupado}
              onChange={(e) => {
                setDestinoCliente(e.target.value);
                setDestinoPlano("");
                setAlvo("");
                setConfirmacao(null);
              }}
            >
              <option value={clienteId}>Cliente atual</option>
              {(clientes.data?.pages.flat() ?? [])
                .filter((c) => c.id !== clienteId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </label>
          {clientes.hasNextPage && (
            <Button
              variant="secondary"
              disabled={clientes.isFetching}
              onClick={() => void clientes.fetchNextPage()}
            >
              Mais Clientes
            </Button>
          )}
          {clientes.isError && <p role="alert">Não foi possível carregar Clientes.</p>}
          {autorizacao.isFetching && <p>Verificando acesso ao destino…</p>}
          {!autorizacao.isFetching && (autorizacao.isError || autorizacao.data === false) && (
            <p role="alert">Acesso ao Cliente de destino indisponível.</p>
          )}
          {podeConsultar && (
            <>
              <label>
                Plano de destino{" "}
                <select
                  className="input"
                  value={destinoPlano}
                  disabled={planos.isFetching || planos.isError || ocupado}
                  onChange={(e) => {
                    setDestinoPlano(e.target.value);
                    setAlvo("");
                    setConfirmacao(null);
                  }}
                >
                  <option value="">Selecione um rascunho</option>
                  {(planos.data?.pages.flat() ?? [])
                    .filter(
                      (p) =>
                        p.estado === "rascunho" &&
                        p.id !== plano.id &&
                        p.clienteId === destinoCliente,
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} · revisão {p.revisao}
                      </option>
                    ))}
                </select>
              </label>
              {planos.hasNextPage && (
                <Button
                  variant="secondary"
                  disabled={planos.isFetching}
                  onClick={() => void planos.fetchNextPage()}
                >
                  Mais Planos
                </Button>
              )}
              {planos.isError && <p role="alert">Planos indisponíveis.</p>}
            </>
          )}
          {planoSelecionado && (
            <>
              <label>
                Buscar alvo{" "}
                <input
                  className="input"
                  maxLength={120}
                  value={busca}
                  disabled={ocupado}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setAlvo("");
                    setConfirmacao(null);
                  }}
                />
              </label>
              <label>
                Alvo de destino ({rotina.alvoTipo}){" "}
                <select
                  className="input"
                  value={alvo}
                  disabled={alvos.isFetching || alvos.isError || ocupado}
                  onChange={(e) => {
                    setAlvo(e.target.value);
                    setConfirmacao(null);
                  }}
                >
                  <option value="">Selecione</option>
                  {alvosVisiveis.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </label>
              {alvos.hasNextPage && (
                <Button
                  variant="secondary"
                  disabled={alvos.isFetching}
                  onClick={() => void alvos.fetchNextPage()}
                >
                  Mais alvos
                </Button>
              )}
              {alvos.isError && <p role="alert">Alvos indisponíveis.</p>}
              <p>
                Confira questionário, data-base, tolerâncias e exigências legais no destino; estes
                dados não são automaticamente validados.
              </p>
              {import.meta.env.VITE_SSO_NATUREZA_ALVO_ROTINA_ENABLED === "true" &&
                rotina.alvoTipo === "componente" && (
                  <p>
                    Confira também se o alvo é Equipamento ou Componente no destino. A natureza só
                    pode ser herdada quando o Cliente e o cadastro do alvo forem os mesmos e houver
                    declaração na versão aprovada.
                  </p>
                )}
              {confirmacao && confirmacao !== fotografia && (
                <p role="alert">Origem ou destino mudou. Confira e confirme novamente.</p>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={fotografia !== null && confirmacao === fotografia}
                  disabled={ocupado || !fotografia}
                  onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)}
                />{" "}
                Confirmo a cópia para o alvo e Plano selecionados.
              </label>
              <Button
                variant="secondary"
                disabled={ocupado || !fotografia || confirmacao !== fotografia}
                onClick={iniciar}
              >
                Copiar Rotina
              </Button>
            </>
          )}
        </>
      )}
      {mensagem && <output className="block">{mensagem}</output>}
    </section>
  );
}
