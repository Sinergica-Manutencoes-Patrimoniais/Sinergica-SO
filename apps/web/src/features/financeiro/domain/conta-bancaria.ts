export interface ContaBancariaItem {
  id: string;
  nome: string;
  banco: string | null;
  saldoInicialCentavos: number;
  saldoInicialEm: string;
  ativo: boolean;
  /** Sempre derivado (saldo inicial + Σ realizados) — nunca coluna gravada (AC-6). Populado pelo
   * adapter via RPC `financeiro.fn_saldo_contas`; ausente enquanto não carregado. */
  saldoAtualCentavos: number | null;
}

export interface ContaBancariaFormData {
  nome: string;
  banco?: string | null;
  saldoInicialCentavos: number;
  saldoInicialEm: string;
}

export function validarContaBancaria(input: ContaBancariaFormData): ContaBancariaFormData {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório.");
  if (!Number.isInteger(input.saldoInicialCentavos)) {
    throw new Error("Saldo inicial inválido.");
  }
  if (!input.saldoInicialEm) throw new Error("Data de corte do saldo inicial é obrigatória.");
  return {
    nome,
    banco: textoOuNull(input.banco),
    saldoInicialCentavos: input.saldoInicialCentavos,
    saldoInicialEm: input.saldoInicialEm,
  };
}

function textoOuNull(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}
