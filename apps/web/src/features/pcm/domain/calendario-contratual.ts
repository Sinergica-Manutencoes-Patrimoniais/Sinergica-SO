export interface VisitaProtegida {
  id: string;
  tipo: "contratual" | "extra";
  semanaOrigem: string | null;
  data: string;
  estado: "confirmada" | "reprogramada" | "excecao_aprovada";
  auvoId: string | null;
}
export interface PreviaVisitasEntrada {
  regra: {
    ancoraSemana: string;
    vigenciaInicio: string;
    vigenciaFim: string | null;
    diaSemana: number;
    intervaloSemanas: number;
  };
  inicio: string;
  fim: string;
  feriados: readonly string[];
  visitasProtegidas: readonly VisitaProtegida[];
}
export interface PreviaVisitas {
  propostas: { semana: string; data: string }[];
  supressoes: { semana: string; data: string; motivo: "feriado" }[];
  visitasPreservadas: VisitaProtegida[];
}
const DIA = 86_400_000;
function dataCivil(valor: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith("0000"))
    throw new Error("Data inválida.");
  const numero = Date.parse(`${valor}T00:00:00.000Z`);
  if (!Number.isFinite(numero) || new Date(numero).toISOString().slice(0, 10) !== valor)
    throw new Error("Data inválida.");
  return numero;
}
function segunda(data: number): boolean {
  return new Date(data).getUTCDay() === 1;
}
function iso(data: number): string {
  return new Date(data).toISOString().slice(0, 10);
}

export interface PreviaCalendarioEntrada {
  dataBase: string;
  intervalo: number;
  unidade: "dias" | "semanas" | "meses" | "anos";
  inicio: string;
  fim: string;
  feriados: readonly string[];
}
export interface VencimentoCalendario {
  ciclo: number;
  vencimento: string;
  feriado: boolean;
}

/** Avaliação informativa em dias civis; não altera âncora ou programação. */
export function avaliarToleranciaCalendario(entrada: {
  vencimento: string;
  data: string;
  diasAntes?: number;
  diasDepois?: number;
}): {
  vencimento: string;
  inicioPermitido: string;
  fimPermitido: string;
  situacao: "antes_da_tolerancia" | "dentro_da_tolerancia" | "apos_a_tolerancia";
} {
  const vencimento = dataCivil(entrada.vencimento);
  const data = dataCivil(entrada.data);
  const antes = entrada.diasAntes ?? 0;
  const depois = entrada.diasDepois ?? 0;
  if (
    ![antes, depois].every((valor) => Number.isInteger(valor) && valor >= 0 && valor <= 2147483647)
  )
    throw new Error("Tolerância inválida.");
  const inicio = vencimento - antes * DIA;
  const fim = vencimento + depois * DIA;
  if (!Number.isFinite(new Date(inicio).getTime()) || !Number.isFinite(new Date(fim).getTime()))
    throw new Error("Tolerância excede datas suportadas.");
  const inicioPermitido = iso(inicio);
  const fimPermitido = iso(fim);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(inicioPermitido) ||
    inicioPermitido.startsWith("0000") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fimPermitido)
  )
    throw new Error("Tolerância excede datas suportadas.");
  return {
    vencimento: entrada.vencimento,
    inicioPermitido,
    fimPermitido,
    situacao:
      data < inicio
        ? "antes_da_tolerancia"
        : data > fim
          ? "apos_a_tolerancia"
          : "dentro_da_tolerancia",
  };
}

export function janelaPadraoCalendario(hoje: string): { inicio: string; fim: string } {
  const fim = iso(dataCivil(hoje) + 30 * DIA);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fim)) throw new Error("Janela excede datas suportadas.");
  return { inicio: hoje, fim };
}

function adicionarMesesDesdeAncora(ancora: number, meses: number): number {
  const origem = new Date(ancora);
  const primeiro = new Date(0);
  primeiro.setUTCHours(0, 0, 0, 0);
  primeiro.setUTCFullYear(origem.getUTCFullYear(), origem.getUTCMonth() + meses, 1);
  if (!Number.isFinite(primeiro.getTime())) return Number.NaN;
  const ultimo = new Date(primeiro);
  ultimo.setUTCMonth(ultimo.getUTCMonth() + 1, 0);
  primeiro.setUTCDate(Math.min(origem.getUTCDate(), ultimo.getUTCDate()));
  return primeiro.getTime();
}

