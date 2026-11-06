import { describe, expect, it } from "vitest";
import { permiteAcao, type ConcessaoEfetiva, type ContextoCapacidade } from "./capacidades-sso";

const clienteA = "17020000-0000-4000-8000-00000000000a";
const clienteB = "17020000-0000-4000-8000-00000000000b";
const contexto: ContextoCapacidade = { usuarioAtivo: true, papel: "colaborador", moduloNivel: "escrita", clienteId: clienteA };
const gestao: ConcessaoEfetiva = { acao: "plano.gerir", clienteId: clienteA, origem: "individual", ativa: true };

describe("prévia de capacidades de gestão e execução", () => {
  it("exige concessão individual para gerir Plano e não distingue o criador", () => {
    expect(permiteAcao(contexto, "plano.gerir", [gestao])).toBe(true);
    expect(permiteAcao(contexto, "plano.gerir", [{ ...gestao, origem: "perfil" }])).toBe(false);
    expect(permiteAcao(contexto, "plano.gerir", [])).toBe(false);
    // Não há parâmetro de autoria na prévia; autoaprovação definitiva é verificada no servidor.
  });
  it("não transfere uma concessão individual a outro Cliente ou após revogação", () => {
    expect(permiteAcao({ ...contexto, clienteId: clienteB }, "plano.gerir", [gestao])).toBe(false);
    expect(permiteAcao(contexto, "plano.gerir", [{ ...gestao, ativa: false }])).toBe(false);
    expect(permiteAcao({ ...contexto, usuarioAtivo: false }, "plano.gerir", [gestao])).toBe(false);
  });
  it("separa validação de execução de gestão do Plano", () => {
    const validacao: ConcessaoEfetiva = { acao: "execucao.validar", clienteId: clienteA, origem: "perfil", ativa: true };
    expect(permiteAcao(contexto, "execucao.validar", [validacao])).toBe(true);
    expect(permiteAcao(contexto, "plano.gerir", [validacao])).toBe(false);
    expect(permiteAcao({ ...contexto, moduloNivel: "leitura" }, "execucao.validar", [validacao])).toBe(false);
    expect(permiteAcao({ ...contexto, papel: "cliente-sindico" }, "execucao.validar", [validacao])).toBe(false);
  });
});
