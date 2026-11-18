// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

function montar(
  rpcImpl: (nome: string, args: unknown) => Promise<{ data: unknown; error: unknown }>,
) {
  const rpc = vi.fn((nome: string, args: unknown) => {
    const resultado = rpcImpl(nome, args);
    return Object.assign(resultado, { abortSignal: () => resultado });
  });
  vi.doMock("../../../../lib/supabase-client", () => ({
    supabase: { schema: () => ({ rpc }) },
  }));
  return rpc;
}

async function renderizar() {
  const { TrechosDeslocamento: Componente } = await import("./TrechosDeslocamento");
  const cliente = new QueryClient();
  render(
    <QueryClientProvider client={cliente}>
      <Componente clienteId="cliente-1" visitaId="visita-1" />
    </QueryClientProvider>,
  );
}

const TRECHO_VAZIO = {
  sequencia: null,
  origem: null,
  destino: null,
  minutos: null,
  enquadramento: null,
  motivo: null,
  revisao: null,
  ator_id: null,
  criada_em: null,
  revisao_visita_atual: 1,
};

describe("TrechosDeslocamento", () => {
  it("AC-F3: gate fechado mostra 'disponível, não ativado', não erro genérico nem tela em branco", async () => {
    vi.resetModules();
    montar(async () => ({ data: null, error: { message: "trechos_deslocamento_bloqueados" } }));
    await renderizar();
    expect(await screen.findByText(/disponível, ainda não ativado/i)).toBeInTheDocument();
  });

  it("AC-1: lista os trechos com enquadramento, na ordem", async () => {
    vi.resetModules();
    montar(async () => ({
      data: [
        {
          ...TRECHO_VAZIO,
          sequencia: 1,
          origem: "residencia",
          destino: "visita_proxima",
          minutos: 30,
          enquadramento: "nao_computado",
          revisao: 1,
          ator_id: "a",
          criada_em: "2026-11-18T10:00:00Z",
        },
        {
          ...TRECHO_VAZIO,
          sequencia: 2,
          origem: "visita_anterior",
          destino: "visita_proxima",
          minutos: 20,
          enquadramento: "computado",
          revisao: 1,
          ator_id: "a",
          criada_em: "2026-11-18T10:30:00Z",
        },
      ],
      error: null,
    }));
    await renderizar();
    expect(await screen.findByText(/Residência → Visita próxima/)).toBeInTheDocument();
    expect(await screen.findByText("Não computado")).toBeInTheDocument();
    expect(await screen.findByText("Computado")).toBeInTheDocument();
  });

  it("AC-10: sem trecho declarado, a Visita continua válida — mostra estado vazio, não erro", async () => {
    vi.resetModules();
    montar(async () => ({ data: [TRECHO_VAZIO], error: null }));
    await renderizar();
    expect(await screen.findByText(/Nenhum trecho declarado ainda/i)).toBeInTheDocument();
  });

  it("declara um trecho — RPC chamado com os campos certos", async () => {
    vi.resetModules();
    const rpc = montar(async (nome) => {
      if (nome === "sso_listar_trechos_visita") return { data: [TRECHO_VAZIO], error: null };
      return { data: { requestId: "r1", revisao: 1 }, error: null };
    });
    const usuario = userEvent.setup();
    await renderizar();
    await screen.findByText(/Nenhum trecho declarado ainda/i);
    await usuario.type(screen.getByLabelText("Minutos"), "30");
    await usuario.click(screen.getByRole("button", { name: "Declarar dia" }));
    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith(
        "sso_declarar_trechos_visita",
        expect.objectContaining({
          p_cliente_id: "cliente-1",
          p_visita_id: "visita-1",
          p_revisao_visita: 1,
          p_revisao_anterior: 0,
        }),
      );
    });
  });
});