/** Datas sempre derivadas da âncora, sem deslocar ciclos por feriado ou execução. */
export function projetarVencimentosPorCalendario(
  entrada: PreviaCalendarioEntrada,
): VencimentoCalendario[] {
  const ancora = dataCivil(entrada.dataBase);
  const inicio = dataCivil(entrada.inicio);
  const fim = dataCivil(entrada.fim);
  if (
    inicio > fim ||
    !Number.isSafeInteger(entrada.intervalo) ||
    entrada.intervalo < 1 ||
    entrada.intervalo > 2147483647 ||
    !["dias", "semanas", "meses", "anos"].includes(entrada.unidade)
  )
    throw new Error("Recorrência inválida.");
  const feriados = new Set(entrada.feriados.map((data) => iso(dataCivil(data))));
  const porMes = entrada.unidade === "meses" || entrada.unidade === "anos";
  const fator = entrada.unidade === "anos" ? 12 : entrada.unidade === "semanas" ? 7 : 1;
  const passo = entrada.intervalo * fator;
  const origem = new Date(ancora);
  const referencia = new Date(inicio);
  const distancia = porMes
    ? (referencia.getUTCFullYear() - origem.getUTCFullYear()) * 12 +
      referencia.getUTCMonth() -
      origem.getUTCMonth()
    : Math.floor((inicio - ancora) / DIA);
  const primeiro = Math.max(0, Math.floor(distancia / passo));
  const resultado: VencimentoCalendario[] = [];
  for (let ciclo = primeiro; ; ciclo++) {
    const distanciaCiclo = ciclo * passo;
    const vencimento = porMes
      ? adicionarMesesDesdeAncora(ancora, distanciaCiclo)
      : ancora + distanciaCiclo * DIA;
    if (!Number.isFinite(vencimento) || vencimento > fim) break;
    if (vencimento < inicio) continue;
    if (resultado.length >= 10_000)
      throw new Error("Janela extensa demais para prévia; reduza o período.");
    const data = iso(vencimento);
    resultado.push({ ciclo, vencimento: data, feriado: feriados.has(data) });
  }
  return resultado;
}

/** Prévia sem efeitos: feriados só suprimem Visitas contratuais não protegidas. */
export function projetarVisitasContratuais(entrada: PreviaVisitasEntrada): PreviaVisitas {
  const { regra } = entrada;
  const ancora = dataCivil(regra.ancoraSemana);
  const inicio = dataCivil(entrada.inicio);
  const fim = dataCivil(entrada.fim);
  const vigenciaInicio = dataCivil(regra.vigenciaInicio);
  const vigenciaFim = regra.vigenciaFim === null ? null : dataCivil(regra.vigenciaFim);
  if (
    !segunda(ancora) ||
    inicio > fim ||
    (vigenciaFim !== null && vigenciaFim < vigenciaInicio) ||
    !Number.isInteger(regra.diaSemana) ||
    regra.diaSemana < 1 ||
    regra.diaSemana > 7 ||
    !Number.isSafeInteger(regra.intervaloSemanas) ||
    regra.intervaloSemanas < 1 ||
    regra.intervaloSemanas > Math.floor(Number.MAX_SAFE_INTEGER / (7 * DIA))
  ) {
    throw new Error("Regra contratual inválida.");
  }
  const feriados = new Set(entrada.feriados.map((data) => iso(dataCivil(data))));
  const semanasProtegidas = new Set<string>();
  const ids = new Set<string>();
  for (const visita of entrada.visitasProtegidas) {
    if (
      !visita.id.trim() ||
      ids.has(visita.id) ||
      !["confirmada", "reprogramada", "excecao_aprovada"].includes(visita.estado)
    )
      throw new Error("Visita protegida inválida.");
    ids.add(visita.id);
    dataCivil(visita.data);
    if (visita.tipo === "contratual") {
      if (!visita.semanaOrigem || !segunda(dataCivil(visita.semanaOrigem)))
        throw new Error("Semana de origem inválida.");
      semanasProtegidas.add(visita.semanaOrigem);
    } else if (visita.tipo !== "extra" || visita.semanaOrigem !== null)
      throw new Error("Visita protegida inválida.");
  }
  const resultado: PreviaVisitas = {
    propostas: [],
    supressoes: [],
    visitasPreservadas: entrada.visitasProtegidas.map((v) => ({ ...v })),
  };
  const passo = regra.intervaloSemanas * 7 * DIA;
  const primeira = Math.max(0, Math.floor((Math.max(inicio, vigenciaInicio) - ancora) / passo));
  const limite = Math.min(fim, vigenciaFim ?? fim);
  for (let indice = primeira; ; indice++) {
    const semana = ancora + indice * passo;
    const data = semana + (regra.diaSemana - 1) * DIA;
    if (data > limite) break;
    if (data < inicio || data < vigenciaInicio) continue;
    const semanaIso = iso(semana);
    const dataIso = iso(data);
    if (semanasProtegidas.has(semanaIso)) continue;
    if (resultado.propostas.length + resultado.supressoes.length >= 10_000)
      throw new Error("Janela extensa demais para prévia; reduza o período.");
    if (feriados.has(dataIso))
      resultado.supressoes.push({ semana: semanaIso, data: dataIso, motivo: "feriado" });
    else resultado.propostas.push({ semana: semanaIso, data: dataIso });
  }
  return resultado;
}

