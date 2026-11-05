import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { FilaPreventivaPcm } from "./FilaPreventivaPcm";
type Pedido = {
  requestId: string;
  clienteId: string;
  preparadaId: string;
  revisao: number;
  data: string;
  decisao: "avaliar" | "tratar_manualmente";
  motivo: string;
};
const dataCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    clienteId: z.string().uuid(),
    preparadaId: z.string().uuid(),
    revisao: z.number().int().nonnegative(),
    data: dataCivil,
    decisao: z.enum(["avaliar", "tratar_manualmente"]),
    motivo: z.string().min(1).max(2000),
  })
  .strict();
const candidatoSchema = z
  .object({
    preparada_id: z.string().uuid(),
    versao_id: z.string().uuid(),
    rotina_id: z.string().uuid(),
    ciclo: z.number().int().nonnegative(),
    vencimento_original: dataCivil,
    tolerancia_depois: z.number().int().nonnegative(),
    tem_vinculo_legado: z.boolean(),
    tem_os: z.boolean(),
    ultima_revisao: z.number().int().nonnegative(),
  })
  .strict();

type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  rotinaId: string;
  ocorrenciaEmConferencia?: string;
};
export function TriagemCicloAtrasado(props: Props) {
  return (
    <TriagemSessao
      key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.rotinaId])}
      {...props}
    />
  );
}
function TriagemSessao({ userId, clienteId, planoId, rotinaId, ocorrenciaEmConferencia }: Props) {
  const cache = useQueryClient();
  const trava = useRef(false);
  const chave = `sso-triagem-atraso:${JSON.stringify([userId, clienteId, planoId, rotinaId])}`;
  const [data, setData] = useState("");
  const [referencia, setReferencia] = useState("");
  const [escolha, setEscolha] = useState("");
  const [decisao, setDecisao] = useState<Pedido["decisao"]>("avaliar");
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId ? p : "invalido";
    } catch {
      return "invalido";
    }
  });
  const [filaSelecionada, setFilaSelecionada] = useState<string | null>(null);
  const candidatos = useInfiniteQuery({
    queryKey: ["triagem-atraso", userId, clienteId, planoId, rotinaId, referencia],
    enabled: !!referencia,
    initialPageParam: null as string | null,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada.");
      const { data: linhas, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_candidatos_atraso", {
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_rotina_id: rotinaId,
          p_data_referencia: referencia,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const resultado = z.array(candidatoSchema).max(20).parse(linhas);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      let anterior = pageParam ?? "";
      for (const linha of resultado) {
        if (linha.rotina_id !== rotinaId || linha.preparada_id <= anterior)
          throw new Error("Página divergente.");
        anterior = linha.preparada_id;
      }
      return resultado;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.preparada_id : undefined),
  });
  const item = candidatos.data?.pages.flat().find((c) => c.preparada_id === escolha);
  const correspondenciaCarregada =
    !!ocorrenciaEmConferencia &&
    !!candidatos.data?.pages.flat().some((c) => c.preparada_id === ocorrenciaEmConferencia);
  const snapshot =
    item && data === referencia ? JSON.stringify([item, referencia, decisao, motivo]) : null;
  const confirmacaoAtual = snapshot !== null && snapshot === confirmado;
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      const antes = await supabase.auth.getUser();
      if (
        antes.error ||
        antes.data.user?.id !== userId ||
        sessionStorage.getItem(chave) !== JSON.stringify(p)
      )
        throw new Error("Sessão ou tentativa alterada.");
      const { data: r, error } = await supabase.schema("pcm").rpc("sso_triar_ciclo_atrasado", {
        p_request_id: p.requestId,
        p_cliente_id: p.clienteId,
        p_preparada_id: p.preparadaId,
        p_expected_revision: p.revisao,
        p_data_referencia: p.data,
        p_decisao: p.decisao,
        p_motivo: p.motivo,
      });
      if (error) throw error;
      const depois = await supabase.auth.getUser();
      if (
        depois.error ||
        depois.data.user?.id !== userId ||
        !r ||
        r.requestId !== p.requestId ||
        r.preparadaId !== p.preparadaId ||
        r.revisao !== p.revisao + 1 ||
        r.dataReferencia !== p.data ||
        r.decisao !== p.decisao ||
        r.dataBaseAlterada !== false ||
        r.ocorrenciaCriada !== false ||
        r.osCriada !== false ||
        r.tarefaAuvoCriada !== false
      )
        throw new Error("Resultado inválido.");
    },
    onSuccess: async (_r, p) => {
      await cache.invalidateQueries({
        queryKey: ["triagem-atraso", userId, clienteId, planoId, rotinaId],
      });
      try {
        const atual = await supabase.auth.getUser();
        if (
          atual.error ||
          atual.data.user?.id !== userId ||
          sessionStorage.getItem(chave) !== JSON.stringify(p)
        )
          throw new Error();
        sessionStorage.removeItem(chave);
      } catch {
        setAviso(
          "Triagem confirmada, mas tentativa local alterada ou não removida. Preserve o pedido e consulte suporte.",
        );
        return;
      }
      setPendente(null);
      setConfirmado(null);
      setAviso("Triagem preliminar registrada; nenhuma data foi alterada.");
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado ou revisão obsoleta. Repita a mesma tentativa; procure suporte em conflito.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    trava.current = true;
    try {
      const salvo = sessionStorage.getItem(chave);
      if (pendente ? salvo !== JSON.stringify(p) : salvo !== null) throw new Error();
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      trava.current = false;
      setPendente("invalido");
      setAviso("Tentativa alterada ou não disponível; procure suporte.");
      return;
    }
    setPendente(p);
    envio.mutate(p);
  };
  return (
    <section aria-label="Triagem de candidatos a atraso">
      <h5>Triagem de candidatos a atraso</h5>
      {ocorrenciaEmConferencia && (
        <p role="status">
          Ocorrência encaminhada para conferência: {ocorrenciaEmConferencia}. Informe a data e
          consulte os candidatos.
        </p>
      )}
      <p>
        Compara a data informada com vencimento e tolerância de ocorrências preparadas. Não prova
        que a execução esteja pendente ou atrasada; fuso/data e situação da OS exigem conferência
        PCM. Não altera calendário nem cria OS/Auvo.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (data && !pendente) {
            setReferencia(data);
            setEscolha("");
            setConfirmado(null);
          }
        }}
      >
        <label>
          Data de referência declarada{" "}
          <input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <button disabled={!!pendente}>Consultar candidatos</button>
      </form>
      {candidatos.isError && (
        <p role="alert">
          Lista indisponível.{" "}
          <button type="button" onClick={() => void candidatos.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {referencia && ocorrenciaEmConferencia && !candidatos.isFetching && !candidatos.isError && (
        <p>
          {correspondenciaCarregada
            ? "A ocorrência consultada no feriado está entre os candidatos carregados."
            : candidatos.hasNextPage
              ? "A ocorrência consultada ainda não está nas páginas carregadas."
              : "A ocorrência consultada não apareceu para esta data de referência; isso não prova execução ou ausência de pendência."}
        </p>
      )}
      {!pendente && correspondenciaCarregada && !candidatos.isFetching && !candidatos.isError && (
        <button
          type="button"
          onClick={() => {
            setEscolha(ocorrenciaEmConferencia!);
            setConfirmado(null);
          }}
        >
          Selecionar ocorrência encaminhada
        </button>
      )}
      {confirmado && !confirmacaoAtual && (
        <p role="alert">Candidato ou decisão alterados. Confira e confirme novamente.</p>
      )}
      {referencia && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !item ||
              pendente ||
              !confirmacaoAtual ||
              !motivo.trim() ||
              candidatos.isFetching ||
              candidatos.isError
            )
              return;
            enviar({
              requestId: crypto.randomUUID(),
              clienteId,
              preparadaId: item.preparada_id,
              revisao: item.ultima_revisao,
              data: referencia,
              decisao,
              motivo: motivo.trim(),
            });
          }}
        >
          <fieldset
            disabled={!!pendente || envio.isPending || candidatos.isFetching || candidatos.isError}
          >
            <label>
              Candidato{" "}
              <select
                value={escolha}
                onChange={(e) => {
                  setEscolha(e.target.value);
                  setConfirmado(null);
                }}
                required
              >
                <option value="">Selecione</option>
                {candidatos.data?.pages.flat().map((c) => (
                  <option key={c.preparada_id} value={c.preparada_id}>
                    {c.preparada_id === ocorrenciaEmConferencia ? "Ocorrência consultada · " : ""}
                    Ciclo {c.ciclo} · {c.vencimento_original} · tolerância {c.tolerancia_depois}{" "}
                    dias · ponte {c.tem_vinculo_legado ? "sim" : "não"} · OS{" "}
                    {c.tem_os ? "sim" : "não"} · revisão {c.ultima_revisao}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Decisão preliminar{" "}
              <select
                value={decisao}
                onChange={(e) => setDecisao(e.target.value as Pedido["decisao"])}
              >
                <option value="avaliar">Avaliar</option>
                <option value="tratar_manualmente">Tratar manualmente</option>
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
                checked={confirmacaoAtual}
                disabled={!snapshot}
                onChange={(e) => setConfirmado(e.target.checked ? snapshot : null)}
              />{" "}
              Conferi o candidato e a data de referência
            </label>
            <button disabled={!confirmacaoAtual}>Registrar triagem</button>
          </fieldset>
        </form>
      )}
      {candidatos.hasNextPage && (
        <button type="button" onClick={() => void candidatos.fetchNextPage()}>
          Mais candidatos
        </button>
      )}
      {item &&
        !candidatos.isFetching &&
        !candidatos.isError &&
        import.meta.env.VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED === "true" && (
          <button type="button" onClick={() => setFilaSelecionada(item.preparada_id)}>
            Conferir entrada na fila desta ocorrência
          </button>
        )}
      {filaSelecionada && (
        <section aria-label="Fila da ocorrência selecionada">
          <p>
            Ocorrência {filaSelecionada}{" "}
            <button type="button" onClick={() => setFilaSelecionada(null)}>
              Fechar fila
            </button>
          </p>
          <FilaPreventivaPcm
            key={filaSelecionada}
            userId={userId}
            clienteId={clienteId}
            planoId={planoId}
            preparadaId={filaSelecionada}
          />
        </section>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}
