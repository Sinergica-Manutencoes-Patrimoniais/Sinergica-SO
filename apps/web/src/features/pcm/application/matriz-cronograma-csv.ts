/** CSV UTF-8 separado por ponto e vírgula. Não interpreta tipos, fórmulas ou cabeçalhos. */
export function lerMatrizCronogramaCsv(entrada: string): string[][] {
  const bytes = new TextEncoder();
  if (bytes.encode(entrada).length > 1_048_576) throw new Error("CSV excede 1 MiB.");
  if (entrada.includes("\0")) throw new Error("CSV contém caractere NUL não suportado.");
  const texto = entrada.replace(/^\uFEFF/, "");
  const matriz: string[][] = [];
  let linha: string[] = [], campo = "", citado = false, fechado = false;
  const adicionarCampo = () => {
    if (bytes.encode(JSON.stringify(campo)).length > 4000) throw new Error("Célula excede o limite.");
    linha.push(campo);
    if (linha.length > 500) throw new Error("Linha excede 500 colunas.");
    campo = ""; fechado = false;
  };
  const adicionarLinha = () => {
    adicionarCampo(); matriz.push(linha); linha = [];
    if (matriz.length > 10000) throw new Error("CSV excede 10.000 linhas.");
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (citado) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else { citado = false; fechado = true; } }
      else campo += c;
      continue;
    }
    if (fechado && c !== ";" && c !== "\r" && c !== "\n") throw new Error("Texto após aspas de fechamento.");
    if (c === '"') { if (campo || fechado) throw new Error("Aspas em posição inválida."); citado = true; }
    else if (c === ";") adicionarCampo();
    else if (c === "\r" || c === "\n") { if (c === "\r" && texto[i + 1] === "\n") i++; adicionarLinha(); }
    else campo += c;
  }
  if (citado) throw new Error("Campo entre aspas não foi fechado.");
  if (campo || linha.length || fechado) adicionarLinha();
  if (!matriz.length || bytes.encode(JSON.stringify(matriz)).length > 1_048_576) throw new Error("Matriz vazia ou maior que 1 MiB.");
  return matriz;
}
