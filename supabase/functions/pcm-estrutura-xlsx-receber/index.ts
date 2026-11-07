import { criarEntradaEstruturaXlsx } from "../_shared/estrutura-xlsx/entrada.ts";

// Entrada local não registrada; gate de ambiente e gates de banco permanecem fechados.
Deno.serve(criarEntradaEstruturaXlsx((nome) => Deno.env.get(nome)));
