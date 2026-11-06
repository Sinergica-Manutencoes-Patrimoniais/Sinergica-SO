import { useState } from "react";
import { AprovarContinuacaoParcela, pedidoContinuacaoParcelaSchema } from "./AprovarContinuacaoParcela";

/** Recupera tentativas da aba mesmo quando a proposta já saiu da lista de pendentes. */
export function RecuperarContinuacoesParcela({ usuario, cliente, chamado }: { usuario: string; cliente: string; chamado: string }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [atualizacao, atualizar] = useState(0);
  const propostas: string[] = []; let invalida = false;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const chave = sessionStorage.key(i); if (!chave?.startsWith("sso-continuacao-parcela:")) continue;
      let contexto: unknown; try { contexto = JSON.parse(chave.slice("sso-continuacao-parcela:".length)); } catch { continue; }
      if (!Array.isArray(contexto) || contexto[0] !== usuario || contexto[1] !== cliente || contexto[2] !== chamado) continue;
      try { const texto = sessionStorage.getItem(chave); if (!texto || texto.length > 16000 || contexto.length !== 4) throw new Error();
        const p = pedidoContinuacaoParcelaSchema.parse(JSON.parse(texto));
        if (p.ator !== usuario || p.foto.clienteId !== cliente || p.foto.chamadoId !== chamado || p.foto.propostaId !== contexto[3]) throw new Error();
        propostas.push(p.foto.propostaId);
      } catch { invalida = true; }
    }
  } catch { invalida = true; }
  if (!propostas.length && !invalida) return null;
  return <section aria-label="Recuperar continuidade de parcela"><h4>Tentativas de continuidade pendentes nesta aba</h4>
    <p>Repita somente o mesmo pedido para confirmar o resultado. A repetição não comprova execução nem envia tarefa ao Auvo.</p>
    {invalida && <p role="alert">Há uma tentativa ilegível. Procure suporte; ela não foi removida.</p>}
    <ul>{propostas.map((proposta) => <li key={proposta}>Proposta {proposta} <button type="button" aria-expanded={aberta===proposta} onClick={() => setAberta(aberta===proposta?null:proposta)}>{aberta===proposta?"Ocultar recuperação":"Recuperar tentativa"}</button>
      {aberta===proposta && <AprovarContinuacaoParcela key={`${proposta}:${atualizacao}`} usuario={usuario} cliente={cliente} chamado={chamado} proposta={proposta} somenteRecuperacao />}</li>)}</ul>
    <button type="button" onClick={() => { setAberta(null); atualizar((n) => n + 1); }}>Atualizar tentativas</button>
  </section>;
}
