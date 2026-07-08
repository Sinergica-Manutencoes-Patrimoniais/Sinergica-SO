export interface ConfigOperacaoFormData {
  toolUseEnabled: boolean;
  ragEnabled: boolean;
  vendasEnabled: boolean;
  consultaPedidosEnabled: boolean;
  limiteDiarioMensagens: string;
  transferirAposNRespostas: string;
  palavrasTransferencia: string[];
  orcamentoMensalUsd: string;
}

export interface ConfigOperacaoValidado {
  toolUseEnabled: boolean;
  ragEnabled: boolean;
  vendasEnabled: boolean;
  consultaPedidosEnabled: boolean;
  limiteDiarioMensagens: number | null;
  transferirAposNRespostas: number | null;
  palavrasTransferencia: string[];
  orcamentoMensalUsd: number | null;
}

function numeroOuNull(valor: string, campo: string): number | null {
  const texto = valor.trim();
  if (!texto) return null;
  const numero = Number(texto);
  if (!Number.isFinite(numero) || numero < 0)
    throw new Error(`${campo} deve ser um número válido (≥ 0).`);
  return numero;
}

export function validarConfigOperacao(input: ConfigOperacaoFormData): ConfigOperacaoValidado {
  // AC-1: Modo vendas exige Ferramentas ligado — mesma invariante do CHECK em 0054.
  if (input.vendasEnabled && !input.toolUseEnabled) {
    throw new Error("Modo vendas exige Ferramentas (tool use) ligado.");
  }
  return {
    toolUseEnabled: input.toolUseEnabled,
    ragEnabled: input.ragEnabled,
    vendasEnabled: input.vendasEnabled,
    consultaPedidosEnabled: input.consultaPedidosEnabled,
    limiteDiarioMensagens: numeroOuNull(input.limiteDiarioMensagens, "Limite diário"),
    transferirAposNRespostas: numeroOuNull(
      input.transferirAposNRespostas,
      "Transferir após N respostas",
    ),
    palavrasTransferencia: input.palavrasTransferencia.map((p) => p.trim()).filter(Boolean),
    orcamentoMensalUsd: numeroOuNull(input.orcamentoMensalUsd, "Orçamento mensal"),
  };
}

export interface LicaoItem {
  id: string;
  personaId: string;
  contexto: string;
  respostaErrada: string;
  respostaCerta: string;
  ativo: boolean;
}

export interface LicaoFormData {
  contexto: string;
  respostaErrada: string;
  respostaCerta: string;
}

export interface LicaoValidado {
  contexto: string;
  respostaErrada: string;
  respostaCerta: string;
}

export function validarLicao(input: LicaoFormData): LicaoValidado {
  const contexto = input.contexto.trim();
  if (!contexto) throw new Error("Contexto é obrigatório.");
  const respostaErrada = input.respostaErrada.trim();
  if (!respostaErrada) throw new Error("O que estava errado é obrigatório.");
  const respostaCerta = input.respostaCerta.trim();
  if (!respostaCerta) throw new Error("O certo a fazer é obrigatório.");
  return { contexto, respostaErrada, respostaCerta };
}

export interface EspecialistaItem {
  id: string;
  personaId: string;
  nome: string;
  quandoChamar: string;
  ativo: boolean;
}

export interface EspecialistaFormData {
  nome: string;
  quandoChamar: string;
}

export interface EspecialistaValidado {
  nome: string;
  quandoChamar: string;
}

export function validarEspecialista(input: EspecialistaFormData): EspecialistaValidado {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do especialista é obrigatório.");
  const quandoChamar = input.quandoChamar.trim();
  if (!quandoChamar) throw new Error("Quando chamar é obrigatório.");
  return { nome, quandoChamar };
}
