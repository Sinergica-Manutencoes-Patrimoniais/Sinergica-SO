import { resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

// O diretório temporário é criado pelo harness; nunca carregar a .env.local do projeto.
const envDir = process.env.S166_ENV_DIR;
if (!envDir || !resolve(envDir).startsWith(resolve(tmpdir()) + sep)) throw new Error("S166_ENV_DIR isolado é obrigatório.");
export default mergeConfig(base, defineConfig({ envDir }));
