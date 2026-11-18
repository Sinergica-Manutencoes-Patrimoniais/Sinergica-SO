// ingerir-midia.ts — E02-S37. Pipeline de conferência e gravação de mídia/aviso recebidos pela
// Evolution. A mídia NUNCA é aberta/descomprimida/renderizada no servidor — só baixada,
// conferida por tipo real e tamanho real, e guardada no bucket já existente `atendimento-midias`
// (0063/E02-S21), reusando midia_url/midia_nome/midia_mime (SPEC_DEVIATION em 1852).

import {
  type ConteudoDeAviso,
  type ConteudoDeMidia,
  type EstadoNaoGuardado,
  type MidiaRecebida,
  extensaoPerigosa,
  limiteDe,
  mimeAceito,
  nomeParaChave,
  normalizarMime,
  textoDeAviso,
  textoDeMidiaNaoGuardada,
  textoParaAgente,
} from "../_shared/evolution-midia.ts";
import type { UntypedSupabaseClient } from "../_shared/supabase.ts";

const TAMANHO_MAXIMO_DO_WEBHOOK_BASE64 = 30 * 1024 * 1024; // teto bruto; o real é limiteDe(conteudo)

export interface DependenciasDaIngestaoDeMidia {
  serviceClient: UntypedSupabaseClient;
  fetchEvolution: typeof fetch;
}

export interface ResultadoDaIngestao {
  mensagemId: string | null;
  conversaId: string | null;
  duplicado: boolean;
}

interface ParametrosComuns {
  canalId: string;
  instanceId: string;
  remoteJid: string;
  remoteId: string;
  urlBaseEvolution: string;
  tokenInstancia: string;
  nomeRemotoDaInstancia: string;
}

/** Baixa da Evolution em base64, com teto de bytes conferido no content-length E no corpo (nunca
 * confia só no header). Nunca lança — falha vira null, o chamador decide o estado. */
