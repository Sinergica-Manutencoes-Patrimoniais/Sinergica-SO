import { z } from "zod";
import { projetarVencimentosPorCalendario } from "../domain/calendario-contratual";
import { chaveIdentidade } from "../domain/capacidade-por-tecnico";
import type { SnapshotExportacao } from "./snapshot-exportacao";

export type JanelaCronograma = {
  inicio: string;
  fim: string;
  feriadosInformados: readonly string[];
  declaracoes?: { contratoId: string | null; datas: readonly string[] };
};
type Ocorrencia = {
  clienteId: string;
  planoId: string;
  versaoId: string;
  id: string;
  rotinaId: string;
  alvoId: string;
  vencimentoOriginal: string;
  dataProgramada: string | null;
  tipo?: "calendario" | "visita";
  visitaEstado?: string | null;
  visitaRevisao?: number | null;
};
const uuid = z.string().uuid();
const ocorrenciaSchema = z.object({
  clienteId: uuid,
  planoId: uuid,
  versaoId: uuid,
  id: uuid,
  rotinaId: uuid,
  alvoId: uuid,
  vencimentoOriginal: z.string(),
  dataProgramada: z.string().nullable(),
  tipo: z.enum(["calendario", "visita"]).optional(),
  visitaEstado: z.string().nullable().optional(),
  visitaRevisao: z.number().int().positive().nullable().optional(),
});
type Baseline = {
  rotinaId: string;
  alvoId: string;
  ciclo: number;
  vencimento: string;
  feriadoInformado: boolean;
};
export type CapacidadeCronograma = {
  semana: string;
  registros: number;
  destinados: number;
  reservas: number;
  ausencias: number;
  limiteAtingido: boolean;
  identidadeFonte?: string;
}[];
export type CronogramaFotografia = {
  clienteId: string;
  planoId: string;
  versaoId: string;
  planoNome: string;
  versaoNumero: number;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  snapshotHash: string;
  inicio: string;
  fim: string;
  filtro: string;
  feriadosInformados: readonly string[];
  declaracoes?: { contratoId: string | null; datas: readonly string[] };
  rotinas: SnapshotExportacao["rotinas"];
  baseline: Baseline[];
  programacoes: Ocorrencia[];
  rotinasVisitaSemProjecao: string[];
  rotinasCalendarioSemVencimento: string[];
  completude: "desconhecida";
  execucaoIncluida: false;
  capacidadeDeclarada?: CapacidadeCronograma;
};
function validarData(valor: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
    valor.startsWith("0000") ||
    !Number.isFinite(Date.parse(`${valor}T00:00:00Z`)) ||
    new Date(`${valor}T00:00:00Z`).toISOString().slice(0, 10) !== valor
  )
    throw new Error("Data inválida.");
}

