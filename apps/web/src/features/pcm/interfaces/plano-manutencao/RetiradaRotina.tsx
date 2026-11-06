import { Button } from "@sinergica/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { retirarRotinaRascunho, validarRetiradaRotina } from "../../application/plano-manutencao";
import type { PlanoResumo, RetirarRotinaCommand, RotinaDetalhe } from "../../application/plano-manutencao-gateway";
import { supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";

export function RetiradaRotina({ userId, clienteId, plano, rotinas, permitirNova, onAtivo, onAtualizar }: {
  userId: string; clienteId: string; plano: PlanoResumo; rotinas: RotinaDetalhe[]; permitirNova: boolean;
  onAtivo: (ativa: boolean) => void; onAtualizar: () => void;
}) {
  const chave = `sso-rotina-retirada:${userId}:${clienteId}:${plano.id}`;
  const queryClient = useQueryClient();
  const [recuperacao] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(chave);
      const comando = salvo ? validarRetiradaRotina(JSON.parse(salvo)) : null;
      if (comando && comando.planoId !== plano.id) throw new Error("Plano divergente.");
      return { comando, falhou: false };
    } catch { return { comando: null, falhou: true }; }
  });
  const [pendente, setPendente] = useState<RetirarRotinaCommand | null>(recuperacao.comando);
  const [aberto, setAberto] = useState(false);
  const [revisaoInicial, setRevisaoInicial] = useState(plano.revisao);
  const [rotinaId, setRotinaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const mudou = aberto && revisaoInicial !== plano.revisao;
  const ativoAnterior = useRef(false);
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  useEffect(() => {
    const ativo = aberto || Boolean(pendente) || recuperacao.falhou;
    if (ativo !== ativoAnterior.current) { ativoAnterior.current = ativo; onAtivo(ativo); }
  }, [aberto, pendente, recuperacao.falhou, onAtivo]);

  async function enviar(comando: RetirarRotinaCommand, primeiraTentativa = false) {
    if (ocupado) return;
    setOcupado(true); setErro("");
    try {
      await conferirSessaoDiagnostico(userId);
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Tentativa divergente.");
      const recibo = await retirarRotinaRascunho(supabasePlanoManutencaoAdapter, comando);
      if (recibo.requestId !== comando.requestId || recibo.aggregateId !== comando.planoId ||
        recibo.revision !== comando.expectedRevision + 1 || recibo.created !== false ||
        recibo.linkedIds.clienteId !== clienteId || recibo.linkedIds.rotinaId !== comando.rotinaId)
        throw new Error("Recibo de retirada divergente.");
      await conferirSessaoDiagnostico(userId);
      if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Tentativa divergente.");
      sessionStorage.removeItem(chave);
      setPendente(null); setAberto(false);
      await queryClient.invalidateQueries({ queryKey: planoManutencaoKeys.raiz(userId, clienteId) }); onAtualizar();
    } catch (falha) {
      const codigo = typeof falha === "object" && falha !== null && "code" in falha ? String(falha.code) : "";
      if (primeiraTentativa && (["22023", "23514"].includes(codigo) || (codigo === "P0011" && typeof falha === "object" && falha !== null && "message" in falha && falha.message === "revisao_obsoleta"))) {
        try {
          await conferirSessaoDiagnostico(userId);
          if (!montado.current) throw new Error("Tela desmontada.");
          if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Tentativa divergente.");
          sessionStorage.removeItem(chave);
          setPendente(null); setAberto(false);
          setErro(codigo === "P0011" ? "O Plano mudou. Confira os dados antes de tentar novamente." : "A retirada foi recusada. Confira os dados do Plano.");
          await queryClient.invalidateQueries({ queryKey: planoManutencaoKeys.raiz(userId, clienteId) }); onAtualizar();
        } catch { setErro("Não foi possível recuperar o pedido. Consulte o suporte."); }
      } else setErro(codigo === "42501" ? "Permissão indisponível. O pedido permanece pendente para conferência." : codigo === "55P03" && typeof falha === "object" && falha !== null && "message" in falha && falha.message === "autorizacao_em_alteracao" ? "As permissões estão sendo atualizadas. Aguarde e repita o mesmo pedido." : "Não foi possível confirmar a retirada. Tente novamente com os mesmos dados.");
    } finally { setOcupado(false); }
  }
  function confirmar() {
    if (ocupado || mudou || !permitirNova) return;
    try {
      const sufixo = `:${userId}:${clienteId}:${plano.id}`;
      for (let i = 0; i < sessionStorage.length; i++) {
        const item = sessionStorage.key(i);
        if (item && item !== chave && item.endsWith(sufixo) && (item.startsWith("sso-rotina-") || item === `sso-plano-revisao${sufixo}`)) {
          setErro("Existe uma operação pendente neste Plano. Confira e resolva o pedido anterior antes de retirar.");
          return;
        }
      }
      const comando = validarRetiradaRotina({ requestId: crypto.randomUUID(), expectedRevision: revisaoInicial, planoId: plano.id, rotinaId, motivo });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Pedido pendente.");
      sessionStorage.setItem(chave, JSON.stringify(comando)); setPendente(comando); void enviar(comando, true);
    } catch { setErro("Confira a Rotina, o motivo e o armazenamento antes de confirmar."); }
  }
  return <section aria-label="Retirada de Rotina" className="space-y-2">
    {recuperacao.falhou && <p role="alert">Não foi possível recuperar a retirada anterior. Consulte o suporte.</p>}
    {erro && <p role="alert">{erro}</p>}
    {mudou && !pendente && <p role="alert">O Plano mudou. Cancele e confira os dados atuais antes de retirar.</p>}
    {pendente && <Button variant="secondary" disabled={ocupado} onClick={() => void enviar(pendente)}>Tentar retirada novamente</Button>}
    {!aberto && !pendente && !recuperacao.falhou && permitirNova && rotinas.length > 0 && <Button variant="secondary" onClick={() => { setRevisaoInicial(plano.revisao); setAberto(true); setErro(""); }}>Retirar Rotina</Button>}
    {aberto && !pendente && !recuperacao.falhou && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); confirmar(); }}>
      <p>A Rotina será removida do rascunho. A versão aprovada será preservada; a recuperação do rascunho depende da auditoria.</p>
      <label className="block">Rotina a retirar <select className="input" required value={rotinaId} onChange={(e) => setRotinaId(e.target.value)}><option value="">Selecione</option>{rotinas.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></label>
      <label className="block">Motivo da retirada <textarea className="input" required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      <Button type="submit" disabled={ocupado || mudou || !permitirNova}>Confirmar retirada</Button>{" "}
      <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setAberto(false)}>Cancelar</Button>
    </form>}
  </section>;
}
