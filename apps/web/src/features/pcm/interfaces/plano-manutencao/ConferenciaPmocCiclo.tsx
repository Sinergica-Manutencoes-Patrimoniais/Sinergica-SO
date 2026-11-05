import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  rotinaId: string;
  revision: number;
  vencimento: string;
};
const foto = z
  .object({
    id: z.string().uuid(),
    clienteId: z.string().uuid(),
    data: z.string().date(),
    imovelNome: z.string(),
    imovelId: z.string().uuid(),
    contratoId: z.string().uuid(),
    contratoInicio: z.string().nullable(),
    contratoFim: z.string().nullable(),
    estado: z.string(),
    tipo: z.string(),
  })
  .passthrough();
const item = z
  .object({
    agendamento_id: z.string().uuid(),
    revisao_decisao: z.number().int().nonnegative().safe(),
    classificacao: z.enum(["relacionado", "nao_relacionado", "historico_preservado"]).nullable(),
    fotografia_atual: z.boolean(),
    fotografia: foto,
  })
  .strict();
const pedido = z
  .object({
    requestId: z.string().uuid(),
    clienteId: z.string().uuid(),
    planoId: z.string().uuid(),
    versaoId: z.string().uuid(),
    rotinaId: z.string().uuid(),
    revision: z.number().int().positive().safe(),
    vencimento: z.string().date(),
    agendamentoId: z.string().uuid(),
    decisaoRevision: z.number().int().nonnegative().safe(),
    classificacao: z.enum(["relacionado", "nao_relacionado"]),
    fotografia: foto,
    evidencia: z.string().trim().min(1).max(500),
    motivo: z.string().trim().min(1).max(2000),
  })
  .strict();
