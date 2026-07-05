import { Plus, RefreshCw, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { criarPontoSpda } from "../application/qualidade";
import type {
  ClienteOpcao,
  LaudoSpdaPonto,
  LaudoSpdaResumo,
} from "../application/qualidade-gateway";
import { NovoLaudoSpdaModal } from "../components/NovoLaudoSpdaModal";
import {
  CONFORMIDADE_SPDA_LABEL,
  LAUDO_STATUS_LABEL,
  classificarPontoSpda,
  resultadoColor,
  statusColor,
  sugerirConclusaoSpda,
} from "../domain/inspecoes-laudos";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; clientes: ClienteOpcao[]; laudos: LaudoSpdaResumo[] };

export function LaudosSpdaPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [pontos, setPontos] = useState<LaudoSpdaPonto[]>([]);
  const [carregandoPontos, setCarregandoPontos] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");
  const semClientes = estado.fase === "pronto" && estado.clientes.length === 0;

  const [formPonto, setFormPonto] = useState({
    numeroPonto: "1",
    localizacao: "",
    resistenciaOhm: "",
    statusConformidade: "pendente",
    observacoes: "",
    fotoUrl: "",
  });

  const laudoSelecionado = useMemo(() => {
    if (estado.fase !== "pronto") return null;
    return estado.laudos.find((laudo) => laudo.id === selecionadoId) ?? null;
  }, [estado, selecionadoId]);

  const conclusaoSugerida = useMemo(() => sugerirConclusaoSpda(pontos), [pontos]);

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    setErroAcao(null);
    try {
      const [clientes, laudos] = await Promise.all([
        supabaseQualidadeAdapter.listarClientes(),
        supabaseQualidadeAdapter.listarLaudosSpda(),
      ]);
      setEstado({ fase: "pronto", clientes, laudos });
      setSelecionadoId((atual) => atual ?? laudos[0]?.id ?? null);
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar laudos.",
      });
    }
  }, []);

  const carregarPontos = useCallback(async (laudoId: string) => {
    setCarregandoPontos(true);
    try {
      const carregados = await supabaseQualidadeAdapter.listarPontosSpda(laudoId);
      setPontos(carregados);
      setFormPonto((form) => ({
        ...form,
        numeroPonto: String((carregados.at(-1)?.numeroPonto ?? 0) + 1),
      }));
    } catch {
      setPontos([]);
      setErroAcao("Não foi possível carregar os pontos do laudo.");
    } finally {
      setCarregandoPontos(false);
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  useEffect(() => {
    if (selecionadoId) void carregarPontos(selecionadoId);
  }, [selecionadoId, carregarPontos]);

  async function onCriarPonto() {
    if (!user || !laudoSelecionado) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      const resistencia = formPonto.resistenciaOhm ? Number(formPonto.resistenciaOhm) : null;
      const ponto = await criarPontoSpda(supabaseQualidadeAdapter, {
        laudoId: laudoSelecionado.id,
        numeroPonto: Number(formPonto.numeroPonto),
        localizacao: formPonto.localizacao,
        resistenciaOhm: resistencia,
        statusConformidade:
          formPonto.statusConformidade === "pendente"
            ? classificarPontoSpda(resistencia)
            : (formPonto.statusConformidade as LaudoSpdaPonto["statusConformidade"]),
        observacoes: formPonto.observacoes || null,
        fotoUrl: formPonto.fotoUrl || null,
        createdBy: user.id,
      });
      const proximos = [...pontos, ponto];
      setPontos(proximos);
      setFormPonto({
        numeroPonto: String(ponto.numeroPonto + 1),
        localizacao: "",
        resistenciaOhm: "",
        statusConformidade: "pendente",
        observacoes: "",
        fotoUrl: "",
      });
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível adicionar ponto.");
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
    return <div className="p-8 text-center text-sm text-ink-3">Carregando laudos…</div>;
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
          <h2 className="text-base font-semibold text-ink">Laudo SPDA</h2>
          <p className="text-sm text-ink-3">Vistoria, pontos de medição e conclusão técnica</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={carregar}
            className="inline-flex items-center gap-2 rounded-[6px] border border-line px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              disabled={semClientes}
              className="inline-flex items-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Novo laudo
            </button>
          )}
        </div>
      </div>

      {erroAcao && (
        <div className="rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
          {erroAcao}
        </div>
      )}

      {temEscrita && semClientes && (
        <div className="rounded-[6px] border border-[#F0D4B0] bg-orange-soft px-3 py-2 text-sm text-[#7A3F00]">
          Nenhum cliente disponível no PCM. Execute o import Auvo para liberar laudos SPDA
          vinculados a condomínios reais.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4">
        <section className="bg-card rounded-[10px] border border-line overflow-hidden">
          <div className="px-5 py-4 border-b border-line-soft">
            <h3 className="text-sm font-semibold text-ink">Laudos</h3>
            <p className="text-xs text-ink-3 mt-0.5">{estado.laudos.length} registros recentes</p>
          </div>
          <div className="divide-y divide-line-soft">
            {estado.laudos.length === 0 ? (
              <div className="px-5 py-8 text-sm text-ink-3">Nenhum laudo SPDA cadastrado.</div>
            ) : (
              estado.laudos.map((laudo) => (
                <button
                  key={laudo.id}
                  type="button"
                  onClick={() => setSelecionadoId(laudo.id)}
                  className={`w-full px-5 py-4 text-left hover:bg-line-soft ${
                    laudo.id === selecionadoId ? "bg-line-soft" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{laudo.numero}</p>
                      <p className="text-xs text-ink-3 truncate">{laudo.clienteNome}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor(laudo.status)}`}
                    >
                      {LAUDO_STATUS_LABEL[laudo.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-ink-3">
                    {laudo.dataVistoria}
                    {laudo.nivelProtecao ? ` · Nível ${laudo.nivelProtecao}` : ""}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="bg-card rounded-[10px] border border-line min-h-[520px]">
          {laudoSelecionado ? (
            <div>
              <div className="px-5 py-4 border-b border-line-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-ink-3">{laudoSelecionado.clienteNome}</p>
                    <h3 className="text-lg font-semibold text-ink">{laudoSelecionado.numero}</h3>
                    <p className="text-xs text-ink-3 mt-1">
                      {laudoSelecionado.dataVistoria}
                      {laudoSelecionado.responsavelTecnico
                        ? ` · ${laudoSelecionado.responsavelTecnico}`
                        : ""}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-line bg-paper px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-orange" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                        Pontos medidos
                      </span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-ink">{pontos.length}</p>
                  </div>
                </div>
                <p className="mt-4 rounded-[6px] bg-paper px-3 py-2 text-sm text-ink-2">
                  {laudoSelecionado.conclusao || conclusaoSugerida}
                </p>
              </div>

              {temEscrita && (
                <div className="p-5 border-b border-line-soft">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <input
                      className="input"
                      type="number"
                      min="1"
                      placeholder="Ponto"
                      value={formPonto.numeroPonto}
                      onChange={(event) =>
                        setFormPonto({ ...formPonto, numeroPonto: event.target.value })
                      }
                    />
                    <input
                      className="input md:col-span-2"
                      placeholder="Localização"
                      value={formPonto.localizacao}
                      onChange={(event) =>
                        setFormPonto({ ...formPonto, localizacao: event.target.value })
                      }
                    />
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      placeholder="Ohms"
                      value={formPonto.resistenciaOhm}
                      onChange={(event) =>
                        setFormPonto({ ...formPonto, resistenciaOhm: event.target.value })
                      }
                    />
                    <select
                      className="input"
                      value={formPonto.statusConformidade}
                      onChange={(event) =>
                        setFormPonto({ ...formPonto, statusConformidade: event.target.value })
                      }
                    >
                      <option value="pendente">Automático</option>
                      <option value="conforme">Conforme</option>
                      <option value="atencao">Atenção</option>
                      <option value="nao_conforme">Não conforme</option>
                    </select>
                    <button
                      type="button"
                      onClick={onCriarPonto}
                      disabled={salvando}
                      className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" />
                      Ponto
                    </button>
                    <input
                      className="input md:col-span-3"
                      placeholder="Observações"
                      value={formPonto.observacoes}
                      onChange={(event) =>
                        setFormPonto({ ...formPonto, observacoes: event.target.value })
                      }
                    />
                    <input
                      className="input md:col-span-3"
                      placeholder="URL foto/Auvo"
                      value={formPonto.fotoUrl}
                      onChange={(event) =>
                        setFormPonto({ ...formPonto, fotoUrl: event.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="divide-y divide-line-soft">
                {carregandoPontos ? (
                  <div className="px-5 py-8 text-sm text-ink-3">Carregando pontos…</div>
                ) : pontos.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-ink-3">
                    Nenhum ponto de medição registrado.
                  </div>
                ) : (
                  pontos.map((ponto) => (
                    <div key={ponto.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-ink tabular-nums">
                          Ponto {ponto.numeroPonto}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${resultadoColor(ponto.statusConformidade)}`}
                        >
                          {CONFORMIDADE_SPDA_LABEL[ponto.statusConformidade]}
                        </span>
                        {ponto.resistenciaOhm !== null && (
                          <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-3">
                            {ponto.resistenciaOhm} Ω
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-medium text-ink">{ponto.localizacao}</p>
                      <p className="mt-1 text-xs text-ink-3">{ponto.observacoes || "—"}</p>
                      {ponto.fotoUrl && (
                        <a
                          href={ponto.fotoUrl}
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
            <div className="p-8 text-sm text-ink-3">Selecione ou crie um laudo SPDA.</div>
          )}
        </section>
      </div>

      {modalAberto && user && (
        <NovoLaudoSpdaModal
          clientes={estado.clientes}
          clienteInicialId={laudoSelecionado?.clientId}
          userId={user.id}
          onClose={() => setModalAberto(false)}
          onCreated={(laudo, pontosCriados) => {
            setEstado({ ...estado, laudos: [laudo, ...estado.laudos] });
            setSelecionadoId(laudo.id);
            setPontos(pontosCriados);
            setModalAberto(false);
          }}
        />
      )}
    </div>
  );
}
