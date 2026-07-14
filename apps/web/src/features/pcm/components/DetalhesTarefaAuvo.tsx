// E01-S38/E01-S70: renderiza `detalhes` (jsonb, dado rico da tarefa Auvo só pra exibição) em abas
// espelhando o app Auvo — Relato, Anexos/Fotos, Questionários, Equipamentos, Pendências, Horas,
// Valores. Componente puro de apresentação: recebe `detalhes` (+ check-in/out, que vivem na OS, não
// no jsonb) e não faz I/O. Campo novo do Auvo amanhã só precisa aparecer aqui, sem migration.
import {
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Wrench,
} from "lucide-react";
import { useState } from "react";

type AbaDetalhe =
  | "relato"
  | "anexos"
  | "questionarios"
  | "equipamentos"
  | "pendencias"
  | "horas"
  | "valores";

interface QuestionarioResposta {
  pergunta: string;
  resposta: string;
  data: string | null;
}

const ABAS: Array<{ id: AbaDetalhe; label: string; icon: typeof FileText }> = [
  { id: "relato", label: "Relato", icon: FileText },
  { id: "anexos", label: "Anexos/Fotos", icon: ImageIcon },
  { id: "questionarios", label: "Questionários", icon: ListChecks },
  { id: "equipamentos", label: "Equipamentos", icon: Wrench },
  { id: "pendencias", label: "Pendências", icon: AlertTriangle },
  { id: "horas", label: "Horas", icon: Clock },
  { id: "valores", label: "Valores", icon: DollarSign },
];

