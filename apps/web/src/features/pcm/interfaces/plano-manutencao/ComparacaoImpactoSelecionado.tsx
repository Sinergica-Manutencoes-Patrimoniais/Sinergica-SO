import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";

const rotina = z
  .object({
    id: z.string().uuid(),
    nome: z.string(),
    alvo_tipo: z.enum(["sistema", "componente", "grupo"]),
    sistema_id: z.string().uuid().nullable(),
    equipamento_id: z.string().uuid().nullable(),
    grupo_id: z.string().uuid().nullable(),
    modo: z.enum(["calendario", "visita"]),
    intervalo_n: z.number().int().nullable(),
    intervalo_unidade: z.string().nullable(),
    data_base: z.string().nullable(),
    tempo_minutos: z.number().nullable(),
    tipo_tempo: z.string().nullable(),
    tolerancia_antes: z.number().nullable(),
    tolerancia_depois: z.number().nullable(),
    instrucao: z.string().nullable(),
    questionario_id: z.string().uuid().nullable(),
  })
  .strict();
const osImpacto = z
  .array(
    z
      .object({
        id: z.string().uuid(),
        status: z.string().nullable(),
        atualizadaEm: z.string().nullable(),
      })
      .strict(),
  )
  .max(100);
const origemOcorrencia = z
  .object({
    versaoId: z.string().uuid(),
    numero: z.number().int().positive().nullable(),
    estado: z.enum(["disponivel", "historico_indeterminado"]),
    rotina: z.record(z.unknown()).nullable(),
    questionarioEstado: z.enum(["disponivel", "sem_questionario", "indeterminado"]),
    questionarioHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
  })
  .strict();
const questionarioComparacao = z
  .object({
    estado: z.enum([
      "nao_comparavel",
      "sem_questionario",
      "referencia_alterada",
      "historico_indeterminado",
      "fonte_atual_indisponivel",
      "conteudo_integral_igual",
      "conteudo_integral_diferente",
    ]),
    historicoHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    atualHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
  })
  .strict();
export const comparacaoImpactoSchema = z
  .object({
    preparadaId: z.string().uuid(),
    rascunhoId: z.string().uuid(),
    revisaoPlano: z.number().int().positive(),
    tipo: z.enum(["calendario", "visita"]),
    rotinaLogicaId: z.string().uuid(),
    alvoOcorrenciaTipo: z.enum(["sistema", "componente", "grupo"]),
    alvoOcorrenciaId: z.string().uuid(),
    vencimentoOriginal: z.string().date(),
    ciclo: z.number().int().nonnegative().nullable(),
    visitaId: z.string().uuid().nullable(),
    semanaOrigem: z.string().date().nullable(),
    anterior: rotina,
    rascunho: rotina.nullable(),
    questionarioComparacao,
    origemOcorrencia,
    osImpacto,
    osOutroCliente: z.boolean(),
    avaliacaoLegadaExistente: z.literal(true).optional(),
    fontesCompletas: z.literal(false),
    aprovacaoAutorizada: z.literal(false),
  })
  .strict();
