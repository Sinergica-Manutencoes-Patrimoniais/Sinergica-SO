import { supabase } from "../../../lib/supabase-client";
import { enviarXlsxEntreAbas } from "./enviar-xlsx-entre-abas";
import { receberXlsxHttp } from "./receber-xlsx-http";
import { recuperarOrigemXlsx } from "./supabase-recuperar-xlsx";
import { reconciliarTentativaXlsx } from "./reconciliar-tentativa-xlsx";

type Entrada = { userId: string; clienteId: string; fonteId: string; bytes: Uint8Array };
type Travas = { request<T>(nome: string, callback: () => Promise<T>): Promise<T> };

/** Composição usada apenas pela prévia experimental em desenvolvimento; gates permanecem fechados. */
export async function enviarXlsxAutenticado(entrada: Entrada, storage: Pick<Storage, "getItem" | "setItem">, locks: Travas | null) {
  const dados = { ...entrada, bytes: Uint8Array.from(entrada.bytes) };
  return enviarXlsxEntreAbas(dados, storage, locks,
    (pedido) => receberXlsxHttp(pedido, supabase),
    () => recuperarOrigemXlsx(dados.userId, dados.clienteId, dados.fonteId));
}

export async function reconciliarXlsxAutenticado(entrada: Entrada, storage: Pick<Storage, "getItem" | "setItem">, locks: Travas | null) {
  const dados = { ...entrada, bytes: Uint8Array.from(entrada.bytes) };
  await reconciliarTentativaXlsx(dados, storage, locks, () => recuperarOrigemXlsx(dados.userId, dados.clienteId, dados.fonteId));
}
