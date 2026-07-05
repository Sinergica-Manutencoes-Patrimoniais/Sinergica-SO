import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { criarInspecao, criarItemInspecao } from "../application/qualidade";
import type { ClienteOpcao, InspecaoItem, InspecaoResumo } from "../application/qualidade-gateway";
import {
  INSPECAO_STATUS_LABEL,
  RESULTADOS_INSPECAO,
  RESULTADO_LABEL,
  SEVERIDADES,
  SISTEMAS_INSPECAO,
  resultadoColor,
  rotuloSistema,
  statusColor,
} from "../domain/inspecoes-laudos";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; clientes: ClienteOpcao[]; inspecoes: InspecaoResumo[] };

function hojeIso(): string {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().slice(0, 10);
}

export function InspecoesPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [itens, setItens] = useState<InspecaoItem[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");
  const semClientes = estado.fase === "pronto" && estado.clientes.length === 0;

  const [formInspecao, setFormInspecao] = useState({
    clientId: "",
    titulo: "",
    dataInspecao: hojeIso(),
    responsavelTecnico: "",
    observacoesGerais: "",
  });

  const [formItem, setFormItem] = useState({
    sistema: "geral",
    localizacao: "",
    descricao: "",
    resultado: "nao_avaliado",
    severidade: "media",
    recomendacao: "",
    prazoRecomendado: "",
    fotoUrl: "",
  });

  const inspecaoSelecionada = useMemo(() => {
    if (estado.fase !== "pronto") return null;
    return estado.inspecoes.find((inspecao) => inspecao.id === selecionadaId) ?? null;
  }, [estado, selecionadaId]);

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    setErroAcao(null);
    try {
      const dados = await supabaseQualidadeAdapter.listarClientes();
      const inspecoes = await supabaseQualidadeAdapter.listarInspecoes();
      setEstado({ fase: "pronto", clientes: dados, inspecoes });
      setSelecionadaId((atual) => atual ?? inspecoes[0]?.id ?? null);
      setFormInspecao((form) => ({ ...form, clientId: form.clientId || dados[0]?.id || "" }));
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar inspeções.",
      });
    }
  }, []);

  const carregarItens = useCallback(async (inspecaoId: string) => {
    setCarregandoItens(true);
    try {
      setItens(await supabaseQualidadeAdapter.listarItensInspecao(inspecaoId));
    } catch {
      setItens([]);
      setErroAcao("Não foi possível carregar os itens da inspeção.");
    } finally {
      setCarregandoItens(false);
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  useEffect(() => {
    if (selecionadaId) void carregarItens(selecionadaId);
  }, [selecionadaId, carregarItens]);

  async function onCriarInspecao() {
    if (!user || estado.fase !== "pronto") return;
    setSalvando(true);
    setErroAcao(null);
    try {
      const criada = await criarInspecao(supabaseQualidadeAdapter, {
        ...formInspecao,
        responsavelTecnico: formInspecao.responsavelTecnico || null,
        observacoesGerais: formInspecao.observacoesGerais || null,
        createdBy: user.id,
      });
      setEstado({ ...estado, inspecoes: [criada, ...estado.inspecoes] });
      setSelecionadaId(criada.id);
      setFormInspecao({
        clientId: formInspecao.clientId,
        titulo: "",
        dataInspecao: hojeIso(),
        responsavelTecnico: "",
        observacoesGerais: "",
      });
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível criar inspeção.");
    } finally {
      setSalvando(false);
    }
  }

  async function onCriarItem() {
    if (!user || !inspecaoSelecionada) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      const item = await criarItemInspecao(supabaseQualidadeAdapter, {
        inspecaoId: inspecaoSelecionada.id,
        clientId: inspecaoSelecionada.clientId,
        sistema: formItem.sistema as InspecaoItem["sistema"],
        localizacao: formItem.localizacao || null,
        descricao: formItem.descricao,
        resultado: formItem.resultado as InspecaoItem["resultado"],
        severidade: formItem.severidade as InspecaoItem["severidade"],
        recomendacao: formItem.recomendacao || null,
        prazoRecomendado: formItem.prazoRecomendado || null,
        fotoUrl: formItem.fotoUrl || null,
        createdBy: user.id,
      });
      setItens((atuais) => [...atuais, item]);
      setFormItem({
        sistema: "geral",
        localizacao: "",
        descricao: "",
        resultado: "nao_avaliado",
        severidade: "media",
        recomendacao: "",
        prazoRecomendado: "",
        fotoUrl: "",
      });
      void carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível adicionar item.");
    } finally {
      setSalvando(false);
    }
  }

  if (permissoesCarregando)
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;

  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="text-sm text-ink-3 mt-1">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando inspeções…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-sm text-ink-3 mt-1">{estado.mensagem}</p>
        <button type="button" onClick={carregar} className="mt-4 text-sm font-semibold text-orange">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Inspeções</h2>
          <p className="text-sm text-ink-3">Vistorias prediais, inconformidades e recomendações</p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {erroAcao && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erroAcao}
        </div>
      )}

      {temEscrita && (
        <section className="bg-card rounded-[10px] border border-line p-4">
          {semClientes && (
            <div className="mb-3 rounded-[6px] border border-[#F0D4B0] bg-orange-soft px-3 py-2 text-sm text-[#7A3F00]">
              Nenhum cliente disponível no PCM. Execute o import Auvo para liberar a criação de
              inspeções vinculadas a condomínios reais.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              className="input md:col-span-2"
              value={formInspecao.clientId}
              disabled={semClientes}
              onChange={(event) =>
                setFormInspecao({ ...formInspecao, clientId: event.target.value })
              }
            >
              {estado.clientes.length === 0 ? (
                <option value="">Nenhum cliente disponível</option>
              ) : (
                estado.clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))
              )}
            </select>
            <input
              className="input md:col-span-2"
              placeholder="Título da inspeção"
              value={formInspecao.titulo}
              onChange={(event) => setFormInspecao({ ...formInspecao, titulo: event.target.value })}
            />
            <input
              className="input"
              type="date"
              value={formInspecao.dataInspecao}
              onChange={(event) =>
                setFormInspecao({ ...formInspecao, dataInspecao: event.target.value })
              }
            />
            <input
              className="input md:col-span-2"
              placeholder="Responsável técnico"
              value={formInspecao.responsavelTecnico}
              onChange={(event) =>
                setFormInspecao({ ...formInspecao, responsavelTecnico: event.target.value })
              }
            />
            <input
              className="input md:col-span-2"
              placeholder="Observações gerais"
              value={formInspecao.observacoesGerais}
              onChange={(event) =>
                setFormInspecao({ ...formInspecao, observacoesGerais: event.target.value })
              }
            />
            <button
              type="button"
              onClick={onCriarInspecao}
              disabled={salvando || !formInspecao.clientId || semClientes}
              className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Criar
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
        <section className="bg-card rounded-[10px] border border-line overflow-hidden">
          <div className="px-5 py-4 border-b border-line-soft">
            <h3 className="text-sm font-semibold text-ink">Registros</h3>
            <p className="text-xs text-ink-3 mt-0.5">
              {estado.inspecoes.length} inspeções recentes
            </p>
          </div>
          <div className="divide-y divide-line-soft">
            {estado.inspecoes.length === 0 ? (
              <div className="px-5 py-8 text-sm text-ink-3">Nenhuma inspeção cadastrada.</div>
            ) : (
              estado.inspecoes.map((inspecao) => (
                <button
                  key={inspecao.id}
                  type="button"
                  onClick={() => setSelecionadaId(inspecao.id)}
                  className={`w-full px-5 py-4 text-left hover:bg-line-soft ${
                    inspecao.id === selecionadaId ? "bg-line-soft" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{inspecao.titulo}</p>
                      <p className="text-xs text-ink-3 truncate">{inspecao.clienteNome}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor(inspecao.status)}`}
                    >
                      {INSPECAO_STATUS_LABEL[inspecao.status]}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <span className="rounded-[6px] bg-paper px-2 py-1 text-xs text-ink-3">
                      {inspecao.totalItens} itens
                    </span>
                    <span className="rounded-[6px] bg-[#E7F6EC] px-2 py-1 text-xs text-[#1E8E45]">
                      {inspecao.itensConformes}
                    </span>
                    <span className="rounded-[6px] bg-[#FDF1DF] px-2 py-1 text-xs text-[#B26A00]">
                      {inspecao.itensAtencao}
                    </span>
                    <span className="rounded-[6px] bg-[#FCE9E7] px-2 py-1 text-xs text-[#C5362B]">
                      {inspecao.itensNaoConformes}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="bg-card rounded-[10px] border border-line min-h-[520px]">
          {inspecaoSelecionada ? (
            <div>
              <div className="px-5 py-4 border-b border-line-soft">
                <p className="text-xs text-ink-3">{inspecaoSelecionada.clienteNome}</p>
                <h3 className="text-lg font-semibold text-ink">{inspecaoSelecionada.titulo}</h3>
                <p className="text-xs text-ink-3 mt-1">
                  {inspecaoSelecionada.dataInspecao}
                  {inspecaoSelecionada.responsavelTecnico
                    ? ` · ${inspecaoSelecionada.responsavelTecnico}`
                    : ""}
                </p>
              </div>

              {temEscrita && (
                <div className="p-5 border-b border-line-soft">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select
                      className="input"
                      value={formItem.sistema}
                      onChange={(event) =>
                        setFormItem({ ...formItem, sistema: event.target.value })
                      }
                    >
                      {SISTEMAS_INSPECAO.map((sistema) => (
                        <option key={sistema.valor} value={sistema.valor}>
                          {sistema.rotulo}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      placeholder="Localização"
                      value={formItem.localizacao}
                      onChange={(event) =>
                        setFormItem({ ...formItem, localizacao: event.target.value })
                      }
                    />
                    <select
                      className="input"
                      value={formItem.resultado}
                      onChange={(event) =>
                        setFormItem({ ...formItem, resultado: event.target.value })
                      }
                    >
                      {RESULTADOS_INSPECAO.map((resultado) => (
                        <option key={resultado.valor} value={resultado.valor}>
                          {resultado.rotulo}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      value={formItem.severidade}
                      onChange={(event) =>
                        setFormItem({ ...formItem, severidade: event.target.value })
                      }
                    >
                      {SEVERIDADES.map((severidade) => (
                        <option key={severidade.valor} value={severidade.valor}>
                          {severidade.rotulo}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input md:col-span-2"
                      placeholder="Descrição técnica"
                      value={formItem.descricao}
                      onChange={(event) =>
                        setFormItem({ ...formItem, descricao: event.target.value })
                      }
                    />
                    <input
                      className="input"
                      placeholder="Prazo recomendado"
                      type="date"
                      value={formItem.prazoRecomendado}
                      onChange={(event) =>
                        setFormItem({ ...formItem, prazoRecomendado: event.target.value })
                      }
                    />
                    <input
                      className="input"
                      placeholder="URL foto/Auvo"
                      value={formItem.fotoUrl}
                      onChange={(event) =>
                        setFormItem({ ...formItem, fotoUrl: event.target.value })
                      }
                    />
                    <input
                      className="input md:col-span-3"
                      placeholder="Recomendação"
                      value={formItem.recomendacao}
                      onChange={(event) =>
                        setFormItem({ ...formItem, recomendacao: event.target.value })
                      }
                    />
                    <button
                      type="button"
                      onClick={onCriarItem}
                      disabled={salvando}
                      className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" />
                      Item
                    </button>
                  </div>
                </div>
              )}

              <div className="divide-y divide-line-soft">
                {carregandoItens ? (
                  <div className="px-5 py-8 text-sm text-ink-3">Carregando itens…</div>
                ) : itens.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-ink-3">Nenhum item registrado.</div>
                ) : (
                  itens.map((item) => (
                    <div key={item.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                          {rotuloSistema(item.sistema)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${resultadoColor(item.resultado)}`}
                        >
                          {RESULTADO_LABEL[item.resultado]}
                        </span>
                        <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-3">
                          {item.severidade}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-ink">{item.descricao}</p>
                      <p className="mt-1 text-xs text-ink-3">
                        {[item.localizacao, item.recomendacao].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {item.fotoUrl && (
                        <a
                          href={item.fotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-xs font-semibold text-orange hover:text-orange-deep"
                        >
                          Abrir foto/referência
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-sm text-ink-3">Selecione ou crie uma inspeção.</div>
          )}
        </section>
      </div>
    </div>
  );
}
