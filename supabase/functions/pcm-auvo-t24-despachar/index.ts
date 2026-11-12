// E01-S168 (SSO-003, P0 do Caderno Técnico do Fabrício) — a borda implantável do despacho T−24.
//
// O QUE FALTAVA
// A regra do T−24 existia inteira e testada: `avaliarEnvioT24`, o ledger de tentativas, as RPCs
// de concessão/fence (`sso_t24_reservar_candidata`, `sso_t24_iniciar_efeito`,
// `sso_t24_confirmar_efeito`), a orquestração pura (`orquestracao-t24.ts`), o repositório, o
// fornecedor, o transporte HTTP e a composição. O que NÃO existia era uma Edge Function
// implantável importando essa composição — buscar "t24" em `supabase/functions/*/index.ts`
// (fora de `_shared`) não devolvia nada. A promessa do §11.1 ("uma tarefa por OS,
// automaticamente, em T−24") dependia de alguém apertar um botão na UI.
//
// Este arquivo é só a borda: lê configuração, comprova contrato e delega. Nenhuma regra nova
// mora aqui — se houver divergência de comportamento, ela está nos módulos compartilhados.
//
// TRÊS TRAVAS INDEPENDENTES, TODAS FECHADAS POR PADRÃO
//   1. `SSO_T24_DESPACHAR_ENABLED` — a função responde 503 enquanto não for "true".
//   2. `SSO_T24_CONTRATO_APROVADO_SHA256` — impressão digital do contrato de campos do Auvo.
//      Sem ela conferindo, `contratoComprovado()` devolve false e a orquestração recusa com
//      `contrato_nao_comprovado` ANTES de qualquer efeito remoto. É a trava que atende ao
//      item 16.2-1 do Caderno (endpoints/campos reais do Auvo ainda sem prova de contrato com
//      credencial real): enquanto a prova não acontecer, o despacho não acontece.
//   3. `SSO_T24_BUSCA_APROVADA_SHA256` — impressão digital separada para a cobertura da busca
//      por `externalId`. Resposta vazia do Auvo não prova ausência de tarefa; sem esta prova a
//      busca falha fechada e a OS vai para reconciliação em vez de ganhar uma 2ª tarefa.
// As impressões digitais têm que vir de revisão independente. Habilitar a flag não é a revisão.
//
// O agendamento vive na migration 1844 (`pcm.fn_invoke_t24_despachar` + `pg_cron`), no mesmo
// padrão de `fn_invoke_auvo_pull` (0037): sem os secrets do Vault, o cron é no-op silencioso.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey } from "../_shared/auth.ts";
import { criarComposicaoHttpT24 } from "../_shared/auvo/composicao-http-t24.ts";
import { criarLeitorIdentidadeHttpT24 } from "../_shared/auvo/leitor-identidade-http-t24.ts";
import type { ContratoLeituraT24 } from "../_shared/auvo/fornecedor-t24.ts";

