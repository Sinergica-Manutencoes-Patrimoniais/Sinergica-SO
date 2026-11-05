import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import {
  type ComparacaoImpacto,
  comparacaoImpactoArmazenadaSchema,
} from "./ComparacaoImpactoSelecionado";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  rascunhoId: string;
  preparadaId: string;
  planoRevision: number;
  decisaoRevision: number;
  comparacao: ComparacaoImpacto;
};
const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    clienteId: z.string(),
    planoId: z.string(),
    rascunhoId: z.string().uuid(),
    preparadaId: z.string().uuid(),
    planoRevision: z.number().int().positive(),
    decisaoRevision: z.number().int().nonnegative(),
    indice: z.number().int().min(0).max(3660000),
    data: z.string().date(),
    motivo: z.string().trim().min(1).max(2000),
    comparacao: comparacaoImpactoArmazenadaSchema,
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
const candidatoSchema = z
  .object({ indice: z.number().int().min(0).max(3660000), vencimento: z.string().date() })
  .strict();
export function EscolherNovaDataCalendario(props: Props) {
  if (import.meta.env.VITE_SSO_NOVA_DATA_CICLO_ENABLED !== "true") return null;
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.rascunhoId,
        props.preparadaId,
        props.decisaoRevision,
      ])}
      {...props}
    />
  );
}
function Conteudo({
  userId,
  clienteId,
  planoId,
  rascunhoId,
  preparadaId,
  planoRevision,
  decisaoRevision,
  comparacao,
}: Props) {
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const cache = useQueryClient();
  const trava = useRef(false);
  const primeira = useRef(false);
  const chave = `sso-nova-data-calendario:${JSON.stringify([userId, clienteId, planoId, rascunhoId, preparadaId, decisaoRevision])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId &&
        p.planoId === planoId &&
        p.rascunhoId === rascunhoId &&
        p.preparadaId === preparadaId &&
        p.decisaoRevision === decisaoRevision
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [motivo, setMotivo] = useState("");
  const [opcoes, setOpcoes] = useState<z.infer<typeof candidatoSchema>[]>([]);
  const [selecionado, setSelecionado] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const assinatura = JSON.stringify([
    clienteId,
    planoId,
    rascunhoId,
    preparadaId,
    planoRevision,
    decisaoRevision,
    comparacao,
    inicio,
    fim,
    selecionado,
    motivo.trim(),
  ]);
  const previa = useMutation({
    mutationFn: async () => {
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_prever_novas_datas_calendario", {
          p_ator: userId,
          p_cliente: clienteId,
          p_plano: planoId,
          p_rascunho: rascunhoId,
          p_preparada: preparadaId,
          p_revisao: planoRevision,
          p_inicio: inicio,
          p_fim: fim,
          p_comparacao: comparacao,
        });
      if (error) throw error;
      const r = z.array(candidatoSchema).max(100).parse(data);
      if (
        r.some((v, i) => {
          const anterior = r[i - 1];
          return (
            v.vencimento < inicio ||
            v.vencimento > fim ||
            (i > 0 && (anterior === undefined || v.indice <= anterior.indice))
          );
        })
      )
        throw new Error("Prévia divergente.");
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
      return r;
    },
    onSuccess: (r) => {
      setOpcoes(r);
      setSelecionado("");
      setConfirmado(null);
      setAviso(
        r.length ? "Confira as datas da nova regra." : "Nenhuma data candidata nessa janela.",
      );
    },
    onError: () => {
      setOpcoes([]);
      setSelecionado("");
      setConfirmado(null);
      setAviso("Prévia indisponível ou comparação alterada. Atualize os dados.");
    },
  });
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa divergente.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_escolher_nova_data_calendario", {
          p_ator: userId,
          p_request: p.requestId,
          p_cliente: p.clienteId,
          p_plano: p.planoId,
          p_rascunho: p.rascunhoId,
          p_preparada: p.preparadaId,
          p_revisao_plano: p.planoRevision,
          p_revisao_decisao: p.decisaoRevision,
          p_indice_novo: p.indice,
          p_data_confirmada: p.data,
          p_motivo: p.motivo,
          p_comparacao: p.comparacao,
        });
      if (error) throw error;
      if (
        !data ||
        data.requestId !== p.requestId ||
        data.preparadaId !== p.preparadaId ||
        data.novaDataEscolhida !== p.data ||
        data.indiceNovo !== p.indice ||
        data.substituicaoAplicada !== false ||
        data.aprovacaoAutorizada !== false ||
        data.ocorrenciaAlterada !== false ||
        data.osAlteradas !== false
      )
        throw new Error("Recibo divergente.");
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
    },
    onSuccess: async (_r, p) => {
      try {
        await conferirSessaoDiagnostico(userId);
        if (!montado.current) throw new Error("Tela desmontada.");
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(chave);
      } catch {
        setAviso("Tentativa preservada; procure suporte.");
        return;
      }
      setPendente(null);
      setConfirmado(null);
      setAviso("Nova data escolhida; aplicação depende de aprovação e vigência.");
      await Promise.all([
        cache.invalidateQueries({
          queryKey: ["decisoes-impacto-ocorrencia", userId, clienteId, planoId],
        }),
        cache.invalidateQueries({
          queryKey: ["escolha-alteracao-ciclo", userId, clienteId, planoId],
        }),
        cache.invalidateQueries({
          queryKey: ["avaliacao-impacto-revisao", userId, clienteId, planoId],
        }),
        cache.invalidateQueries({
          queryKey: ["avaliacao-impacto-visita-legado", userId, clienteId, planoId],
        }),
      ]).catch(() => undefined);
    },
    onError: async (error, p) => {
      if (
        primeira.current &&
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (("message" in error &&
          ((error.code === "P0010" && error.message === "comparacao_obsoleta") ||
            (error.code === "P0011" && error.message === "revisao_obsoleta") ||
            (error.code === "P0014" && error.message === "data_candidata_alterada"))) ||
          ((error.code === "23514" || error.code === "23505") &&
            "message" in error &&
            typeof error.message === "string" &&
            [
              "nova_data_invalida",
              "execucao_ou_vinculo_exige_reconciliacao",
              "candidato_existente_exige_reconciliacao",
              "candidato_ja_escolhido",
            ].includes(error.message)))
      ) {
        try {
          await conferirSessaoDiagnostico(userId);
          if (!montado.current) throw new Error("Tela desmontada.");
          if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error();
          sessionStorage.removeItem(chave);
          setPendente(null);
          setConfirmado(null);
          setOpcoes([]);
          setAviso("A escolha não pôde ser aplicada. Atualize os dados e confira novamente.");
          return;
        } catch {
          setAviso("Tentativa preservada; procure suporte.");
          return;
        }
      }
      setAviso("Resultado não confirmado. Repita a mesma tentativa; procure suporte se persistir.");
    },
    onSettled: () => {
      trava.current = false;
      primeira.current = false;
    },
  });
  const enviar = (p: Pedido, nova = false) => {
    if (trava.current) return;
    try {
      const anterior = sessionStorage.getItem(chave);
      if (anterior !== null && (nova || anterior !== JSON.stringify(p))) throw new Error();
      sessionStorage.setItem(chave, JSON.stringify(p));
    } catch {
      setAviso("Não foi possível guardar a tentativa.");
      return;
    }
    trava.current = true;
    primeira.current = nova;
    setPendente(p);
    envio.mutate(p);
  };
  return (
    <section aria-label="Escolher nova data">
      <h5>Escolher nova data pela regra revisada</h5>
      <p>
        Consulte uma janela de até 90 dias. A escolha não altera a ocorrência antiga nem OS; efeitos
        dependem de aprovação e vigência.
      </p>
      <fieldset disabled={!!pendente || envio.isPending || previa.isPending}>
        <label>
          Início da janela{" "}
          <input
            type="date"
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value);
              setOpcoes([]);
              setConfirmado(null);
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
              setOpcoes([]);
              setConfirmado(null);
            }}
          />
        </label>
        <button
          type="button"
          disabled={!inicio || !fim || fim < inicio}
          onClick={() => previa.mutate()}
        >
          Consultar datas
        </button>
        <label>
          Data candidata{" "}
          <select
            value={selecionado}
            onChange={(e) => {
              setSelecionado(e.target.value);
              setConfirmado(null);
            }}
          >
            <option value="">Selecione</option>
            {opcoes.map((o) => (
              <option key={o.indice} value={String(o.indice)}>
                {o.vencimento} · ciclo {o.indice}
              </option>
            ))}
          </select>
        </label>
        <label>
          Motivo{" "}
          <textarea
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
          Conferi a ocorrência original e a data escolhida
        </label>
        <button
          type="button"
          disabled={confirmado !== assinatura || !selecionado || !motivo.trim()}
          onClick={() => {
            const candidato = opcoes.find((o) => String(o.indice) === selecionado);
            if (!candidato || confirmado !== assinatura) return;
            enviar(
              {
                requestId: crypto.randomUUID(),
                clienteId,
                planoId,
                rascunhoId,
                preparadaId,
                planoRevision,
                decisaoRevision,
                indice: candidato.indice,
                data: candidato.vencimento,
                motivo: motivo.trim(),
                comparacao,
              },
              true,
            );
          }}
        >
          Registrar escolha
        </button>
      </fieldset>
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
