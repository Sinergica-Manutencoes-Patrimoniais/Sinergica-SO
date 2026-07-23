import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  avaliarMotivoHandoff,
  comporPromptPersona,
  resolverRotaAtendimento,
} from "./atendimento-runtime.ts";

Deno.test("roteamento A/B usa persona exata da instância", () => {
  assertEquals(
    resolverRotaAtendimento({
      vinculo: { personaId: "persona-a", personaTipo: "chamados" },
      temConfigZe: true,
    }),
    { tipo: "chamados", personaId: "persona-a", origem: "instancia" },
  );
  assertEquals(
    resolverRotaAtendimento({
      vinculo: { personaId: "persona-b", personaTipo: "comercial" },
      temConfigZe: false,
    }),
    { tipo: "comercial", personaId: "persona-b", origem: "instancia" },
  );
});

Deno.test("roteamento legado só existe com config_ze", () => {
  assertEquals(resolverRotaAtendimento({ vinculo: null, temConfigZe: true }), {
    tipo: "chamados",
    personaId: null,
    origem: "legado",
  });
  assertEquals(resolverRotaAtendimento({ vinculo: null, temConfigZe: false }), null);
});

Deno.test("handoff respeita transferir após N respostas", () => {
  assertEquals(
    avaliarMotivoHandoff({
      contexto: "continuar",
      palavrasTransferencia: [],
      respostasAgente: 3,
      transferirAposNRespostas: 3,
      respostasAgenteHoje: 3,
      limiteDiarioMensagens: 20,
    }),
    "Limite de 3 respostas atingido",
  );
});

Deno.test("handoff prioriza cliente ausente e palavra configurada", () => {
  const base = {
    respostasAgente: 0,
    transferirAposNRespostas: null,
    respostasAgenteHoje: 0,
    limiteDiarioMensagens: null,
  };
  assertEquals(
    avaliarMotivoHandoff({
      ...base,
      contexto: "quero falar com humano",
      palavrasTransferencia: ["humano"],
    }),
    "Palavra de transferência: humano",
  );
  assertEquals(
    avaliarMotivoHandoff({
      ...base,
      contexto: "oi",
      palavrasTransferencia: [],
      clienteObrigatorioAusente: true,
    }),
    "Cliente PCM não vinculado",
  );
});

Deno.test("prompt efetivo inclui base fixa mesmo com RAG vazio", () => {
  assertEquals(
    comporPromptPersona("instrução", "base própria", ""),
    "instrução\n\nbase própria",
  );
});
