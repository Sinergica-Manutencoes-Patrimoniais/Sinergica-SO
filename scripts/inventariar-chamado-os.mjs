/**
 * Inventário estático auxiliar da transição Chamado 1:N OS.
 * Não consulta banco nem determina quais definições estão implantadas.
 * Saída inclui candidatos para revisão humana, não prova cobertura integral.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const diretorio = new URL("../supabase/migrations/", import.meta.url);
const arquivos = (await readdir(diretorio)).filter((nome) => nome.endsWith(".sql")).sort();
const candidatos = [];
const ignorados = [];
const consumidoresAplicacao = [];

for (const arquivo of arquivos) {
  const texto = await readFile(join(fileURLToPath(diretorio), arquivo), "utf8");
  const cabecalho = /\bcreate\s+(?:or\s+replace\s+)?function\s+((?:"?\w+"?\.)?"?\w+"?)\s*\(/gi;
  for (const ocorrencia of texto.matchAll(cabecalho)) {
    const inicio = ocorrencia.index;
    const restante = texto.slice(inicio);
    // A tag delimitadora é procurada somente após AS para não confundir
    // comentários e valores default antes do corpo.
    const corpoInicio = /\bas\s+(\$[a-z_0-9]*\$)/i.exec(restante);
    const proximaDefinicao = /\bcreate\s+(?:or\s+replace\s+)?function\s+/i.exec(restante.slice(ocorrencia[0].length));
    if (!corpoInicio || (proximaDefinicao && corpoInicio.index > ocorrencia[0].length + proximaDefinicao.index)) {
      ignorados.push({ arquivo, funcao: ocorrencia[1], motivo: "corpo não localizado" });
      continue;
    }
    const inicioCorpo = corpoInicio.index + corpoInicio[0].length;
    const fimCorpo = restante.indexOf(corpoInicio[1], inicioCorpo);
    if (fimCorpo < 0) {
      ignorados.push({ arquivo, funcao: ocorrencia[1], motivo: "delimitador de corpo ausente" });
      continue;
    }
    const definicao = restante.slice(0, fimCorpo + corpoInicio[1].length);
    const temChamado = /\b(chamado_id|chamados|ordem_servico_id)\b/i.test(definicao);
    const temOs = /\b(ordens_servico|operacao_itens|ordem_servico_id)\b/i.test(definicao);
    if (!temChamado || !temOs) continue;
    candidatos.push({
      arquivo,
      funcao: ocorrencia[1],
      linha: texto.slice(0, inicio).split("\n").length,
      escrita: /\b(insert\s+into|update|delete\s+from)\s+(?:pcm\.)?(?:chamados|ordens_servico)\b/i.test(definicao),
      referenciaSingular: /\bordem_servico_id\b/i.test(definicao),
      sqlDinamico: /\bexecute\b/i.test(definicao),
    });
  }
}

// Busca conservadora por caminhos: as palavras podem estar em contextos não
// relacionados ao vínculo Chamado–OS. O resultado não inclui conteúdo.
async function examinarFontes(pasta, prefixo) {
  for (const entrada of await readdir(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    const relativo = `${prefixo}/${entrada.name}`;
    if (entrada.isDirectory()) {
      if (!["node_modules", "dist", "coverage"].includes(entrada.name)) await examinarFontes(caminho, relativo);
      continue;
    }
    if (!entrada.isFile() || !/\.(?:ts|tsx|js|mjs)$/.test(entrada.name) || /\.(?:test|spec)\./.test(entrada.name)) continue;
    const fonte = await readFile(caminho, "utf8");
    const chamado = /chamado(?:_id|Id|s?\b)/i.test(fonte);
    const os = /ordem(?:_servico_id|ServicoId|Servico|s_servico)|\bos_id\b/i.test(fonte);
    if (!chamado || !os) continue;
    consumidoresAplicacao.push({
      arquivo: relativo,
      referenciaSingular: /ordem_servico_id|ordemServicoId/.test(fonte),
      escritaPotencial: /\b(?:insert|update|upsert|delete)\s*\(/.test(fonte),
    });
  }
}

const raiz = fileURLToPath(new URL("../", import.meta.url));
await examinarFontes(join(raiz, "apps/web/src"), "apps/web/src");
await examinarFontes(join(raiz, "supabase/functions"), "supabase/functions");

process.stdout.write(JSON.stringify({
  aviso: "Candidatos estáticos; versões, sobrecargas, views, triggers, SQL dinâmico e consumidores externos exigem conferência na base instalada.",
  arquivosExaminados: arquivos.length,
  candidatos,
  corposNaoIdentificados: ignorados,
  consumidoresAplicacao,
}, null, 2) + "\n");