const indisponivel = () =>
  new Response(JSON.stringify({ erro: "indisponivel" }), {
    status: 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// Serialização canônica (chaves ordenadas) — mesma de `pcm-origem-campo-processar`. Duas
// representações diferentes do mesmo contrato têm que dar a mesma impressão digital, senão a
// prova vira sorte de formatação.
function canonico(valor: unknown): string {
  if (valor === null || typeof valor === "string" || typeof valor === "boolean" || typeof valor === "number") {
    if (typeof valor === "number" && !Number.isFinite(valor)) throw new Error("Contrato inválido.");
    return JSON.stringify(valor)!;
  }
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (typeof valor !== "object") throw new Error("Contrato inválido.");
  const objeto = valor as Record<string, unknown>;
  return `{${Object.keys(objeto).sort().map((chave) => `${JSON.stringify(chave)}:${canonico(objeto[chave])}`).join(",")}}`;
}

async function impressaoConfere(valor: unknown, nomeEsperado: string): Promise<boolean> {
  const esperado = Deno.env.get(nomeEsperado) ?? "";
  if (!/^[a-f0-9]{64}$/.test(esperado)) return false;
  const bytes = new TextEncoder().encode(canonico(valor));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const calculado = Array.from(digest, (parte) => parte.toString(16).padStart(2, "0")).join("");
  return calculado === esperado;
}

/**
 * Contrato de campos vindo de `SSO_T24_CONTRATO` (JSON). `comprovado` NUNCA é lido do JSON —
 * é calculado pela impressão digital. Assim ninguém se auto-aprova editando a variável.
 */
function lerContrato(): Record<string, unknown> | null {
  const bruto = Deno.env.get("SSO_T24_CONTRATO");
  if (!bruto || bruto.length > 4096) return null;
  try {
    const valor = JSON.parse(bruto);
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
    if ("comprovado" in valor) return null;
    return valor as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** O Auvo devolve a tarefa ora em `result`, ora em `result.entityList` — mesmo tratamento de `pcm-auvo-tasks-import`. */
const desembrulhar = (resposta: unknown): unknown => {
  const objeto = resposta as { result?: unknown } | null;
  const resultado = objeto && typeof objeto === "object" ? objeto.result : undefined;
  if (Array.isArray(resultado)) return resultado.length === 1 ? resultado[0] : null;
  if (resultado && typeof resultado === "object") {
    const lista = (resultado as { entityList?: unknown }).entityList;
    if (Array.isArray(lista)) return lista.length === 1 ? lista[0] : null;
    return resultado;
  }
  return null;
};

Deno.serve(async (req) => {
  const habilitado = () => Deno.env.get("SSO_T24_DESPACHAR_ENABLED") === "true";
  if (!habilitado()) return indisponivel();
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    if (!url) throw new Error("Configuração indisponível.");
    const banco = createClient(url, getSupabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const executar = criarComposicaoHttpT24({
      habilitado,
      banco: banco as unknown as Parameters<typeof criarComposicaoHttpT24>[0]["banco"],
      agora: () => performance.now(),
      // `comprovado` é derivado da impressão digital, nunca declarado pela configuração.
      contrato: async () => {
        const base = lerContrato();
        if (base === null) throw new Error("Contrato T24 ausente ou malformado.");
        // O formato dos campos é conferido por `validarContrato` em `fornecedor-t24.ts`; aqui só
        // garantimos que `comprovado` vem da impressão digital, não da configuração.
        return {
          ...base,
          comprovado: await impressaoConfere(base, "SSO_T24_CONTRATO_APROVADO_SHA256"),
        } as unknown as ContratoLeituraT24;
      },
      buscarPagina: criarLeitorIdentidadeHttpT24({
        // Prova separada da do contrato: saber ler o campo não é o mesmo que saber que a busca
        // cobre TODAS as tarefas da OS. Sem as duas, a criação não avança.
        verificar: async () => {
          const base = lerContrato();
          return base !== null && await impressaoConfere(base, "SSO_T24_BUSCA_APROVADA_SHA256");
        },
        // `temProxima` por página cheia é heurística do Auvo; é justamente o que a impressão
        // digital de busca precisa ter validado antes de valer como cobertura comprovada.
        interpretar: (resposta, _pagina, limite) => {
          const objeto = resposta as { result?: unknown } | null;
          const resultado = objeto && typeof objeto === "object" ? objeto.result : undefined;
          const itens = Array.isArray(resultado)
            ? resultado
            : Array.isArray((resultado as { entityList?: unknown } | undefined)?.entityList)
              ? ((resultado as { entityList: unknown[] }).entityList)
              : null;
          if (itens === null) throw new Error("Página Auvo inválida.");
          return { itens, temProxima: itens.length === limite };
        },
      }),
      extrairCriacao: desembrulhar,
      extrairLeitura: desembrulhar,
    });
    return await executar(req);
  } catch {
    return indisponivel();
  }
});
