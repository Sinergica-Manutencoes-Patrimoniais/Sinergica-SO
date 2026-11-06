import { useCallback, useEffect, useState } from "react";
import { supabaseOrdemServicoAdapter } from "../../infrastructure/supabase-ordem-servico-adapter";

const prefixo = "sso-confirmar-chamado-os:";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Recupera tentativas da própria aba mesmo quando a OS não está mais na página carregada. */
export function RecuperarConfirmacaoOs({ usuario, revisaoTela, aoConcluir }: { usuario: string; revisaoTela: string | null; aoConcluir: () => Promise<void> | void }) {
  const [itens, setItens] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const consultar = useCallback(() => {
    try {
      const encontrados: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const chave = sessionStorage.key(i);
        if (!chave?.startsWith(prefixo)) continue;
        let partes: unknown;
        try { partes = JSON.parse(chave.slice(prefixo.length)); } catch { continue; }
        if (!Array.isArray(partes) || partes.length !== 2 || partes[0] !== usuario || typeof partes[1] !== "string" || !uuid.test(partes[1])) continue;
        encontrados.push(partes[1]);
      }
      setItens([...new Set(encontrados)].sort());
      setErro("");
    } catch { setErro("Não foi possível consultar as tentativas desta aba. Procure suporte antes de confirmar novamente."); }
  }, [usuario]);
  useEffect(() => { consultar(); }, [consultar, revisaoTela]);
  async function repetir(ordemId: string) {
    if (enviando) return;
    setEnviando(ordemId); setMensagem("");
    try {
      const resultado = await supabaseOrdemServicoAdapter.confirmarChamado({ ordemId, userId: usuario, somenteRepetir: true });
      setMensagem(`Chamado ${resultado.numero} confirmado. Atualize o quadro para conferir.`);
      consultar();
      try { await aoConcluir(); } catch { setMensagem(`Chamado ${resultado.numero} confirmado, mas o quadro não foi atualizado. Atualize para conferir.`); }
    } catch { setMensagem("Resultado não confirmado. Mantenha a tentativa e procure suporte se necessário."); }
    finally { setEnviando(null); }
  }
  if (!itens.length && !erro && !mensagem) return null;
  return <section aria-label="Confirmações pendentes de Chamado">
    <h3>Confirmações pendentes de Chamado</h3>
    <p>São tentativas guardadas nesta aba. Repetir pode concluir uma solicitação ainda não aplicada.</p>
    {erro && <p role="alert">{erro}</p>}
    <ul>{itens.map(id => <li key={id}>OS {id} <button type="button" disabled={enviando !== null} onClick={() => void repetir(id)}>Repetir mesma tentativa</button></li>)}</ul>
    {mensagem && <p role="status">{mensagem}</p>}
  </section>;
}
