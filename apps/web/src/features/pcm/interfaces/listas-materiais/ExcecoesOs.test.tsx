// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExcecoesOs } from "./ExcecoesOs";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
const usuario = "17900000-0000-4000-8000-000000000001";
const terceiro = "17900000-0000-4000-8000-000000000002";
const cliente = "17900000-0000-4000-8000-000000000003";
const os = "17900000-0000-4000-8000-000000000004";
const lista = "17900000-0000-4000-8000-000000000005";
const data = "2026-11-27T13:20:00.000Z";

vi.mock("../../../../lib/supabase-client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: usuario } }, error: null }) },
    schema: () => ({ rpc }),
  },
}));

afterEach(() => {
  cleanup();
  rpc.mockReset();
  vi.unstubAllEnvs();
});

function montar(podeRegistrar: boolean, erroPrimeiraLeitura?: "42501" | "55000") {
  vi.stubEnv("VITE_SSO_EXCECOES_MATERIAIS_OS_ENABLED", "true");
  vi.stubEnv("VITE_SSO_IMPEDIMENTO_MATERIAL_OS_ENABLED", "true");
  rpc.mockImplementation((nome: string, escopo: { p_cliente_id: string; p_os_id: string }) => ({
    abortSignal: async () => {
      if (escopo.p_cliente_id !== cliente || escopo.p_os_id !== os)
        return { data: null, error: { code: "42501" } };
      if (nome === "sso_listar_excecoes_materiais_os") {
        if (erroPrimeiraLeitura) return { data: null, error: { code: erroPrimeiraLeitura } };
        return {
          data: [
            {
              lista_id: lista,
              revisao: 2,
              motivo: "faltante",
              descricao: "Fusível ausente",
              revisao_linhas: null,
              posicao: null,
              ator_id: terceiro,
              criado_em: data,
            },
          ],
          error: null,
        };
      }
      if (!podeRegistrar) return { data: null, error: { code: "42501" } };
      return {
        data: [
          {
            revisao: 1,
            lista_id: lista,
            evento_revision: 2,
            estado: "suspenso",
            motivo: "Aguardar material",
            ator_id: terceiro,
            criado_em: data,
          },
        ],
        error: null,
      };
    },
  }));
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ExcecoesOs usuario={usuario} cliente={cliente} os={os} />
    </QueryClientProvider>,
  );
}

it.each([true, false])(
  "mantém o histórico consultivo com permissão de intenção %s",
  async (permitido) => {
    montar(permitido);
    const historico = within(screen.getByRole("region", { name: "Histórico de exceções da OS" }));
    expect(await historico.findByText(/Fusível ausente/)).toBeVisible();
    expect(rpc).toHaveBeenCalledWith("sso_listar_excecoes_materiais_os", {
      p_cliente_id: cliente,
      p_os_id: os,
      p_apos_lista: null,
      p_apos_revisao: null,
      p_limite: 20,
    });
    expect(
      historico.queryByRole("button", { name: /impedimento|intenção/i }),
    ).not.toBeInTheDocument();
    const acao = within(
      screen.getByRole("region", { name: "Ação da OS: intenção de impedimento" }),
    );
    fireEvent.change(acao.getByRole("combobox"), { target: { value: `${lista}:2` } });
    fireEvent.click(acao.getByRole("button", { name: "Consultar impedimento" }));
    if (permitido) {
      expect(await acao.findByRole("button", { name: "Registrar intenção" })).toBeDisabled();
      const item = acao.getByText(/Aguardar material/);
      expect(item).toHaveTextContent("Nome do responsável indisponível");
      expect(item).not.toHaveTextContent(terceiro);
      expect(item).not.toHaveTextContent(lista);
      expect(item).not.toHaveTextContent(data);
      expect(item.querySelector("time")).toHaveAttribute("datetime", data);
    } else {
      expect(await acao.findByRole("alert")).toHaveTextContent("Histórico indisponível");
      expect(acao.queryByRole("button", { name: "Registrar intenção" })).not.toBeInTheDocument();
    }
  },
);

it.each([
  ["42501", /não tem permissão/i],
  ["55000", /ainda não foi liberada/i],
] as const)(
  "oculta a ação e a repetição se a primeira leitura retorna %s",
  async (codigo, mensagem) => {
    montar(true, codigo);
    expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
    expect(
      screen.queryByRole("region", { name: "Ação da OS: intenção de impedimento" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(rpc).toHaveBeenCalledTimes(1);
  },
);
