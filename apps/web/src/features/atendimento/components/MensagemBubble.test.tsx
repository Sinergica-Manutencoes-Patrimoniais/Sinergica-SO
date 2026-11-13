// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MensagemItem } from "../domain/mensagens";
import { MensagemBubble } from "./MensagemBubble";

function mensagem(overrides: Partial<MensagemItem>): MensagemItem {
  return {
    id: "m1",
    conversaId: "c1",
    direcao: "entrada",
    remetenteTipo: "cliente",
    remetenteId: null,
    conteudo: "oi",
    statusEntrega: null,
    erroDetalhe: null,
    createdAt: "2026-11-13T10:00:00Z",
    tipoConteudo: "texto",
    midiaUrl: null,
    midiaNome: null,
    midiaMime: null,
    payload: {},
    origemEnvio: null,
    custoIa: null,
    legenda: null,
    conteudoRecebido: null,
    anexoEstado: null,
    citacao: null,
    reacao: null,
    ...overrides,
  };
}

describe("MensagemBubble — E02-S37/S38 (tipos novos)", () => {
  it("aviso de localização mostra o texto fixo, sem conteúdo real", () => {
    render(
      <MensagemBubble
        mensagem={mensagem({ conteudo: "[localização]", conteudoRecebido: "localizacao" })}
      />,
    );
    expect(screen.getByText("[localização]")).toBeInTheDocument();
  });

  it("mídia guardada com legenda mostra a legenda, nunca o marcador do agente", () => {
    render(
      <MensagemBubble
        mensagem={mensagem({
          tipoConteudo: "midia",
          conteudoRecebido: "imagem",
          anexoEstado: "guardado",
          conteudo: "[imagem] legenda: paguei a avaliação",
          legenda: "paguei a avaliação",
          midiaUrl: "https://exemplo.local/foto.jpg",
          midiaMime: "image/jpeg",
        })}
      />,
    );
    expect(screen.getByText("paguei a avaliação")).toBeInTheDocument();
    expect(screen.queryByText(/\[imagem\] legenda/)).not.toBeInTheDocument();
  });

  it("figurinha guardada (sem legenda) não mostra parágrafo de texto", () => {
    const { container } = render(
      <MensagemBubble
        mensagem={mensagem({
          tipoConteudo: "midia",
          conteudoRecebido: "figurinha",
          anexoEstado: "guardado",
          conteudo: "[figurinha]",
          legenda: null,
          midiaUrl: "https://exemplo.local/sticker.webp",
          midiaMime: "image/webp",
        })}
      />,
    );
    expect(container.querySelector("p")).toBeNull();
  });

  it("mídia acima do limite mostra o aviso com o motivo, nunca a imagem", () => {
    render(
      <MensagemBubble
        mensagem={mensagem({
          conteudoRecebido: "video",
          anexoEstado: "acima_do_limite",
          conteudo: "[vídeo acima do limite]",
        })}
      />,
    );
    expect(screen.getByText("[vídeo acima do limite]")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("citação mostra o autor e o trecho, com rótulo 'mensagem anterior' quando não há trecho", () => {
    render(
      <MensagemBubble
        mensagem={mensagem({
          citacao: { mensagemId: null, trecho: null, autor: "desconhecido" },
        })}
      />,
    );
    expect(screen.getByText("mensagem anterior")).toBeInTheDocument();
  });

  it("citação com mensagem existente mostra o autor certo e trecho", () => {
    render(
      <MensagemBubble
        mensagem={mensagem({
          citacao: { mensagemId: "m0", trecho: "A sessão custa R$ 500", autor: "humano" },
        })}
      />,
    );
    expect(screen.getByText("Equipe")).toBeInTheDocument();
    expect(screen.getByText("A sessão custa R$ 500")).toBeInTheDocument();
  });

  it("reação mostra o emoji com aria-label", () => {
    render(<MensagemBubble mensagem={mensagem({ reacao: "👍" })} />);
    expect(screen.getByLabelText("Cliente reagiu com 👍")).toBeInTheDocument();
  });

  it("sem reação, nenhum elemento de reação é renderizado", () => {
    render(<MensagemBubble mensagem={mensagem({})} />);
    expect(screen.queryByLabelText(/reagiu com/)).not.toBeInTheDocument();
  });
});
