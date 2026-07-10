import type { AuvoEntityDescriptor } from "./types.ts";

export interface ClienteRow extends Record<string, unknown> {
  id: string;
  nome: string;
  cnpj?: string | null;
  ativo?: boolean | null;
  endereco?: string | null;
  contato_nome?: string | null;
  contato_telefone?: string | null;
  contato_email?: string | null;
  observacoes?: string | null;
  detalhes?: Record<string, unknown>;
}

export interface AuvoCustomer {
  id?: number;
  externalId?: string;
  name?: string;
  description?: string;
  legalName?: string;
  cpfCnpj?: string;
  phoneNumber?: string[];
  email?: string[];
  note?: string;
  address?: string;
  active?: boolean;
  contacts?: Array<{ name?: string; phoneNumber?: string; email?: string }>;
}

export const clientesDescriptor: AuvoEntityDescriptor<AuvoCustomer, ClienteRow> = {
  key: "clientes",
  auvoBasePath: "/customers",
  pcmTable: "clientes",
  webhookEntity: 7,
  writeEnabled: false,
  deleteStrategy: "soft-patch",
  toAuvo(row) {
    const contato = contatoPrincipal(row);
    return limparVazios({
      name: row.nome,
      legalName: row.nome,
      cpfCnpj: row.cnpj,
      active: row.ativo ?? true,
      address: row.endereco,
      phoneNumber: row.contato_telefone ? [row.contato_telefone] : undefined,
      email: row.contato_email ? [row.contato_email] : undefined,
      note: row.observacoes,
      contacts: contato ? [contato] : undefined,
    }) as AuvoCustomer;
  },
  fromAuvo(auvo) {
    const contato = auvo.contacts?.[0];
    const temContatos = Array.isArray(auvo.contacts) && auvo.contacts.length > 0;
    return {
      nome: textoOuFallback(auvo.name ?? auvo.description ?? auvo.legalName, `Cliente ${auvo.id ?? ""}`.trim()),
      cnpj: textoOuNull(auvo.cpfCnpj),
      ativo: auvo.active ?? true,
      endereco: textoOuNull(auvo.address),
      contato_nome: textoOuNull(contato?.name),
      contato_telefone: textoOuNull(contato?.phoneNumber ?? auvo.phoneNumber?.[0]),
      contato_email: textoOuNull(contato?.email ?? auvo.email?.[0]),
      observacoes: textoOuNull(auvo.note),
      // E01-S51: guarda o array completo de contatos (contacts[0] já vira contato_nome/telefone/
      // email acima) — múltiplos contatos por condomínio (síndico, zelador, administradora) hoje
      // são descartados. Só campo já confirmado (`contacts`), sem nome novo especulativo.
      ...(temContatos ? { detalhes: { contacts: auvo.contacts } } : {}),
    };
  },
};

function contatoPrincipal(row: ClienteRow): { name?: string; phoneNumber?: string; email?: string } | null {
  const contato = limparVazios({
    name: row.contato_nome,
    phoneNumber: row.contato_telefone,
    email: row.contato_email,
  }) as { name?: string; phoneNumber?: string; email?: string };
  return Object.keys(contato).length > 0 ? contato : null;
}

function limparVazios<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }),
  ) as T;
}

function textoOuFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function textoOuNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
