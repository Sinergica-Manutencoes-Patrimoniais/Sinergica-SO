import { caminhoLegado } from "./seletor-legado.ts";
const despesa="18090000-0000-4000-8000-000000000002",cliente="18090000-0000-4000-8000-000000000001",request="18090000-0000-4000-8000-000000000003",caminho=`${cliente}/${despesa}/${request}`;
const assert=(v:boolean)=>{if(!v)throw Error("Asserção falhou");};
Deno.test("permite apenas classificação legada com caminho coerente",()=>{assert(caminhoLegado({origem:"legado",digest:null,caminho},despesa)===caminho);assert(caminhoLegado({origem:"mediado",digest:"a".repeat(64),caminho},despesa)===null);assert(caminhoLegado({origem:"legado",digest:null,caminho},cliente)===null);assert(caminhoLegado({origem:"legado",digest:"a".repeat(64),caminho},despesa)===null);});
