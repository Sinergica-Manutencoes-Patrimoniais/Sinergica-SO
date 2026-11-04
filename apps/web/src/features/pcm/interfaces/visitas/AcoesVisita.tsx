import { Button } from "@sinergica/ui";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ZodError } from "zod";
import { criarOperacoesVisita, type OperacaoVisita } from "../../application/visitas";
import type { VisitaDetalhe } from "../../application/visitas-gateway";
import { supabaseVisitasAdapter } from "../../infrastructure/supabase-visitas-adapter";
import { converterHorarioLocal, horarioNoDispositivo } from "./horario-local";

export function AcoesVisita({ userId, clienteId, visita, bloqueado }: { userId: string; clienteId: string; visita: VisitaDetalhe; bloqueado: boolean }) {
  const queryClient = useQueryClient();
  const [recuperacao] = useState(() => {
    try {
      const operacoes = criarOperacoesVisita(supabaseVisitasAdapter, sessionStorage, { usuarioId: userId, clienteId, visitaId: visita.id });
      return { operacoes, pendente: operacoes.pendente(), falhou: false };
    } catch { return { operacoes: null, pendente: null, falhou: true }; }
  });
  const [pendente, setPendente] = useState<OperacaoVisita | null>(recuperacao.pendente);
  const [escolha, alterarEscolha] = useState<"planejar" | "confirmar" | "registrarCiencia" | "associarOs" | "adicionarMembro" | "definirResponsavel" | "encerrarMembro" | "desvincularOs" | "editarProgramacao" | "editarPosicao" | null>(null);
  const [revisaoEscolha, setRevisaoEscolha] = useState<number | null>(null);
  function setEscolha(valor: typeof escolha) {
    setRevisaoEscolha(valor === null ? null : visita.revisao);
    alterarEscolha(valor);
  }
  const revisaoMudou = escolha !== null && revisaoEscolha !== visita.revisao;
  const [dataCiencia, setDataCiencia] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [canal, setCanal] = useState("");
  const [observacao, setObservacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [deslocamento, setDeslocamento] = useState("");
  const [area, setArea] = useState("");
  const [local, setLocal] = useState("");
  const [buscaArea, setBuscaArea] = useState("");
  const [buscaLocal, setBuscaLocal] = useState("");
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState("");
  const [sequencia, setSequencia] = useState("");
  const [papel, setPapel] = useState("");
  const [estimativa, setEstimativa] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [armazenamentoFalhou, setArmazenamentoFalhou] = useState(false);
  const osDisponiveis = useInfiniteQuery({ queryKey: ["visitas", userId, clienteId, visita.id, "selecionar-os", busca],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => supabaseVisitasAdapter.selecionarOs({ clienteId, visitaId: visita.id, busca, limite: 20, apos: pageParam }, signal),
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina[pagina.length - 1]?.id : undefined,
    enabled: escolha === "associarOs" && !bloqueado && !pendente, gcTime: 0 });
  const pessoasDisponiveis = useInfiniteQuery({ queryKey: ["visitas", userId, clienteId, visita.id, "selecionar-pessoas", escolha === "adicionarMembro", busca],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => supabaseVisitasAdapter.selecionarFuncionarios({ clienteId, visitaId: visita.id, excluirVinculados: escolha === "adicionarMembro", busca, limite: 20, apos: pageParam }, signal),
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina[pagina.length - 1]?.id : undefined,
    enabled: (escolha === "adicionarMembro" || escolha === "definirResponsavel") && !bloqueado && !pendente, gcTime: 0 });
  const equipeVigente = useInfiniteQuery({ queryKey: ["visitas", userId, clienteId, visita.id, "equipe-para-encerrar"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => supabaseVisitasAdapter.listarEquipe({ clienteId, visitaId: visita.id, incluirHistorico: false, limite: 20, aposId: pageParam }, signal),
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina[pagina.length - 1]?.id : undefined,
    enabled: escolha === "encerrarMembro" && !bloqueado && !pendente, gcTime: 0 });
  const osVigentes = useInfiniteQuery({ queryKey: ["visitas", userId, clienteId, visita.id, "os-para-desvincular"],
    initialPageParam: null as { sequencia: number; id: string } | null,
    queryFn: ({ pageParam, signal }) => supabaseVisitasAdapter.listarOs({ clienteId, visitaId: visita.id, incluirHistorico: false, limite: 20, apos: pageParam }, signal),
    getNextPageParam: (pagina) => pagina.length === 20 ? { sequencia: pagina[pagina.length - 1]!.sequencia, id: pagina[pagina.length - 1]!.id } : undefined,
    enabled: escolha === "desvincularOs" && !bloqueado && !pendente, gcTime: 0 });
  const areas = useInfiniteQuery({ queryKey: ["visitas", userId, clienteId, visita.id, "posicoes", "area", buscaArea],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => supabaseVisitasAdapter.selecionarPosicoes({ clienteId, visitaId: visita.id, tipo: "area", areaId: null, busca: buscaArea, limite: 20, apos: pageParam }, signal),
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina[pagina.length - 1]?.id : undefined,
    enabled: escolha === "editarPosicao" && !bloqueado && !pendente, gcTime: 0 });
  const locais = useInfiniteQuery({ queryKey: ["visitas", userId, clienteId, visita.id, "posicoes", "local", area, buscaLocal],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => supabaseVisitasAdapter.selecionarPosicoes({ clienteId, visitaId: visita.id, tipo: "local", areaId: area, busca: buscaLocal, limite: 20, apos: pageParam }, signal),
    getNextPageParam: (pagina) => pagina.length === 20 ? pagina[pagina.length - 1]?.id : undefined,
    enabled: escolha === "editarPosicao" && Boolean(area) && area !== "sem" && !bloqueado && !pendente, gcTime: 0 });

  const consultaSelecao = escolha === "associarOs" ? osDisponiveis : pessoasDisponiveis;
  const selecaoAtual = Boolean(selecionado) && consultaSelecao.data?.pages.some((pagina) => pagina.some((item) => item.id === selecionado)) === true;
  const selecaoBloqueada = consultaSelecao.isPending || consultaSelecao.isFetching || consultaSelecao.isError || !selecaoAtual;
  const consultaVinculo = escolha === "desvincularOs" ? osVigentes : equipeVigente;
  const vinculoAtual = Boolean(selecionado) && consultaVinculo.data?.pages.some((pagina) => pagina.some((item) => item.id === selecionado)) === true;
  const vinculoBloqueado = consultaVinculo.isPending || consultaVinculo.isFetching || consultaVinculo.isError || !vinculoAtual;
  const areaAtual = area === "sem" || (Boolean(area) && areas.data?.pages.some((pagina) => pagina.some((item) => item.id === area)) === true);
  const localAtual = !local || locais.data?.pages.some((pagina) => pagina.some((item) => item.id === local)) === true;
  const posicaoBloqueada = areas.isPending || areas.isFetching || areas.isError || !areaAtual
    || (area !== "sem" && (locais.isPending || locais.isFetching || locais.isError || !localAtual));

  async function enviar(repetir: boolean) {
    if (!recuperacao.operacoes || ocupado || bloqueado || (!repetir && revisaoMudou)) return;
    if (!repetir && (escolha === "associarOs" || escolha === "adicionarMembro" || escolha === "definirResponsavel") && selecaoBloqueada) return;
    if (!repetir && (escolha === "desvincularOs" || escolha === "encerrarMembro") && vinculoBloqueado) return;
    if (!repetir && escolha === "editarPosicao" && posicaoBloqueada) return;
    setOcupado(true); setErro(""); setMensagem("");
    try {
      const base = { requestId: repetir ? "" : crypto.randomUUID(), expectedRevision: visita.revisao, visitaId: visita.id };
      const resultado = repetir ? await recuperacao.operacoes.repetir() : escolha === "registrarCiencia"
        ? await recuperacao.operacoes.iniciar({ tipo: "registrarCiencia", comando: { ...base,
          cienciaEm: converterHorarioLocal(dataCiencia), responsavel, canal, observacao } })
        : escolha === "associarOs" ? await recuperacao.operacoes.iniciar({ tipo: "associarOs", comando: { ...base,
          osId: selecionado, vinculoId: crypto.randomUUID(), sequencia: Number(sequencia), estimativaMinutos: estimativa === "" ? null : Number(estimativa) } })
        : escolha === "adicionarMembro" ? await recuperacao.operacoes.iniciar({ tipo: "adicionarMembro", comando: { ...base,
          funcionarioId: selecionado, participacaoId: crypto.randomUUID(), papel, estimativaMinutos: estimativa === "" ? null : Number(estimativa) } })
        : escolha === "definirResponsavel" ? await recuperacao.operacoes.iniciar({ tipo: "editar", comando: { ...base,
          areaId: visita.areaId, localId: visita.localId, inicioEm: visita.inicioEm, fimEm: visita.fimEm, fuso: visita.fuso,
          responsavelId: selecionado, deslocamentoMinutos: visita.deslocamentoMinutos } })
        : escolha === "editarProgramacao" ? await recuperacao.operacoes.iniciar({ tipo: "editar", comando: { ...base,
          areaId: visita.areaId, localId: visita.localId,
          inicioEm: inicio === horarioNoDispositivo(visita.inicioEm) ? visita.inicioEm : converterHorarioLocal(inicio),
          fimEm: fim === horarioNoDispositivo(visita.fimEm) ? visita.fimEm : converterHorarioLocal(fim),
          fuso: visita.fuso, responsavelId: visita.responsavelId, deslocamentoMinutos: Number(deslocamento) } })
        : escolha === "editarPosicao" ? await recuperacao.operacoes.iniciar({ tipo: "editar", comando: { ...base,
          areaId: area === "sem" ? null : area, localId: area === "sem" ? null : local || null,
          inicioEm: visita.inicioEm, fimEm: visita.fimEm, fuso: visita.fuso, responsavelId: visita.responsavelId, deslocamentoMinutos: visita.deslocamentoMinutos } })
        : escolha === "encerrarMembro" ? await recuperacao.operacoes.iniciar({ tipo: "encerrarMembro", comando: { ...base,
          participacaoId: selecionado, motivo } })
        : escolha === "desvincularOs" ? await recuperacao.operacoes.iniciar({ tipo: "desvincularOs", comando: { ...base,
          vinculoId: selecionado, motivo } })
        : escolha === "planejar" || escolha === "confirmar"
          ? await recuperacao.operacoes.iniciar({ tipo: escolha, comando: base })
          : (() => { throw new Error("Selecione uma operação."); })();
      const operacaoAtual = recuperacao.operacoes.pendente();
      setPendente(operacaoAtual); setEscolha(null);
      setMensagem(operacaoAtual ? "A operação anterior terminou. Há outra operação pendente para recuperar."
        : resultado.warnings.includes("ciencia_cliente_exigida_antes_envio")
        ? "Confirmação PCM registrada. Ciência do Cliente é exigida antes do envio."
        : "Operação registrada. Nenhuma tarefa foi enviada ao Auvo.");
      await queryClient.invalidateQueries({ queryKey: ["visitas", userId, clienteId] });
    } catch (falha) {
      try {
        const atual = recuperacao.operacoes.pendente();
        setPendente(atual);
        const codigo = typeof falha === "object" && falha !== null && "code" in falha ? String(falha.code) : "";
        const detalhe = typeof falha === "object" && falha !== null && "message" in falha ? String(falha.message) : "";
        const impedimentoMaterial = codigo === "23514" && detalhe === "visita_com_impedimento_material";
        if (!atual && (falha instanceof ZodError || falha instanceof RangeError)) {
          setErro(falha instanceof RangeError ? "Horário inválido ou repetido na mudança de fuso. Escolha outro horário." : "Confira os dados informados, incluindo datas e horários, antes de salvar.");
          return;
        }
        if (atual) setErro(impedimentoMaterial
          ? "A confirmação encontrou impedimento de material em uma OS. Confira a composição e a tentativa pendente antes de repetir."
          : codigo === "42501"
          ? "Permissão indisponível. A operação permanece pendente; peça acesso antes de tentar novamente."
          : "Não foi possível confirmar o resultado. Tente a mesma operação novamente.");
        else {
          setEscolha(null);
          setErro(impedimentoMaterial ? "A confirmação encontrou impedimento de material em uma OS. Confira a composição."
            : codigo === "40001" ? "A Visita mudou. Confira a revisão atual antes de tentar novamente."
            : codigo === "42501" ? "Você não tem mais permissão para esta operação."
              : "A operação foi recusada. Confira responsável, equipe, OS e estado da Visita.");
          await queryClient.invalidateQueries({ queryKey: ["visitas", userId, clienteId] });
        }
      } catch { setArmazenamentoFalhou(true); setErro("Não foi possível recuperar a operação. Consulte o suporte antes de continuar."); }
    } finally { setOcupado(false); }
  }
  return <section aria-label="Ações da Visita" className="space-y-2">
    {recuperacao.falhou && <p role="alert">Não foi possível recuperar operação anterior. Consulte o suporte antes de continuar.</p>}
    {erro && <p role="alert">{erro}</p>}{mensagem && <output>{mensagem}</output>}
    {revisaoMudou && !pendente && <p role="alert">A Visita mudou enquanto esta ação estava aberta. Cancele, confira os dados atuais e tente novamente.</p>}
    {pendente && <Button variant="secondary" disabled={ocupado || bloqueado || armazenamentoFalhou} onClick={() => void enviar(true)}>Tentar operação novamente</Button>}
    {!recuperacao.falhou && !armazenamentoFalhou && !pendente && !escolha && visita.estado === "rascunho" && <Button variant="secondary" disabled={ocupado || bloqueado} onClick={() => setEscolha("planejar")}>Planejar Visita</Button>}
    {!recuperacao.falhou && !armazenamentoFalhou && !pendente && !escolha && visita.estado === "planejada" && <Button variant="secondary" disabled={ocupado || bloqueado} onClick={() => setEscolha("confirmar")}>Confirmar Visita</Button>}
    {!recuperacao.falhou && !armazenamentoFalhou && !pendente && !escolha && ["planejada", "confirmada"].includes(visita.estado) && <Button variant="secondary" disabled={ocupado || bloqueado} onClick={() => setEscolha("registrarCiencia")}>Registrar ciência do Cliente</Button>}
    {!recuperacao.falhou && !armazenamentoFalhou && !pendente && !escolha && ["rascunho", "planejada"].includes(visita.estado) && <>
      <Button variant="secondary" disabled={ocupado || bloqueado} onClick={() => { setBusca(""); setSelecionado(""); setEstimativa(""); setEscolha("associarOs"); }}>Adicionar OS</Button>{" "}
      <Button variant="secondary" disabled={ocupado || bloqueado} onClick={() => { setBusca(""); setSelecionado(""); setEstimativa(""); setEscolha("adicionarMembro"); }}>Adicionar pessoa</Button>{" "}
      <Button variant="secondary" disabled={ocupado || bloqueado} onClick={() => { setBusca(""); setSelecionado(""); setEscolha("definirResponsavel"); }}>Definir responsável</Button>{" "}
      <Button variant="secondary" disabled={ocupado || bloqueado} onClick={() => { setSelecionado(""); setMotivo(""); setEscolha("encerrarMembro"); }}>Encerrar participação</Button>{" "}
      <Button variant="secondary" disabled={ocupado || bloqueado} onClick={() => { setSelecionado(""); setMotivo(""); setEscolha("desvincularOs"); }}>Desvincular OS</Button>{" "}
      <Button variant="secondary" disabled={ocupado || bloqueado} onClick={() => { setInicio(horarioNoDispositivo(visita.inicioEm)); setFim(horarioNoDispositivo(visita.fimEm)); setDeslocamento(String(visita.deslocamentoMinutos)); setEscolha("editarProgramacao"); }}>Editar programação</Button>{" "}
      <Button variant="secondary" disabled={ocupado || bloqueado} onClick={() => { setArea(""); setLocal(""); setBuscaArea(""); setBuscaLocal(""); setEscolha("editarPosicao"); }}>Editar posição</Button>
    </>}
    {escolha === "editarPosicao" && !pendente && !armazenamentoFalhou && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void enviar(false); }}>
      <p>Selecione a posição atual ou escolha remover a posição. A seleção usa o cadastro atual; a posição anterior pode ter mudado.</p>
      <label className="block">Buscar Área <input className="input" maxLength={120} value={buscaArea} onChange={(e) => { setBuscaArea(e.target.value); setArea(""); setLocal(""); setBuscaLocal(""); }} /></label>
      {areas.isPending && <output>Carregando Áreas...</output>}
      {areas.isError && <p role="alert">Não foi possível carregar Áreas. <button type="button" onClick={() => void areas.refetch()}>Tentar novamente</button></p>}
      <label className="block">Área da Visita <select className="input" required value={area} onChange={(e) => { setArea(e.target.value); setLocal(""); setBuscaLocal(""); }}><option value="">Selecione</option><option value="sem">Sem Área e Local</option>
        {!areas.isError && areas.data?.pages.flat().map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</select></label>
      {areas.data && !areas.isError && areas.data.pages.flat().length === 0 && <p>Nenhuma Área encontrada.</p>}
      {areas.hasNextPage && <Button type="button" variant="secondary" disabled={areas.isFetchingNextPage} onClick={() => void areas.fetchNextPage()}>Mais Áreas</Button>}
      {area && area !== "sem" && <>
        <label className="block">Buscar Local <input className="input" maxLength={120} value={buscaLocal} onChange={(e) => { setBuscaLocal(e.target.value); setLocal(""); }} /></label>
        {locais.isPending && <output>Carregando Locais...</output>}
        {locais.isError && <p role="alert">Não foi possível carregar Locais. <button type="button" onClick={() => void locais.refetch()}>Tentar novamente</button></p>}
        <label className="block">Local da Visita <select className="input" value={local} onChange={(e) => setLocal(e.target.value)}><option value="">Sem Local específico</option>
          {!locais.isError && locais.data?.pages.flat().map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></label>
        {locais.data && !locais.isError && locais.data.pages.flat().length === 0 && <p>Nenhum Local encontrado.</p>}
        {locais.hasNextPage && <Button type="button" variant="secondary" disabled={locais.isFetchingNextPage} onClick={() => void locais.fetchNextPage()}>Mais Locais</Button>}
      </>}
      {area && (!areaAtual || !localAtual) && !areas.isFetching && !locais.isFetching && !areas.isError && !locais.isError && <p role="alert">A seleção deixou de estar disponível. Escolha outra opção.</p>}
      <Button type="submit" disabled={ocupado || bloqueado || revisaoMudou || posicaoBloqueada}>Salvar posição</Button>{" "}
      <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setEscolha(null)}>Cancelar</Button>
    </form>}
    {escolha === "editarProgramacao" && !pendente && !armazenamentoFalhou && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void enviar(false); }}>
      <p>Horários no fuso deste dispositivo: {Intl.DateTimeFormat().resolvedOptions().timeZone}. O fuso cadastrado da Visita permanece {visita.fuso}.</p>
      <label className="block">Novo início da Visita <input className="input" type="datetime-local" required value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
      <label className="block">Novo fim da Visita <input className="input" type="datetime-local" required value={fim} onChange={(e) => setFim(e.target.value)} /></label>
      <label className="block">Deslocamento em minutos <input className="input" type="number" min="0" step="1" required value={deslocamento} onChange={(e) => setDeslocamento(e.target.value)} /></label>
      <Button type="submit" disabled={ocupado || bloqueado || revisaoMudou}>Salvar programação</Button>{" "}
      <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setEscolha(null)}>Cancelar</Button>
    </form>}
    {escolha === "desvincularOs" && !pendente && !armazenamentoFalhou && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void enviar(false); }}>
      <p>O vínculo fica no histórico; a OS não é excluída.</p>
      {osVigentes.isPending && <output>Carregando OS vinculadas...</output>}
      {osVigentes.isError && <p role="alert">Não foi possível carregar OS. <button type="button" onClick={() => void osVigentes.refetch()}>Tentar novamente</button></p>}
      <label className="block">Vínculo de OS <select className="input" required value={selecionado} onChange={(e) => setSelecionado(e.target.value)}><option value="">Selecione</option>
        {!osVigentes.isError && osVigentes.data?.pages.flat().map((o) => <option key={o.id} value={o.id}>{o.numero} — {o.titulo}</option>)}</select></label>
      {osVigentes.data && !osVigentes.isError && osVigentes.data.pages.flat().length === 0 && <p>Nenhuma OS vinculada.</p>}
      {osVigentes.hasNextPage && <Button type="button" variant="secondary" disabled={osVigentes.isFetchingNextPage} onClick={() => void osVigentes.fetchNextPage()}>Mais OS vinculadas</Button>}
      <label className="block">Motivo da desvinculação <textarea className="input" required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      {selecionado && !vinculoAtual && !osVigentes.isFetching && !osVigentes.isError && <p role="alert">A seleção deixou de estar disponível. Escolha outra opção.</p>}
      <Button type="submit" disabled={ocupado || bloqueado || revisaoMudou || vinculoBloqueado}>Confirmar desvinculação</Button>{" "}
      <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setEscolha(null)}>Cancelar</Button>
    </form>}
    {escolha === "encerrarMembro" && !pendente && !armazenamentoFalhou && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void enviar(false); }}>
      <p>O encerramento preserva o histórico da participação.</p>
      {equipeVigente.isPending && <output>Carregando equipe...</output>}
      {equipeVigente.isError && <p role="alert">Não foi possível carregar a equipe. <button type="button" onClick={() => void equipeVigente.refetch()}>Tentar novamente</button></p>}
      <label className="block">Participação <select className="input" required value={selecionado} onChange={(e) => setSelecionado(e.target.value)}><option value="">Selecione</option>
        {!equipeVigente.isError && equipeVigente.data?.pages.flat().map((p) => <option key={p.id} value={p.id}>{p.nome} — {p.papel}</option>)}</select></label>
      {equipeVigente.data && !equipeVigente.isError && equipeVigente.data.pages.flat().length === 0 && <p>Nenhuma participação vigente.</p>}
      {equipeVigente.hasNextPage && <Button type="button" variant="secondary" disabled={equipeVigente.isFetchingNextPage} onClick={() => void equipeVigente.fetchNextPage()}>Mais integrantes</Button>}
      <label className="block">Motivo do encerramento <textarea className="input" required maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      {selecionado && !vinculoAtual && !equipeVigente.isFetching && !equipeVigente.isError && <p role="alert">A seleção deixou de estar disponível. Escolha outra opção.</p>}
      <Button type="submit" disabled={ocupado || bloqueado || revisaoMudou || vinculoBloqueado}>Confirmar encerramento</Button>{" "}
      <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setEscolha(null)}>Cancelar</Button>
    </form>}
    {(escolha === "associarOs" || escolha === "adicionarMembro" || escolha === "definirResponsavel") && !pendente && !armazenamentoFalhou && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void enviar(false); }}>
      <p>{escolha === "associarOs" ? "Selecione uma OS disponível do Cliente. O servidor confere o vínculo ao salvar." : "Selecione uma pessoa ativa. A disponibilidade ainda não é verificada."}</p>
      <label className="block">Buscar {escolha === "associarOs" ? "OS" : "pessoa"} <input className="input" maxLength={120} value={busca} onChange={(e) => { setBusca(e.target.value); setSelecionado(""); }} /></label>
      {escolha === "associarOs" ? <>
        {osDisponiveis.isPending && <output>Carregando OS disponíveis...</output>}
        {osDisponiveis.isError && <p role="alert">Não foi possível buscar OS. <button type="button" onClick={() => void osDisponiveis.refetch()}>Tentar novamente</button></p>}
        <label className="block">Ordem de Serviço <select className="input" required value={selecionado} onChange={(e) => setSelecionado(e.target.value)}><option value="">Selecione</option>
          {osDisponiveis.data?.pages.flat().map((o) => <option key={o.id} value={o.id}>{o.numero} — {o.titulo} ({o.status})</option>)}</select></label>
        {osDisponiveis.data && osDisponiveis.data.pages.flat().length === 0 && <p>Nenhuma OS disponível nesta busca.</p>}
        {osDisponiveis.hasNextPage && <Button type="button" variant="secondary" disabled={osDisponiveis.isFetchingNextPage} onClick={() => void osDisponiveis.fetchNextPage()}>Mais OS disponíveis</Button>}
        <label className="block">Sequência da OS <input className="input" type="number" min="1" step="1" required value={sequencia} onChange={(e) => setSequencia(e.target.value)} /></label>
      </> : <>
        {pessoasDisponiveis.isPending && <output>Carregando pessoas...</output>}
        {pessoasDisponiveis.isError && <p role="alert">Não foi possível buscar pessoas. <button type="button" onClick={() => void pessoasDisponiveis.refetch()}>Tentar novamente</button></p>}
        <label className="block">{escolha === "definirResponsavel" ? "Responsável da Visita" : "Pessoa da equipe"} <select className="input" required value={selecionado} onChange={(e) => setSelecionado(e.target.value)}><option value="">Selecione</option>
          {pessoasDisponiveis.data?.pages.flat().map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        {pessoasDisponiveis.data && pessoasDisponiveis.data.pages.flat().length === 0 && <p>Nenhuma pessoa disponível nesta busca.</p>}
        {pessoasDisponiveis.hasNextPage && <Button type="button" variant="secondary" disabled={pessoasDisponiveis.isFetchingNextPage} onClick={() => void pessoasDisponiveis.fetchNextPage()}>Mais pessoas disponíveis</Button>}
        {escolha === "adicionarMembro" && <label className="block">Papel na Visita <input className="input" required maxLength={120} value={papel} onChange={(e) => setPapel(e.target.value)} /></label>}
      </>}
      {escolha !== "definirResponsavel" && <label className="block">{escolha === "associarOs" ? "Tempo estimado da OS (minutos)" : "Tempo estimado da pessoa (minutos)"} <input className="input" type="number" min={escolha === "associarOs" ? "0" : "1"} step="1" value={estimativa} onChange={(e) => setEstimativa(e.target.value)} /></label>}
      {selecionado && !selecaoAtual && !consultaSelecao.isFetching && !consultaSelecao.isError && <p role="alert">A seleção deixou de estar disponível. Escolha outra opção.</p>}
      <Button type="submit" disabled={ocupado || bloqueado || revisaoMudou || selecaoBloqueada}>{escolha === "associarOs" ? "Associar OS" : escolha === "definirResponsavel" ? "Salvar responsável" : "Salvar pessoa"}</Button>{" "}
      <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setEscolha(null)}>Cancelar</Button>
    </form>}
    {escolha === "registrarCiencia" && !pendente && !armazenamentoFalhou && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void enviar(false); }}>
      <p>Registre a informação recebida do Cliente. Isso não confirma o PCM nem envia tarefas.</p>
      <p>Horário no fuso deste dispositivo: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      <label className="block">Data e hora da ciência <input className="input" type="datetime-local" required value={dataCiencia} onChange={(e) => setDataCiencia(e.target.value)} /></label>
      <label className="block">Responsável do Cliente <input className="input" required maxLength={200} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} /></label>
      <label className="block">Canal <input className="input" required maxLength={120} value={canal} onChange={(e) => setCanal(e.target.value)} /></label>
      <label className="block">Observação <textarea className="input" required maxLength={2000} value={observacao} onChange={(e) => setObservacao(e.target.value)} /></label>
      <Button type="submit" disabled={ocupado || bloqueado || revisaoMudou}>Salvar ciência</Button>{" "}
      <Button type="button" variant="secondary" disabled={ocupado} onClick={() => setEscolha(null)}>Cancelar</Button>
    </form>}
    {(escolha === "confirmar" || escolha === "planejar") && !pendente && !armazenamentoFalhou && <div><p>{escolha === "confirmar"
      ? "Confirmar esta revisão pelo PCM? Isso não envia tarefas ao Auvo."
      : "Planejar este rascunho? Isso não confirma a Visita nem envia tarefas ao Auvo."}</p>
      <Button disabled={ocupado || bloqueado || revisaoMudou} onClick={() => void enviar(false)}>{escolha === "confirmar" ? "Confirmar decisão PCM" : "Confirmar planejamento"}</Button>{" "}
      <Button variant="secondary" disabled={ocupado} onClick={() => setEscolha(null)}>Cancelar</Button>
    </div>}
  </section>;
}
