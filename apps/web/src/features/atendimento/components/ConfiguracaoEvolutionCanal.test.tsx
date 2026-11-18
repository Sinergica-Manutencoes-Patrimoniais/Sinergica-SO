// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfiguracaoEvolutionCanal } from "./ConfiguracaoEvolutionCanal";
import type { PortaDeConfiguracaoEvolutionCompleta } from "./ConfiguracaoEvolutionCanal";

function portaFake(
  overrides: Partial<PortaDeConfiguracaoEvolutionCompleta> = {},
): PortaDeConfiguracaoEvolutionCompleta {
  return {
    salvarServidor: vi.fn().mockResolvedValue({ estado: "compativel", versao: "2.1.1" }),
    criarInstancia: vi
      .fn()
      .mockResolvedValue({ estado: "conectado_verificado", jaExistia: false, adotada: true }),
    instalarWebhook: vi.fn().mockResolvedValue({ estado: "conectado_verificado" }),
    ...overrides,
  };
}

describe("ConfiguracaoEvolutionCanal", () => {
  it("não renderiza nada sem permissão de escrita", () => {
    const { container } = render(
      <ConfiguracaoEvolutionCanal porta={portaFake()} canais={[]} temEscrita={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("salva o servidor e mostra compatibilidade", async () => {
    const porta = portaFake();
    render(<ConfiguracaoEvolutionCanal porta={porta} canais={[]} temEscrita />);

    fireEvent.change(screen.getByPlaceholderText("https://evolution.exemplo.com.br"), {
      target: { value: "https://evolution.minhaempresa.com.br" },
    });
    fireEvent.change(screen.getByPlaceholderText("apikey"), { target: { value: "chave-secreta" } });
    fireEvent.click(screen.getByText("1. Salvar servidor"));

    await waitFor(() =>
      expect(porta.salvarServidor).toHaveBeenCalledWith({
        urlBase: "https://evolution.minhaempresa.com.br",
        apikeyGlobal: "chave-secreta",
      }),
    );
    expect(await screen.findByText(/Servidor compatível/)).toBeInTheDocument();
  });

  it("migra o webhook de um canal e avisa que a conexão foi mantida (adoção)", async () => {
    const porta = portaFake();
    render(
      <ConfiguracaoEvolutionCanal
        porta={porta}
        canais={[{ id: "canal-1", label: "Atendimento principal" }]}
        temEscrita
      />,
    );

    fireEvent.click(screen.getByText("2. Migrar webhook"));

    await waitFor(() => expect(porta.criarInstancia).toHaveBeenCalledWith("canal-1"));
    expect(porta.instalarWebhook).toHaveBeenCalledWith("canal-1");
    expect(await screen.findByText("migrado, conexão mantida")).toBeInTheDocument();
  });

  it("mostra o erro quando a migração falha", async () => {
    const porta = portaFake({
      instalarWebhook: vi.fn().mockRejectedValue(new Error("webhook_falhou")),
    });
    render(
      <ConfiguracaoEvolutionCanal
        porta={porta}
        canais={[{ id: "canal-1", label: "Atendimento principal" }]}
        temEscrita
      />,
    );

    fireEvent.click(screen.getByText("2. Migrar webhook"));
    expect(await screen.findByText("webhook_falhou")).toBeInTheDocument();
  });
});
