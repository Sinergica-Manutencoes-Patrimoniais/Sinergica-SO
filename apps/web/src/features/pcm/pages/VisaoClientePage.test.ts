import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(resolve(__dirname, "VisaoClientePage.tsx"), "utf8");

describe("VisaoClientePage — E01-S53 AC-8", () => {
  it("mantém Preventivas como aba do 360 e só monta o workspace quando selecionada", () => {
    expect(fonte).toContain('id: "preventivas", label: "Preventivas"');
    expect(fonte).toContain('aba === "preventivas" && user');
    expect(fonte).toContain("<PreventivasWorkspace");
    expect(fonte).toContain("clienteId={cliente.id}");
    expect(fonte).toContain("clienteNome={cliente.nome}");
    expect(fonte).toContain("temEscrita={temEscrita}");
  });

  it("não mantém a visão anterior montada durante a troca de cliente", () => {
    expect(fonte).toContain('{ fase: "pronto"; clienteId: string; visao: VisaoCliente }');
    expect(fonte).toContain("estado.clienteId !== clienteId");
    expect(fonte).toContain("requisicao !== requisicaoAtual.current");
  });

  it("agrupa a navegação e condiciona ações rápidas à permissão de escrita", () => {
    expect(fonte).toContain('label: "Operação"');
    expect(fonte).toContain('label: "Ativos"');
    expect(fonte).toContain('label: "Gestão e relacionamento"');
    expect(fonte).toContain('aria-label="Ações rápidas do cliente"');
    expect(fonte).toContain("temEscrita && user");
    expect(fonte).toContain("Novo chamado");
    expect(fonte).toContain("Nova OS");
    expect(fonte).toContain("Nova preventiva");
    expect(fonte).toContain("Novo componente");
  });

  it("mantém áreas secundárias alcançáveis no overflow Mais", () => {
    expect(fonte).toContain("LIMITE_ABAS_VISIVEIS");
    expect(fonte).toContain("abasNoMais");
    expect(fonte).toContain("Mais áreas de ${grupo.label}");
    expect(fonte).toContain('event.currentTarget.closest("details")?.removeAttribute("open")');
  });
});
