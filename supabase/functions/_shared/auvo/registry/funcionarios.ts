import type { AuvoEntityDescriptor } from "./types.ts";

export interface FuncionarioRow extends Record<string, unknown> {
  id: string;
  nome: string;
  equipe?: string | null;
  cargo?: string | null;
  telefone?: string | null;
  email?: string | null;
  culture?: string | null;
  user_type?: number | null;
  ativo?: boolean | null;
}

export interface AuvoUser {
  id?: number;
  userID?: number;
  name?: string;
  team?: string;
  jobPosition?: string;
  phoneNumber?: string;
  email?: string;
  culture?: string;
  userType?: number | { id?: number; description?: string };
  unavailableForTasks?: boolean;
}

export const funcionariosDescriptor: AuvoEntityDescriptor<AuvoUser, FuncionarioRow> = {
  key: "funcionarios",
  auvoBasePath: "/users",
  pcmTable: "funcionarios",
  webhookEntity: 1,
  writeEnabled: false,
  deleteStrategy: "soft-patch",
  deactivatePatch: { unavailableForTasks: true },
  toAuvo(row) {
    return limparVazios({
      name: row.nome,
      culture: row.culture ?? "pt-BR",
      userType: row.user_type ?? 1,
      jobPosition: row.cargo,
      phoneNumber: row.telefone,
      email: row.email,
      unavailableForTasks: row.ativo === false,
    }) as AuvoUser;
  },
  fromAuvo(auvo) {
    const auvoId = auvo.userID ?? auvo.id;
    return {
      auvo_user_id: auvoId,
      nome: textoOuFallback(auvo.name, `Funcionário ${auvoId ?? ""}`.trim()),
      equipe: textoOuNull(auvo.team),
      cargo: textoOuNull(auvo.jobPosition),
      telefone: textoOuNull(auvo.phoneNumber),
      email: textoOuNull(auvo.email),
      culture: textoOuFallback(auvo.culture, "pt-BR"),
      user_type: userTypeId(auvo.userType) ?? 1,
      ativo: auvo.unavailableForTasks !== true,
    };
  },
};

function userTypeId(userType: AuvoUser["userType"]): number | null {
  if (typeof userType === "number") return userType;
  if (typeof userType === "object" && userType?.id != null) return userType.id;
  return null;
}

function limparVazios<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string") return value.trim().length > 0;
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
