// _shared/evolution-url.ts — E02-S35 (ADR-1686). Anti-SSRF para a URL do servidor Evolution
// configurado pela UI: em produção exige HTTPS, sem credencial/query/fragmento embutido, resolve
// DNS a cada chamada (nunca confia num cadastro antigo) e nega loopback/link-local/metadata/rede
// privada por padrão. Falha fechada — nunca assume "provavelmente público".

export interface ResultadoDaValidacaoDeUrl {
  ok: boolean;
  origem?: string;
  motivo?: string;
}

export interface DependenciasDeRede {
  /** Injetável para teste: resolve A/AAAA sem bater em DNS real. */
  resolverDns: (hostname: string) => Promise<string[]>;
  /** `true` relaxa HTTPS/IP privado — só para desenvolvimento local, nunca em produção real. */
  permitirRedePrivada?: boolean;
}

function paraInteiro(ip: string): number | null {
  const partes = ip.split(".");
  if (partes.length !== 4) return null;
  let valor = 0;
  for (const parte of partes) {
    if (!/^\d{1,3}$/.test(parte)) return null;
    const n = Number(parte);
    if (n > 255) return null;
    valor = (valor << 8) | n;
  }
  return valor >>> 0;
}

/** 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16 (link-local/metadata). */
export function ipv4PrivadoOuLoopback(ip: string): boolean {
  const valor = paraInteiro(ip);
  if (valor === null) return false;
  const emFaixa = (base: string, mascaraBits: number): boolean => {
    const baseValor = paraInteiro(base);
    if (baseValor === null) return false;
    const mascara = mascaraBits === 0 ? 0 : (0xffffffff << (32 - mascaraBits)) >>> 0;
    return (valor & mascara) === (baseValor & mascara);
  };
  return (
    emFaixa("127.0.0.0", 8) ||
    emFaixa("10.0.0.0", 8) ||
    emFaixa("172.16.0.0", 12) ||
    emFaixa("192.168.0.0", 16) ||
    emFaixa("169.254.0.0", 16) ||
    emFaixa("0.0.0.0", 8)
  );
}

/** ::1 (loopback), fc00::/7 (ULA), fe80::/10 (link-local). Checagem textual — suficiente para os
 * formatos que `Deno.resolveDns` devolve (sem CIDR aritmético binário em IPv6 aqui). */
export function ipv6PrivadoOuLoopback(ip: string): boolean {
  const normalizado = ip.toLowerCase();
  if (normalizado === "::1" || normalizado === "0:0:0:0:0:0:0:1") return true;
  if (normalizado.startsWith("fe80:") || normalizado.startsWith("fe8") || normalizado.startsWith("fe9")) {
    return true;
  }
  // fc00::/7 cobre fc00:: a fdff:: — primeiro byte 0xfc ou 0xfd.
  const primeiroGrupo = normalizado.split(":")[0] ?? "";
  if (/^f[cd][0-9a-f]{0,2}$/.test(primeiroGrupo)) return true;
  return false;
}

function enderecoPrivadoOuLoopback(ip: string): boolean {
  return ip.includes(":") ? ipv6PrivadoOuLoopback(ip) : ipv4PrivadoOuLoopback(ip);
}

/** Resolve A/AAAA a cada chamada externa; ausência ou erro falha fechado. */
export async function resolverEnderecosPublicos(
  hostname: string,
  deps: DependenciasDeRede,
): Promise<string[]> {
  try {
    return await deps.resolverDns(hostname);
  } catch {
    return [];
  }
}

/**
 * Valida a URL do servidor Evolution ANTES de qualquer chamada de rede ao probe (AC-1). Em
 * produção: HTTPS obrigatório, sem username/password/search/hash, DNS resolvido para endereço
 * público. `permitirRedePrivada` existe só para smoke local contra instância de homologação —
 * nunca ligado no caminho real do produto.
 */
export async function validarUrlDoServidor(
  urlBruta: string,
  deps: DependenciasDeRede,
): Promise<ResultadoDaValidacaoDeUrl> {
  let url: URL;
  try {
    url = new URL(urlBruta);
  } catch {
    return { ok: false, motivo: "url_invalida" };
  }

  if (deps.permitirRedePrivada !== true && url.protocol !== "https:") {
    return { ok: false, motivo: "https_obrigatorio" };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, motivo: "credencial_na_url" };
  }
  if (url.search !== "" || url.hash !== "") {
    return { ok: false, motivo: "query_ou_fragmento_na_url" };
  }

  const enderecos = await resolverEnderecosPublicos(url.hostname, deps);
  if (enderecos.length === 0) {
    return { ok: false, motivo: "dns_nao_resolvido" };
  }
  if (deps.permitirRedePrivada !== true && enderecos.some(enderecoPrivadoOuLoopback)) {
    return { ok: false, motivo: "endereco_privado_ou_loopback" };
  }

  return { ok: true, origem: url.origin };
}

/** Nome remoto derivado do canal — nunca escolhido pelo client (ADR-1686, AC-4). */
export function nomeRemotoDaInstancia(canalId: string): string {
  return `sinergica-${canalId}`;
}
