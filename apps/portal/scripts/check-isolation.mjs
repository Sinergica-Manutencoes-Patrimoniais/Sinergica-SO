import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const proibidos = ["HomePage", "features/pcm/pages", "features/financeiro/pages", "features/atendimento", "features/config/pages"];
const dist = resolve(import.meta.dirname, "../dist");

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const path = join(dir, nome);
    return statSync(path).isDirectory() ? arquivos(path) : [path];
  });
}

const conteudo = arquivos(dist).filter((path) => /\.(js|css|html)$/.test(path)).map((path) => readFileSync(path, "utf8")).join("\n");
for (const termo of proibidos) {
  if (conteudo.includes(termo)) throw new Error(`Bundle do portal contém módulo interno proibido: ${termo}`);
}
console.log("✓ Bundle do portal isolado de módulos internos.");
