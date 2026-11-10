import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { criarOsChamadoSchema, type CriacaoOsChamadoGateway, type CriarOsChamado } from "../../application/chamados-os-comando";
import { chamadosOsQueryKeys } from "../../application/chamados-os-queries";
import { supabase } from "../../../../lib/supabase-client";

type Props = {
  habilitado?: string;
  usuario: string;
  cliente: string;
  chamado: string;
  gateway: CriacaoOsChamadoGateway;
  chamadoEsperado: string;
  aoConcluir?: () => void;
};

/** Flag desativada por padrão; servidor mantém gate de escrita fechado. */
export function CriarOsChamado(props: Props) {
  if (props.habilitado !== "true" || props.chamado !== props.chamadoEsperado) return null;
  return <Formulario key={JSON.stringify([props.usuario, props.cliente, props.chamado])} {...props} />;
}

function Formulario({ usuario, cliente, chamado, gateway, aoConcluir }: Props) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<"preventiva" | "corretiva" | "emergencial">("corretiva");
  const chave = `sso-criar-os:${usuario}:${cliente}:${chamado}`;
  const [recuperacao] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(chave);
      const comando = guardado ? criarOsChamadoSchema.parse(JSON.parse(guardado)) : null;
      if (comando && (comando.clienteId !== cliente || comando.chamadoId !== chamado)) throw new Error("contexto divergente");
      return { comando, falhou: false };
    } catch { return { comando: null, falhou: true }; }
  });
  const [pendente, setPendente] = useState<CriarOsChamado | null>(recuperacao.comando);
  const trava = useRef(false);
  const [erro, setErro] = useState("");
  const [reconciliando, setReconciliando] = useState(false);
  const queryClient = useQueryClient();
  const permissao = useQuery({
    queryKey: ["criar-os-revisao", usuario, cliente, chamado],
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      const revisao = await gateway.consultarRevisao(cliente, chamado, signal);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      return revisao;
    },
    enabled: Boolean(usuario && cliente && chamado), gcTime: 0, refetchOnWindowFocus: true,
  });
  const disponivel = !permissao.isPending && !permissao.isFetching && !permissao.isError && permissao.data !== undefined;
  const salvar = useMutation({ mutationFn: (comando: CriarOsChamado) => gateway.criar(comando) });
  async function conferirSessao() {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== usuario) throw new Error("Sessão alterada.");
  }
  function tentativaAtualConfere(comando: CriarOsChamado) {
    const armazenado = sessionStorage.getItem(chave);
    if (!armazenado) return false;
    const atual = criarOsChamadoSchema.safeParse(JSON.parse(armazenado));
    return atual.success && JSON.stringify(atual.data) === JSON.stringify(criarOsChamadoSchema.parse(comando));
  }
  async function enviar(comando: CriarOsChamado) {
    if (trava.current) return;
    trava.current = true;
    setErro("");
    try {
      await conferirSessao();
      if (!tentativaAtualConfere(comando)) throw new Error("Tentativa alterada.");
      await salvar.mutateAsync(comando);
      await queryClient.invalidateQueries({ queryKey: chamadosOsQueryKeys.ordens(usuario, cliente, chamado) });
      await conferirSessao();
      if (!tentativaAtualConfere(comando)) {
        setErro("OS confirmada, mas a tentativa local mudou. Reabra o Chamado e reconcilie antes de criar outra OS.");
        return;
      }
      sessionStorage.removeItem(chave);
      setPendente(null); setTitulo(""); setDescricao("");
      try {
        await queryClient.invalidateQueries({ queryKey: ["s167-resumo-chamados", usuario] });
        void permissao.refetch();
        await queryClient.invalidateQueries({ queryKey: ["s167-quadro-gerencial", usuario, cliente] });
        await queryClient.invalidateQueries({ queryKey: ["chamado-painel", usuario, chamado] });
        aoConcluir?.();
      } catch { setErro("OS confirmada, mas a atualização da tela falhou. Recarregue para conferir."); }
    } catch {
      setErro("Resultado não confirmado. Não crie outra OS até reconciliar esta operação.");
    } finally {
      trava.current = false;
    }
  }
  async function reconciliar(comando: CriarOsChamado) {
    if (trava.current || !gateway.reconciliar) return;
    trava.current = true;
    setReconciliando(true);
    setErro("");
    try {
      await conferirSessao();
      if (!tentativaAtualConfere(comando)) throw new Error("Tentativa alterada.");
      const resposta = await gateway.reconciliar(comando);
      if (resposta.estado === "indeterminado") {
        setErro("Resultado indeterminado: mantenha a tentativa e não crie outra OS. Repita o mesmo pedido ou procure suporte.");
        return;
      }
      await conferirSessao();
      if (!tentativaAtualConfere(comando)) {
        setErro("Resultado confirmado, mas a tentativa local mudou. Reabra o Chamado e reconcilie antes de continuar.");
        return;
      }
      sessionStorage.removeItem(chave);
      setPendente(null); setTitulo(""); setDescricao("");
      try {
        await queryClient.invalidateQueries({ queryKey: chamadosOsQueryKeys.ordens(usuario, cliente, chamado) });
        await queryClient.invalidateQueries({ queryKey: ["s167-resumo-chamados", usuario] });
        void permissao.refetch();
        await queryClient.invalidateQueries({ queryKey: ["s167-quadro-gerencial", usuario, cliente] });
        await queryClient.invalidateQueries({ queryKey: ["chamado-painel", usuario, chamado] });
        aoConcluir?.();
      } catch { setErro("OS confirmada, mas a atualização da tela falhou. Recarregue para conferir."); }
    } catch {
      setErro("Não foi possível reconciliar. Mantenha a tentativa e procure suporte se o problema persistir.");
    } finally {
      trava.current = false;
      setReconciliando(false);
    }
  }
  return <section aria-label="Criar OS do Chamado">
    <p>Criação experimental indisponível até liberação do servidor.</p>
    {permissao.isFetching && <output>Verificando acesso e revisão…</output>}
    {permissao.isError && <p role="alert">Não foi possível verificar acesso e revisão. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>}
    {recuperacao.falhou && <p role="alert">Não foi possível recuperar a operação anterior. Consulte o suporte antes de continuar.</p>}
    {erro && <p role="alert">{erro}</p>}
    {pendente ? <><p>A tentativa pode ser recuperada mesmo se a revisão atual estiver indisponível; o servidor verifica a autorização.</p><button type="button" disabled={salvar.isPending || reconciliando} onClick={() => void enviar(pendente)}>Repetir mesma operação</button>{import.meta.env.VITE_SSO_RECONCILIAR_REQUEST_OS_ENABLED === "true" && gateway.reconciliar && <button type="button" disabled={salvar.isPending || reconciliando} onClick={() => void reconciliar(pendente)}>Consultar resultado do pedido</button>}</> :
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!disponivel || recuperacao.falhou || trava.current) return;
        const validado = criarOsChamadoSchema.safeParse({ requestId: crypto.randomUUID(), expectedRevision: permissao.data,
          chamadoId: chamado, clienteId: cliente, osId: crypto.randomUUID(), titulo,
          descricao: descricao.trim() || null, categoria });
        if (!validado.success) { setErro("Confira os dados e a revisão do Chamado."); return; }
        try {
          if (sessionStorage.getItem(`sso-conversao-integral:${usuario}:${cliente}:${chamado}`) !== null) {
            setErro("Há uma conversão pendente neste Chamado. Resolva-a antes de iniciar outra OS."); return;
          }
          if (sessionStorage.getItem(chave) !== null) throw new Error("operação pendente");
          sessionStorage.setItem(chave, JSON.stringify(validado.data));
        } catch { setErro("Não foi possível guardar a operação; procure suporte antes de continuar."); return; }
        setPendente(validado.data); void enviar(validado.data);
      }}>
        <label>Título da OS <input required maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></label>
        <label>Descrição <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
        <label>Categoria <select value={categoria} onChange={(e) => setCategoria(e.target.value as typeof categoria)}>
          <option value="corretiva">Corretiva</option><option value="preventiva">Preventiva</option><option value="emergencial">Emergencial</option>
        </select></label>
        <button type="submit" disabled={salvar.isPending || reconciliando || !disponivel || recuperacao.falhou}>Criar OS</button>
      </form>}
  </section>;
}
