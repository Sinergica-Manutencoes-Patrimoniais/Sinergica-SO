import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
import { EstadoEscolhaAlteracao } from "./EstadoEscolhaAlteracao";
import { EscolherNovaVisita } from "./EscolherNovaVisita";
import {
  useComparacaoImpacto,
  DetalhesComparacaoImpacto,
  comparacaoImpactoArmazenadaSchema,
  type ComparacaoImpacto,
} from "./ComparacaoImpactoSelecionado";
import { supabase } from "../../../../lib/supabase-client";
const decisaoSchema = z.enum(["manter_sem_alterar", "exige_reconciliacao"]);
const camposComuns = {
  preparada_id: z.string().uuid(),
  rascunho_id: z.string().uuid(),
  rotina_id: z.string().uuid(),
  revisao_decisao: z.number().int().nonnegative().safe(),
  ultima_decisao: decisaoSchema.nullable(),
  ultima_revisao_plano: z.number().int().positive().safe().nullable(),
};
const linhaSchema = z
  .object({
    ...camposComuns,
    semana_origem: z.string().date(),
    visita_id: z.string().uuid(),
    ciclo_canonico_id: z.string().uuid().nullable(),
  })
  .strict();
type Pedido = {
  requestId: string;
  clienteId: string;
  planoId: string;
  rascunhoId: string;
  preparadaId: string;
  planoRevision: number;
  decisaoRevision: number;
  decisao: "manter_sem_alterar" | "exige_reconciliacao" | "alterar_conteudo";
  motivo: string;
  comparacao?: ComparacaoImpacto;
};

export function DecisaoImpactoVisita(props: {
  userId: string;
  clienteId: string;
  planoId: string;
  revision: number;
}) {
  if (import.meta.env.VITE_SSO_DECISOES_IMPACTO_MEDIADAS_ENABLED !== "true")
    return <p>Decisões de impacto indisponíveis.</p>;
  return (
    <DecisaoImpactoVisitaAtiva
      key={JSON.stringify([props.userId, props.clienteId, props.planoId])}
      {...props}
    />
  );
}

