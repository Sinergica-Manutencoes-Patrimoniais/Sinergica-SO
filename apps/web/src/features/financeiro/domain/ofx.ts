// Parser OFX próprio, sem lib (design.md D-1). OFX 1.x é SGML com tags-folha sem fechamento
// (`<TRNTYPE>DEBIT`, sem `</TRNTYPE>`); OFX 2.x é XML bem-formado. Em vez de um parser SGML/XML de
// verdade, extrai por regex de tag: `<TAG>valor` até a próxima `<` ou quebra de linha — funciona
// igual nos dois formatos, porque a tag de fechamento do 2.x (`</TAG>`) também começa com `<` e
// interrompe a captura.
//
// As fixtures em `__fixtures__/` são sintéticas. A validação adicional contra o OFX real
// anonimizado do banco da Sinérgica continua como pendência de insumo registrada na spec; não há
// divergência do contrato implementado, mas esse UAT deve ocorrer antes de declarar o parser
// definitivo para o banco usado em produção.

export interface TransacaoOfx {
  fitid: string;
  data: string; // ISO yyyy-mm-dd (de DTPOSTED)
  valorCentavos: number; // com sinal — negativo = débito, como vem no OFX
  memo: string;
  tipoOfx: string; // TRNTYPE cru (DEBIT/CREDIT/PIX/...)
}

export interface OfxParseResult {
  bankId: string | null;
  acctId: string | null;
  transacoes: TransacaoOfx[];
}

export function parseOfx(texto: string): OfxParseResult {
  if (!texto || !texto.includes("<STMTTRN>")) {
    throw new Error("Arquivo OFX inválido: nenhuma transação (<STMTTRN>) encontrada.");
  }

  const bankId = extrairTag(texto, "BANKID");
  const acctId = extrairTag(texto, "ACCTID");
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/g) ?? [];

  const transacoes: TransacaoOfx[] = [];
  for (const bloco of blocos) {
    const fitid = extrairTag(bloco, "FITID");
    const dtposted = extrairTag(bloco, "DTPOSTED");
    const trnamt = extrairTag(bloco, "TRNAMT");
    if (!fitid || !dtposted || !trnamt) continue; // transação ilegível: pula, não quebra o arquivo

    const memo = extrairTag(bloco, "MEMO") ?? extrairTag(bloco, "NAME") ?? "";
    const tipoOfx = extrairTag(bloco, "TRNTYPE") ?? "";

    transacoes.push({
      fitid,
      data: formatarDataOfx(dtposted),
      valorCentavos: valorOfxParaCentavos(trnamt),
      memo: memo.trim(),
      tipoOfx: tipoOfx.trim(),
    });
  }

  if (transacoes.length === 0) {
    throw new Error(
      "Nenhuma transação legível encontrada — arquivo pode estar truncado ou corrompido.",
    );
  }

  return { bankId, acctId, transacoes };
}

function extrairTag(texto: string, tag: string): string | null {
  const match = texto.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"));
  const valor = match?.[1]?.trim();
  return valor && valor.length > 0 ? valor : null;
}

function formatarDataOfx(dtposted: string): string {
  const ano = dtposted.slice(0, 4);
  const mes = dtposted.slice(4, 6);
  const dia = dtposted.slice(6, 8);
  return `${ano}-${mes}-${dia}`;
}

/** TRNAMT vem como decimal com ponto e sinal explícito ("-150.00"/"1500.00") — nunca float × 100,
 * parse de string igual ao resto do domínio financeiro (dinheiro.ts). */
function valorOfxParaCentavos(trnamt: string): number {
  const normalizado = trnamt.trim();
  const negativo = normalizado.startsWith("-");
  const semSinal = normalizado.replace(/^[-+]/, "");
  const [parteInteira = "0", parteDecimal = "00"] = semSinal.split(".");
  const decimalDoisDigitos = `${parteDecimal}00`.slice(0, 2);
  const centavos = Number(parteInteira) * 100 + Number(decimalDoisDigitos);
  return negativo ? -centavos : centavos;
}
