import { resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";
const envDir=process.env.S166_ENV_DIR, outDir=process.env.S166_BUILD_DIR;
if(!envDir || !outDir || !resolve(envDir).startsWith(resolve(tmpdir())+sep) || !resolve(outDir).startsWith(resolve(tmpdir())+sep)) throw new Error("Diretórios temporários isolados obrigatórios.");
export default mergeConfig(base,defineConfig({envDir,build:{outDir,emptyOutDir:true,rollupOptions:{input:resolve(__dirname,"e2e/s166-isolado/jornada.html")}}}));
