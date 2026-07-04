export function mencionaZe(content: string, botJid?: string | null): boolean {
  const texto = content.normalize("NFC");
  if (/(^|[^\p{L}\p{N}_])z[eé]($|[^\p{L}\p{N}_])/iu.test(texto)) return true;
  if (!botJid) return false;
  return texto.includes(`@${botJid}`) || texto.includes(botJid);
}

export type ModoZe = "off" | "monitor" | "active";

export function deveAcionarZe(params: {
  content: string;
  modo: ModoZe;
  botJid?: string | null;
}): boolean {
  if (params.modo === "off") return false;
  if (mencionaZe(params.content, params.botJid)) return true;
  return params.modo === "active";
}
