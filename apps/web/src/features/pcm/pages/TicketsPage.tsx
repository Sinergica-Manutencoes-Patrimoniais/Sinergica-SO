import { Archive, Plus, RefreshCw, Ticket as TicketIcon, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  arquivarTicket,
  criarTicket,
  listarClientesTicket,
  listarEquipesTicket,
  listarReferenciaTicket,
  listarTickets,
  mudarStatusTicket,
} from "../application/tickets";
import type {
  TicketClienteOpcao,
  TicketEquipeOpcao,
  TicketFormData,
  TicketItem,
  TicketReferenciaOpcao,
} from "../domain/tickets";
import { supabaseTicketsAdapter } from "../infrastructure/supabase-tickets-adapter";

/** E01-S48: `supabase-js` lança `FunctionsFetchError` com a mensagem genérica "Failed to send a
 * request to the Edge Function" quando o `fetch` falha no browser — tipicamente CORS bloqueando a
 * resposta (domínio fora de `CORS_ALLOWED_ORIGINS`), não a function em si com problema. Troca por
 * uma mensagem que não faz o usuário achar que é bug de negócio. */
function mensagemErroCarregarTickets(error: unknown): string {
  const generico =
    error instanceof Error &&
    (error.name === "FunctionsFetchError" || error.message.includes("Failed to send a request"));
  if (generico) {
    return "Não foi possível conectar ao servidor (rede/CORS). Recarregue a página; se persistir, contate o suporte.";
  }
  return error instanceof Error ? error.message : "Falha ao carregar tickets.";
}

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      tickets: TicketItem[];
      clientes: TicketClienteOpcao[];
      equipes: TicketEquipeOpcao[];
      requestTypes: TicketReferenciaOpcao[];
      status: TicketReferenciaOpcao[];
    };