function DecisaoImpactoVisitaAtiva({
  userId,
  clienteId,
  planoId,
  revision,
}: { userId: string; clienteId: string; planoId: string; revision: number }) {
  const emEnvio = useRef(false);
  const primeiraTentativa = useRef(false);
  const conferirSessao = (signal?: AbortSignal) => conferirSessaoDiagnostico(userId, signal);
  const cache = useQueryClient();
  const chave = `sso-impacto-visita:${JSON.stringify([userId, clienteId, planoId])}`;
  const [selecionado, setSelecionado] = useState("");
  const [decisao, setDecisao] = useState<Pedido["decisao"]>("exige_reconciliacao");
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      return p.clienteId === clienteId &&
        p.planoId === planoId &&
        typeof p.requestId === "string" &&
        typeof p.rascunhoId === "string" &&
        typeof p.preparadaId === "string" &&
        Number.isSafeInteger(p.planoRevision) &&
        Number.isSafeInteger(p.decisaoRevision) &&
        ["manter_sem_alterar", "exige_reconciliacao", "alterar_conteudo"].includes(p.decisao) &&
        (p.decisao !== "alterar_conteudo" || p.comparacao !== undefined) &&
        typeof p.motivo === "string" &&
        (p.comparacao === undefined ||
          comparacaoImpactoArmazenadaSchema.safeParse(p.comparacao).success)
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const lista = useInfiniteQuery({
    queryKey: ["impactos-visita", userId, clienteId, planoId, revision],
    initialPageParam: null as string | null,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_decisoes_visita_mediada", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_expected_plano: revision,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linhaSchema).max(20).parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const linha of pagina) {
        const atual = linha.preparada_id.toLowerCase();
        if (atual <= anterior) throw new Error("Página divergente.");
        anterior = atual;
      }
      await conferirSessao(signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.preparada_id : undefined),
  });
  const itens = lista.data?.pages.flat() ?? [];
  const divergentes =
    new Set(itens.map((x) => x.preparada_id.toLowerCase())).size !== itens.length ||
    itens.some(
      (x, i) => i > 0 && x.preparada_id.toLowerCase() <= itens[i - 1]!.preparada_id.toLowerCase(),
    );
  const item =
    !divergentes && !lista.isFetching && !lista.isError
      ? itens.find((x) => x.preparada_id === selecionado)
      : undefined;
  const comparacao = useComparacaoImpacto({
    userId,
    clienteId,
    planoId,
    revisao: revision,
    rascunhoId: item?.rascunho_id,
    preparadaId: item?.preparada_id,
    tipo: "visita",
  });
  const dadosComparacao =
    !comparacao.isFetching && !comparacao.isError ? comparacao.data : undefined;
  const assinaturaAtual = JSON.stringify([
    userId,
    clienteId,
    planoId,
    revision,
    item,
    dadosComparacao,
    decisao,
    motivo.trim(),
  ]);
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } =
        p.decisao === "alterar_conteudo"
          ? await supabase.schema("pcm").rpc("sso_escolher_alteracao_ciclo", {
              p_ator: userId,
              p_request: p.requestId,
              p_cliente: p.clienteId,
              p_plano: p.planoId,
              p_rascunho: p.rascunhoId,
              p_preparada: p.preparadaId,
              p_revisao_plano: p.planoRevision,
              p_revisao_decisao: p.decisaoRevision,
              p_tipo: "visita",
              p_motivo: p.motivo,
              p_comparacao: p.comparacao,
            })
          : await supabase
              .schema("pcm")
              .rpc(p.comparacao ? "sso_decidir_impacto_comparado" : "sso_decidir_impacto_mediada", {
                ...(p.comparacao ? { p_comparacao: p.comparacao } : {}),
                p_ator_id: userId,
                p_tipo: "visita",
                p_request_id: p.requestId,
                p_cliente_id: p.clienteId,
                p_plano_id: p.planoId,
                p_rascunho_id: p.rascunhoId,
                p_preparada_id: p.preparadaId,
                p_expected_plano: p.planoRevision,
                p_expected_decisao: p.decisaoRevision,
                p_decisao: p.decisao,
                p_motivo: p.motivo,
              });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.preparadaId !== p.preparadaId ||
        data.revisaoPlano !== p.planoRevision ||
        data.revisao !== p.decisaoRevision + 1 ||
        data.decisao !== (p.decisao === "alterar_conteudo" ? "exige_reconciliacao" : p.decisao) ||
        (p.decisao === "alterar_conteudo" &&
          (data.alteracaoEscolhida !== true || data.versaoOperacionalAplicada !== false)) ||
        data.impactoIntegralComprovado !== false ||
        data.aprovacaoAutorizada !== false ||
        data.ocorrenciaAlterada !== false ||
        data.osAlteradas !== false
      )
        throw new Error("Resposta inválida.");
      await conferirSessao();
    },
    onSuccess: async (_resultado, p) => {
      try {
        await conferirSessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(p))
          throw new Error("Tentativa divergente.");
        sessionStorage.removeItem(chave);
      } catch {
        setAviso("Tentativa não removida; procure suporte.");
        return;
      }
      setPendente(null);
      setConfirmado(null);
      setAviso("Decisão registrada; a aprovação depende das validações e autorizações aplicáveis.");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["impactos-visita", userId, clienteId, planoId] }),
        cache.invalidateQueries({
          queryKey: ["avaliacao-impacto-revisao", userId, clienteId, planoId],
        }),
        cache.invalidateQueries({
          queryKey: ["avaliacao-impacto-visita-legado", userId, clienteId, planoId],
        }),
        cache.invalidateQueries({
          queryKey: ["avaliacao-fotografias-grupo", userId, clienteId, planoId],
        }),
      ]);
    },
    onError: async (error, p) => {
      if (
        primeiraTentativa.current &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        ((error.code === "P0014" &&
          "message" in error &&
          error.message === "revisao_decisao_obsoleta") ||
          (error.code === "P0010" &&
            "message" in error &&
            error.message === "comparacao_obsoleta") ||
          (error.code === "P0011" && "message" in error && error.message === "revisao_obsoleta"))
      ) {
        try {
          await conferirSessao();
          if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(chave);
          setPendente(null);
          setConfirmado(null);
          setAviso(
            "A revisão, decisão ou comparação mudou. Atualize os dados e confirme novamente.",
          );
          await Promise.all([
            cache.invalidateQueries({
              queryKey: ["comparacao-impacto-selecionado", userId, clienteId, planoId],
            }),
            cache.invalidateQueries({ queryKey: ["impactos-visita", userId, clienteId, planoId] }),
          ]).catch(() => undefined);
          return;
        } catch {
          setAviso("Tentativa preservada; procure suporte.");
          return;
        }
      }
      setAviso(
        "Resultado não confirmado ou revisão alterada. Repita a mesma tentativa; procure suporte em conflito.",
      );
    },
    onSettled: () => {
      emEnvio.current = false;
      primeiraTentativa.current = false;
    },
  });
  const enviar = (p: Pedido, primeira = false) => {
    if (emEnvio.current) return;
    try {
      const anterior = sessionStorage.getItem(chave);
      if (anterior && anterior !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível guardar tentativa; nada enviado.");
      return;
    }
    emEnvio.current = true;
    primeiraTentativa.current = primeira;
    setPendente(p);
    envio.mutate(p);
  };
  return (
    <section aria-label="Decisões de impacto por Visita">
      <h4>Impacto em Visitas</h4>
      <p>
        Somente ocorrências preparadas da versão anterior. Ausência de identidade canônica bloqueia
        a decisão; fotografia limitada de OS não prova cobertura integral. Não altera Visita,
        ocorrência ou OS e não libera aprovação.
      </p>
      {divergentes && <p role="alert">Páginas divergentes. Atualize a lista.</p>}
      {lista.isError && (
        <p role="alert">
          Lista indisponível ou revisão alterada.{" "}
          <button type="button" onClick={() => void lista.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !item?.ciclo_canonico_id ||
            pendente ||
            !dadosComparacao ||
            comparacao.isFetching ||
            comparacao.isError ||
            confirmado !== assinaturaAtual ||
            !motivo.trim() ||
            lista.isFetching ||
            lista.isError
          )
            return;
          enviar(
            {
              requestId: crypto.randomUUID(),
              clienteId,
              planoId,
              rascunhoId: item.rascunho_id,
              preparadaId: item.preparada_id,
              planoRevision: revision,
              decisaoRevision: item.revisao_decisao,
              decisao,
              motivo: motivo.trim(),
              comparacao: dadosComparacao,
            },
            true,
          );
        }}
      >
        <fieldset
          disabled={
            !!pendente || envio.isPending || lista.isFetching || lista.isError || divergentes
          }
        >
          <label>
            Ocorrência{" "}
            <select
              required
              value={selecionado}
              onChange={(e) => {
                setSelecionado(e.target.value);
                setConfirmado(null);
              }}
            >
              <option value="">Selecione</option>
              {!divergentes &&
                !lista.isFetching &&
                !lista.isError &&
                itens.map((x) => (
                  <option key={x.preparada_id} value={x.preparada_id}>
                    Semana {x.semana_origem} · Visita {x.visita_id} · identidade{" "}
                    {x.ciclo_canonico_id ? "registrada" : "ausente"} · decisão{" "}
                    {x.ultima_decisao ?? "nenhuma"}
                  </option>
                ))}
            </select>
          </label>
          {item && comparacao.isFetching && <output className="block">Carregando comparação da Rotina…</output>}
          {item && comparacao.isError && (
            <p role="alert">
              Não foi possível comprovar a comparação da Rotina.{" "}
              <button type="button" onClick={() => void comparacao.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {item && dadosComparacao && <DetalhesComparacaoImpacto dados={dadosComparacao} />}
          <label>
            Decisão{" "}
            <select
              value={decisao}
              onChange={(e) => {
                setDecisao(e.target.value as Pedido["decisao"]);
                setConfirmado(null);
              }}
            >
              <option value="exige_reconciliacao">Exige reconciliação</option>
              <option value="manter_sem_alterar">Manter sem alterar</option>
              {import.meta.env.VITE_SSO_ALTERACAO_CICLO_ENABLED === "true" && (
                <option value="alterar_conteudo">Aplicar conteúdo da revisão à ocorrência</option>
              )}
            </select>
          </label>
          <label>
            Motivo{" "}
            <textarea
              required
              maxLength={2000}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setConfirmado(null);
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              disabled={!dadosComparacao}
              checked={confirmado === assinaturaAtual}
              onChange={(e) => setConfirmado(e.target.checked ? assinaturaAtual : null)}
            />{" "}
            Conferi a decisão parcial e suas limitações
          </label>
          <button type="submit"
            disabled={
              !dadosComparacao || confirmado !== assinaturaAtual || !item?.ciclo_canonico_id
            }
          >
            Registrar decisão
          </button>
        </fieldset>
      </form>
      {item && dadosComparacao && (
        <EscolherNovaVisita
          userId={userId}
          clienteId={clienteId}
          planoId={planoId}
          rascunhoId={item.rascunho_id}
          preparadaId={item.preparada_id}
          planoRevision={revision}
          decisaoRevision={item.revisao_decisao}
          comparacao={dadosComparacao}
        />
      )}
      {item?.ultima_decisao === "exige_reconciliacao" && item.ultima_revisao_plano === revision && (
        <EstadoEscolhaAlteracao
          userId={userId}
          clienteId={clienteId}
          planoId={planoId}
          rascunhoId={item.rascunho_id}
          preparadaId={item.preparada_id}
          planoRevision={revision}
          decisaoRevision={item.revisao_decisao}
          tipo="visita"
        />
      )}
      {!divergentes && !lista.isError && lista.hasNextPage && (
        <button type="button" onClick={() => void lista.fetchNextPage()}>
          Mais ocorrências
        </button>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <output className="block">{aviso}</output>}
    </section>
  );
}