type Pedido = z.infer<typeof pedido>;
export function ConferenciaPmocCiclo({
  userId,
  clienteId,
  planoId,
  versaoId,
  rotinaId,
  revision,
  vencimento,
}: Props) {
  const cache = useQueryClient();
  const trava = useRef(false);
  const primeiraTentativa = useRef(false);
  const chave = `sso-pmoc-ciclo:${JSON.stringify([userId, clienteId, planoId, versaoId, rotinaId, vencimento])}`;
  const [selecionado, setSelecionado] = useState("");
  const [classificacao, setClassificacao] = useState<Pedido["classificacao"] | "">("");
  const [evidencia, setEvidencia] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedido.parse(JSON.parse(raw));
      return p.clienteId === clienteId &&
        p.planoId === planoId &&
        p.versaoId === versaoId &&
        p.rotinaId === rotinaId &&
        p.vencimento === vencimento
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const lista = useInfiniteQuery({
    queryKey: [
      "pmoc-conferencia-ciclo",
      userId,
      clienteId,
      planoId,
      versaoId,
      rotinaId,
      revision,
      vencimento,
    ],
    gcTime: 0,
    retry: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_pmoc_ciclo_conferencia", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_versao_id: versaoId,
          p_rotina_id: rotinaId,
          p_expected_revision: revision,
          p_vencimento: vencimento,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(item).max(20).parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const x of pagina) {
        if (
          x.agendamento_id.toLowerCase() <= anterior ||
          x.fotografia.id !== x.agendamento_id ||
          x.fotografia.clienteId !== clienteId ||
          x.fotografia.data !== vencimento
        )
          throw new Error("Página divergente.");
        anterior = x.agendamento_id.toLowerCase();
      }
      await conferirSessaoDiagnostico(userId, signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.agendamento_id : undefined),
  });
  const itens = lista.data?.pages.flat() ?? [];
  const consistentes = itens.every(
    (x, i) =>
      i === 0 || x.agendamento_id.toLowerCase() > itens[i - 1]!.agendamento_id.toLowerCase(),
  );
  const disponivel = !!lista.data && !lista.isFetching && !lista.isError && consistentes;
  const atual = disponivel ? itens.find((x) => x.agendamento_id === selecionado) : undefined;
  const assinatura = JSON.stringify([
    clienteId,
    planoId,
    versaoId,
    rotinaId,
    revision,
    vencimento,
    atual,
    classificacao,
    evidencia.trim(),
    motivo.trim(),
  ]);
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessaoDiagnostico(userId);
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_classificar_pmoc_ciclo", {
        p_ator_id: userId,
        p_request_id: p.requestId,
        p_cliente_id: p.clienteId,
        p_plano_id: p.planoId,
        p_versao_id: p.versaoId,
        p_rotina_id: p.rotinaId,
        p_expected_revision: p.revision,
        p_vencimento: p.vencimento,
        p_agendamento_id: p.agendamentoId,
        p_expected_decisao: p.decisaoRevision,
        p_expected_fotografia: p.fotografia,
        p_evidencia: p.evidencia,
        p_motivo: p.motivo,
        p_classificacao: p.classificacao,
      });
      if (error) throw error;
      const r = z
        .object({
          requestId: z.string().uuid(),
          agendamentoId: z.string().uuid(),
          versaoId: z.string().uuid(),
          revisao: z.number().int().positive(),
          classificacao: z.enum(["relacionado", "nao_relacionado"]),
          agendamentoAlterado: z.literal(false),
          osAlteradas: z.literal(false),
        })
        .strict()
        .parse(data);
      if (
        r.requestId !== p.requestId ||
        r.agendamentoId !== p.agendamentoId ||
        r.versaoId !== p.versaoId ||
        r.revisao !== p.decisaoRevision + 1 ||
        r.classificacao !== p.classificacao
      )
        throw new Error("Recibo divergente.");
      await conferirSessaoDiagnostico(userId);
    },
    onSuccess: async (_r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(chave);
      } catch {
        setAviso("Tentativa preservada; procure suporte.");
        return;
      }
      setPendente(null);
      setConfirmado(null);
      setAviso("Conferência registrada; agendamento e OS não foram alterados.");
      await Promise.all([
        cache.invalidateQueries({
          queryKey: ["pmoc-conferencia-ciclo", userId, clienteId, planoId],
        }),
        cache.invalidateQueries({ queryKey: ["origem-efetiva-ciclo", userId, clienteId, planoId] }),
        cache.invalidateQueries({ queryKey: ["origens-lote", userId, clienteId, planoId] }),
      ]);
    },
    onError: async (error, p) => {
      const e = error as { code?: string; message?: string };
      if (
        primeiraTentativa.current &&
        ((e.code === "P0013" && e.message === "fotografia_pmoc_alterada") ||
          (e.code === "P0011" && e.message === "revisao_obsoleta") ||
          (e.code === "P0014" && e.message === "revisao_decisao_obsoleta") ||
          (e.code === "23514" &&
            [
              "vinculo_pmoc_atual_necessario",
              "classificacao_diverge_de_vinculo_atual",
              "cadeia_pmoc_inconsistente",
              "agendamento_indisponivel",
              "vigencia_indeterminada",
              "vencimento_nao_e_ciclo",
              "vencimento_nao_e_visita",
            ].includes(e.message ?? "")))
      ) {
        try {
          await conferirSessaoDiagnostico(userId);
          if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(chave);
          setPendente(null);
          setConfirmado(null);
          setAviso(
            "Conferência recusada pelo servidor. Revise o vínculo, os dados e a vigência antes de tentar novamente.",
          );
          await lista.refetch();
          return;
        } catch {
          /* Preservar a tentativa se o resultado não puder ser confirmado. */
        }
      }
      setAviso(
        "Resultado não confirmado ou vínculo incompatível. Repita a tentativa; procure suporte se persistir.",
      );
    },
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    try {
      const salvo = sessionStorage.getItem(chave);
      if (salvo !== null && salvo !== JSON.stringify(p)) throw new Error();
      primeiraTentativa.current = salvo === null;
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível guardar a tentativa.");
      return;
    }
    trava.current = true;
    setPendente(p);
    envio.mutate(p);
  };
  return (
    <section aria-label="Conferência PMOC da data">
      <h5>Conferir PMOC da data</h5>
      <p>
        Informe se o agendamento pertence ao Plano. Para marcar como relacionado, é necessário um
        vínculo PMOC válido na versão.
      </p>
      {lista.isFetching && <p role="status">Consultando agendamentos…</p>}
      {(lista.isError || !consistentes) && (
        <p role="alert">
          Consulta indisponível ou divergente.{" "}
          <button type="button" onClick={() => void lista.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {disponivel && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !atual ||
              !classificacao ||
              pendente ||
              envio.isPending ||
              confirmado !== assinatura ||
              !evidencia.trim() ||
              !motivo.trim()
            )
              return;
            enviar({
              requestId: crypto.randomUUID(),
              clienteId,
              planoId,
              versaoId,
              rotinaId,
              revision,
              vencimento,
              agendamentoId: atual.agendamento_id,
              decisaoRevision: atual.revisao_decisao,
              classificacao,
              fotografia: atual.fotografia,
              evidencia: evidencia.trim(),
              motivo: motivo.trim(),
            });
          }}
        >
          <fieldset disabled={!!pendente || envio.isPending}>
            <label>
              Agendamento{" "}
              <select
                required
                value={selecionado}
                onChange={(e) => {
                  setSelecionado(e.target.value);
                  setConfirmado(null);
                }}
              >
                <option value="">Selecione</option>
                {itens.map((x) => (
                  <option key={x.agendamento_id} value={x.agendamento_id}>
                    {x.fotografia.imovelNome} · {x.fotografia.tipo} · {x.fotografia.estado} ·{" "}
                    {x.classificacao ?? "sem classificação"}
                    {x.classificacao && !x.fotografia_atual ? " · desatualizada" : ""}
                  </option>
                ))}
              </select>
            </label>
            {atual && (
              <p>
                Imóvel {atual.fotografia.imovelNome} ({atual.fotografia.imovelId}) · contrato{" "}
                {atual.fotografia.contratoId} · vigência{" "}
                {atual.fotografia.contratoInicio ?? "indisponível"} a{" "}
                {atual.fotografia.contratoFim ?? "indisponível"}.
              </p>
            )}
            <label>
              Classificação{" "}
              <select
                required
                value={classificacao}
                onChange={(e) => {
                  setClassificacao(e.target.value as Pedido["classificacao"] | "");
                  setConfirmado(null);
                }}
              >
                <option value="">Selecione</option>
                <option value="nao_relacionado">Não relacionado ao Plano</option>
                <option value="relacionado">Relacionado ao Plano — exige vínculo válido</option>
              </select>
            </label>
            <label>
              Referência da evidência{" "}
              <input
                required
                maxLength={500}
                value={evidencia}
                onChange={(e) => {
                  setEvidencia(e.target.value);
                  setConfirmado(null);
                }}
              />
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
                checked={confirmado === assinatura}
                onChange={(e) => setConfirmado(e.target.checked ? assinatura : null)}
              />{" "}
              Conferi a classificação e o vínculo quando aplicável
            </label>
            <button disabled={!atual || !classificacao || confirmado !== assinatura}>
              Registrar conferência
            </button>
          </fieldset>
        </form>
      )}
      {disponivel && lista.hasNextPage && (
        <button type="button" onClick={() => void lista.fetchNextPage()}>
          Mais agendamentos
        </button>
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
