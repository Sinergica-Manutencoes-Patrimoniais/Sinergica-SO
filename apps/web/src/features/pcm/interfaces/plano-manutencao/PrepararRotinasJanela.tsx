import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import {
  confirmarSnapshotExportacao,
  lerSnapshotExportacao,
} from "../../application/snapshot-exportacao";
import { janelaPadraoCalendario } from "../../domain/calendario-contratual";
import { obterPaginaSnapshotExportacao } from "../../infrastructure/supabase-snapshot-exportacao";
import { FilaAposPreparacao } from "./FilaAposPreparacao";
import { FilaDasOcorrenciasPreparadas } from "./FilaDasOcorrenciasPreparadas";
import { IntegrarOrigemOcorrencia } from "./IntegrarOrigemOcorrencia";

const uuid = z.string().uuid();
const esperadoSchema = z
  .object({ ciclo: z.number().int().nonnegative().safe(), vencimento: z.string().date() })
  .strict();
const rotinaSchema = z
  .object({
    rotinaId: uuid,
    nome: z.string().min(1),
    alvo: z.string().min(1),
    requestId: uuid,
    esperados: z.array(esperadoSchema).min(1).max(31),
  })
  .strict();
const reciboSchema = z
  .object({ rotinaId: uuid, preparadas: z.array(uuid).min(1).max(31) })
  .strict();
const pedidoSchema = z
  .object({
    clienteId: uuid,
    planoId: uuid,
    versaoId: uuid,
    revision: z.number().int().positive().safe(),
    inicio: z.string().date(),
    fim: z.string().date(),
    rotinas: z.array(rotinaSchema).min(1).max(25),
    proxima: z.number().int().nonnegative(),
    recibos: z.array(reciboSchema).max(25),
    tentativaIncerta: z.boolean().optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      p.proxima > p.rotinas.length ||
      p.recibos.length !== p.proxima ||
      p.recibos.some((r, i) => r.rotinaId !== p.rotinas[i]?.rotinaId) ||
      new Set(p.rotinas.map((r) => r.rotinaId.toLowerCase())).size !== p.rotinas.length ||
      new Set(p.rotinas.map((r) => r.requestId.toLowerCase())).size !== p.rotinas.length
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sequência divergente." });
  });
