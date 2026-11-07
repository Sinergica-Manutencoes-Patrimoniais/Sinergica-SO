import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import type { EdicaoMateriais } from "../../domain/edicao-materiais";
import {
  type SalvarLinhasMateriais,
  supabaseListasMateriaisAdapter,
  validarSalvarLinhasMateriais,
} from "../../infrastructure/supabase-listas-materiais-adapter";
import { EditorMateriais, type RascunhoEditorMateriais } from "./EditorMateriais";
import { HistoricoVersoes } from "./HistoricoVersoes";

type Props = {
  usuario: string;
  cliente: string;
  ordemServico: string;
  listaId: string;
  revisao: number;
  textoOriginal: string;
  rascunho?: RascunhoEditorMateriais;
  onRascunho?: (rascunho: RascunhoEditorMateriais) => void;
  onSalvo?: () => void;
};
export function EditorPersistido(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([props.usuario, props.cliente, props.ordemServico, props.listaId])}
      {...props}
    />
  );
}
function Conteudo({
  usuario,
  cliente,
  ordemServico,
  listaId,
  revisao,
  textoOriginal,
  rascunho,
  onRascunho,
  onSalvo,
}: Props) {
  const chave = `sso-linhas-materiais:${usuario}:${cliente}:${ordemServico}:${listaId}`;
  const [recuperacao] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(chave);
      const comando = guardado ? validarSalvarLinhasMateriais(JSON.parse(guardado)) : null;
      if (comando && comando.listaId !== listaId) throw new Error("Lista divergente.");
      return { comando, falhou: false };
    } catch {
      return { comando: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState(recuperacao.comando);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const emEnvio = useRef(false);
  const queryClient = useQueryClient();
  const dados = useQuery({
    queryKey: ["listas-materiais", usuario, cliente, ordemServico, "linhas", listaId, revisao],
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      const linhas = await supabaseListasMateriaisAdapter.obterLinhas(listaId, revisao, signal);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario || signal.aborted) throw new Error("Sessão alterada.");
      return linhas;
    },
    enabled: !pendente && !recuperacao.falhou,
    gcTime: 0,
  });
  async function enviar(comando: SalvarLinhasMateriais) {
    if (emEnvio.current) throw new Error("Operação em andamento.");
    emEnvio.current = true;
    setOcupado(true);
    setErro("");
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Operação guardada divergente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Sessão ou operação alterada.");
      await supabaseListasMateriaisAdapter.salvarLinhas(comando);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario) throw new Error("Sessão alterada.");
      await queryClient.invalidateQueries({
        queryKey: ["listas-materiais", usuario, cliente, ordemServico, "listas"],
      });
      const atual = await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id !== usuario || sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Operação guardada divergente.");
      sessionStorage.removeItem(chave);
      setPendente(null);
      onSalvo?.();
    } catch (falha) {
      setErro("Não foi possível confirmar o salvamento. Repita a operação ou consulte o suporte.");
      throw falha;
    } finally {
      emEnvio.current = false;
      setOcupado(false);
    }
  }
  async function salvar(edicao: EdicaoMateriais) {
    if (pendente || emEnvio.current || edicao.textoOriginal !== textoOriginal)
      throw new Error("Edição indisponível.");
    const comando = validarSalvarLinhasMateriais({
      requestId: crypto.randomUUID(),
      listaId,
      expectedRevision: revisao,
      linhas: edicao.linhas,
    });
    if (sessionStorage.getItem(chave) !== null) throw new Error("Operação pendente.");
    sessionStorage.setItem(chave, JSON.stringify(comando));
    setPendente(comando);
    await enviar(comando);
  }
  if (recuperacao.falhou)
    return <p role="alert">Não foi possível recuperar edição pendente. Consulte o suporte.</p>;
  if (pendente)
    return (
      <div>
        {erro && <p role="alert">{erro}</p>}
        <p>Edição aguardando confirmação; nenhum dado será substituído.</p>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void enviar(pendente).catch(() => {})}
        >
          Tentar salvar linhas novamente
        </button>
      </div>
    );
  if (dados.isFetching || dados.isPending) return <output>Consultando linhas…</output>;
  if (dados.isError)
    return (
      <p role="alert">
        Não foi possível consultar as linhas.{" "}
        <button type="button" onClick={() => void dados.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  const inicial = dados.data === null ? undefined : { textoOriginal, linhas: dados.data };
  return (
    <><HistoricoVersoes usuario={usuario} cliente={cliente} ordemServico={ordemServico} listaId={listaId} revisao={revisao} /><EditorMateriais
      contexto={JSON.stringify([listaId, revisao])}
      textoOriginal={textoOriginal}
      edicaoInicial={inicial}
      rascunho={rascunho}
      onRascunho={onRascunho}
      salvar={salvar}
    /></>
  );
}
