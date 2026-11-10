import { criarEntradaXlsx } from "./entrada.ts";

// Nenhum efeito operacional enquanto configuração e gates de banco permanecerem fechados.
Deno.serve(criarEntradaXlsx((nome) => Deno.env.get(nome)));