type Pedido = z.infer<typeof pedidoSchema>;
type Origem = {
  rotinaId: string;
  nome: string;
  alvo: string;
  itens: Array<{ ciclo: number; vencimento: string; estado: string }>;
};
type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  revision: number;
};
export function PrepararRotinasJanela(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.versaoId])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, planoId, versaoId, revision }: Props) {
  const chave = `sso-preparar-rotinas-janela:${JSON.stringify([userId, clienteId, planoId, versaoId])}`;
  const cache = useQueryClient();
  const montado = useRef(false);
  const trava = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [origens, setOrigens] = useState<Origem[] | null>(null);
  const [contextoOrigem, setContextoOrigem] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [concluidos, setConcluidos] = useState<z.infer<typeof reciboSchema>[]>([]);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId && p.planoId === planoId && p.versaoId === versaoId
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const sessao = async (signal?: AbortSignal) => {
    const r = await supabase.auth.getUser();
    if (!montado.current || signal?.aborted || r.error || r.data.user?.id !== userId)
      throw new Error("Sessão alterada.");
  };
  const snapshot = useQuery({
    queryKey: ["rotinas-janela-snapshot", userId, clienteId, planoId, versaoId],
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const identidade = { clienteId, planoId, versaoId };
      const pagina = (posicao: number, s?: AbortSignal) => {
        if (posicao >= 1000) throw new Error("Limite de Rotinas.");
        return obterPaginaSnapshotExportacao(identidade, posicao, s);
      };
      await sessao(signal);
      const s = await lerSnapshotExportacao(pagina, identidade, signal);
      if (s.total > 1000) throw new Error("Limite de Rotinas.");
      await confirmarSnapshotExportacao(pagina, identidade, s, signal);
      await sessao(signal);
      return s;
    },
  });
  const rotinas = snapshot.data?.rotinas.filter((r) => r.modo === "calendario") ?? [];
  const visivel = !!snapshot.data && !snapshot.isFetching && !snapshot.isError;
  const escolhido = rotinas.filter((r) => selecionadas.includes(r.id));
  const contextoAtual = JSON.stringify([
    clienteId,
    planoId,
    versaoId,
    revision,
    inicio,
    fim,
    snapshot.data?.snapshotHash,
    escolhido.map((r) => [r.id, r.nome, r.alvoTipo, r.alvoId]),
  ]);
  const origensAtuais = contextoOrigem === contextoAtual ? origens : null;
  const assinaturaAtual = JSON.stringify([contextoAtual, origensAtuais]);
  const dias = (Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000;
  const janelaValida = Number.isFinite(dias) && dias >= 0 && dias <= 30;
  const bloqueadas = origensAtuais?.filter((r) => r.itens.some((i) => i.estado !== "plano")) ?? [];
  const comCiclos = origensAtuais?.filter((r) => r.itens.length > 0) ?? [];
  async function conferir() {
    if (
      trava.current ||
      pendente ||
      conferindo ||
      !visivel ||
      !janelaValida ||
      escolhido.length < 1 ||
      escolhido.length !== selecionadas.length
    )
      return;
    trava.current = true;
    setConferindo(true);
    setOrigens(null);
    setAssinatura(null);
    setAviso("");
    try {
      const obtidas: Origem[] = [];
      for (const r of escolhido) {
        await sessao();
        const { data, error } = await supabase
          .schema("pcm")
          .rpc("sso_origens_lote_calendario", {
            p_ator_id: userId,
            p_cliente_id: clienteId,
            p_plano_id: planoId,
            p_versao_id: versaoId,
            p_rotina_id: r.id,
            p_expected_revision: revision,
            p_inicio: inicio,
            p_fim: fim,
          });
        if (error) throw error;
        const result = z
          .object({
            revisao: z.number().int().positive(),
            inicio: z.string().date(),
            fim: z.string().date(),
            itens: z
              .array(
                z
                  .object({
                    ciclo: z.number().int().nonnegative().safe(),
                    vencimento: z.string().date(),
                    estado: z.enum([
                      "plano",
                      "pmoc_vinculado",
                      "pmoc_pendente",
                      "revisao_necessaria",
                      "conflito",
                      "origem_pendente",
                    ]),
                    agendamentoId: uuid.nullable(),
                  })
                  .strict(),
              )
              .max(31),
            fontesCompletas: z.literal(false),
            exclusividadeGlobalComprovada: z.literal(false),
          })
          .strict()
          .parse(data);
        if (
          result.revisao !== revision ||
          result.inicio !== inicio ||
          result.fim !== fim ||
          result.itens.some(
            (x, i) =>
              x.vencimento < inicio ||
              x.vencimento > fim ||
              (i > 0 && x.ciclo <= result.itens[i - 1]!.ciclo) ||
              (x.estado === "pmoc_vinculado") !== (x.agendamentoId !== null),
          )
        )
          throw new Error("Prévia divergente.");
        await sessao();
        obtidas.push({
          rotinaId: r.id,
          nome: r.nome,
          alvo: `${r.alvoTipo} ${r.alvoNome}`,
          itens: result.itens.map(({ ciclo, vencimento, estado }) => ({
            ciclo,
            vencimento,
            estado,
          })),
        });
      }
      if (montado.current) {
        setOrigens(obtidas);
        setContextoOrigem(contextoAtual);
      }
    } catch {
      if (montado.current)
        setAviso(
          "Não foi possível conferir todas as Rotinas. Confira acesso, revisão e período; nada foi preparado.",
        );
    } finally {
      trava.current = false;
      if (montado.current) setConferindo(false);
    }
  }
  async function executar(inicial: Pedido) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setAviso("");
    let atual = inicial;
    try {
      while (atual.proxima < atual.rotinas.length) {
        await sessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(atual))
          throw new Error("Tentativa alterada.");
        const r = atual.rotinas[atual.proxima]!;
        // Registre antes do envio: após recarga ou falha de rede, o pedido pode ter sido confirmado.
        const jaIncerta = atual.tentativaIncerta !== false;
        const enviado = pedidoSchema.parse({ ...atual, tentativaIncerta: true });
        sessionStorage.setItem(chave, JSON.stringify(enviado));
        atual = enviado;
        setPendente(atual);
        const { data, error } = await supabase
          .schema("pcm")
          .rpc("sso_materializar_lote_calendario_origem_conferida", {
            p_ator_id: userId,
            p_request_id: r.requestId,
            p_cliente_id: atual.clienteId,
            p_plano_id: atual.planoId,
            p_versao_id: atual.versaoId,
            p_rotina_id: r.rotinaId,
            p_expected_revision: atual.revision,
            p_inicio: atual.inicio,
            p_fim: atual.fim,
            p_esperados: r.esperados,
          });
        if (error) {
          if (
            !jaIncerta &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "P0015" && "message" in error &&
            (error.message === "revisao_obsoleta" || error.message === "previa_divergente")
          ) {
            await sessao();
            if (sessionStorage.getItem(chave) !== JSON.stringify(atual))
              throw new Error("Tentativa alterada.");
            sessionStorage.removeItem(chave);
            setPendente(null);
            setConcluidos(atual.recibos);
            setAssinatura(null);
            setOrigens(null);
            setAviso(
              `A revisão ou a origem mudou após ${atual.proxima} de ${atual.rotinas.length} Rotinas. Confira novamente as restantes; as anteriores permanecem preparadas.`,
            );
            return;
          }
          throw error;
        }
        const resposta = z
          .object({
            requestId: uuid,
            inicio: z.string().date(),
            fim: z.string().date(),
            total: z.number().int().nonnegative(),
            criadas: z.number().int().nonnegative(),
            itens: z
              .array(
                z
                  .object({
                    indice: z.number().int().nonnegative().safe(),
                    vencimentoOriginal: z.string().date(),
                    preparadaId: uuid,
                    cicloCanonicoId: uuid,
                    criada: z.boolean(),
                  })
                  .strict(),
              )
              .max(31),
            atomico: z.literal(true),
            osCriada: z.literal(false),
            tarefaAuvoCriada: z.literal(false),
          })
          .passthrough()
          .parse(data);
        const esperados = r.esperados.slice().sort((a, b) => a.ciclo - b.ciclo);
        if (
          resposta.requestId !== r.requestId ||
          resposta.inicio !== atual.inicio ||
          resposta.fim !== atual.fim ||
          resposta.total !== r.esperados.length ||
          resposta.itens.length !== resposta.total ||
          resposta.criadas !== resposta.itens.filter((i) => i.criada).length ||
          new Set(resposta.itens.map((i) => i.preparadaId.toLowerCase())).size !==
            resposta.itens.length ||
          JSON.stringify(
            resposta.itens
              .map((i) => ({ ciclo: i.indice, vencimento: i.vencimentoOriginal }))
              .sort((a, b) => a.ciclo - b.ciclo),
          ) !== JSON.stringify(esperados)
        )
          throw new Error("Recibo divergente.");
        await sessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(atual))
          throw new Error("Tentativa alterada.");
        const proximo = pedidoSchema.parse({
          ...atual,
          proxima: atual.proxima + 1,
          recibos: [
            ...atual.recibos,
            { rotinaId: r.rotinaId, preparadas: resposta.itens.map((i) => i.preparadaId) },
          ],
          tentativaIncerta: false,
        });
        sessionStorage.setItem(chave, JSON.stringify(proximo));
        atual = proximo;
        setPendente(atual);
      }
      await sessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(atual))
        throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave);
      setPendente(null);
      setConcluidos(atual.recibos);
      setAssinatura(null);
      setOrigens(null);
      setAviso(
        "Preparação concluída. Confira a fila de cada ocorrência; nenhuma OS ou tarefa foi criada.",
      );
    } catch {
      if (montado.current)
        setAviso(
          `Sequência interrompida após ${atual.proxima} de ${atual.rotinas.length} Rotinas. As anteriores permanecem preparadas; retome a mesma tentativa.`,
        );
    } finally {
      trava.current = false;
      if (montado.current) setOcupado(false);
      void Promise.allSettled([
        cache.invalidateQueries({
          queryKey: ["obrigacoes-preparadas", userId, clienteId, planoId],
        }),
        cache.invalidateQueries({
          queryKey: ["historico-ciclo-canonico", userId, clienteId, planoId, versaoId],
        }),
        cache.invalidateQueries({
          queryKey: ["previa-vencimentos-ocorrencia", userId, clienteId, planoId, versaoId],
        }),
      ]);
    }
  }
  function iniciar() {
    if (
      trava.current ||
      pendente ||
      !visivel ||
      !origensAtuais ||
      bloqueadas.length > 0 ||
      comCiclos.length === 0 ||
      assinatura !== assinaturaAtual
    )
      return;
    try {
      const p = pedidoSchema.parse({
        clienteId,
        planoId,
        versaoId,
        revision,
        inicio,
        fim,
        rotinas: comCiclos.map((r) => ({
          rotinaId: r.rotinaId,
          nome: r.nome,
          alvo: r.alvo,
          requestId: crypto.randomUUID(),
          esperados: r.itens.map(({ ciclo, vencimento }) => ({ ciclo, vencimento })),
        })),
        proxima: 0,
        recibos: [],
        tentativaIncerta: false,
      });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(p));
      setConcluidos([]);
      setPendente(p);
      void executar(p);
    } catch {
      setAviso("Não foi possível guardar a sequência; nada foi enviado.");
    }
  }
  const recibosDisponiveis = pendente && pendente !== "invalido" ? pendente.recibos : concluidos;
  return (
    <section aria-label="Preparar Rotinas por calendário">
      <h4>Preparar Rotinas por calendário</h4>
      <p>
        Confira até 25 Rotinas no mesmo período. A preparação é sequencial por Rotina: falha não
        desfaz as anteriores. Retome o pedido pendente para continuar; não cria OS ou tarefa Auvo. A
        fonte de feriados e a exclusividade global ainda não são comprovadas.
      </p>
      {snapshot.isFetching && <p role="status">Consultando Rotinas…</p>}
      {snapshot.isError && (
        <p role="alert">
          Rotinas indisponíveis.{" "}
          <button type="button" onClick={() => void snapshot.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {pendente === "invalido" && <p role="alert">Sequência local ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" ? (
        <>
          <p role="status">
            Rotinas confirmadas: {pendente.proxima} de {pendente.rotinas.length}.{" "}
            {ocupado
              ? "Preparando a próxima…"
              : "Retome a mesma sequência para repetir o item pendente."}
          </p>
          <button type="button" disabled={ocupado} onClick={() => void executar(pendente)}>
            Retomar sequência
          </button>
        </>
      ) : (
        !pendente &&
        visivel && (
          <>
            <label>
              Início da janela{" "}
              <input
                type="date"
                value={inicio}
                onChange={(e) => {
                  setInicio(e.target.value);
                  setOrigens(null);
                  setAssinatura(null);
                }}
              />
            </label>
            <label>
              Fim da janela{" "}
              <input
                type="date"
                value={fim}
                onChange={(e) => {
                  setFim(e.target.value);
                  setOrigens(null);
                  setAssinatura(null);
                }}
              />
            </label>
            <button
              type="button"
              disabled={!inicio || conferindo}
              onClick={() => {
                try {
                  setFim(janelaPadraoCalendario(inicio).fim);
                  setOrigens(null);
                  setAssinatura(null);
                } catch {
                  setAviso("Informe início válido.");
                }
              }}
            >
              Usar janela de 30 dias
            </button>
            <p>
              Informe a data de início no fuso do Plano. O servidor valida a janela e não prepara
              vencidos neste fluxo.
            </p>
            <fieldset disabled={conferindo || ocupado}>
              <legend>Rotinas selecionadas: {selecionadas.length}/25</legend>
              {rotinas.map((r) => (
                <label key={r.id}>
                  <input
                    type="checkbox"
                    checked={selecionadas.includes(r.id)}
                    disabled={!selecionadas.includes(r.id) && selecionadas.length >= 25}
                    onChange={(e) => {
                      setSelecionadas((a) =>
                        e.target.checked ? [...a, r.id] : a.filter((id) => id !== r.id),
                      );
                      setOrigens(null);
                      setAssinatura(null);
                    }}
                  />{" "}
                  {r.nome} · {r.alvoTipo} {r.alvoNome}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              disabled={!janelaValida || !escolhido.length || conferindo || ocupado}
              onClick={() => void conferir()}
            >
              Conferir Rotinas e origens
            </button>
            {origensAtuais && (
              <>
                <ul>
                  {origensAtuais.map((r) => (
                    <li key={r.rotinaId}>
                      {r.nome} · {r.alvo} · {r.itens.length} ciclo(s)
                      {r.itens.map((i) => (
                        <span key={i.ciclo}>
                          {" "}
                          · {i.vencimento}: {i.estado}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                {bloqueadas.length > 0 && (
                  <p role="alert">
                    Há origem PMOC, pendência ou conflito. Resolva essas Rotinas ou retire-as da
                    seleção e confira novamente.
                  </p>
                )}
                {comCiclos.length === 0 && <p>Nenhuma Rotina selecionada tem ciclos na janela.</p>}
                <label>
                  <input
                    type="checkbox"
                    disabled={bloqueadas.length > 0 || comCiclos.length === 0}
                    checked={assinatura === assinaturaAtual}
                    onChange={(e) => setAssinatura(e.target.checked ? assinaturaAtual : null)}
                  />{" "}
                  Conferi cada Rotina, alvo, ciclo e origem; autorizo a preparação sequencial.
                </label>
                <button
                  type="button"
                  disabled={
                    assinatura !== assinaturaAtual ||
                    bloqueadas.length > 0 ||
                    comCiclos.length === 0
                  }
                  onClick={iniciar}
                >
                  Preparar Rotinas selecionadas
                </button>
              </>
            )}
          </>
        )
      )}
      {!ocupado && recibosDisponiveis.length > 0 && (
        <section aria-label="Ocorrências preparadas na janela">
          <h5>Ocorrências preparadas</h5>
          <ul>
            {recibosDisponiveis.flatMap((r) =>
              r.preparadas.map((id) => (
                <li key={id}>
                  Rotina {r.rotinaId} · ocorrência {id}{" "}
                  <FilaAposPreparacao
                    userId={userId}
                    clienteId={clienteId}
                    planoId={planoId}
                    preparadaId={id}
                  />
                  <IntegrarOrigemOcorrencia
                    userId={userId}
                    clienteId={clienteId}
                    planoId={planoId}
                    revision={revision}
                    preparadaId={id}
                    tipo="calendario"
                  />
                </li>
              )),
            )}
          </ul>
          {import.meta.env.VITE_SSO_FILA_SELECIONADA_ENABLED === "true" && (
            <FilaDasOcorrenciasPreparadas
              userId={userId}
              clienteId={clienteId}
              planoId={planoId}
              preparadas={recibosDisponiveis.flatMap((r) => r.preparadas)}
            />
          )}
        </section>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
