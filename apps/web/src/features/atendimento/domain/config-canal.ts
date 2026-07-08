export type ModoZe = "off" | "monitor" | "active";

export interface ConfigCanalItem {
  id: string | null;
  clientId: string;
  modo: ModoZe;
  groupJid: string | null;
  botJid: string | null;
}

export interface ConfigCanalFormData {
  clientId: string;
  modo: ModoZe;
  groupJid: string;
  botJid: string;
}

export interface ConfigCanalValidado {
  clientId: string;
  modo: ModoZe;
  groupJid: string | null;
  botJid: string | null;
}

export function validarConfigCanal(input: ConfigCanalFormData): ConfigCanalValidado {
  const clientId = input.clientId.trim();
  if (!clientId) throw new Error("Cliente é obrigatório.");
  const groupJid = input.groupJid.trim();
  const botJid = input.botJid.trim();
  return {
    clientId,
    modo: input.modo,
    groupJid: groupJid || null,
    botJid: botJid || null,
  };
}
