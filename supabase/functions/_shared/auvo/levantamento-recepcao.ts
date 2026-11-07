import { z } from "npm:zod@4.6.7";

const atributoSchema = z.enum(["nome", "observacoes", "quantidade", "codigoInformado", "referenciaPai", "sistemaProvisorio", "localProvisorio", "classificacao"]);
const tipoSchema = z.enum(["area", "local", "sublocal", "sistema", "equipamento", "componente", "grupo_quantitativo"]);
const idExterno = z.string().min(1).max(200).refine((valor) => valor.trim() === valor && valor.length > 0);
const contratoSchema = z.object({
  questionarioId: idExterno,
  versao: idExterno,
  campos: z.record(z.string(), atributoSchema),
}).strict();
const entradaSchema = z.object({
  envelopeId: z.string().guid(),
  clienteId: z.string().guid(),
  osId: z.string().guid(),
  taskId: z.string().regex(/^[1-9][0-9]{0,18}$/),
  questionarioId: idExterno,
  versao: idExterno,
  linhas: z.array(z.object({
    chave: z.string().trim().min(1).max(200), tipo: tipoSchema,
    respostas: z.record(z.string(), z.unknown()),
    fotos: z.array(idExterno).max(100),
  }).strict()).min(1).max(1000),
}).strict();

type Atributo = z.infer<typeof atributoSchema>;
type LinhaPreparada = { chave: string; tipo: z.infer<typeof tipoSchema>; atributos: Partial<Record<Atributo, string | number>> & { nome: string } };
type Resultado =
  | { estado: "pendente"; motivo: "contrato_invalido" | "entrada_invalida" | "contrato_desconhecido" | "mapeamento_ambiguo" | "chave_duplicada" | "resposta_nao_mapeada" | "resposta_incompativel" | "foto_duplicada" | "limite_excedido" }
  | { estado: "preparado"; origem: { envelopeId: string; clienteId: string; osId: string; taskId: string; questionarioId: string; versao: string };
      linhas: LinhaPreparada[]; fotos: { chaveLinha: string; referencia: string }[] };

/** Não autentica origem, não faz I/O e não grava staging nem cadastros. */
export function prepararLevantamentoEstruturado(entrada: unknown, contrato: unknown): Resultado {
  try {
    const texto = JSON.stringify(entrada);
    const mapa = JSON.stringify(contrato);
    if (texto === undefined || mapa === undefined || new TextEncoder().encode(texto).length > 1_048_576 || new TextEncoder().encode(mapa).length > 65_536) {
      return { estado: "pendente", motivo: "limite_excedido" };
    }
  } catch { return { estado: "pendente", motivo: "entrada_invalida" }; }
  const configuracao = contratoSchema.safeParse(contrato);
  if (!configuracao.success) return { estado: "pendente", motivo: "contrato_invalido" };
  const dados = entradaSchema.safeParse(entrada);
  if (!dados.success) return { estado: "pendente", motivo: "entrada_invalida" };
  const c = configuracao.data;
  const e = dados.data;
  if (e.questionarioId !== c.questionarioId || e.versao !== c.versao) return { estado: "pendente", motivo: "contrato_desconhecido" };
  const atributosMapeados = Object.values(c.campos);
  if (!atributosMapeados.length || new Set(atributosMapeados).size !== atributosMapeados.length || Object.keys(c.campos).some((chave) => !chave || chave.length > 200)) {
    return { estado: "pendente", motivo: "mapeamento_ambiguo" };
  }
  const chaves = new Set<string>();
  const fotosVistas = new Set<string>();
  const linhas: LinhaPreparada[] = [];
  const fotos: { chaveLinha: string; referencia: string }[] = [];
  for (const linha of e.linhas) {
    if (chaves.has(linha.chave)) return { estado: "pendente", motivo: "chave_duplicada" };
    chaves.add(linha.chave);
    const atributos: Partial<Record<Atributo, string | number>> = {};
    for (const [id, valor] of Object.entries(linha.respostas)) {
      if (!Object.hasOwn(c.campos, id)) return { estado: "pendente", motivo: "resposta_nao_mapeada" };
      const atributo = c.campos[id]!;
      if (valor === null) continue;
      if (atributo === "quantidade") {
        if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0) return { estado: "pendente", motivo: "resposta_incompativel" };
        atributos.quantidade = valor;
      } else {
        if (typeof valor !== "string" || valor.length > 4000) return { estado: "pendente", motivo: "resposta_incompativel" };
        atributos[atributo] = valor;
      }
    }
    // O staging exige nome não vazio; não inventar ou extrair de prosa quando ausente.
    if (typeof atributos.nome !== "string" || !atributos.nome.trim()) return { estado: "pendente", motivo: "resposta_incompativel" };
    atributos.nome = atributos.nome.trim();
    for (const referencia of linha.fotos) {
      const identidade = JSON.stringify([linha.chave, referencia]);
      if (fotosVistas.has(identidade)) return { estado: "pendente", motivo: "foto_duplicada" };
      // A recepção em staging limita o lote inteiro, não apenas cada linha.
      if (fotos.length >= 10_000) return { estado: "pendente", motivo: "limite_excedido" };
      fotosVistas.add(identidade);
      fotos.push({ chaveLinha: linha.chave, referencia });
    }
    linhas.push({ chave: linha.chave, tipo: linha.tipo, atributos: atributos as LinhaPreparada["atributos"] });
  }
  // jsonb::text inclui espaços após separadores; contabilizá-los para não
  // preparar um lote de referências que a recepção recusará por tamanho.
  const bytesFotos = new TextEncoder().encode(JSON.stringify(fotos)).length + Math.max(0, fotos.length * 4 - 1);
  if (bytesFotos > 262_144 || new TextEncoder().encode(JSON.stringify(linhas)).length > 1_048_576 || linhas.some((linha) => new TextEncoder().encode(JSON.stringify(linha)).length > 32768)) {
    return { estado: "pendente", motivo: "limite_excedido" };
  }
  return { estado: "preparado", origem: { envelopeId: e.envelopeId, clienteId: e.clienteId, osId: e.osId, taskId: e.taskId,
    questionarioId: e.questionarioId, versao: e.versao }, linhas, fotos };
}