/** Somente composição de fontes declaradas; não demonstra cobertura de feriados ou execução. */
export function comporCronogramaFotografia(
  snapshot: SnapshotExportacao,
  janela: JanelaCronograma,
  ocorrencias: readonly Ocorrencia[],
  filtro = "todas as Rotinas da versão",
): CronogramaFotografia {
  validarData(janela.inicio);
  validarData(janela.fim);
  for (const data of janela.feriadosInformados) validarData(data);
  if (
    janela.declaracoes?.contratoId !== null &&
    janela.declaracoes?.contratoId !== undefined &&
    !uuid.safeParse(janela.declaracoes.contratoId).success
  )
    throw new Error("Contrato declarado inválido.");
  if (janela.declaracoes)
    for (const data of janela.declaracoes.datas) {
      validarData(data);
      if (!janela.feriadosInformados.includes(data))
        throw new Error("Data declarada ausente da projeção.");
    }
  if (janela.inicio > janela.fim || !snapshot.vigenciaInicio)
    throw new Error("Período ou vigência indisponível.");
  validarData(snapshot.vigenciaInicio);
  if (snapshot.vigenciaFim) validarData(snapshot.vigenciaFim);
  if (snapshot.vigenciaFim && snapshot.vigenciaFim < snapshot.vigenciaInicio)
    throw new Error("Vigência inválida.");
  if (snapshot.rotinas.length !== snapshot.total) throw new Error("Fotografia incompleta.");
  const rotinas = new Map<string, SnapshotExportacao["rotinas"][number]>();
  const baseline: {
    rotinaId: string;
    alvoId: string;
    ciclo: number;
    vencimento: string;
    feriadoInformado: boolean;
  }[] = [];
  const rotinasVisitaSemProjecao: string[] = [];
  const rotinasCalendarioSemVencimento: string[] = [];
  // Uma linha é reservada ao cabeçalho do XLSX. Falhar antes de montar artefato truncado.
  const limiteLinhas = 1_048_575;
  const verificarLimite = (programacoes: number) => {
    if (
      baseline.length +
        rotinasVisitaSemProjecao.length +
        rotinasCalendarioSemVencimento.length +
        programacoes >
      limiteLinhas
    )
      throw new Error("Cronograma excede o limite de linhas da planilha.");
  };
  const inicio = janela.inicio > snapshot.vigenciaInicio ? janela.inicio : snapshot.vigenciaInicio;
  const fim =
    snapshot.vigenciaFim && snapshot.vigenciaFim < janela.fim ? snapshot.vigenciaFim : janela.fim;
  for (const rotina of snapshot.rotinas) {
    const chave = chaveIdentidade(rotina.id);
    if (
      rotinas.has(chave) ||
      chaveIdentidade(rotina.planoId) !== chaveIdentidade(snapshot.planoId) ||
      chaveIdentidade(rotina.versaoId) !== chaveIdentidade(snapshot.versaoId)
    )
      throw new Error("Rotina inconsistente.");
    rotinas.set(chave, rotina);
    if (rotina.modo === "visita") {
      rotinasVisitaSemProjecao.push(rotina.id);
      verificarLimite(0);
      continue;
    }
    if (!rotina.dataBase || !rotina.intervalo || !rotina.unidade)
      throw new Error("Recorrência incompleta.");
    if (inicio > fim) {
      rotinasCalendarioSemVencimento.push(rotina.id);
      verificarLimite(0);
      continue;
    }
    const quantidadeAnterior = baseline.length;
    for (const item of projetarVencimentosPorCalendario({
      dataBase: rotina.dataBase,
      intervalo: rotina.intervalo,
      unidade: rotina.unidade,
      inicio,
      fim,
      feriados: janela.feriadosInformados,
    })) {
      baseline.push({
        rotinaId: rotina.id,
        alvoId: rotina.alvoId,
        ciclo: item.ciclo,
        vencimento: item.vencimento,
        feriadoInformado: item.feriado,
      });
      verificarLimite(0);
    }
    if (baseline.length === quantidadeAnterior) {
      rotinasCalendarioSemVencimento.push(rotina.id);
      verificarLimite(0);
    }
  }
  const vistos = new Set<string>();
  const programacoes: Ocorrencia[] = [];
  for (const entrada of ocorrencias) {
    const item = ocorrenciaSchema.parse(entrada);
    validarData(item.vencimentoOriginal);
    if (item.dataProgramada) validarData(item.dataProgramada);
    const rotina = rotinas.get(chaveIdentidade(item.rotinaId));
    const id = chaveIdentidade(item.id);
    if (
      vistos.has(id) ||
      !rotina ||
      chaveIdentidade(item.clienteId) !== chaveIdentidade(snapshot.clienteId) ||
      chaveIdentidade(item.planoId) !== chaveIdentidade(snapshot.planoId) ||
      chaveIdentidade(item.versaoId) !== chaveIdentidade(snapshot.versaoId) ||
      chaveIdentidade(item.alvoId) !== chaveIdentidade(rotina.alvoId) ||
      (item.tipo !== undefined && item.tipo !== rotina.modo)
    )
      throw new Error("Ocorrência inconsistente.");
    vistos.add(id);
    if (
      (item.vencimentoOriginal >= janela.inicio && item.vencimentoOriginal <= janela.fim) ||
      (item.dataProgramada !== null &&
        item.dataProgramada >= janela.inicio &&
        item.dataProgramada <= janela.fim)
    ) {
      programacoes.push({ ...item });
      verificarLimite(programacoes.length);
    }
  }
  baseline.sort(
    (a, b) =>
      a.vencimento.localeCompare(b.vencimento) ||
      a.rotinaId.localeCompare(b.rotinaId) ||
      a.ciclo - b.ciclo,
  );
  // A paginação da fonte é por identidade, não por data operacional. Ordenar
  // as programações pela data exibida mantém PDF e XLSX na mesma sequência.
  programacoes.sort(
    (a, b) =>
      (a.dataProgramada ?? a.vencimentoOriginal).localeCompare(
        b.dataProgramada ?? b.vencimentoOriginal,
      ) ||
      a.vencimentoOriginal.localeCompare(b.vencimentoOriginal) ||
      chaveIdentidade(a.rotinaId).localeCompare(chaveIdentidade(b.rotinaId)) ||
      chaveIdentidade(a.id).localeCompare(chaveIdentidade(b.id)),
  );
  return {
    clienteId: snapshot.clienteId,
    planoId: snapshot.planoId,
    versaoId: snapshot.versaoId,
    planoNome: snapshot.planoNome,
    versaoNumero: snapshot.versaoNumero,
    vigenciaInicio: snapshot.vigenciaInicio,
    vigenciaFim: snapshot.vigenciaFim,
    snapshotHash: snapshot.snapshotHash,
    inicio: janela.inicio,
    fim: janela.fim,
    filtro,
    feriadosInformados: [...janela.feriadosInformados],
    ...(janela.declaracoes
      ? {
          declaracoes: {
            contratoId: janela.declaracoes.contratoId,
            datas: [...janela.declaracoes.datas],
          },
        }
      : {}),
    rotinas: snapshot.rotinas.map((r) => ({ ...r })),
    baseline,
    programacoes,
    rotinasVisitaSemProjecao,
    rotinasCalendarioSemVencimento,
    completude: "desconhecida",
    execucaoIncluida: false,
  };
}

