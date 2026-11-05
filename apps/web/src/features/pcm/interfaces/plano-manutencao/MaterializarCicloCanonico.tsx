import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { ConferenciaPmocCiclo } from "./ConferenciaPmocCiclo";
import { FilaAposPreparacao } from "./FilaAposPreparacao";
import { IntegrarOrigemOcorrencia } from "./IntegrarOrigemOcorrencia";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
type Pedido = {
  requestId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  revision: number;
  ciclo: number;
  vencimento: string;
};

type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  revision: number;
  ciclo: number;
  vencimento: string;
  vencido?: boolean;
};
export function MaterializarCicloCanonico(props: Props) {
  const key = JSON.stringify([
    props.userId,
    props.clienteId,
    props.planoId,
    props.versaoId,
    props.rotinaId,
    props.ciclo,
    props.vencimento,
    props.vencido ?? false,
  ]);
  if (import.meta.env.VITE_SSO_ORIGEM_EFETIVA_CICLO_ENABLED === "true")
    return <ComOrigem key={key} {...props} />;
  return <MaterializarCicloSessao key={key} {...props} vencido={props.vencido ?? false} />;
}
function ComOrigem(props: Props) {
  const { userId, clienteId, planoId, versaoId, rotinaId, revision, ciclo, vencimento } = props;
  const q = useQuery({
    queryKey: [
      "origem-efetiva-ciclo",
      userId,
      clienteId,
      planoId,
      versaoId,
      rotinaId,
      revision,
      ciclo,
      vencimento,
    ],
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_consultar_origem_efetiva_ciclo", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_versao_id: versaoId,
          p_rotina_id: rotinaId,
          p_expected_revision: revision,
          p_vencimento: vencimento,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = z
        .object({
          planoId: z.string().uuid(),
          versaoId: z.string().uuid(),
          rotinaId: z.string().uuid(),
          revisao: z.number().int().positive(),
          ciclo: z.number().int().nonnegative(),
          vencimento: z.string().date(),
          estado: z.enum([
            "plano",
            "pmoc_vinculado",
            "pmoc_pendente",
            "revisao_necessaria",
            "conflito",
            "origem_pendente",
          ]),
          agendamentoId: z.string().uuid().nullable(),
          fontesCompletas: z.literal(false),
          exclusividadeGlobalComprovada: z.literal(false),
        })
        .strict()
        .parse(data);
      if (
        r.planoId !== planoId ||
        r.versaoId !== versaoId ||
        r.rotinaId !== rotinaId ||
        r.revisao !== revision ||
        r.ciclo !== ciclo ||
        r.vencimento !== vencimento ||
        (r.estado === "pmoc_vinculado") !== (r.agendamentoId !== null)
      )
        throw new Error("Origem divergente.");
      await conferirSessaoDiagnostico(userId, signal);
      return r;
    },
  });
  if (q.isFetching || q.isPending) return <output>Conferindo origem do ciclo...</output>;
  if (q.isError || !q.data)
    return (
      <p role="alert">
        Origem do ciclo indisponível.{" "}
        <button type="button" onClick={() => void q.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  const chave = `${props.vencido ? "sso-ciclo-vencido" : "sso-ciclo-canonico"}:${JSON.stringify([userId, clienteId, planoId, versaoId, rotinaId, ciclo, vencimento])}`;
  let temTentativa = false;
  try {
    temTentativa = sessionStorage.getItem(chave) !== null;
  } catch {
    temTentativa = true;
  }
  const textos: Record<string, string> = {
    pmoc_vinculado: `Ciclo vinculado ao agendamento PMOC ${q.data.agendamentoId}.`,
    pmoc_pendente: "Origem PMOC declarada; falta vincular o agendamento.",
    revisao_necessaria: "Agendamento PMOC da mesma data exige conferência para esta versão.",
    conflito: "Fontes conflitantes exigem reconciliação.",
    origem_pendente: "Declare a origem da Rotina antes de preparar.",
  };
  return (
    <>
      {q.data.estado === "plano" ? (
        <p>
          Origem Plano declarada. Agendamentos PMOC não vinculados ainda precisam de conferência.
        </p>
      ) : (
        <p>{textos[q.data.estado]} Outros agendamentos não vinculados permanecem indeterminados.</p>
      )}
      {q.data.estado === "revisao_necessaria" && (
        <ConferenciaPmocCiclo
          userId={userId}
          clienteId={clienteId}
          planoId={planoId}
          versaoId={versaoId}
          rotinaId={rotinaId}
          revision={revision}
          vencimento={vencimento}
        />
      )}
      {(q.data.estado === "plano" || temTentativa) && (
        <MaterializarCicloSessao
          {...props}
          vencido={props.vencido ?? false}
          somenteRepetir={q.data.estado !== "plano"}
        />
      )}
    </>
  );
}
function MaterializarCicloSessao({
  userId,
  clienteId,
  planoId,
  versaoId,
  rotinaId,
  revision,
  ciclo,
  vencimento,
  vencido,
  somenteRepetir = false,
}: {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  revision: number;
  ciclo: number;
  vencimento: string;
  vencido: boolean;
  somenteRepetir?: boolean;
}) {
  const cache = useQueryClient();
  const chave = `${vencido ? "sso-ciclo-vencido" : "sso-ciclo-canonico"}:${JSON.stringify([userId, clienteId, planoId, versaoId, rotinaId, ciclo, vencimento])}`;
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const primeiraTentativa = useRef(false);
  const [preparada, setPreparada] = useState<string | null>(null);
  const identidadeConfirmacao = JSON.stringify([
    planoId,
    versaoId,
    rotinaId,
    revision,
    ciclo,
    vencimento,
  ]);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pedido;
      return p.clienteId === clienteId &&
        p.planoId === planoId &&
        p.versaoId === versaoId &&
        p.rotinaId === rotinaId &&
        p.ciclo === ciclo &&
        p.vencimento === vencimento &&
        typeof p.requestId === "string" &&
        Number.isSafeInteger(p.revision)
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (
        antes.error ||
        antes.data.user?.id !== userId ||
        sessionStorage.getItem(chave) !== JSON.stringify(p)
      )
        throw new Error("Sessão ou tentativa alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc(vencido ? "sso_preparar_ciclo_vencido" : "sso_materializar_ciclo_canonico", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_plano_id: p.planoId,
          p_versao_id: p.versaoId,
          p_rotina_id: p.rotinaId,
          p_expected_revision: p.revision,
          p_vencimento: p.vencimento,
        });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.indice !== p.ciclo ||
        data.vencimentoOriginal !== p.vencimento ||
        typeof data.criada !== "boolean" ||
        data.osCriada !== false ||
        data.tarefaAuvoCriada !== false
      )
        throw new Error("Resultado inválido.");
      const preparadaId = z.string().uuid().parse(data.preparadaId);
      z.string().uuid().parse(data.cicloCanonicoId);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      return { criada: data.criada as boolean, preparadaId };
    },
    onSuccess: async (r, p) => {
      await cache.invalidateQueries({
        queryKey: [
          "historico-ciclo-canonico",
          userId,
          clienteId,
          planoId,
          versaoId,
          rotinaId,
          ciclo,
        ],
      });
      await cache.invalidateQueries({
        queryKey: ["previa-vencimentos-ocorrencia", userId, clienteId, planoId, versaoId],
      });
      await cache.invalidateQueries({
        queryKey: ["obrigacoes-preparadas", userId, clienteId, planoId],
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
        setAviso("Tentativa alterada ou não removida; preserve o pedido e procure suporte.");
        return;
      }
      setPendente(null);
      setConfirmado(null);
      setPreparada(r.preparadaId);
      setAviso(
        r.criada
          ? "Ciclo preparado criado com identidade canônica; sem OS ou Auvo."
          : "Identidade existente reutilizada; sem OS ou Auvo.",
      );
    },
    onError: async (error, p) => {
      if (
        primeiraTentativa.current &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P0011" &&
        "message" in error &&
        error.message === "revisao_obsoleta"
      ) {
        try {
          const atual = await supabase.auth.getUser();
          if (
            atual.error ||
            atual.data.user?.id !== userId ||
            sessionStorage.getItem(chave) !== JSON.stringify(p)
          )
            throw new Error();
          sessionStorage.removeItem(chave);
          setPendente(null);
          setConfirmado(null);
          setAviso("A revisão mudou. Atualize os dados e confira novamente.");
          await cache.invalidateQueries({
            queryKey: ["previa-vencimentos-ocorrencia", userId, clienteId, planoId, versaoId],
          });
          return;
        } catch {
          setAviso("Tentativa preservada; procure suporte.");
          return;
        }
      }
      setAviso(
        "Resultado não confirmado, revisão mudou ou há conflito de identidade. Repita a mesma tentativa; procure suporte em conflito.",
      );
    },
    onSettled: () => {
      trava.current = false;
      primeiraTentativa.current = false;
    },
  });
  useEffect(() => {
    if (envio.isSuccess)
      void cache.invalidateQueries({
        queryKey: ["previa-vencimentos-uso-canonico", userId, clienteId, planoId, versaoId],
      });
  }, [envio.isSuccess, cache, userId, clienteId, planoId, versaoId]);
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
      setAviso("Não foi possível guardar tentativa; nada enviado. Procure suporte.");
      return;
    }
    primeiraTentativa.current = !pendente;
    if (!pendente) {
      setPreparada(null);
    }
    setPendente(p);
    envio.mutate(p);
  };
  return (
    <section aria-label="Materializar ciclo canônico">
      <p>
        Prepara somente este ciclo, sem OS/Auvo. Coincidência de data com regra diferente exige
        continuidade aprovada.{" "}
        {vencido
          ? "O servidor aceita somente ciclo vencido de versão e Rotina elegíveis; a preparação não comprova ausência de execução."
          : "Vencidos não são gerados neste comando."}{" "}
        {import.meta.env.VITE_SSO_GERACAO_FUSO_SNAPSHOT_ENABLED === "true"
          ? "Janela usa fuso explícito congelado na versão; versões antigas sem fuso ficam bloqueadas."
          : "Fuso operacional ainda exige validação."}{" "}
        Não usar antes de homologação.
      </p>
      {!somenteRepetir && (
        <>
          <label>
            <input
              type="checkbox"
              disabled={!!pendente || envio.isPending}
              checked={confirmado === identidadeConfirmacao}
              onChange={(e) => setConfirmado(e.target.checked ? identidadeConfirmacao : null)}
            />{" "}
            Conferi ciclo {ciclo} e vencimento {vencimento} · revisão {revision}
          </label>
          <button
            type="button"
            disabled={confirmado !== identidadeConfirmacao || !!pendente || envio.isPending}
            onClick={() =>
              enviar({
                requestId: crypto.randomUUID(),
                clienteId,
                planoId,
                versaoId,
                rotinaId,
                revision,
                ciclo,
                vencimento,
              })
            }
          >
            Preparar ciclo
          </button>
        </>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa pendente
        </button>
      )}
      {aviso && <output>{aviso}</output>}
      {preparada && (
        <section aria-label="Próximo passo do ciclo preparado">
          <p>Ocorrência preparada {preparada}.</p>
          <FilaAposPreparacao
            key={preparada}
            userId={userId}
            clienteId={clienteId}
            planoId={planoId}
            preparadaId={preparada}
          />
          <IntegrarOrigemOcorrencia
            userId={userId}
            clienteId={clienteId}
            planoId={planoId}
            revision={revision}
            preparadaId={preparada}
            tipo="calendario"
          />
        </section>
      )}
    </section>
  );
}
