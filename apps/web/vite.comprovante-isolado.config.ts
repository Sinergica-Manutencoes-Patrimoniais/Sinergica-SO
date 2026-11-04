import { mergeConfig } from "vite";
import base from "./vite.config";

// Não carrega arquivos .env do projeto no teste de download sintético.
export default mergeConfig(base, { envDir: false });
