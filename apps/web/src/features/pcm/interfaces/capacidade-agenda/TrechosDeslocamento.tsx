import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const ORIGENS = [
  { value: "residencia", label: "Residência" },
  { value: "escritorio", label: "Escritório" },
  { value: "visita_anterior", label: "Visita anterior" },
  { value: "visita_proxima", label: "Visita próxima" },
  { value: "outro", label: "Outro (retirada/entrega a serviço)" },
] as const;

const trechoLidoSchema = z
  .object({
    sequencia: z.number().int().positive().nullable(),
    origem: z.string().nullable(),
    destino: z.string().nullable(),
    minutos: z.number().int().nullable(),
    enquadramento: z.enum(["computado", "nao_computado"]).nullable(),
    motivo: z.string().nullable(),
    revisao: z.number().int().positive().nullable(),
    ator_id: z.string().nullable(),
    criada_em: z.string().nullable(),
    revisao_visita_atual: z.number().int().positive(),
  })
  .strict();

interface TrechoForm {
  origem: string;
  destino: string;
  minutos: string;
  motivo: string;
}

const TRECHO_VAZIO: TrechoForm = {
  origem: "residencia",
  destino: "visita_proxima",
  minutos: "",
  motivo: "",
};

/** Erro do Postgrest (supabase-js) é um objeto plano `{message,...}`, NÃO `instanceof Error` —
 * checar só por `instanceof Error` nunca reconhece o erro nomeado da RPC. */
function mensagemDeErro(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string")
    return error.message;
  return "";
}

/** E01-S195 — declaração de trechos de deslocamento com origem/destino/enquadramento (AC-1 a
 * AC-4). Mesma seção de `DeslocamentoDeclarado` (que continua sendo a declaração agregada de
 * E01-S172) — as duas coexistem, não se substituem (ver plan.md). */
export function TrechosDeslocamento(props: { clienteId: string; visitaId: string }) {
  return <Conteudo key={`${props.clienteId}:${props.visitaId}`} {...props} />;
}