export interface MudancaDiaEntrada extends Omit<PreviaVisitasEntrada, "regra"> {
  regraAtual: PreviaVisitasEntrada["regra"];
  novoDiaSemana: number;
  vigencia: string;
  hoje: string;
}
type DataProposta = { data: string; situacao: "prevista" | "suprimida" };
export interface ImpactoMudancaDia {
  semana: string;
  classificacao: "inalterada" | "alterada" | "adicionada" | "retirada";
  antes: DataProposta | null;
  depois: DataProposta | null;
}

/** Comparação informativa, não altera Visitas nem calcula impactos operacionais. */
export function preverMudancaDiaContratual(entrada: MudancaDiaEntrada): {
  impactos: ImpactoMudancaDia[];
  visitasPreservadas: VisitaProtegida[];
  efeitosOperacionaisPendentes: true;
} {
  const hoje = dataCivil(entrada.hoje);
  const vigencia = dataCivil(entrada.vigencia);
  const inicio = dataCivil(entrada.inicio);
  const fim = dataCivil(entrada.fim);
  const inicioAtual = dataCivil(entrada.regraAtual.vigenciaInicio);
  const fimAtual = entrada.regraAtual.vigenciaFim
    ? dataCivil(entrada.regraAtual.vigenciaFim)
    : null;
  if (
    inicio > fim ||
    vigencia < hoje ||
    vigencia < inicioAtual ||
    (fimAtual !== null && vigencia > fimAtual) ||
    !Number.isInteger(entrada.novoDiaSemana) ||
    entrada.novoDiaSemana < 1 ||
    entrada.novoDiaSemana > 7
  )
    throw new Error("Vigência da mudança inválida.");
  const base: PreviaVisitasEntrada = {
    regra: entrada.regraAtual,
    inicio: iso(Math.max(inicio, hoje)),
    fim: entrada.fim,
    feriados: entrada.feriados,
    visitasProtegidas: entrada.visitasProtegidas,
  };
  if (hoje > fim) {
    // Validar a regra e referências mesmo quando não há período futuro na janela.
    const verificada = projetarVisitasContratuais({ ...base, inicio: entrada.fim });
    return {
      impactos: [],
      visitasPreservadas: verificada.visitasPreservadas,
      efeitosOperacionaisPendentes: true,
    };
  }
  const atual = projetarVisitasContratuais(base);
  const nova = projetarVisitasContratuais({
    ...base,
    regra: {
      ...entrada.regraAtual,
      diaSemana: entrada.novoDiaSemana,
      vigenciaInicio: entrada.vigencia,
    },
  });
  const mapa = (previa: PreviaVisitas) => {
    const registros = new Map<string, DataProposta>();
    for (const item of previa.propostas)
      registros.set(item.semana, { data: item.data, situacao: "prevista" });
    for (const item of previa.supressoes)
      registros.set(item.semana, { data: item.data, situacao: "suprimida" });
    return registros;
  };
  const antes = mapa(atual);
  const depois = mapa(nova);
  // A semana inicial pode começar antes da janela (ou de hoje). Um ciclo
  // anterior à vigência já consumiu essa semana, inclusive se foi feriado.
  const inicioVisivel = Math.max(inicio, hoje);
  const diaSemana = new Date(inicioVisivel).getUTCDay();
  const inicioSemana = Math.max(
    dataCivil("0001-01-01"),
    inicioVisivel - ((diaSemana + 6) % 7) * DIA,
  );
  if (inicioSemana < inicioVisivel) {
    const anteriorForaDaJanela = projetarVisitasContratuais({
      ...base,
      inicio: iso(inicioSemana),
      fim: iso(inicioVisivel - DIA),
    });
    for (const [semana, item] of mapa(anteriorForaDaJanela)) {
      if (dataCivil(item.data) < vigencia) depois.delete(semana);
    }
  }
  for (const [semana, item] of antes) {
    if (dataCivil(item.data) < vigencia) depois.set(semana, item);
  }
  const semanas = [...new Set([...antes.keys(), ...depois.keys()])].sort();
  const impactos: ImpactoMudancaDia[] = semanas.map((semana) => {
    const anterior = antes.get(semana) ?? null;
    const posterior = depois.get(semana) ?? null;
    const classificacao = !anterior
      ? "adicionada"
      : !posterior
        ? "retirada"
        : anterior.data === posterior.data && anterior.situacao === posterior.situacao
          ? "inalterada"
          : "alterada";
    return { semana, classificacao, antes: anterior, depois: posterior };
  });
  return {
    impactos,
    visitasPreservadas: atual.visitasPreservadas,
    efeitosOperacionaisPendentes: true,
  };
}