export function DetalhesTarefaAuvo({
  detalhes,
  checkInAt,
  checkOutAt,
}: {
  detalhes: Record<string, unknown>;
  checkInAt?: string | null;
  checkOutAt?: string | null;
}) {
  const [aba, setAba] = useState<AbaDetalhe>("relato");

  const texto = (chave: string) =>
    typeof detalhes[chave] === "string" && detalhes[chave] ? (detalhes[chave] as string) : null;
  const numero = (chave: string) =>
    typeof detalhes[chave] === "number" ? (detalhes[chave] as number) : null;
  const lista = (chave: string) =>
    Array.isArray(detalhes[chave]) ? (detalhes[chave] as unknown[]) : null;

  const endereco = texto("address");
  const lat = numero("latitude");
  const lon = numero("longitude");
  const tecnicoNomeAuvo = texto("tecnicoNomeAuvo");
  const clienteNomeAuvo = texto("clienteNomeAuvo");
  const orientacao = texto("orientacao");
  const relato = texto("relato");
  const pendencia = texto("pendencia");
  const duracao = texto("duracao");
  const despesa = texto("despesa");
  const categoriaFinanceira = texto("categoriaFinanceira");
  const assinaturaNome = texto("assinaturaNome");
  const assinaturaUrl = texto("assinaturaUrl");
  const anexos = lista("anexos") ?? [];
  const produtos = lista("produtos") ?? [];
  const servicos = lista("servicos") ?? [];
  const custosAdicionais = lista("custosAdicionais") ?? [];
  const questionarios = (lista("questionarios") ?? []) as QuestionarioResposta[];
  const palavrasChave = lista("palavrasChave") ?? [];
  const ticketId = numero("ticketId");
  const ticketTitulo = texto("ticketTitulo");
  const taskUrl = texto("taskUrl");
  const duracaoHoras = numero("duracaoHoras");

  return (
    <div className="rounded-[8px] border border-line bg-paper">
      <div className="border-b border-line-soft overflow-x-auto">
        <div className="flex min-w-max gap-1 px-1">
          {ABAS.map((item) => {
            const Icon = item.icon;
            const ativo = aba === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setAba(item.id)}
                className={`inline-flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-semibold transition-colors ${
                  ativo ? "border-orange text-ink" : "border-transparent text-ink-3 hover:text-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3">
        {aba === "relato" && (
          <div className="space-y-3 text-sm">
            {endereco && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-3">Endereço</p>
                <p className="text-ink-2">
                  {endereco}
                  {lat != null && lon != null && (
                    <a
                      href={`https://www.google.com/maps?q=${lat},${lon}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-xs font-semibold text-orange"
                    >
                      ver no mapa
                    </a>
                  )}
                </p>
              </div>
            )}
            {(tecnicoNomeAuvo || clienteNomeAuvo) && (
              <div className="grid grid-cols-2 gap-2">
                {tecnicoNomeAuvo && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-3">
                      Técnico (Auvo)
                    </p>
                    <p className="text-ink-2">{tecnicoNomeAuvo}</p>
                  </div>
                )}
                {clienteNomeAuvo && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-3">
                      Cliente (Auvo)
                    </p>
                    <p className="text-ink-2">{clienteNomeAuvo}</p>
                  </div>
                )}
              </div>
            )}
            {orientacao && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-3">Orientação</p>
                <p className="text-ink-2">{orientacao}</p>
              </div>
            )}
            {relato && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-3">Relato do técnico</p>
                <p className="text-ink-2">{relato}</p>
              </div>
            )}
            {palavrasChave.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-3">Palavras-chave</p>
                <p className="text-ink-2">{palavrasChave.join(", ")}</p>
              </div>
            )}
            {ticketId != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-3">Ticket vinculado</p>
                <p className="text-ink-2">
                  #{ticketId}
                  {ticketTitulo ? ` · ${ticketTitulo}` : ""}
                </p>
              </div>
            )}
            {taskUrl && (
              <a
                href={taskUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs font-semibold text-orange"
              >
                Ver tarefa completa no Auvo →
              </a>
            )}
            {!endereco &&
              !tecnicoNomeAuvo &&
              !clienteNomeAuvo &&
              !orientacao &&
              !relato &&
              palavrasChave.length === 0 &&
              ticketId == null &&
              !taskUrl && <EstadoVazio texto="Sem relato para esta tarefa." />}
          </div>
        )}

        {aba === "anexos" && (
          <div className="space-y-3">
            {anexos.length === 0 && !assinaturaUrl && (
              <EstadoVazio texto="Sem anexos ou fotos para esta tarefa." />
            )}
            {anexos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {anexos.map((anexo, indice) => (
                  <AnexoThumb
                    // biome-ignore lint/suspicious/noArrayIndexKey: anexos do Auvo não têm id estável no payload
                    key={indice}
                    anexo={anexo}
                  />
                ))}
              </div>
            )}
            {assinaturaUrl && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-3">Assinatura</p>
                <a href={assinaturaUrl} target="_blank" rel="noreferrer" className="mt-1 block">
                  <img
                    src={assinaturaUrl}
                    alt={assinaturaNome ?? "Assinatura"}
                    className="h-20 w-32 rounded-[6px] border border-line object-contain bg-card"
                  />
                </a>
                <p className="mt-1 text-xs text-ink-3">{assinaturaNome ?? "Sem nome"}</p>
              </div>
            )}
          </div>
        )}

        {aba === "questionarios" && (
          <div className="space-y-3">
            {questionarios.length === 0 ? (
              <EstadoVazio texto="Sem questionário preenchido para esta tarefa." />
            ) : (
              questionarios.map((item, indice) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: resposta achatada não tem id estável no payload
                  key={indice}
                  className="rounded-[6px] border border-line-soft bg-card p-2.5 text-sm"
                >
                  <p className="text-ink-2 font-medium">{item.pergunta}</p>
                  <p className="mt-1 text-ink">{item.resposta || "Sem resposta"}</p>
                  {item.data && (
                    <p className="mt-1 text-[10px] text-ink-3">
                      {new Date(item.data).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {aba === "equipamentos" && (
          <EstadoVazio texto="Vínculo de equipamento a esta tarefa ainda não é exibido aqui." />
        )}

        {aba === "pendencias" && (
          <div>
            {pendencia ? (
              <p className="text-sm text-ink-2">{pendencia}</p>
            ) : (
              <EstadoVazio texto="Sem pendências registradas para esta tarefa." />
            )}
          </div>
        )}

        {aba === "horas" && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {checkInAt && (
              <Info label="Check-in" value={new Date(checkInAt).toLocaleString("pt-BR")} />
            )}
            {checkOutAt && (
              <Info label="Check-out" value={new Date(checkOutAt).toLocaleString("pt-BR")} />
            )}
            {duracao && <Info label="Duração" value={duracao} />}
            {duracaoHoras != null && <Info label="Duração (horas)" value={String(duracaoHoras)} />}
            {!checkInAt && !checkOutAt && !duracao && duracaoHoras == null && (
              <div className="col-span-2">
                <EstadoVazio texto="Sem apontamento de horas para esta tarefa." />
              </div>
            )}
          </div>
        )}

        {aba === "valores" && (
          <div className="space-y-3 text-sm">
            <ListaValores titulo="Produtos" itens={produtos} />
            <ListaValores titulo="Serviços" itens={servicos} />
            <ListaValores titulo="Custos adicionais" itens={custosAdicionais} />
            {(despesa || categoriaFinanceira) && (
              <div className="grid grid-cols-2 gap-2">
                {despesa && <Info label="Despesa" value={despesa} />}
                {categoriaFinanceira && (
                  <Info label="Categoria financeira" value={categoriaFinanceira} />
                )}
              </div>
            )}
            {produtos.length === 0 &&
              servicos.length === 0 &&
              custosAdicionais.length === 0 &&
              !despesa &&
              !categoriaFinanceira && (
                <EstadoVazio texto="Sem valores registrados para esta tarefa." />
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function ListaValores({ titulo, itens }: { titulo: string; itens: unknown[] }) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-3">{titulo}</p>
      <ul className="mt-1 space-y-1">
        {itens.map((item, indice) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: item do Auvo não tem id estável no payload
          <li key={indice} className="text-ink-2">
            {descreverItem(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function descreverItem(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const registro = item as Record<string, unknown>;
    const nome = registro.name ?? registro.nome ?? registro.description ?? registro.descricao;
    const quantidade = registro.quantity ?? registro.quantidade;
    const valor = registro.value ?? registro.valor ?? registro.price ?? registro.preco;
    const partes = [
      typeof nome === "string" ? nome : "Item",
      quantidade != null ? `qtd ${quantidade}` : null,
      valor != null ? `R$ ${valor}` : null,
    ].filter(Boolean);
    return partes.join(" · ");
  }
  return "Item sem descrição";
}

function AnexoThumb({ anexo }: { anexo: unknown }) {
  const url = urlDoAnexo(anexo);
  const [falhouCarregar, setFalhouCarregar] = useState(false);

  if (!url) return null;
  if (falhouCarregar) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex h-20 items-center justify-center rounded-[6px] border border-line bg-card px-2 text-center text-[10px] font-semibold text-orange"
      >
        Ver anexo
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt="Anexo da tarefa"
        onError={() => setFalhouCarregar(true)}
        className="h-20 w-full rounded-[6px] border border-line object-cover"
      />
    </a>
  );
}

/** Payload real de `attachments[]` não está confirmado em documentação — aceita string direta ou
 * objeto com uma das chaves mais comuns de URL usadas pela API Auvo em outros endpoints. */
function urlDoAnexo(anexo: unknown): string | null {
  if (typeof anexo === "string" && anexo) return anexo;
  if (anexo && typeof anexo === "object") {
    const registro = anexo as Record<string, unknown>;
    for (const chave of ["url", "attachmentUrl", "fileUrl", "link", "uri", "path"]) {
      const valor = registro[chave];
      if (typeof valor === "string" && valor) return valor;
    }
  }
  return null;
}

function EstadoVazio({ texto }: { texto: string }) {
  return <p className="text-sm text-ink-3">{texto}</p>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-3">{label}</p>
      <p className="text-ink-2">{value}</p>
    </div>
  );
}
