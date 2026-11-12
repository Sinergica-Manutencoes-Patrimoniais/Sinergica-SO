// E01-S168 (SSO-003) — a borda do despacho T−24 falha FECHADA.
//
// A Edge Function `pcm-auvo-t24-despachar` ligou um caminho que antes não existia. Ligar um
// caminho é exatamente onde se cria risco novo, então o que estes testes travam não é o caminho
// feliz: é que, enquanto o contrato do Auvo não estiver comprovado (item 16.2-1 do Caderno,
// pendente), nenhuma chamada remota sai — nem criar, nem atualizar, nem buscar.
//
// A prova tem valor porque o transporte usado aqui EXPLODE se for tocado: qualquer rede
// significa teste vermelho.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { criarComposicaoHttpT24 } from "./composicao-http-t24.ts";

const CHAVE = "chave-de-servico-para-teste";
const corpo = { limite: 1, prazoMs: 5000, paginas: 1, itensPorPagina: 10 };

// Uma concessão válida: tudo que o repositório exige, para que a recusa venha do contrato
// e não de um payload malformado.
const CONCESSAO = {
  tentativaId: "11111111-1111-4111-8111-111111111111",
  osId: "22222222-2222-4222-8222-222222222222",
  visitaId: "33333333-3333-4333-8333-333333333333",
  fence: 1,
  revisao: 1,
  operacao: "criar",
  tarefaId: null,
  autorizaEnvio: false,
  questionarioObrigatorio: false,
  esperado: { tecnicoId: "10", inicio: "2026-12-01T10:00:00.000Z", alvoId: "20", questionarioId: null },
  despacho: {
    clienteId: "44444444-4444-4444-8444-444444444444", clienteAuvoId: "30",
    tipoTarefaId: "55555555-5555-4555-8555-555555555555", tipoTarefaAuvoId: "40",
    titulo: "Preventiva", descricao: null, prioridade: "normal",
  },
};

function bancoFalso(registro: { chamadas: string[] }) {
  return {
    schema: () => ({
      // O recibo precisa ecoar `request_id`/`fence`, senão o repositório trata como não
      // confirmado e o resultado vira "incerto" — mascarando o bloqueio que queremos provar.
      rpc: (nome: string, p: Record<string, unknown>) => {
        registro.chamadas.push(nome);
        const data = nome === "sso_t24_reservar_candidata"
          ? CONCESSAO
          : {
              requestId: p.p_request_id,
              tentativaId: p.p_tentativa_id,
              fence: p.p_fence,
              estado: p.p_estado,
            };
        return { abortSignal: () => Promise.resolve({ data, error: null }) };
      },
    }),
  };
}

function compor(registro: { chamadas: string[] }, habilitado: boolean) {
  return criarComposicaoHttpT24({
    habilitado: () => habilitado,
    banco: bancoFalso(registro) as unknown as Parameters<typeof criarComposicaoHttpT24>[0]["banco"],
    agora: () => performance.now(),
    // Contrato bem formado, mas NÃO comprovado — é o estado real de produção hoje.
    contrato: () => Promise.resolve({
      comprovado: false, fuso: "America/Sao_Paulo", campoTipo: "taskTypeId", campoAlvo: "equipmentId",
      prioridades: { normal: 1 }, limiteOrientacao: 4000, permiteAtualizarCamposCriticos: false,
      questionarioAusenteSeguroNaAtualizacao: false, campoId: "taskID", campoExternalId: "externalId",
      campoTecnico: "idUserTo", campoHorario: "taskDate", campoAlvoLeitura: "equipmentId",
      campoQuestionario: "questionnaireId", questionarioAusenteSignificaNenhum: true,
    }),
    buscarPagina: () => { throw new Error("A busca não pode ser tocada sem contrato comprovado."); },
    extrairCriacao: () => { throw new Error("Criação não pode ser tocada sem contrato comprovado."); },
    extrairLeitura: () => { throw new Error("Leitura não pode ser tocada sem contrato comprovado."); },
  });
}

function requisicao() {
  return new Request("https://exemplo.test/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CHAVE}` },
    body: JSON.stringify(corpo),
  });
}

Deno.test("sem contrato comprovado, bloqueia a OS sem tocar no Auvo", async () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", CHAVE);
  const registro = { chamadas: [] as string[] };
  const resposta = await compor(registro, true)(requisicao());
  assertEquals(resposta.status, 200);
  const corpoResposta = await resposta.json();
  // Considerou a OS e a bloqueou: o trabalho foi visto, não ignorado em silêncio.
  assertEquals(corpoResposta.considerados, 1);
  assertEquals(corpoResposta.bloqueados, 1);
  assertEquals(corpoResposta.confirmados, 0);
  // O bloqueio foi registrado no ledger — falha fechada não pode ser falha muda.
  assertEquals(registro.chamadas.includes("sso_t24_resultado_outbox_servico"), true);
  // E o efeito remoto nunca começou: nenhum `iniciar_efeito`, nenhuma rede.
  assertEquals(registro.chamadas.includes("sso_t24_iniciar_efeito"), false);
});

Deno.test("com a flag desligada, nem o banco é consultado", async () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", CHAVE);
  const registro = { chamadas: [] as string[] };
  const resposta = await compor(registro, false)(requisicao());
  assertEquals(resposta.status, 403);
  assertEquals(registro.chamadas.length, 0);
});

Deno.test("sem credencial de serviço, recusa antes de qualquer trabalho", async () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", CHAVE);
  const registro = { chamadas: [] as string[] };
  const resposta = await compor(registro, true)(
    new Request("https://exemplo.test/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer chave-errada" },
      body: JSON.stringify(corpo),
    }),
  );
  assertEquals(resposta.status, 403);
  assertEquals(registro.chamadas.length, 0);
});
