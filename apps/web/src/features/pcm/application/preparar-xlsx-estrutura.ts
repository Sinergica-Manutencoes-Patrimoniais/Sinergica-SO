import { extrairXlsxEmWorker } from "../infrastructure/extrair-xlsx-worker";
import { analisarEstruturaOoxml } from "./importacao-estrutura-ooxml";
import { lerPartesOoxml } from "./ler-partes-ooxml";
import { interpretarLivroOoxml } from "./metadados-ooxml";

/** Preparação experimental; não conectar à recepção ou a arquivos de usuário antes dos gates. */
export async function prepararArquivoEstrutura(bytes: Uint8Array, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!bytes.length || bytes.byteLength > 5_242_880) throw new Error("Arquivo comprimido inválido.");
  const copia = new Uint8Array(bytes);
  const hash = await crypto.subtle.digest("SHA-256", copia);
  signal.throwIfAborted();
  const sha256 = Array.from(new Uint8Array(hash), (valor) => valor.toString(16).padStart(2, "0")).join("");
  const partes = await extrairXlsxEmWorker(copia, signal);
  signal.throwIfAborted();
  const decodificador = new TextDecoder("utf-8", { fatal: true });
  const obter = (nome: string) => {
    const conteudo = partes.get(nome);
    if (!conteudo || conteudo.byteLength > 4_194_304) throw new Error("Metadados da planilha ausentes ou extensos.");
    return decodificador.decode(conteudo);
  };
  const livro = interpretarLivroOoxml(obter("xl/workbook.xml"), obter("xl/_rels/workbook.xml.rels"));
  const abas = livro.abas.filter((aba) => aba.estado === "visible").map((aba) => aba.nome);
  if (!abas.length) throw new Error("Nenhuma aba visível disponível.");
  return {
    sha256,
    abas: [...abas],
    conferir(nomeAba: string) {
      signal.throwIfAborted();
      if (!abas.includes(nomeAba)) throw new Error("Selecione uma aba visível do arquivo.");
      const leitura = lerPartesOoxml(partes, nomeAba);
      const diagnosticos = analisarEstruturaOoxml(leitura.celulas);
      signal.throwIfAborted();
      return { sha256, aba: nomeAba, diagnosticos };
    },
  };
}
