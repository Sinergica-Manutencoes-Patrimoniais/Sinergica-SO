import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cabecalhosFotos } from "./cors.ts";
Deno.test("preflight permite cabeçalhos necessários sem ampliar origins",()=>{
 const base={"Access-Control-Allow-Origin":"https://permitido.example","Access-Control-Allow-Headers":"authorization, apikey"};
 const cabecalhos=cabecalhosFotos(base);
 assertEquals(cabecalhos["Access-Control-Allow-Origin"],base["Access-Control-Allow-Origin"]);
 assertEquals(cabecalhos["Access-Control-Allow-Headers"],"authorization, apikey, x-request-id, x-lote-id, x-linha-chave, x-foto-id");
});
