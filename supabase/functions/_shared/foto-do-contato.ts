// _shared/foto-do-contato.ts — E02-S40. Busca a foto de perfil do WhatsApp do contato (ancorada
// na conversa — a Sinérgica não tem entidade `contato` separada). Dado não confiável: confere a
// URL devolvida (host do WhatsApp), a ASSINATURA do arquivo (não o content-type declarado), o
// tamanho (1 MB), e nunca sobe exceção para o caminho da mensagem — falha aqui é sempre engolida.

export interface EntradaDaFoto {
  canalId: string;
  conversaId: string;
  remoteJid: string;
  nomeRemoto: string;
  tokenInstancia: string;
  urlBaseEvolution: string;
}

export interface DependenciasDaFoto {
  fetchEvolution: typeof fetch;
  reservarConsulta: (conversaId: string) => Promise<boolean>;
  registrarResultado: (
    conversaId: string,
    estado: "guardada" | "sem_foto" | "falhou",
    mime: string | null,
    hash: string | null,
  ) => Promise<void>;
  salvarArquivo: (caminho: string, bytes: Uint8Array, mime: string) => Promise<void>;
}

const TAMANHO_MAXIMO_DA_FOTO = 1024 * 1024;
const HOSTS_PERMITIDOS = [".whatsapp.net"];

const ASSINATURAS: ReadonlyArray<{ mime: "image/jpeg" | "image/png" | "image/webp"; bytes: number[] }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

function extensaoPorMime(mime: string): string {
  return mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
}

/** Confere pelos BYTES reais, nunca pelo content-type declarado pelo servidor (dado não confiável). */
export function mimeDaAssinatura(bytes: Uint8Array): string | null {
  for (const { mime, bytes: assinatura } of ASSINATURAS) {
    if (bytes.length >= assinatura.length && assinatura.every((b, i) => bytes[i] === b)) {
      return mime;
    }
  }
  // WebP: "RIFF" (bytes 0-3) + tamanho + "WEBP" (bytes 8-11).
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function urlDoWhatsapp(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username !== "" || u.password !== "") return false;
    return HOSTS_PERMITIDOS.some((sufixo) => u.hostname.endsWith(sufixo));
  } catch {
    return false;
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function baixarComTeto(
  fetchFn: typeof fetch,
  url: string,
  tetoBytes: number,
): Promise<Uint8Array | null> {
  const resposta = await fetchFn(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!resposta.ok || !resposta.body) return null;
  const leitor = resposta.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > tetoBytes) {
      void leitor.cancel().catch(() => undefined);
      return null;
    }
    pedacos.push(value);
  }
  const bytes = new Uint8Array(total);
  let posicao = 0;
  for (const pedaco of pedacos) {
    bytes.set(pedaco, posicao);
    posicao += pedaco.length;
  }
  return bytes;
}

/** Nunca lança — qualquer falha vira 'falhou' ou é simplesmente engolida (AC-2). */
export async function atualizarFotoDoContato(
  entrada: EntradaDaFoto,
  deps: DependenciasDaFoto,
): Promise<void> {
  try {
    const podeConsultar = await deps.reservarConsulta(entrada.conversaId);
    if (!podeConsultar) return;

    const respostaUrl = await deps.fetchEvolution(
      `${entrada.urlBaseEvolution.replace(/\/+$/, "")}/chat/fetchProfilePictureUrl/${encodeURIComponent(entrada.nomeRemoto)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", apikey: entrada.tokenInstancia },
        body: JSON.stringify({ number: entrada.remoteJid }),
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!respostaUrl.ok) {
      await deps.registrarResultado(entrada.conversaId, "sem_foto", null, null);
      return;
    }
    const corpo = (await respostaUrl.json().catch(() => null)) as Record<string, unknown> | null;
    const urlDaFoto = typeof corpo?.profilePictureUrl === "string" ? corpo.profilePictureUrl : null;
    if (urlDaFoto === null || !urlDoWhatsapp(urlDaFoto)) {
      await deps.registrarResultado(entrada.conversaId, "sem_foto", null, null);
      return;
    }

    const bytes = await baixarComTeto(deps.fetchEvolution, urlDaFoto, TAMANHO_MAXIMO_DA_FOTO);
    if (bytes === null || bytes.length === 0) {
      await deps.registrarResultado(entrada.conversaId, "falhou", null, null);
      return;
    }

    const mime = mimeDaAssinatura(bytes);
    if (mime === null) {
      await deps.registrarResultado(entrada.conversaId, "falhou", null, null);
      return;
    }

    const hash = await sha256Hex(bytes);
    const caminho = `${entrada.conversaId}.${extensaoPorMime(mime)}`;
    await deps.salvarArquivo(caminho, bytes, mime);
    await deps.registrarResultado(entrada.conversaId, "guardada", mime, hash);
  } catch {
    // Falha aqui NUNCA sobe para o caminho da mensagem (AC-2) — best effort, silencioso.
    try {
      await deps.registrarResultado(entrada.conversaId, "falhou", null, null);
    } catch {
      // mesmo o registro de falha pode falhar (ex.: cofre indisponível) — engole de propósito.
    }
  }
}
