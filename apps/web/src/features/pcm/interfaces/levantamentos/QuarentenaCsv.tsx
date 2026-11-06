import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import type { DiagnosticoLinhaCsv } from "../../application/importacao-estrutura-csv";
type Props = { userId: string; clienteId: string; chaveOrigem: string; diagnosticos: DiagnosticoLinhaCsv[] | null };
const linha = z.object({ numero: z.number().int().min(2), estado: z.enum(["apta_estruturalmente", "rejeitada"]), celulas: z.array(z.string()).min(1).max(100), erros: z.array(z.string().min(1).max(500)).max(30) }).strict();
const pedido = z.object({ requestId: z.string().uuid(), clienteId: z.string().uuid(), chaveOrigem: z.string().min(1).max(200), linhas: z.array(linha).min(1).max(1000) }).strict(); type Pedido = z.infer<typeof pedido>;
export function QuarentenaCsv(props: Props) { if (import.meta.env.VITE_SSO_QUARENTENA_CSV_ENABLED !== "true") return null; return <Conteudo key={JSON.stringify([props.userId, props.clienteId])} {...props}/>; }
function Conteudo({ userId, clienteId, chaveOrigem, diagnosticos }: Props) {
  const key = `sso-quarentena-csv:${JSON.stringify([userId, clienteId])}`; const client = useQueryClient(); const trava = useRef(false); const [confirmacao, setConfirmacao] = useState<string | null>(null); const [aviso, setAviso] = useState("");
  const fotografia = JSON.stringify({ userId, clienteId, chaveOrigem: chaveOrigem.trim(), diagnosticos });
  const confirmado = confirmacao === fotografia;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => { try { const raw = sessionStorage.getItem(key); if (!raw) return null; const p = pedido.parse(JSON.parse(raw)); return p.clienteId === clienteId ? p : "invalido"; } catch { return "invalido"; } });
  const envio = useMutation({ mutationFn: async (p: Pedido) => {
    const antes = await supabase.auth.getUser();
    if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(key) !== JSON.stringify(p)) throw new Error("Sessão ou tentativa alterada.");
    const { data, error } = await supabase.schema("pcm").rpc("sso_receber_quarentena_autorizada", { p_request_id: p.requestId, p_cliente_id: p.clienteId, p_chave_origem: p.chaveOrigem, p_linhas: p.linhas });
    if (error) throw error;
    const r = z.object({ requestId: z.string().uuid(), quarentenaId: z.string().uuid(), quantidade: z.number().int().positive(), oficialAlterado: z.literal(false) }).strict().parse(data);
    const depois = await supabase.auth.getUser();
    if (depois.error || depois.data.user?.id !== userId || r.requestId !== p.requestId || r.quantidade !== p.linhas.length) throw new Error("Sessão ou resposta divergente.");
  }, onSuccess: async (_r, p) => {
    await client.invalidateQueries({ queryKey: ["quarentena-csv", userId, clienteId, "lotes"] });
    try { const atual = await supabase.auth.getUser(); if (atual.error || atual.data.user?.id !== userId || sessionStorage.getItem(key) !== JSON.stringify(p)) throw new Error(); sessionStorage.removeItem(key); }
    catch { setAviso("Quarentena registrada; tentativa local não foi limpa. Consulte suporte."); return; }
    setPendente(null); setConfirmacao(null); setAviso("Registros não vazios preservados em quarentena: registros aptos e rejeitados separados. Nenhum cadastro oficial ou lote tipado criado.");
  }, onError: () => setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."), onSettled: () => { trava.current = false; } });
  function enviar(p: Pedido) { if (trava.current) return; try { if (sessionStorage.getItem(key) !== JSON.stringify(p)) throw new Error(); trava.current = true; envio.mutate(p); } catch { setAviso("Tentativa local alterada ou indisponível. Consulte suporte."); } }
  function iniciar() { if (pendente || trava.current || !confirmado || !chaveOrigem.trim() || !diagnosticos?.some(d => d.erros.length)) return; try { const linhas = diagnosticos.map(d => ({ numero: d.numero, estado: d.erros.length ? "rejeitada" : "apta_estruturalmente", celulas: d.celulas, erros: d.erros })); const p = pedido.parse({ requestId: crypto.randomUUID(), clienteId, chaveOrigem: chaveOrigem.trim(), linhas }); if (new TextEncoder().encode(JSON.stringify(p.linhas)).length > 900000 || p.linhas.some(l => new TextEncoder().encode(JSON.stringify(l)).length > 30000)) throw new Error("Limite de quarentena excedido"); if (sessionStorage.getItem(key) !== null) throw new Error("Tentativa existente"); sessionStorage.setItem(key, JSON.stringify(p)); setPendente(p); enviar(p); } catch { setAviso("Não foi possível preservar o arquivo: confira tamanho, identificação e sessão. Nenhuma linha foi enviada."); } }
  if (!pendente && !diagnosticos?.some(d => d.erros.length) && !aviso) return null;
  return <section><h4>Preservar arquivo em quarentena</h4><p>Preserva células dos registros não vazios, não os bytes originais do arquivo, separando aptos estruturais e rejeitados. Diagnósticos são declarados, não validam o cadastro. Nenhum registro será incorporado ou enviado ao lote tipado nesta etapa. Quando habilitada, a revisão de quarentenas permite corrigir e conferir antes de reconciliar. Conteúdo pode conter dados sensíveis e ficará temporariamente nesta sessão para retry.</p>{pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}{pendente && pendente !== "invalido" ? <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>Repetir recepção em quarentena</button> : !pendente && diagnosticos?.some(d => d.erros.length) && <><label><input type="checkbox" checked={confirmado} onChange={e => setConfirmacao(e.target.checked ? fotografia : null)}/> Autorizo guardar os registros não vazios em quarentena privada para este Cliente.</label><button type="button" disabled={!confirmado || !chaveOrigem.trim() || envio.isPending} onClick={iniciar}>Preservar em quarentena</button></>}{aviso && <p role="status">{aviso}</p>}</section>;
}