export function TicketsPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modalAberto, setModalAberto] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [tickets, clientes, equipes, requestTypes, status] = await Promise.all([
        listarTickets(supabaseTicketsAdapter),
        listarClientesTicket(supabaseTicketsAdapter),
        listarEquipesTicket(supabaseTicketsAdapter),
        listarReferenciaTicket(supabaseTicketsAdapter, "request-type"),
        listarReferenciaTicket(supabaseTicketsAdapter, "status"),
      ]);
      setEstado({ fase: "pronto", tickets, clientes, equipes, requestTypes, status });
    } catch (error) {
      setEstado({ fase: "erro", mensagem: mensagemErroCarregarTickets(error) });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: TicketFormData) {
    if (!user) return;
    setErroAcao(null);
    await criarTicket(supabaseTicketsAdapter, { ...input, userId: user.id });
    setModalAberto(false);
    await carregar();
  }

  async function mudarStatus(ticket: TicketItem, statusId: number) {
    if (!user) return;
    try {
      setErroAcao(null);
      await mudarStatusTicket(supabaseTicketsAdapter, { id: ticket.id, statusId, userId: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível mudar o status.");
    }
  }

  async function arquivar(ticket: TicketItem) {
    if (!user || !confirm(`Arquivar o ticket "${ticket.titulo}"? Fica só local no PCM.`)) return;
    try {
      setErroAcao(null);
      await arquivarTicket(supabaseTicketsAdapter, { id: ticket.id, userId: user.id });
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível arquivar.");
    }
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const statusNome = (id: number | null) =>
    estado.status.find((s) => s.id === id)?.nome ?? (id != null ? `Status ${id}` : "—");

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Tickets</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Chamados de central de atendimento do Auvo — diferente da OS do PCM
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Novo ticket
            </button>
          )}
        </div>
        <div className="mt-3 rounded-[6px] border border-[#F4D28C] bg-[#FFF8E8] px-3 py-2 text-sm text-[#7A4D00]">
          Só o status propaga ao Auvo. Título/descrição, se editados depois de criados, ficam só
          locais — a API do Auvo não documenta edição desses campos.
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {estado.tickets.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <TicketIcon className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum ticket aberto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {estado.tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-[8px] border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold text-ink">{ticket.titulo}</h4>
                  <p className="mt-1 text-xs text-ink-3">
                    {ticket.clienteNome ?? "Sem cliente"} · Auvo {ticket.auvoId ?? "-"} · Sync{" "}
                    {ticket.auvoSyncStatus ?? "pending"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ticket.ativo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#EFF1F4] text-[#5A6175]"}`}
                >
                  {ticket.ativo ? "Ativo" : "Arquivado"}
                </span>
              </div>
              {ticket.descricao && <p className="mt-2 text-sm text-ink-3">{ticket.descricao}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-3">Status:</span>
                {temEscrita && ticket.ativo ? (
                  <select
                    value={ticket.statusId ?? ""}
                    onChange={(event) => mudarStatus(ticket, Number(event.target.value))}
                    className="input h-8 text-xs"
                  >
                    <option value="" disabled>
                      selecionar
                    </option>
                    {estado.status.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-semibold text-ink-2">
                    {statusNome(ticket.statusId)}
                  </span>
                )}
              </div>
              {ticket.auvoSyncError && (
                <p className="mt-2 text-xs text-[#A23B25]">{ticket.auvoSyncError}</p>
              )}
              {temEscrita && ticket.ativo && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => arquivar(ticket)}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-[#F2C0B5] px-3 text-xs font-semibold text-[#A23B25] hover:bg-[#FFF4F1]"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arquivar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalAberto && (
        <NovoTicketModal
          clientes={estado.clientes}
          equipes={estado.equipes}
          requestTypes={estado.requestTypes}
          status={estado.status}
          onCancel={() => setModalAberto(false)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function NovoTicketModal({
  clientes,
  equipes,
  requestTypes,
  status,
  onCancel,
  onSalvar,
}: {
  clientes: TicketClienteOpcao[];
  equipes: TicketEquipeOpcao[];
  requestTypes: TicketReferenciaOpcao[];
  status: TicketReferenciaOpcao[];
  onCancel: () => void;
  onSalvar: (input: TicketFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<TicketFormData>({
    titulo: "",
    descricao: null,
    clienteId: "",
    equipeId: null,
    prioridade: null,
    requestTypeId: null,
    statusId: null,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o ticket.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Novo ticket</h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Título *</span>
            <input
              value={dados.titulo}
              onChange={(event) => setDados((a) => ({ ...a, titulo: event.target.value }))}
              className="input w-full"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Descrição</span>
            <textarea
              value={dados.descricao ?? ""}
              onChange={(event) => setDados((a) => ({ ...a, descricao: event.target.value }))}
              className="input min-h-[80px] w-full resize-y"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Cliente *</span>
            <select
              value={dados.clienteId}
              onChange={(event) => setDados((a) => ({ ...a, clienteId: event.target.value }))}
              className="input w-full"
            >
              <option value="">selecionar</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id} disabled={!cliente.auvoId}>
                  {cliente.nome}
                  {!cliente.auvoId ? " (não sincronizado)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Equipe responsável</span>
            <select
              value={dados.equipeId ?? ""}
              onChange={(event) =>
                setDados((a) => ({ ...a, equipeId: event.target.value || null }))
              }
              className="input w-full"
            >
              <option value="">nenhuma</option>
              {equipes.map((equipe) => (
                <option key={equipe.id} value={equipe.id}>
                  {equipe.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-3">
                Tipo de solicitação
              </span>
              <select
                value={dados.requestTypeId ?? ""}
                onChange={(event) =>
                  setDados((a) => ({
                    ...a,
                    requestTypeId: event.target.value ? Number(event.target.value) : null,
                  }))
                }
                className="input w-full"
              >
                <option value="">selecionar</option>
                {requestTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-3">Status inicial</span>
              <select
                value={dados.statusId ?? ""}
                onChange={(event) =>
                  setDados((a) => ({
                    ...a,
                    statusId: event.target.value ? Number(event.target.value) : null,
                  }))
                }
                className="input w-full"
              >
                <option value="">selecionar</option>
                {status.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Prioridade</span>
            <input
              type="number"
              value={dados.prioridade ?? ""}
              onChange={(event) =>
                setDados((a) => ({
                  ...a,
                  prioridade: event.target.value ? Number(event.target.value) : null,
                }))
              }
              className="input w-full"
            />
          </label>
          {erro && (
            <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