async function baixarMidia(
  fetchFn: typeof fetch,
  entrada: { urlBase: string; nomeRemoto: string; token: string; remoteId: string; maximoBytes: number },
): Promise<{ bytes: Uint8Array; mimeType: string | null } | null> {
  try {
    const resposta = await fetchFn(
      `${entrada.urlBase.replace(/\/+$/, "")}/chat/getBase64FromMediaMessage/${encodeURIComponent(entrada.nomeRemoto)}`,
      {
        method: "POST",
        headers: { apikey: entrada.token, "content-type": "application/json" },
        body: JSON.stringify({ message: { key: { id: entrada.remoteId } }, convertToMp4: false }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!resposta.ok) return null;
    const maximoBase64 = Math.ceil((entrada.maximoBytes * 4) / 3) + 200;
    const contentLength = Number(resposta.headers.get("content-length") ?? 0);
    if (contentLength > maximoBase64 * 2) return null;
    const corpoTexto = await resposta.text();
    if (corpoTexto.length > Math.min(maximoBase64 * 2, TAMANHO_MAXIMO_DO_WEBHOOK_BASE64)) return null;
    const dados = JSON.parse(corpoTexto) as Record<string, unknown>;
    if (typeof dados.base64 !== "string") return null;
    const codificado = dados.base64.replace(/^data:[^,]+,/, "");
    if (codificado.length > maximoBase64) return null;
    const binario = atob(codificado);
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    return { bytes, mimeType: normalizarMime(dados.mimetype) };
  } catch {
    return null;
  }
}

async function registrar(
  deps: DependenciasDaIngestaoDeMidia,
  comuns: ParametrosComuns,
  args: {
    tipoConteudo: "midia" | "audio" | "texto";
    conteudoRecebido: string | null;
    legenda: string | null;
    conteudo: string | null;
    midiaUrl: string | null;
    midiaNome: string | null;
    midiaMime: string | null;
    anexoEstado: string | null;
  },
): Promise<ResultadoDaIngestao> {
  const { data, error } = await deps.serviceClient
    .schema("atendimento")
    .rpc("fn_registrar_midia_evolution", {
      p_canal_id: comuns.canalId,
      p_event_type: "MESSAGES_UPSERT",
      p_remote_id: comuns.remoteId,
      p_instance_id: comuns.instanceId,
      p_remote_jid: comuns.remoteJid,
      p_tipo_conteudo: args.tipoConteudo,
      p_conteudo_recebido: args.conteudoRecebido,
      p_legenda: args.legenda,
      p_conteudo: args.conteudo,
      p_midia_url: args.midiaUrl,
      p_midia_nome: args.midiaNome,
      p_midia_mime: args.midiaMime,
      p_anexo_estado: args.anexoEstado,
    });
  if (error) throw error;
  const linha = Array.isArray(data) ? data[0] : data;
  return {
    mensagemId: linha?.mensagem_id ?? null,
    conversaId: linha?.conversa_id ?? null,
    duplicado: linha?.duplicado === true,
  };
}

export async function ingerirMidia(
  deps: DependenciasDaIngestaoDeMidia,
  comuns: ParametrosComuns,
  midia: MidiaRecebida,
): Promise<ResultadoDaIngestao> {
  const limite = limiteDe(midia.conteudo);
  let estado: EstadoNaoGuardado | null = null;

  if (extensaoPerigosa(midia.nome) || (midia.mimeType !== "" && !mimeAceito(midia.conteudo, midia.mimeType))) {
    estado = "tipo_nao_aceito";
  } else if (midia.tamanhoDeclarado !== null && midia.tamanhoDeclarado > limite) {
    estado = "acima_do_limite";
  }

  if (estado === null) {
    const baixado = await baixarMidia(deps.fetchEvolution, {
      urlBase: comuns.urlBaseEvolution,
      nomeRemoto: comuns.nomeRemotoDaInstancia,
      token: comuns.tokenInstancia,
      remoteId: comuns.remoteId,
      maximoBytes: limite,
    });
    if (baixado === null) {
      estado = "indisponivel";
    } else {
      const mimeReal = baixado.mimeType ?? midia.mimeType;
      if (baixado.bytes.length === 0) estado = "indisponivel";
      else if (baixado.bytes.length > limite) estado = "acima_do_limite";
      else if (!mimeAceito(midia.conteudo, mimeReal)) estado = "tipo_nao_aceito";
      else {
        const caminho = `${comuns.canalId}/${comuns.remoteId}/${nomeParaChave(midia.nome)}`;
        const { error: erroUpload } = await deps.serviceClient.storage
          .from("atendimento-midias")
          .upload(caminho, baixado.bytes, { contentType: mimeReal, upsert: true });
        if (erroUpload) {
          estado = "indisponivel";
        } else {
          return registrar(deps, comuns, {
            tipoConteudo: midia.conteudo === "figurinha" ? "midia" : "midia",
            conteudoRecebido: midia.conteudo,
            legenda: midia.legenda,
            conteudo: textoParaAgente(midia),
            midiaUrl: caminho,
            midiaNome: midia.nome,
            midiaMime: mimeReal,
            anexoEstado: "guardado",
          });
        }
      }
    }
  }

  return registrar(deps, comuns, {
    tipoConteudo: "texto",
    conteudoRecebido: midia.conteudo,
    legenda: null,
    conteudo: textoDeMidiaNaoGuardada(midia, estado ?? "indisponivel"),
    midiaUrl: null,
    midiaNome: null,
    midiaMime: null,
    anexoEstado: estado ?? "indisponivel",
  });
}

export async function ingerirAviso(
  deps: DependenciasDaIngestaoDeMidia,
  comuns: ParametrosComuns,
  aviso: ConteudoDeAviso,
): Promise<ResultadoDaIngestao> {
  return registrar(deps, comuns, {
    tipoConteudo: "texto",
    conteudoRecebido: aviso,
    legenda: null,
    conteudo: textoDeAviso(aviso),
    midiaUrl: null,
    midiaNome: null,
    midiaMime: null,
    anexoEstado: null,
  });
}

export type { ConteudoDeMidia, ParametrosComuns };