/** Linhas usam datas como texto civil e explicitam o limite das fontes. */
export function linhasCronogramaFotografia(
  cronograma: CronogramaFotografia,
): (string | number | null)[][] {
  const linhas: (string | number | null)[][] = [
    [
      "Tipo",
      "Cliente ID",
      "Plano",
      "Plano ID",
      "Versão",
      "Versão ID",
      "Fotografia",
      "Período início",
      "Período fim",
      "Filtro",
      "Cobertura",
      "Execução",
      "Feriados",
      "Origem dos feriados",
      "Rotina ID",
      "Alvo ID",
      "Ciclo",
      "Vencimento original",
      "Data programada informada",
      "Feriado informado",
      "Ocorrência ID",
      "Estado da Visita",
      "Revisão da Visita",
      "Rotina",
      "Tipo de alvo",
      "Alvo",
      "Modo",
      "Intervalo",
      "Unidade",
      "Tempo previsto (minutos)",
      "Base do tempo",
      "Capacidade",
      "Tolerância antes (dias)",
      "Tolerância depois (dias)",
      "Início da vigência",
      "Fim da vigência",
      "Natureza declarada do alvo",
    ],
  ];
  const origem = cronograma.declaracoes
    ? `Declarações não oficiais: ${cronograma.declaracoes.datas.join(", ") || "nenhuma ativa"}; escopo ${cronograma.declaracoes.contratoId ? `geral e contrato ${cronograma.declaracoes.contratoId}` : "geral do Cliente"}; demais datas informadas manualmente; vínculo com Plano não comprovado`
    : "Datas manuais; declarações não consultadas";
  const base = [
    cronograma.clienteId,
    cronograma.planoNome,
    cronograma.planoId,
    cronograma.versaoNumero,
    cronograma.versaoId,
    cronograma.snapshotHash,
    cronograma.inicio,
    cronograma.fim,
    cronograma.filtro,
    "cobertura desconhecida",
    "execução não incluída",
    `feriados informados: ${cronograma.feriadosInformados.join(", ") || "nenhum"}`,
    origem,
  ];
  const rotinas = new Map(cronograma.rotinas.map((r) => [chaveIdentidade(r.id), r]));
  const capacidade = cronograma.capacidadeDeclarada
    ? "parcial, discriminada por semana"
    : "não incluída";
  const detalhes = (id: string | null): (string | number | null)[] => {
    const r = id ? rotinas.get(chaveIdentidade(id)) : undefined;
    const natureza = !r
      ? null
      : r.alvoTipo !== "componente"
        ? "não aplicável"
        : r.alvoNatureza === undefined
          ? "não consultada"
          : (r.alvoNatureza ?? "não declarada");
    return r
      ? [
          r.nome,
          r.alvoTipo,
          r.alvoNome,
          r.modo,
          r.intervalo,
          r.unidade,
          r.tempoMinutos,
          r.tempoMinutos === null || r.tempoMinutos === 0
            ? "tempo a validar"
            : (r.tipoTempo ?? "base a validar"),
          capacidade,
          r.toleranciaAntes,
          r.toleranciaDepois,
          cronograma.vigenciaInicio,
          cronograma.vigenciaFim,
          natureza,
        ]
      : [
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          capacidade,
          null,
          null,
          cronograma.vigenciaInicio,
          cronograma.vigenciaFim,
          natureza,
        ];
  };
  // Exibe a obrigação e a programação na mesma linha do tempo, mas mantém
  // os dois registros distintos: uma programação não comprova execução.
  const eventos: {
    data: string;
    ordem: number;
    chave: string;
    linha: (string | number | null)[];
  }[] = [];
  for (const b of cronograma.baseline)
    eventos.push({
      data: b.vencimento,
      ordem: 0,
      chave: `${chaveIdentidade(b.rotinaId)}:${b.ciclo}`,
      linha: [
        "baseline calendário",
        ...base,
        b.rotinaId,
        b.alvoId,
        b.ciclo,
        b.vencimento,
        null,
        b.feriadoInformado ? "sim, informado" : "não informado",
        null,
        null,
        null,
        ...detalhes(b.rotinaId),
      ],
    });
  for (const p of cronograma.programacoes)
    eventos.push({
      data: p.dataProgramada ?? p.vencimentoOriginal,
      ordem: 1,
      chave: chaveIdentidade(p.id),
      linha: [
        "programação informada",
        ...base,
        p.rotinaId,
        p.alvoId,
        null,
        p.vencimentoOriginal,
        p.dataProgramada,
        "não verificado",
        p.id,
        p.visitaEstado ?? null,
        p.visitaRevisao ?? null,
        ...detalhes(p.rotinaId),
      ],
    });
  eventos.sort(
    (a, b) => a.data.localeCompare(b.data) || a.ordem - b.ordem || a.chave.localeCompare(b.chave),
  );
  for (const evento of eventos) linhas.push(evento.linha);
  for (const id of cronograma.rotinasVisitaSemProjecao)
    linhas.push([
      "rotina por Visita sem projeção",
      ...base,
      id,
      rotinas.get(chaveIdentidade(id))?.alvoId ?? null,
      null,
      null,
      null,
      "não verificado",
      null,
      null,
      null,
      ...detalhes(id),
    ]);
  for (const id of cronograma.rotinasCalendarioSemVencimento)
    linhas.push([
      "rotina sem vencimento na janela",
      ...base,
      id,
      rotinas.get(chaveIdentidade(id))?.alvoId ?? null,
      null,
      null,
      null,
      "não verificado",
      null,
      null,
      null,
      ...detalhes(id),
    ]);
  if (linhas.length === 1)
    linhas.push([
      "sem dados no período",
      ...base,
      null,
      null,
      null,
      null,
      null,
      "não verificado",
      null,
      null,
      null,
      ...detalhes(null),
    ]);
  const cabecalho = linhas[0];
  if (!cabecalho) throw new Error("Cabeçalho indisponível.");
  for (const semana of cronograma.capacidadeDeclarada ?? []) {
    if (linhas.length >= 1_048_576)
      throw new Error("Cronograma excede o limite de linhas da planilha.");
    const linha: (string | number | null)[] = Array(cabecalho.length).fill(null);
    linha[0] = "capacidade declarada parcial";
    base.forEach((valor, indice) => {
      linha[indice + 1] = valor;
    });
    linha[cabecalho.indexOf("Capacidade")] =
      `Semana ${semana.semana}: ${semana.registros} registro(s); destinados ${semana.destinados} min, reservas ${semana.reservas} min, ausências ${semana.ausencias} min; ${semana.limiteAtingido ? "limite atingido" : "limite não atingido"}; cobertura desconhecida, sem cálculo de saldo ou deduplicação de intervalos`;
    linhas.push(linha);
  }
  return linhas;
}

export function textoCronogramaFotografia(cronograma: CronogramaFotografia): string {
  const [cabecalho, ...linhas] = linhasCronogramaFotografia(cronograma);
  if (!cabecalho) throw new Error("Cabeçalho indisponível.");
  return linhas
    .map((linha) =>
      linha.map((valor, indice) => `${cabecalho[indice]}: ${valor ?? "não informado"}`).join("\n"),
    )
    .join("\n\n");
}
