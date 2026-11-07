import { criarEntradaLevantamentoEstruturado } from "../_shared/auvo/entrada-levantamento-estruturado.ts";

// Entrada não registrada, desativada por padrão; não importar fotos nem aprovar cadastros.
Deno.serve(criarEntradaLevantamentoEstruturado((nome) => Deno.env.get(nome)));
