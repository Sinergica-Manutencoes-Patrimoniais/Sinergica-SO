import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guia = readFileSync(new URL("./ComercialGuia.tsx", import.meta.url), "utf8");

describe("Guia SO — Comercial", () => {
  it("documenta todas as opções reais da navegação do Comercial (HomePage.tsx COMERCIAL_NAV)", () => {
    // Se uma tela nova entrar em COMERCIAL_NAV sem entrada aqui, este teste quebra — é o gate
    // que impede o guia de envelhecer em silêncio (AC-3).
    const opcoes = [
      "Dashboard",
      "Funil",
      "Contas",
      "Contratos",
      "Precificação",
      "Configuração do funil",
    ];

    for (const opcao of opcoes) {
      expect(guia).toContain(`nome: "${opcao}"`);
    }
  });

  it("explica uso e sentido com status de dado real", () => {
    expect(guia).toContain('<StatusModulo status="real" />');
    expect(guia).toContain("Para que serve");
    expect(guia).toContain("Como usar");
    expect(guia).toContain("Qual o sentido");
    expect(guia).not.toContain('<StatusModulo status="planejado" />');
    expect(guia).not.toContain('<StatusModulo status="prototipo" />');
  });

  it("explica os conceitos que confundem (AC-4)", () => {
    expect(guia).toContain("Conta</dt>");
    expect(guia).toContain("Proposta × Orçamento de Serviço");
    expect(guia).toContain("Piso e desconto máximo");
    expect(guia).toContain("Etapas configuráveis");
    expect(guia).toContain("Motivo de perda é obrigatório");
  });

  it("descreve as integrações com outros módulos do ponto de vista do usuário (AC-6)", () => {
    expect(guia).toContain("WhatsApp");
    expect(guia).toContain("Levantamento de pré-venda");
    expect(guia).toContain("síndico");
    expect(guia).toContain("Financeiro");
  });

  it("é honesto sobre o que ainda não existe (AC-7)", () => {
    expect(guia).toContain("DOCX");
    expect(guia).toContain("assinatura eletrônica");
    expect(guia).toContain("gerada automaticamente por IA");
  });
});
