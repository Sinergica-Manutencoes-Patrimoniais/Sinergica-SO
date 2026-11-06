import { useState } from "react";
import { z } from "zod";
import { ConfirmarRetornoPropriedadeFila } from "./ConfirmarRetornoPropriedadeFila";

/** Recupera somente uma tentativa já guardada nesta aba; nunca inicia confirmação nova. */
export function RecuperarConfirmacaoFila({ userId, clienteId, itensCarregados, disponivel }: {
  userId: string; clienteId: string; itensCarregados: string[]; disponivel: boolean;
}) {
  const [entrada, setEntrada] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  function recuperar() {
    const id = z.string().uuid().safeParse(entrada.trim().toLowerCase());
    if (!id.success) { setAviso("Informe o identificador válido do item da fila."); return; }
    if (itensCarregados.includes(id.data)) { setAviso("O item está na lista; use a tentativa exibida nele."); setSelecionado(null); return; }
    try {
      const chave = `sso-confirmar-retorno-fila:${JSON.stringify([userId, clienteId, id.data])}`;
      if (sessionStorage.getItem(chave) === null) { setAviso("Não há tentativa desta sessão para o item informado."); setSelecionado(null); return; }
      setSelecionado(id.data); setAviso("");
    } catch { setAviso("Não foi possível acessar a tentativa desta aba."); setSelecionado(null); }
  }
  const naLista = selecionado !== null && itensCarregados.includes(selecionado);
  return <section aria-label="Recuperar confirmação da fila">
    <p>Para uma tentativa não encontrada nas páginas carregadas, informe o identificador do item usado nesta aba.</p>
    <label>Identificador do item <input value={entrada} disabled={!disponivel} onChange={(e) => { setEntrada(e.target.value); setSelecionado(null); setAviso(""); }} /></label>
    <button type="button" disabled={!disponivel} onClick={recuperar}>Procurar tentativa</button>
    {aviso && <p role="status">{aviso}</p>}
    {naLista && <p role="status">O item está na lista; continue por ela.</p>}
    {selecionado && !naLista && <ConfirmarRetornoPropriedadeFila key={`${userId}:${clienteId}:${selecionado}`} userId={userId} clienteId={clienteId}
      outboxId={selecionado} revisao={1} permitido={false} disponivel={disponivel} />}
  </section>;
}
