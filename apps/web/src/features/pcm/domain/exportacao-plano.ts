import { chaveIdentidade } from "./capacidade-por-tecnico";

type RotinaCsv = { id?: string; alvoId?: string; nome: string; alvoTipo: string; alvoNome: string; alvoNatureza?: "equipamento" | "componente" | null; modo: string; intervalo: number | null; unidade: string | null; dataBase: string | null; tempoMinutos: number | null; tipoTempo: string | null; toleranciaAntes: number; toleranciaDepois: number };
export type DadosExportacaoVersao = { clienteId: string; planoNome: string; versaoId: string; versaoNumero: number; vigenciaInicio: string | null; vigenciaFim: string | null; filtro?: string; snapshotHash?: string; rotinas: readonly RotinaCsv[] };
const naturezaExibida = (r: RotinaCsv) => r.alvoTipo !== "componente" ? "não aplicável"
  : r.alvoNatureza === undefined ? "não consultada" : r.alvoNatureza ?? "não declarada";
function celulaCsv(valor: string | number | null | undefined): string {
  let texto = String(valor ?? "");
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(texto) || /^[\t\r\n]/u.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Dados de versão, não cronograma; ausência de tempo não significa zero. */
export function linhasVersaoPlano(dados: DadosExportacaoVersao): (string | number | null)[][] {
  const linhas: (string | number | null)[][] = [["Cliente ID", "Plano", "Versão", "Versão ID", "Vigência início", "Vigência fim", "Filtro", "Capacidade", "Estado da linha", "Rotina", "Tipo de alvo", "Alvo", "Modo", "Intervalo", "Unidade", "Data-base (não é execução)", "Tempo minutos", "Estado do tempo", "Tipo de tempo", "Tolerância antes (dias)", "Tolerância depois (dias)", "Rotina ID", "Alvo ID", "Identificador da fotografia", "Natureza declarada do alvo"]];
  const base = [dados.clienteId, dados.planoNome, dados.versaoNumero, dados.versaoId, dados.vigenciaInicio, dados.vigenciaFim, dados.filtro ?? "todas as Rotinas da versão", "não incluída"];
  if (!dados.rotinas.length) linhas.push([...base, "sem Rotinas", ...Array<string>(12).fill(""), "", "", dados.snapshotHash ?? "não conferida", ""]);
  for (const r of dados.rotinas) linhas.push([...base, "Rotina", r.nome, r.alvoTipo, r.alvoNome, r.modo, r.intervalo, r.unidade, r.dataBase, r.tempoMinutos, r.tempoMinutos && r.tipoTempo ? "informado" : "a validar", r.tipoTempo, r.toleranciaAntes, r.toleranciaDepois, r.id ?? "", r.alvoId ?? "", dados.snapshotHash ?? "não conferida", naturezaExibida(r)]);
  return linhas;
}

/** Texto do PDF usa a mesma fotografia e seleção que a planilha. */
export function textoVersaoPlano(dados: DadosExportacaoVersao): string {
  const linhas = [`Cliente: ${dados.clienteId}`, `Plano: ${dados.planoNome}`, `Versão: ${dados.versaoNumero} (${dados.versaoId})`, `Vigência: ${dados.vigenciaInicio ?? "não informada"} a ${dados.vigenciaFim ?? "sem fim"}`, `Filtro: ${dados.filtro ?? "todas as Rotinas da versão"}`, `Identificador da fotografia: ${dados.snapshotHash ?? "não conferida"}`, "Capacidade: não incluída", "Datas operacionais: não incluídas; data-base não representa execução."];
  if (!dados.rotinas.length) linhas.push("sem Rotinas");
  for (const r of dados.rotinas) linhas.push(`Rotina: ${r.nome} (${r.id ?? "ID não informado"})`, `Alvo: ${r.alvoTipo} - ${r.alvoNome} (${r.alvoId ?? "ID não informado"})`, ...(r.alvoTipo === "componente" ? [`Natureza: ${naturezaExibida(r)}`] : []), `Recorrência: ${r.modo} - ${r.intervalo ?? "não informado"} ${r.unidade ?? ""}`, `Data-base: ${r.dataBase ?? "não informada"}`, `Tempo: ${r.tempoMinutos && r.tipoTempo ? `${r.tempoMinutos} min (${r.tipoTempo})` : "a validar"}`, `Tolerância: ${r.toleranciaAntes} dias antes, ${r.toleranciaDepois} dias depois`);
  return linhas.join("\n");
}

export function csvVersaoPlano(dados: DadosExportacaoVersao): string {
  return "\ufeff" + linhasVersaoPlano(dados).map((linha) => linha.map(celulaCsv).join(";")).join("\r\n") + "\r\n";
}

export async function xlsxVersaoPlano(dados: DadosExportacaoVersao): Promise<Blob> {
  const { default: writeExcelFile } = await import("write-excel-file/universal");
  return writeExcelFile(linhasVersaoPlano(dados), { sheet: "Versão do Plano" }).toBlob();
}

/** Confere vínculos locais; não comprova conteúdo ou autorização do servidor. */
export function contextoExportacaoValido(clienteId: string, plano: { id: string; clienteId: string }, versao: { id: string; planoId: string; estado: string }, rotinas: readonly { id: string; planoId: string; versaoId: string }[]): boolean {
  if (!clienteId || !plano.id || !plano.clienteId || !versao.id || !versao.planoId || versao.estado !== "aprovado") return false;
  if (chaveIdentidade(clienteId) !== chaveIdentidade(plano.clienteId) || chaveIdentidade(plano.id) !== chaveIdentidade(versao.planoId)) return false;
  const ids = new Set<string>();
  for (const rotina of rotinas) {
    if (!rotina.id || !rotina.planoId || !rotina.versaoId || chaveIdentidade(rotina.planoId) !== chaveIdentidade(plano.id) || chaveIdentidade(rotina.versaoId) !== chaveIdentidade(versao.id)) return false;
    const id = chaveIdentidade(rotina.id);
    if (ids.has(id)) return false;
    ids.add(id);
  }
  return true;
}