export const comparacaoImpactoArmazenadaSchema = comparacaoImpactoSchema.extend({
  ciclo: z.number().int().nonnegative().nullable().optional(),
  visitaId: z.string().uuid().nullable().optional(),
  semanaOrigem: z.string().date().nullable().optional(),
  questionarioComparacao: questionarioComparacao.optional(),
  origemOcorrencia: origemOcorrencia.optional(),
  osImpacto: osImpacto.optional(),
  osOutroCliente: z.boolean().optional(),
});
export type ComparacaoImpacto = z.infer<typeof comparacaoImpactoArmazenadaSchema>;
type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  revisao: number;
  rascunhoId?: string;
  preparadaId?: string;
  tipo: "calendario" | "visita";
};
export function useComparacaoImpacto({
  userId,
  clienteId,
  planoId,
  revisao,
  rascunhoId,
  preparadaId,
  tipo,
}: Props) {
  return useQuery({
    queryKey: [
      "comparacao-impacto-selecionado",
      userId,
      clienteId,
      planoId,
      revisao,
      rascunhoId,
      preparadaId,
      tipo,
    ],
    enabled: !!rascunhoId && !!preparadaId,
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      if (!rascunhoId || !preparadaId) throw new Error("Ocorrência ausente.");
      await conferirSessaoDiagnostico(userId, signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_comparar_rotina_impacto_v3", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_expected_plano: revisao,
          p_rascunho_id: rascunhoId,
          p_preparada_id: preparadaId,
          p_tipo: tipo,
        })
        .abortSignal(signal);
      if (error) throw error;
      const r = comparacaoImpactoSchema.parse(data);
      if (
        r.preparadaId !== preparadaId ||
        r.rascunhoId !== rascunhoId ||
        r.revisaoPlano !== revisao ||
        r.tipo !== tipo ||
        (tipo === "calendario"
          ? r.ciclo === null || r.visitaId !== null || r.semanaOrigem !== null
          : r.ciclo !== null || r.visitaId === null || r.semanaOrigem === null)
      )
        throw new Error("Comparação divergente.");
      await conferirSessaoDiagnostico(userId, signal);
      return r;
    },
  });
}
function DadosRotina({ titulo, valor }: { titulo: string; valor: z.infer<typeof rotina> | null }) {
  if (!valor) return <p>{titulo}: Rotina ausente no rascunho.</p>;
  const alvo = valor.sistema_id ?? valor.equipamento_id ?? valor.grupo_id;
  const tipo = { sistema: "Sistema", componente: "Componente", grupo: "Grupo Quantitativo" }[
    valor.alvo_tipo
  ];
  return (
    <div>
      <strong>
        {titulo}: {valor.nome}
      </strong>
      <p>
        {tipo}: {alvo ?? "não informado"} ·{" "}
        {valor.modo === "visita" ? "por Visita" : "por calendário"} · intervalo{" "}
        {valor.intervalo_n ?? "não informado"} {valor.intervalo_unidade ?? ""} · data-base{" "}
        {valor.data_base ?? "não informada"}
      </p>
      <p>
        Tempo:{" "}
        {valor.tempo_minutos === null || valor.tempo_minutos === 0
          ? "a validar"
          : `${valor.tempo_minutos} min (${valor.tipo_tempo ?? "tipo não informado"})`}{" "}
        · Instrução: {valor.instrucao || "não informada"}
      </p>
      <p>
        Tolerância: {valor.tolerancia_antes ?? "não informada"} dias antes /{" "}
        {valor.tolerancia_depois ?? "não informada"} dias depois · questionário{" "}
        {valor.questionario_id ?? "não informado"}
      </p>
    </div>
  );
}
function OrigemHistorica({ dados }: { dados: z.infer<typeof origemOcorrencia> | undefined }) {
  if (!dados) return <p>Origem da ocorrência não registrada nesta tentativa anterior.</p>;
  if (dados.estado !== "disponivel" || !dados.rotina)
    return (
      <p>Versão de origem {dados.numero ?? dados.versaoId}: histórico da Rotina indeterminado.</p>
    );
  const texto = (chave: string) => {
    const valor = dados.rotina?.[chave];
    return typeof valor === "string" || typeof valor === "number" ? String(valor) : "não informado";
  };
  const questionario = {
    disponivel: "snapshot disponível",
    sem_questionario: "sem questionário",
    indeterminado: "histórico indeterminado",
  }[dados.questionarioEstado];
  return (
    <div>
      <strong>
        Origem da ocorrência · versão {dados.numero ?? dados.versaoId}: {texto("nome")}
      </strong>
      <p>
        Modo {texto("modo")} · intervalo {texto("intervalo_n")} {texto("intervalo_unidade")} ·
        data-base {texto("data_base")}
      </p>
      <p>
        Tempo {texto("tempo_minutos")} · tipo {texto("tipo_tempo")} · instrução {texto("instrucao")}
      </p>
      <p>
        Questionário {texto("questionario_id")} · {questionario}.
      </p>
    </div>
  );
}
export function DetalhesComparacaoImpacto({ dados }: { dados: ComparacaoImpacto }) {
  const tipo = { sistema: "Sistema", componente: "Componente", grupo: "Grupo Quantitativo" }[
    dados.alvoOcorrenciaTipo
  ];
  return (
    <section aria-label="Comparação da Rotina da ocorrência">
      <p>
        Ocorrência: {tipo} {dados.alvoOcorrenciaId} · vencimento original {dados.vencimentoOriginal}
        .
      </p>
      {dados.tipo === "calendario" ? (
        <p>Ciclo {dados.ciclo ?? "não informado"}.</p>
      ) : (
        <p>
          Visita {dados.visitaId ?? "não informada"} · semana{" "}
          {dados.semanaOrigem ?? "não informada"}.
        </p>
      )}
      <OrigemHistorica dados={dados.origemOcorrencia} />
      <DadosRotina titulo="Versão anterior" valor={dados.anterior} />
      <DadosRotina titulo="Rascunho" valor={dados.rascunho} />
      <p>
        Questionário:{" "}
        {dados.questionarioComparacao
          ? (
              {
                nao_comparavel: "Rotina ausente na versão proposta.",
                sem_questionario: "Nenhuma referência nas duas versões.",
                referencia_alterada: "Referência alterada; conteúdo exige conferência.",
                historico_indeterminado: "Histórico incompleto; conteúdo indeterminado.",
                fonte_atual_indisponivel: "Fonte atual indisponível ou incompleta.",
                conteudo_integral_igual: "Conteúdo e metadados iguais ao histórico neste instante.",
                conteudo_integral_diferente: "Conteúdo ou metadados diferentes do histórico.",
              } as const
            )[dados.questionarioComparacao.estado]
          : "Conteúdo não registrado na tentativa anterior."}{" "}
        Fontes externas exigem conferência própria.
      </p>
      {dados.avaliacaoLegadaExistente && (
        <p role="alert">
          Há avaliação recebida na ocorrência legada vinculada; confira a evidência antes de
          decidir.
        </p>
      )}
      {dados.osOutroCliente && (
        <p role="alert">
          Existe OS vinculada a outro Cliente; é necessária reconciliação, sem exibir seus dados.
        </p>
      )}
      <p>
        OS ativas encontradas nas fontes vinculadas: {dados.osImpacto?.length ?? "não consultadas"}.
      </p>
      {dados.osImpacto && dados.osImpacto.length > 0 && (
        <ul>
          {dados.osImpacto.map((os) => (
            <li key={os.id}>
              OS {os.id} · status {os.status ?? "não informado"}
            </li>
          ))}
        </ul>
      )}
      <p>A lista é parcial; OS sem vínculo reconhecido podem não aparecer.</p>
    </section>
  );
}
