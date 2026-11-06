import { describe, expect, it } from "vitest";
import { permiteAcao } from "./capacidades-sso";

const contexto = {
  usuarioAtivo: true,
  papel: "colaborador" as const,
  moduloNivel: "escrita" as const,
  clienteId: "cliente-a",
};

describe("capacidade por ação e Cliente", () => {
  it("exige concessão explícita e distingue leitura de gestão cadastral", () => {
    const leitura = [
      {
        acao: "cadastro.ler" as const,
        clienteId: "cliente-a",
        origem: "individual" as const,
        ativa: true,
      },
    ];
    expect(permiteAcao({ ...contexto, moduloNivel: "leitura" }, "cadastro.ler", leitura)).toBe(
      true,
    );
    expect(permiteAcao(contexto, "cadastro.gerir", leitura)).toBe(false);
    expect(permiteAcao({ ...contexto, clienteId: "cliente-b" }, "cadastro.ler", leitura)).toBe(
      false,
    );
  });
  it("não confunde escrita PCM com capacidade de gestão", () => {
    expect(permiteAcao(contexto, "plano.gerir", [])).toBe(false);
  });
  it("admite perfil para ação comum no Cliente correto", () => {
    const grants = [
      {
        acao: "visita.confirmar" as const,
        clienteId: "cliente-a",
        origem: "perfil" as const,
        ativa: true,
      },
    ];
    expect(permiteAcao(contexto, "visita.confirmar", grants)).toBe(true);
    expect(permiteAcao({ ...contexto, clienteId: "cliente-b" }, "visita.confirmar", grants)).toBe(
      false,
    );
  });
  it("exige concessão individual para gerir Plano, inclusive para administrador", () => {
    const perfil = [
      {
        acao: "plano.gerir" as const,
        clienteId: "cliente-a",
        origem: "perfil" as const,
        ativa: true,
      },
    ];
    expect(permiteAcao({ ...contexto, papel: "superadmin" }, "plano.gerir", perfil)).toBe(false);
    expect(
      permiteAcao(contexto, "plano.gerir", [
        { acao: "plano.gerir", clienteId: "cliente-a", origem: "individual", ativa: true },
      ]),
    ).toBe(true);
  });
  it("respeita revogação e exige módulo para ação de escrita", () => {
    const grants = [
      {
        acao: "execucao.validar" as const,
        clienteId: null,
        origem: "individual" as const,
        ativa: true,
      },
    ];
    expect(permiteAcao({ ...contexto, usuarioAtivo: false }, "execucao.validar", grants)).toBe(
      false,
    );
    expect(permiteAcao({ ...contexto, moduloNivel: "leitura" }, "execucao.validar", grants)).toBe(
      false,
    );
    expect(
      permiteAcao(contexto, "execucao.validar", [
        { acao: "execucao.validar", clienteId: null, origem: "individual", ativa: false },
      ]),
    ).toBe(false);
  });
  it("não libera uma ação sem escopo de Cliente", () => {
    const grants = [
      {
        acao: "visita.confirmar" as const,
        clienteId: null,
        origem: "individual" as const,
        ativa: true,
      },
    ];
    expect(permiteAcao({ ...contexto, clienteId: null }, "visita.confirmar", grants)).toBe(false);
  });
});