function Conteudo({ clienteId, visitaId }: { clienteId: string; visitaId: string }) {
  const queryKey = ["trechos-deslocamento", clienteId, visitaId];
  const cache = useQueryClient();
  const [linhas, setLinhas] = useState<TrechoForm[]>([{ ...TRECHO_VAZIO }]);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const consulta = useQuery({
    queryKey,
    // gate fechado é erro permanente, não transitório — mesmo padrão de `DeslocamentoDeclarado`
    // (retry default do TanStack Query mascararia a mensagem de "não ativado" por vários
    // segundos de tentativa automática antes de desistir).
    retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_trechos_visita", { p_cliente_id: clienteId, p_visita_id: visitaId })
        .abortSignal(signal);
      if (error) throw error;
      return z.array(trechoLidoSchema).parse(data);
    },
  });

  const envio = useMutation({
    mutationFn: async (trechos: TrechoForm[]) => {
      const revisaoVisitaAtual = consulta.data?.at(0)?.revisao_visita_atual;
      if (!revisaoVisitaAtual)
        throw new Error("Revisão da Visita indisponível — recarregue antes de declarar.");
      const revisaoAnterior = consulta.data?.find((t) => t.revisao != null)?.revisao ?? 0;
      const payload = trechos.map((t) => ({
        origem: t.origem,
        destino: t.destino,
        minutos: Number(t.minutos),
        motivo: t.motivo || null,
      }));
      const { data, error } = await supabase.schema("pcm").rpc("sso_declarar_trechos_visita", {
        p_request_id: crypto.randomUUID(),
        p_cliente_id: clienteId,
        p_visita_id: visitaId,
        p_revisao_visita: revisaoVisitaAtual,
        p_revisao_anterior: revisaoAnterior,
        p_trechos: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey });
      setLinhas([{ ...TRECHO_VAZIO }]);
      setErroForm(null);
    },
    onError: (error) =>
      setErroForm(mensagemDeErro(error) || "Não foi possível declarar os trechos."),
  });

  // E01-S194/E00-S28 AC-F3: recurso existe mas o gate de banco está fechado — não é erro
  // genérico, é "disponível, não ativado". `E00-S28` tem um componente compartilhado pra isso
  // em outra branch ainda não mesclada aqui; até lá, mensagem equivalente inline.
  const gateFechado =
    consulta.isError && mensagemDeErro(consulta.error).includes("trechos_deslocamento_bloqueados");

  function atualizarLinha(indice: number, campo: keyof TrechoForm, valor: string) {
    setLinhas((atual) =>
      atual.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)),
    );
  }

  function enviar() {
    if (
      linhas.some((l) => !l.minutos || Number.isNaN(Number(l.minutos)) || Number(l.minutos) < 0)
    ) {
      setErroForm("Informe os minutos de cada trecho.");
      return;
    }
    envio.mutate(linhas);
  }

  return (
    <section aria-label="Trechos de deslocamento da Visita">
      <h4>Trechos de deslocamento</h4>
      <p>
        Origem, destino e enquadramento de cada perna do dia. Trajeto residencial (residência ↔
        cliente, mesmo com o veículo da empresa sob guarda) nunca computa; o resto computa e ocupa
        jornada, sem reduzir as horas contratadas do Cliente nem classificar hora extra sozinho.
      </p>

      {gateFechado && <output>Recurso disponível, ainda não ativado para este Cliente.</output>}
      {consulta.isError && !gateFechado && (
        <p role="alert">
          Não foi possível carregar os trechos.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {consulta.isLoading && <p>Carregando…</p>}

      {(() => {
        const trechosReais = consulta.data?.filter((t) => t.sequencia != null) ?? [];
        if (trechosReais.length === 0)
          return consulta.data ? <p>Nenhum trecho declarado ainda.</p> : null;
        return (
          <ul>
            {trechosReais.map((t) => (
              <li key={t.sequencia}>
                {t.sequencia}. {ORIGENS.find((o) => o.value === t.origem)?.label ?? t.origem} →{" "}
                {ORIGENS.find((o) => o.value === t.destino)?.label ?? t.destino} · {t.minutos} min ·{" "}
                <strong>{t.enquadramento === "computado" ? "Computado" : "Não computado"}</strong>
                {t.motivo && <> — {t.motivo}</>}
              </li>
            ))}
          </ul>
        );
      })()}

      {!gateFechado && (
        <>
          {linhas.map((linha, indice) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lista de formulário local, sem id estável antes do envio
            <fieldset key={indice}>
              <legend>Trecho {indice + 1}</legend>
              <label htmlFor={`trecho-origem-${indice}`}>Origem</label>
              <select
                id={`trecho-origem-${indice}`}
                value={linha.origem}
                onChange={(e) => atualizarLinha(indice, "origem", e.target.value)}
              >
                {ORIGENS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label htmlFor={`trecho-destino-${indice}`}>Destino</label>
              <select
                id={`trecho-destino-${indice}`}
                value={linha.destino}
                onChange={(e) => atualizarLinha(indice, "destino", e.target.value)}
              >
                {ORIGENS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <label htmlFor={`trecho-minutos-${indice}`}>Minutos</label>
              <input
                id={`trecho-minutos-${indice}`}
                type="number"
                min={0}
                max={1440}
                value={linha.minutos}
                onChange={(e) => atualizarLinha(indice, "minutos", e.target.value)}
              />
              <label htmlFor={`trecho-motivo-${indice}`}>Motivo (opcional)</label>
              <input
                id={`trecho-motivo-${indice}`}
                value={linha.motivo}
                onChange={(e) => atualizarLinha(indice, "motivo", e.target.value)}
              />
            </fieldset>
          ))}
          <button
            type="button"
            onClick={() => setLinhas((atual) => [...atual, { ...TRECHO_VAZIO }])}
          >
            Adicionar trecho
          </button>
          <button type="button" disabled={envio.isPending} onClick={enviar}>
            Declarar dia
          </button>
          {erroForm && <p role="alert">{erroForm}</p>}
        </>
      )}
    </section>
  );
}
