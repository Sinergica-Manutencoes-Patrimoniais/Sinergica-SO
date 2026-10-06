/**
 * Contrato mínimo de observabilidade do cockpit. O evento é deliberadamente pequeno: não aceita
 * nome de cliente, descrição de OS, CPF/CNPJ, fotos nem texto livre. A casca da aplicação pode
 * encaminhar o `CustomEvent` ao provedor de analytics sem acoplar o PCM a ele.
 */
export type EventoCliente360 =
  | {
      nome: "cliente360_drawer_opened";
      clienteId: string;
      tipo: "os" | "preventiva";
    }
  | {
      nome: "cliente360_filter_changed";
      clienteId: string;
      aba: "estrutura" | "componentes" | "sistemas" | "ferramentas";
    }
  | {
      nome: "preventiva_view_changed";
      clienteId: string;
      visao: "lista" | "timeline" | "calendario";
    }
  | { nome: "identificador_recommendations_applied" }
  | {
      nome: "cliente360_mutation_finished";
      clienteId: string;
      recurso: "os" | "preventiva" | "chamado";
      resultado: "sucesso" | "falha";
    };

export const EVENTO_PRODUTO_CLIENTE_360 = "sinergica:produto";

/** Publica uma intenção de produto no browser; em SSR e testes sem DOM é um no-op seguro. */
export function registrarEventoCliente360(evento: EventoCliente360): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(
    new CustomEvent<EventoCliente360>(EVENTO_PRODUTO_CLIENTE_360, { detail: evento }),
  );
}
