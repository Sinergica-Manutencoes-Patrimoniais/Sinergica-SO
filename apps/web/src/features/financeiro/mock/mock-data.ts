// Dados fictícios do protótipo navegável do Financeiro (specs/E04-S01-fundacao-financeiro/).
// Sem leitura de banco — só pra visualização/ideia antes da implementação real (E04-S01..S06).

export function brl(valor: number): string {
  const negativo = valor < 0;
  const texto = Math.abs(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (negativo ? "−R$ " : "R$ ") + texto;
}

export function dataCurta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export const CLIENTES = [
  "H2 Sports Bar & Poker",
  "I Home",
  "Portal Encantos de Parma",
  "Cond. Jardins do Lago",
  "Ed. Villa Bella",
  "Res. Bosque Verde",
];

export interface LancamentoMock {
  data: string;
  desc: string;
  cat: string;
  cliente: string;
  conta: string;
  tipo: "entrada" | "saida";
  status: "previsto" | "realizado";
  valor: number;
}

export const LANCAMENTOS: LancamentoMock[] = [
  {
    data: "2026-07-13",
    desc: "Contrato mensal — Ed. Villa Bella",
    cat: "Receita de contrato",
    cliente: "Ed. Villa Bella",
    conta: "Itaú PJ",
    tipo: "entrada",
    status: "realizado",
    valor: 4200,
  },
  {
    data: "2026-07-12",
    desc: "Combustível — frota",
    cat: "Combustível",
    cliente: "—",
    conta: "Itaú PJ",
    tipo: "saida",
    status: "realizado",
    valor: 680,
  },
  {
    data: "2026-07-12",
    desc: "Laudo SPDA avulso",
    cat: "Laudos e inspeções",
    cliente: "I Home",
    conta: "Itaú PJ",
    tipo: "entrada",
    status: "realizado",
    valor: 1350,
  },
  {
    data: "2026-07-11",
    desc: "Peças — compressor",
    cat: "Peças e materiais",
    cliente: "—",
    conta: "Itaú PJ",
    tipo: "saida",
    status: "realizado",
    valor: 2120,
  },
  {
    data: "2026-07-10",
    desc: "Contrato mensal — Portal Encantos de Parma",
    cat: "Receita de contrato",
    cliente: "Portal Encantos de Parma",
    conta: "Nubank PJ",
    tipo: "entrada",
    status: "realizado",
    valor: 3800,
  },
  {
    data: "2026-07-08",
    desc: "Salários — equipe técnica",
    cat: "Salários",
    cliente: "—",
    conta: "Itaú PJ",
    tipo: "saida",
    status: "realizado",
    valor: 18400,
  },
  {
    data: "2026-07-05",
    desc: "Aluguel escritório",
    cat: "Aluguel",
    cliente: "—",
    conta: "Itaú PJ",
    tipo: "saida",
    status: "realizado",
    valor: 3200,
  },
  {
    data: "2026-07-20",
    desc: "Contrato mensal — H2 Sports Bar & Poker",
    cat: "Receita de contrato",
    cliente: "H2 Sports Bar & Poker",
    conta: "Itaú PJ",
    tipo: "entrada",
    status: "previsto",
    valor: 5100,
  },
  {
    data: "2026-07-22",
    desc: "Manutenção veículo",
    cat: "Manutenção veículos",
    cliente: "—",
    conta: "Itaú PJ",
    tipo: "saida",
    status: "previsto",
    valor: 950,
  },
  {
    data: "2026-07-25",
    desc: "Encargos — folha",
    cat: "Encargos",
    cliente: "—",
    conta: "Itaú PJ",
    tipo: "saida",
    status: "previsto",
    valor: 6100,
  },
];

export const FLUXO_MESES = [
  { m: "Fev", entrada: 32000, saida: 27500 },
  { m: "Mar", entrada: 35400, saida: 29100 },
  { m: "Abr", entrada: 31200, saida: 30800 },
  { m: "Mai", entrada: 38900, saida: 28700 },
  { m: "Jun", entrada: 40100, saida: 32400 },
  { m: "Jul", entrada: 42300, saida: 31180 },
];

export const GASTO_CATEGORIAS = [
  { nome: "Pessoal", valor: 24500, cor: "#2a78d6" },
  { nome: "Operação", valor: 4870, cor: "#1baf7a" },
  { nome: "Veículos", valor: 950, cor: "#b07600" },
  { nome: "Administrativo", valor: 3200, cor: "#3f9423" },
  { nome: "Impostos", valor: 2180, cor: "#4a3aa7" },
  { nome: "Tarifas bancárias", valor: 210, cor: "#c85e88" },
];

export const CONTAS = [
  { nome: "Itaú PJ", banco: "Itaú", saldo: 96300 },
  { nome: "Nubank PJ", banco: "Nubank", saldo: 28900 },
  { nome: "Caixa (dinheiro)", banco: "—", saldo: 3250 },
];

export const OFX_ROWS = [
  {
    data: "2026-07-13",
    memo: "TED RECEBIDA ED VILLA BELLA",
    valor: 4200,
    sugestao: "Receita de contrato · Ed. Villa Bella",
  },
  { data: "2026-07-12", memo: "POSTO IPIRANGA COMBUSTIVEL", valor: -680, sugestao: "Combustível" },
  {
    data: "2026-07-12",
    memo: "PIX RECEBIDO I HOME EMPREEND",
    valor: 1350,
    sugestao: "Laudos e inspeções · I Home",
  },
  {
    data: "2026-07-09",
    memo: "TARIFA MANUTENCAO CONTA PJ",
    valor: -42,
    sugestao: "Tarifas bancárias",
  },
  {
    data: "2026-07-07",
    memo: "PIX ENVIADO FORNECEDOR PECAS LTDA",
    valor: -2120,
    sugestao: "Peças e materiais",
  },
];

export type FaixaAging = "a-vencer" | "d3" | "d7" | "d15";

export const RECEBIVEIS: Array<{
  cliente: string;
  origem: string;
  venc: string;
  valor: number;
  faixa: FaixaAging;
}> = [
  {
    cliente: "H2 Sports Bar & Poker",
    origem: "Contrato",
    venc: "2026-07-20",
    valor: 5100,
    faixa: "a-vencer",
  },
  {
    cliente: "Cond. Jardins do Lago",
    origem: "Contrato",
    venc: "2026-07-10",
    valor: 2900,
    faixa: "d3",
  },
  {
    cliente: "Res. Bosque Verde",
    origem: "Avulso — laudo",
    venc: "2026-07-05",
    valor: 1350,
    faixa: "d7",
  },
  {
    cliente: "Portal Encantos de Parma",
    origem: "Contrato",
    venc: "2026-06-26",
    valor: 3800,
    faixa: "d15",
  },
];

export const CONTRATOS = [
  {
    cliente: "H2 Sports Bar & Poker",
    valor: 5100,
    dia: 20,
    inicio: "2025-03-01",
    status: "ativo" as const,
  },
  { cliente: "I Home", valor: 3650, dia: 15, inicio: "2024-11-01", status: "ativo" as const },
  {
    cliente: "Portal Encantos de Parma",
    valor: 3800,
    dia: 10,
    inicio: "2025-01-15",
    status: "ativo" as const,
  },
  {
    cliente: "Cond. Jardins do Lago",
    valor: 2900,
    dia: 10,
    inicio: "2025-06-01",
    status: "ativo" as const,
  },
  {
    cliente: "Ed. Villa Bella",
    valor: 4200,
    dia: 13,
    inicio: "2023-09-01",
    status: "ativo" as const,
  },
  {
    cliente: "Res. Bosque Verde",
    valor: 1980,
    dia: 5,
    inicio: "2025-05-20",
    status: "suspenso" as const,
  },
];

export const PAGAR: Array<{
  forn: string;
  desc: string;
  venc: string;
  valor: number;
  faixa: FaixaAging;
}> = [
  {
    forn: "Peças & Cia Ltda",
    desc: "Peças — compressor",
    venc: "2026-07-18",
    valor: 2120,
    faixa: "a-vencer",
  },
  {
    forn: "Locadora de Veículos SP",
    desc: "Aluguel de van",
    venc: "2026-07-09",
    valor: 1400,
    faixa: "d7",
  },
  {
    forn: "Contabilidade Souza",
    desc: "Honorários contábeis",
    venc: "2026-07-05",
    valor: 890,
    faixa: "d15",
  },
  {
    forn: "—",
    desc: "Salários — equipe técnica",
    venc: "2026-07-25",
    valor: 18400,
    faixa: "a-vencer",
  },
];

export interface OsRentabilidade {
  id: string;
  desc: string;
  horas: number;
  rate: number;
  despesa: number;
}

export const RENTABILIDADE: Array<{
  cliente: string;
  receita: number;
  custo: number;
  alerta?: boolean;
  os: OsRentabilidade[];
}> = [
  {
    cliente: "Ed. Villa Bella",
    receita: 4200,
    custo: 2380,
    os: [
      { id: "CH-2301", desc: "Preventiva mensal", horas: 6.5, rate: 42, despesa: 80 },
      { id: "CH-2318", desc: "Corretiva — bomba", horas: 3.0, rate: 42, despesa: 220 },
    ],
  },
  {
    cliente: "I Home",
    receita: 3650,
    custo: 4120,
    alerta: true,
    os: [
      { id: "CH-2244", desc: "Corretiva — quadro elétrico", horas: 9.0, rate: 42, despesa: 610 },
      { id: "CH-2295", desc: "Corretiva — iluminação", horas: 5.5, rate: 42, despesa: 340 },
    ],
  },
  {
    cliente: "Portal Encantos de Parma",
    receita: 3800,
    custo: 1650,
    os: [{ id: "CH-2280", desc: "Preventiva mensal", horas: 5.0, rate: 42, despesa: 60 }],
  },
  {
    cliente: "H2 Sports Bar & Poker",
    receita: 5100,
    custo: 2960,
    os: [
      { id: "CH-2321", desc: "Preventiva mensal", horas: 7.0, rate: 42, despesa: 190 },
      { id: "CH-2333", desc: "Vistoria técnica", horas: 2.0, rate: 42, despesa: 40 },
    ],
  },
  {
    cliente: "Cond. Jardins do Lago",
    receita: 2900,
    custo: 3050,
    alerta: true,
    os: [{ id: "CH-2270", desc: "Corretiva — vazamento", horas: 8.0, rate: 42, despesa: 480 }],
  },
];

export const FUNCIONARIOS = [
  { nome: "Weslei Costa", custo: 4850, horas: 220, desde: "2026-01-01" },
  { nome: "Dhiego Silva", custo: 4600, horas: 220, desde: "2026-01-01" },
  { nome: "Davi Guedes", custo: 3900, horas: 220, desde: "2026-03-01" },
  { nome: "Fabrício Medeiros", custo: 9200, horas: 200, desde: "2025-01-01" },
];
