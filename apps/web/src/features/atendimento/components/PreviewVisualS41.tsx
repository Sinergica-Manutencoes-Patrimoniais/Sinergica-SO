import { useState } from "react";
import type { ConversaItem } from "../domain/conversas";
import type { MensagemItem } from "../domain/mensagens";
import { ConversaLista } from "./ConversaLista";
import { MensagemBubble } from "./MensagemBubble";

/**
 * E02-S41 — preview visual TEMPORÁRIO, sem autenticação nem backend, só para olhar o restilo da
 * bolha/fila (design.md) com dado mock antes de qualquer sessão de implementação terminar.
 * Remover junto com a troca de rota da tela nova (plan.md, fase 4) — não é produto, é vitrine.
 */
const CONVERSAS: ConversaItem[] = [
  {
    id: "c1",
    clientId: "cli-1",
    clienteNome: "Condomínio Villa Real",
    contatoNome: "Maria (síndica)",
    canal: "whatsapp",
    status: "aberta",
    modo: "pausado",
    atribuidoA: "u1",
    naoLidas: 3,
    ultimaMensagemPreview: "[imagem] orçamento do elevador…",
    ultimaMensagemEm: new Date().toISOString(),
    ordemServicoId: null,
    tags: ["urgente"],
  },
  {
    id: "c2",
    clientId: "cli-2",
    clienteNome: "Edifício Jardins",
    contatoNome: "João (zelador)",
    canal: "whatsapp",
    status: "aberta",
    modo: "auto",
    atribuidoA: null,
    naoLidas: 0,
    ultimaMensagemPreview: "Obrigado, até amanhã!",
    ultimaMensagemEm: new Date(Date.now() - 3600_000).toISOString(),
    ordemServicoId: null,
    tags: [],
  },
  {
    id: "c3",
    clientId: null,
    clienteNome: null,
    contatoNome: "+55 11 99999-0000",
    canal: "whatsapp",
    status: "encerrada",
    modo: "auto",
    atribuidoA: null,
    naoLidas: 0,
    ultimaMensagemPreview: "Conversa encerrada pelo atendente",
    ultimaMensagemEm: new Date(Date.now() - 86_400_000).toISOString(),
    ordemServicoId: null,
    tags: [],
  },
];

function mensagem(
  parcial: Partial<MensagemItem> & Pick<MensagemItem, "id" | "direcao" | "remetenteTipo">,
): MensagemItem {
  return {
    conversaId: "c1",
    remetenteId: null,
    conteudo: null,
    statusEntrega: null,
    erroDetalhe: null,
    createdAt: new Date().toISOString(),
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
    ...parcial,
  };
}

const MENSAGENS: MensagemItem[] = [
  mensagem({
    id: "m1",
    direcao: "entrada",
    remetenteTipo: "cliente",
    conteudo: "Bom dia! O elevador social parou de novo, dá pra mandar alguém hoje?",
  }),
  mensagem({
    id: "m2",
    direcao: "saida",
    remetenteTipo: "ze",
    conteudo:
      "Bom dia, Maria! Já vi aqui que o técnico passou na visita da semana passada. Vou verificar a disponibilidade e te retorno em instantes.",
    custoIa: { usdCost: 0.0031, modelo: "gemini-2.5-flash", tokensIn: 420, tokensOut: 95 },
  }),
  mensagem({
    id: "m3",
    direcao: "entrada",
    remetenteTipo: "cliente",
    tipoConteudo: "midia",
    midiaMime: "image/jpeg",
    midiaNome: "orcamento-elevador.jpg",
    midiaUrl: `data:image/svg+xml;utf8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#e5e2d9"/><text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="#8c8f9b" text-anchor="middle" dominant-baseline="middle">foto do orçamento</text></svg>',
    )}`,
    conteudo: "segue o orçamento que recebi",
  }),
  mensagem({
    id: "m4",
    direcao: "saida",
    remetenteTipo: "humano",
    origemEnvio: "celular",
    conteudo: "Pode deixar, Maria — já vou falar com o técnico pessoalmente agora de tarde.",
  }),
  mensagem({
    id: "m5",
    direcao: "entrada",
    remetenteTipo: "cliente",
    conteudo: "Perfeito, muito obrigada! 🙏",
  }),
];

export function PreviewVisualS41() {
  const [selecionada, definirSelecionada] = useState<string | null>("c1");

  return (
    <div className="flex h-screen flex-col bg-paper p-4">
      <p className="mb-2 rounded-md bg-warning-soft px-3 py-1.5 text-caption text-warning">
        Preview visual E02-S41 (design.md) — dado mock, sem backend. Não é rota de produto.
      </p>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="w-[340px] shrink-0">
          <ConversaLista
            conversas={CONVERSAS}
            conversaSelecionadaId={selecionada}
            onSelecionar={(c) => definirSelecionada(c.id)}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-line bg-paper p-4">
          {MENSAGENS.map((m) => (
            <MensagemBubble key={m.id} mensagem={m} />
          ))}
        </div>
      </div>
    </div>
  );
}
