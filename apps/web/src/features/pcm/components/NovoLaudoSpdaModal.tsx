import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileSignature,
  Plus,
  Save,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { criarLaudoSpda, criarPontoSpda } from "../application/qualidade";
import type {
  ClienteOpcao,
  LaudoSpdaPonto,
  LaudoSpdaResumo,
} from "../application/qualidade-gateway";
import {
  CONFORMIDADE_SPDA_LABEL,
  NIVEIS_PROTECAO,
  type NivelProtecao,
  classificarPontoSpda,
  resultadoColor,
  sugerirConclusaoSpda,
} from "../domain/inspecoes-laudos";
import { supabaseQualidadeAdapter } from "../infrastructure/supabase-qualidade-adapter";

interface NovoLaudoSpdaModalProps {
  clientes: ClienteOpcao[];
  clienteInicialId?: string;
  userId: string;
  onClose: () => void;
  onCreated: (laudo: LaudoSpdaResumo, pontos: LaudoSpdaPonto[]) => void;
}

type EtapaId =
  | "dados"
  | "edificio"
  | "pontos"
  | "risco"
  | "seguranca"
  | "dps"
  | "rascunho"
  | "assinatura";

type EtapaDef = { id: EtapaId; rotulo: string };

interface PontoMedicaoForm {
  id: string;
  localizacao: string;
  resistenciaOhm: string;
  observacoes: string;
  fotoUrl: string;
}

interface LinhaExternaForm {
  id: string;
  tipo: "energia" | "sinal";
  comprimento: string;
  instalacao: string;
  ambiente: string;
  dps: string;
}

interface PontoCriticoForm {
  id: string;
  identificacao: string;
  comprimentoCondutor: string;
  distanciaExistente: string;
  materialCondutor: string;
  configuracao: string;
}

interface QuadroDpsForm {
  id: string;
  identificacao: string;
  tipoLinha: string;
  tensao: string;
  topologia: string;
  categoria: string;
  distancia: string;
  equipamentosSensiveis: boolean;
}

interface EdificioForm {
  nome: string;
  endereco: string;
  cidade: string;
  uf: string;
  tipoUso: string;
  comprimento: string;
  largura: string;
  altura: string;
  pavimentos: string;
  estrutura: string;
  cobertura: string;
  possuiSpda: boolean;
}

const ETAPAS: [EtapaDef, ...EtapaDef[]] = [
  { id: "dados", rotulo: "Dados" },
  { id: "edificio", rotulo: "Edifício" },
  { id: "pontos", rotulo: "Pontos" },
  { id: "risco", rotulo: "Risco" },
  { id: "seguranca", rotulo: "Segurança" },
  { id: "dps", rotulo: "DPS" },
  { id: "rascunho", rotulo: "Rascunho" },
  { id: "assinatura", rotulo: "Assinar" },
];

const OPCOES_RISCO = {
  cd: [
    { valor: "0,25", rotulo: "Cercado por edifícios mais altos" },
    { valor: "0,50", rotulo: "Entre edifícios de altura similar" },
    { valor: "1,0", rotulo: "Sem obstáculos próximos de mesma altura" },
    { valor: "2,0", rotulo: "Em posição elevada / topo de colina" },
  ],
  rf: [
    { valor: "0,001", rotulo: "Baixo — escritório, residência comum" },
    { valor: "0,01", rotulo: "Moderado — hotel, loja, escola" },
    { valor: "0,1", rotulo: "Alto — depósito, show room, hospital" },
    { valor: "1,0", rotulo: "Muito alto — explosivos, inflamáveis" },
  ],
  pa: [
    { valor: "0,00001", rotulo: "Calçada / piso pavimentado" },
    { valor: "0,001", rotulo: "Jardim / gramado / terra" },
    { valor: "0,0001", rotulo: "Acesso restrito / monitorado" },
  ],
  lf: [
    { valor: "0,01", rotulo: "Sem risco especial — escritório, residência" },
    { valor: "0,05", rotulo: "Ocupação normal — hotel, loja" },
    { valor: "0,10", rotulo: "Dificuldade de evacuação — idosos, crianças" },
    { valor: "0,20", rotulo: "Risco de pânico — hospital, escola grande" },
  ],
};

function hojeIso(): string {
  const hoje = new Date();
  hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  return hoje.toISOString().slice(0, 10);
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function novoPonto(): PontoMedicaoForm {
  return {
    id: uid("ponto"),
    localizacao: "",
    resistenciaOhm: "",
    observacoes: "",
    fotoUrl: "",
  };
}

function novaLinha(tipo: LinhaExternaForm["tipo"]): LinhaExternaForm {
  return {
    id: uid("linha"),
    tipo,
    comprimento: "500",
    instalacao: "Enterrado (CI=0,5)",
    ambiente: "Urbano <20m (CE=0,01)",
    dps: "Não instalado (PEB=1)",
  };
}

function novoPontoCritico(): PontoCriticoForm {
  return {
    id: uid("critico"),
    identificacao: "",
    comprimentoCondutor: "",
    distanciaExistente: "",
    materialCondutor: "Cobre (km=1,0)",
    configuracao: "Não isolado",
  };
}

function novoQuadroDps(): QuadroDpsForm {
  return {
    id: uid("dps"),
    identificacao: "",
    tipoLinha: "Energia BT",
    tensao: "220 V",
    topologia: "TN-S",
    categoria: "Residencial",
    distancia: "",
    equipamentosSensiveis: false,
  };
}

export function NovoLaudoSpdaModal({
  clientes,
  clienteInicialId,
  userId,
  onClose,
  onCreated,
}: NovoLaudoSpdaModalProps) {
  const [etapaIndex, setEtapaIndex] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState({
    clientId: clienteInicialId || clientes[0]?.id || "",
    dataVistoria: hojeIso(),
    arteNumero: "",
    observacoesGerais: "",
  });
  const [edificio, setEdificio] = useState({
    nome: "",
    endereco: "",
    cidade: "",
    uf: "SP",
    tipoUso: "Residencial",
    comprimento: "",
    largura: "",
    altura: "",
    pavimentos: "1",
    estrutura: "Concreto / Alvenaria estrutural",
    cobertura: "",
    possuiSpda: false,
  });
  const [nivelProtecao, setNivelProtecao] = useState<NivelProtecao>("III");
  const [pontos, setPontos] = useState<PontoMedicaoForm[]>([]);
  const [risco, setRisco] = useState({
    cd: "1,0",
    rf: "0,01",
    pa: "0,00001",
    lf: "0,01",
  });
  const [linhas, setLinhas] = useState<LinhaExternaForm[]>([
    novaLinha("energia"),
    novaLinha("sinal"),
  ]);
  const [descidas, setDescidas] = useState("2");
  const [pontosCriticos, setPontosCriticos] = useState<PontoCriticoForm[]>([novoPontoCritico()]);
  const [quadrosDps, setQuadrosDps] = useState<QuadroDpsForm[]>([novoQuadroDps()]);
  const [assinatura, setAssinatura] = useState({
    nomeCompleto: "",
    crea: "",
    cpf: "",
    assinaturaTexto: "",
  });
  const [rascunhoEditado, setRascunhoEditado] = useState<string | null>(null);

  const etapa = ETAPAS[etapaIndex] ?? ETAPAS[0];
  const clienteSelecionado = clientes.find((cliente) => cliente.id === dados.clientId);
  const pontosClassificados = useMemo(
    () =>
      pontos.map((ponto, index) => {
        const resistencia = ponto.resistenciaOhm ? Number(ponto.resistenciaOhm) : null;
        return {
          numeroPonto: index + 1,
          localizacao: ponto.localizacao,
          resistenciaOhm: resistencia,
          statusConformidade: classificarPontoSpda(resistencia),
          observacoes: ponto.observacoes,
          fotoUrl: ponto.fotoUrl,
        };
      }),
    [pontos],
  );
  const conclusao = sugerirConclusaoSpda(pontosClassificados);
  const rascunho = useMemo(
    () =>
      [
        `Dados da vistoria: ${clienteSelecionado?.nome ?? "Cliente não selecionado"} em ${dados.dataVistoria}.`,
        dados.arteNumero ? `ART/RT/TRT: ${dados.arteNumero}.` : "ART/RT/TRT não informado.",
        `Edificação: ${edificio.nome || "não informada"}; uso ${edificio.tipoUso}; ${edificio.pavimentos || "—"} pavimento(s); altura ${edificio.altura || "—"} m.`,
        `SPDA instalado: ${edificio.possuiSpda ? "sim" : "não"}. Nível de proteção considerado: ${nivelProtecao}.`,
        `Pontos de medição registrados: ${pontosClassificados.length}. ${conclusao}`,
        `Risco simplificado: Cd=${risco.cd}; rf=${risco.rf}; PA=${risco.pa}; Lf=${risco.lf}.`,
        `Linhas externas analisadas: ${linhas.length}. Quadros/DPS avaliados: ${quadrosDps.length}.`,
      ].join("\n"),
    [
      clienteSelecionado,
      conclusao,
      dados,
      edificio,
      linhas.length,
      nivelProtecao,
      pontosClassificados.length,
      quadrosDps.length,
      risco,
    ],
  );
  const textoRascunho = rascunhoEditado ?? rascunho;

  function avancar() {
    setErro(null);
    if (!validarEtapa()) return;
    setEtapaIndex((index) => Math.min(index + 1, ETAPAS.length - 1));
  }

  function voltar() {
    setErro(null);
    setEtapaIndex((index) => Math.max(index - 1, 0));
  }

  function validarEtapa(): boolean {
    if (etapa.id === "dados") {
      if (!dados.clientId) return falhar("Cliente é obrigatório.");
      if (!dados.arteNumero.trim()) return falhar("Número da ART / RT / TRT é obrigatório.");
      if (!dados.dataVistoria) return falhar("Data da vistoria é obrigatória.");
    }
    if (etapa.id === "edificio") {
      if (!edificio.nome.trim()) return falhar("Nome do edifício é obrigatório.");
      if (!edificio.comprimento || !edificio.largura || !edificio.altura) {
        return falhar("Comprimento, largura e altura são obrigatórios.");
      }
    }
    return true;
  }

  function falhar(mensagem: string): false {
    setErro(mensagem);
    return false;
  }

  async function salvar() {
    if (!validarEtapa()) return;
    setSalvando(true);
    setErro(null);
    try {
      const notasGerais = montarNotasGerais({
        observacoesGerais: dados.observacoesGerais,
        edificio,
        risco,
        linhas,
        descidas,
        pontosCriticos,
        quadrosDps,
        assinatura,
        rascunho: textoRascunho,
      });
      const laudo = await criarLaudoSpda(supabaseQualidadeAdapter, {
        clientId: dados.clientId,
        dataVistoria: dados.dataVistoria,
        arteNumero: dados.arteNumero,
        responsavelTecnico: assinatura.nomeCompleto || null,
        notasGerais,
        nivelProtecao,
        createdBy: userId,
      });

      const pontosCriados: LaudoSpdaPonto[] = [];
      for (const ponto of pontosClassificados) {
        if (!ponto.localizacao.trim()) continue;
        const criado = await criarPontoSpda(supabaseQualidadeAdapter, {
          laudoId: laudo.id,
          numeroPonto: ponto.numeroPonto,
          localizacao: ponto.localizacao,
          resistenciaOhm: ponto.resistenciaOhm,
          statusConformidade: ponto.statusConformidade,
          observacoes: ponto.observacoes || null,
          fotoUrl: ponto.fotoUrl || null,
          createdBy: userId,
        });
        pontosCriados.push(criado);
      }

      onCreated(laudo, pontosCriados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o laudo SPDA.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 md:p-4">
      <dialog
        open
        aria-labelledby="novo-laudo-spda-title"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[10px] border border-line bg-card shadow-xl"
      >
        <header className="border-b border-line-soft bg-card px-4 py-3 md:px-5">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={etapaIndex === 0 ? onClose : voltar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-line text-ink-3 hover:bg-line-soft hover:text-ink"
              aria-label={etapaIndex === 0 ? "Fechar" : "Voltar"}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-3">
                Novo laudo SPDA
              </p>
              <h2 id="novo-laudo-spda-title" className="truncate text-base font-semibold text-ink">
                {clienteSelecionado?.nome ?? "Sem cliente"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-line text-ink-3 hover:bg-line-soft hover:text-ink"
              aria-label="Fechar modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-8 gap-1.5">
            {ETAPAS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setEtapaIndex(index)}
                className={`h-1.5 rounded-full ${index <= etapaIndex ? "bg-navy" : "bg-line"}`}
                aria-label={`Ir para etapa ${index + 1}: ${item.rotulo}`}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-ink-3">
              Etapa {etapaIndex + 1} de {ETAPAS.length}
            </span>
            <span className="font-semibold text-ink-2">{etapa.rotulo}</span>
          </div>
        </header>

        <div className="overflow-y-auto bg-paper p-4 md:p-5">
          {erro && (
            <div className="mb-4 rounded-[6px] border border-[#F0C2BD] bg-[#FFF4F2] px-4 py-2 text-sm text-[#A12D24]">
              {erro}
            </div>
          )}

          <section className="mx-auto max-w-4xl rounded-[8px] bg-navy p-4 text-white md:p-6">
            {etapa.id === "dados" && (
              <EtapaDados clientes={clientes} dados={dados} onChange={setDados} />
            )}
            {etapa.id === "edificio" && (
              <EtapaEdificio
                edificio={edificio}
                nivelProtecao={nivelProtecao}
                onEdificioChange={setEdificio}
                onNivelChange={setNivelProtecao}
              />
            )}
            {etapa.id === "pontos" && <EtapaPontos pontos={pontos} onChange={setPontos} />}
            {etapa.id === "risco" && (
              <EtapaRisco
                risco={risco}
                linhas={linhas}
                onRiscoChange={setRisco}
                onLinhasChange={setLinhas}
              />
            )}
            {etapa.id === "seguranca" && (
              <EtapaSeguranca
                descidas={descidas}
                pontosCriticos={pontosCriticos}
                onDescidasChange={setDescidas}
                onPontosCriticosChange={setPontosCriticos}
              />
            )}
            {etapa.id === "dps" && <EtapaDps quadros={quadrosDps} onChange={setQuadrosDps} />}
            {etapa.id === "rascunho" && (
              <EtapaRascunho value={textoRascunho} onChange={setRascunhoEditado} />
            )}
            {etapa.id === "assinatura" && (
              <EtapaAssinatura
                assinatura={assinatura}
                onChange={setAssinatura}
                clienteNome={clienteSelecionado?.nome ?? "—"}
                pontos={pontosClassificados.length}
                nivelProtecao={nivelProtecao}
              />
            )}
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-card px-4 py-3 md:px-5">
          <button
            type="button"
            onClick={etapaIndex === 0 ? onClose : voltar}
            className="inline-flex items-center gap-2 rounded-[6px] border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            <ArrowLeft className="h-4 w-4" />
            {etapaIndex === 0 ? "Cancelar" : "Voltar"}
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando || !dados.clientId}
              className="inline-flex items-center gap-2 rounded-[6px] border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Salvar laudo
            </button>
            {etapaIndex < ETAPAS.length - 1 ? (
              <button
                type="button"
                onClick={avancar}
                className="inline-flex items-center gap-2 rounded-[6px] bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-deep"
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={salvar}
                disabled={salvando || !dados.clientId}
                className="inline-flex items-center gap-2 rounded-[6px] bg-orange px-4 py-2 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-60"
              >
                <FileSignature className="h-4 w-4" />
                Assinar e salvar
              </button>
            )}
          </div>
        </footer>
      </dialog>
    </div>
  );
}

function EtapaTitulo({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <div className="mb-6 text-center">
      <h3 className="text-lg font-semibold text-white">{titulo}</h3>
      <p className="mt-1 text-sm text-white/55">{subtitulo}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-sm font-medium text-white/75">{children}</span>;
}

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-[6px] border border-white/15 bg-white/8 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-orange focus:ring-2 focus:ring-orange/20 ${props.className ?? ""}`}
    />
  );
}

function DarkTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-[6px] border border-white/15 bg-white/8 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-orange focus:ring-2 focus:ring-orange/20 ${props.className ?? ""}`}
    />
  );
}

function DarkSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-[6px] border border-white/15 bg-white/8 px-3 py-2 text-sm text-white outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 ${props.className ?? ""}`}
    />
  );
}

function EtapaDados({
  clientes,
  dados,
  onChange,
}: {
  clientes: ClienteOpcao[];
  dados: {
    clientId: string;
    dataVistoria: string;
    arteNumero: string;
    observacoesGerais: string;
  };
  onChange: (dados: {
    clientId: string;
    dataVistoria: string;
    arteNumero: string;
    observacoesGerais: string;
  }) => void;
}) {
  return (
    <>
      <EtapaTitulo titulo="Dados da vistoria" subtitulo="Informações gerais do laudo" />
      <div className="grid grid-cols-1 gap-4">
        <div>
          <FieldLabel>Cliente / Condomínio *</FieldLabel>
          <DarkSelect
            value={dados.clientId}
            onChange={(event) => onChange({ ...dados, clientId: event.target.value })}
          >
            {clientes.length === 0 ? (
              <option value="">Nenhum cliente disponível</option>
            ) : (
              clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))
            )}
          </DarkSelect>
        </div>
        <div>
          <FieldLabel>Número da ART / RT / TRT *</FieldLabel>
          <DarkInput
            placeholder="Ex: SP-2026/123456-7"
            value={dados.arteNumero}
            onChange={(event) => onChange({ ...dados, arteNumero: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Data da vistoria *</FieldLabel>
          <DarkInput
            type="date"
            value={dados.dataVistoria}
            onChange={(event) => onChange({ ...dados, dataVistoria: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Observações gerais</FieldLabel>
          <DarkTextarea
            rows={4}
            placeholder="Condições climáticas, acesso, acompanhante responsável..."
            value={dados.observacoesGerais}
            onChange={(event) => onChange({ ...dados, observacoesGerais: event.target.value })}
          />
        </div>
      </div>
    </>
  );
}

function EtapaEdificio({
  edificio,
  nivelProtecao,
  onEdificioChange,
  onNivelChange,
}: {
  edificio: EdificioForm;
  nivelProtecao: NivelProtecao;
  onEdificioChange: (edificio: EdificioForm) => void;
  onNivelChange: (nivel: NivelProtecao) => void;
}) {
  return (
    <>
      <EtapaTitulo
        titulo="Dados do edifício"
        subtitulo="Informações construtivas usadas no laudo técnico"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FieldLabel>Nome do edifício *</FieldLabel>
          <DarkInput
            placeholder="Ex: Bloco A — Residencial Paineiras"
            value={edificio.nome}
            onChange={(event) => onEdificioChange({ ...edificio, nome: event.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <FieldLabel>Endereço</FieldLabel>
          <DarkInput
            placeholder="Rua, número, bairro"
            value={edificio.endereco}
            onChange={(event) => onEdificioChange({ ...edificio, endereco: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Cidade</FieldLabel>
          <DarkInput
            placeholder="São Paulo"
            value={edificio.cidade}
            onChange={(event) => onEdificioChange({ ...edificio, cidade: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>UF</FieldLabel>
          <DarkSelect
            value={edificio.uf}
            onChange={(event) => onEdificioChange({ ...edificio, uf: event.target.value })}
          >
            {["SP", "RJ", "MG", "PR", "SC", "RS", "GO", "DF", "BA", "ES"].map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </DarkSelect>
        </div>
        <div>
          <FieldLabel>Tipo de uso</FieldLabel>
          <DarkSelect
            value={edificio.tipoUso}
            onChange={(event) => onEdificioChange({ ...edificio, tipoUso: event.target.value })}
          >
            {["Residencial", "Comercial", "Industrial", "Misto", "Hospitalar", "Escolar"].map(
              (tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ),
            )}
          </DarkSelect>
        </div>
        <div>
          <FieldLabel>Nível de proteção</FieldLabel>
          <DarkSelect
            value={nivelProtecao}
            onChange={(event) => onNivelChange(event.target.value as NivelProtecao)}
          >
            {NIVEIS_PROTECAO.map((nivel) => (
              <option key={nivel.valor} value={nivel.valor}>
                {nivel.rotulo}
              </option>
            ))}
          </DarkSelect>
        </div>
        <div>
          <FieldLabel>Comprimento (m) *</FieldLabel>
          <DarkInput
            type="number"
            placeholder="L"
            value={edificio.comprimento}
            onChange={(event) => onEdificioChange({ ...edificio, comprimento: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Largura (m) *</FieldLabel>
          <DarkInput
            type="number"
            placeholder="W"
            value={edificio.largura}
            onChange={(event) => onEdificioChange({ ...edificio, largura: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Altura (m) *</FieldLabel>
          <DarkInput
            type="number"
            placeholder="H"
            value={edificio.altura}
            onChange={(event) => onEdificioChange({ ...edificio, altura: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Nº de pavimentos</FieldLabel>
          <DarkInput
            type="number"
            value={edificio.pavimentos}
            onChange={(event) => onEdificioChange({ ...edificio, pavimentos: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>Tipo de estrutura</FieldLabel>
          <DarkSelect
            value={edificio.estrutura}
            onChange={(event) => onEdificioChange({ ...edificio, estrutura: event.target.value })}
          >
            {["Concreto / Alvenaria estrutural", "Estrutura metálica", "Madeira", "Mista"].map(
              (tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ),
            )}
          </DarkSelect>
        </div>
        <div>
          <FieldLabel>Tipo de cobertura</FieldLabel>
          <DarkInput
            placeholder="Ex: laje impermeabilizada, telha metálica..."
            value={edificio.cobertura}
            onChange={(event) => onEdificioChange({ ...edificio, cobertura: event.target.value })}
          />
        </div>
        <label className="flex items-center gap-3 text-sm text-white/75 md:col-span-2">
          <input
            type="checkbox"
            checked={edificio.possuiSpda}
            onChange={(event) =>
              onEdificioChange({ ...edificio, possuiSpda: event.target.checked })
            }
            className="h-4 w-4 accent-orange"
          />
          Possui SPDA instalado
        </label>
      </div>
    </>
  );
}

function EtapaPontos({
  pontos,
  onChange,
}: {
  pontos: PontoMedicaoForm[];
  onChange: (pontos: PontoMedicaoForm[]) => void;
}) {
  return (
    <>
      <EtapaTitulo
        titulo="Pontos de medição"
        subtitulo="Registre cada descida do SPDA com leitura de resistência"
      />
      <div className="space-y-3">
        {pontos.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-white/20 px-4 py-10 text-center text-sm text-white/45">
            Nenhum ponto adicionado
          </div>
        ) : (
          pontos.map((ponto, index) => {
            const resistencia = ponto.resistenciaOhm ? Number(ponto.resistenciaOhm) : null;
            const status = classificarPontoSpda(resistencia);
            return (
              <div key={ponto.id} className="rounded-[8px] border border-white/15 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Ponto #{index + 1}</p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${resultadoColor(status)}`}
                    >
                      {CONFORMIDADE_SPDA_LABEL[status]}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange(pontos.filter((item) => item.id !== ponto.id))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/15 text-white/55 hover:bg-white/10 hover:text-white"
                    aria-label={`Remover ponto ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <DarkInput
                    placeholder="Localização"
                    value={ponto.localizacao}
                    onChange={(event) =>
                      onChange(
                        pontos.map((item) =>
                          item.id === ponto.id
                            ? { ...item, localizacao: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <DarkInput
                    type="number"
                    step="0.01"
                    placeholder="Resistência (Ω)"
                    value={ponto.resistenciaOhm}
                    onChange={(event) =>
                      onChange(
                        pontos.map((item) =>
                          item.id === ponto.id
                            ? { ...item, resistenciaOhm: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <DarkInput
                    placeholder="URL foto/Auvo"
                    value={ponto.fotoUrl}
                    onChange={(event) =>
                      onChange(
                        pontos.map((item) =>
                          item.id === ponto.id ? { ...item, fotoUrl: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <DarkInput
                    placeholder="Observações"
                    value={ponto.observacoes}
                    onChange={(event) =>
                      onChange(
                        pontos.map((item) =>
                          item.id === ponto.id
                            ? { ...item, observacoes: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            );
          })
        )}
        <button
          type="button"
          onClick={() => onChange([...pontos, novoPonto()])}
          className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-white/25 px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/8 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Adicionar ponto de medição
        </button>
      </div>
    </>
  );
}

function EtapaRisco({
  risco,
  linhas,
  onRiscoChange,
  onLinhasChange,
}: {
  risco: { cd: string; rf: string; pa: string; lf: string };
  linhas: LinhaExternaForm[];
  onRiscoChange: (risco: { cd: string; rf: string; pa: string; lf: string }) => void;
  onLinhasChange: (linhas: LinhaExternaForm[]) => void;
}) {
  return (
    <>
      <EtapaTitulo
        titulo="Gerenciamento de riscos"
        subtitulo="NBR 5419-2:2026 — parâmetros de avaliação"
      />
      <div className="space-y-6">
        <RadioGrupo
          titulo="Como o edifício está posicionado em relação ao entorno?"
          codigo="Cd"
          opcoes={OPCOES_RISCO.cd}
          value={risco.cd}
          onChange={(valor) => onRiscoChange({ ...risco, cd: valor })}
        />
        <RadioGrupo
          titulo="Qual o risco de incêndio ou explosão dentro da estrutura?"
          codigo="rf"
          opcoes={OPCOES_RISCO.rf}
          value={risco.rf}
          onChange={(valor) => onRiscoChange({ ...risco, rf: valor })}
        />
        <RadioGrupo
          titulo="Como é o acesso ao entorno externo da estrutura?"
          codigo="PA"
          opcoes={OPCOES_RISCO.pa}
          value={risco.pa}
          onChange={(valor) => onRiscoChange({ ...risco, pa: valor })}
        />
        <RadioGrupo
          titulo="Há dificuldade de evacuação ou ocupação especial?"
          codigo="Lf"
          opcoes={OPCOES_RISCO.lf}
          value={risco.lf}
          onChange={(valor) => onRiscoChange({ ...risco, lf: valor })}
        />
        <ListaLinhas linhas={linhas} onChange={onLinhasChange} />
      </div>
    </>
  );
}

function RadioGrupo({
  titulo,
  codigo,
  opcoes,
  value,
  onChange,
}: {
  titulo: string;
  codigo: string;
  opcoes: Array<{ valor: string; rotulo: string }>;
  value: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-white">{titulo}</p>
      <p className="mt-0.5 text-xs text-white/45">{codigo}</p>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {opcoes.map((opcao) => (
          <label
            key={opcao.valor}
            className={`flex items-center gap-3 rounded-[8px] border px-3 py-3 text-sm ${
              value === opcao.valor
                ? "border-orange bg-white/10 text-white"
                : "border-white/15 bg-white/5 text-white/75"
            }`}
          >
            <input
              type="radio"
              checked={value === opcao.valor}
              onChange={() => onChange(opcao.valor)}
              className="h-4 w-4 accent-orange"
            />
            <span>{opcao.rotulo}</span>
            <span className="ml-auto text-xs text-white/45">
              {codigo} = {opcao.valor}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ListaLinhas({
  linhas,
  onChange,
}: {
  linhas: LinhaExternaForm[];
  onChange: (linhas: LinhaExternaForm[]) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-white">Linhas externas conectadas ao edifício</p>
      <div className="mt-3 space-y-3">
        {linhas.map((linha, index) => (
          <div key={linha.id} className="rounded-[8px] border border-white/15 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                {linha.tipo === "energia" ? "Linha de Energia" : "Linha de Sinal"} #{index + 1}
              </p>
              <button
                type="button"
                onClick={() => onChange(linhas.filter((item) => item.id !== linha.id))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/15 text-white/55 hover:bg-white/10 hover:text-white"
                aria-label={`Remover linha ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DarkInput
                type="number"
                placeholder="Comprimento LL (m)"
                value={linha.comprimento}
                onChange={(event) =>
                  onChange(
                    linhas.map((item) =>
                      item.id === linha.id ? { ...item, comprimento: event.target.value } : item,
                    ),
                  )
                }
              />
              <DarkSelect
                value={linha.instalacao}
                onChange={(event) =>
                  onChange(
                    linhas.map((item) =>
                      item.id === linha.id ? { ...item, instalacao: event.target.value } : item,
                    ),
                  )
                }
              >
                {["Enterrado (CI=0,5)", "Aéreo (CI=1,0)", "Blindado (CI=0,2)"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </DarkSelect>
              <DarkSelect
                value={linha.ambiente}
                onChange={(event) =>
                  onChange(
                    linhas.map((item) =>
                      item.id === linha.id ? { ...item, ambiente: event.target.value } : item,
                    ),
                  )
                }
              >
                {["Urbano <20m (CE=0,01)", "Suburbano (CE=0,05)", "Rural (CE=0,1)"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </DarkSelect>
              <DarkSelect
                value={linha.dps}
                onChange={(event) =>
                  onChange(
                    linhas.map((item) =>
                      item.id === linha.id ? { ...item, dps: event.target.value } : item,
                    ),
                  )
                }
              >
                {["Não instalado (PEB=1)", "DPS Classe I", "DPS Classe II", "DPS coordenado"].map(
                  (item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ),
                )}
              </DarkSelect>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([...linhas, novaLinha("energia")])}
          className="inline-flex items-center gap-2 rounded-[6px] border border-white/15 px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/8 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Energia
        </button>
        <button
          type="button"
          onClick={() => onChange([...linhas, novaLinha("sinal")])}
          className="inline-flex items-center gap-2 rounded-[6px] border border-white/15 px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/8 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Sinal
        </button>
      </div>
    </div>
  );
}

function EtapaSeguranca({
  descidas,
  pontosCriticos,
  onDescidasChange,
  onPontosCriticosChange,
}: {
  descidas: string;
  pontosCriticos: PontoCriticoForm[];
  onDescidasChange: (valor: string) => void;
  onPontosCriticosChange: (pontos: PontoCriticoForm[]) => void;
}) {
  return (
    <>
      <EtapaTitulo
        titulo="Distâncias de segurança"
        subtitulo="NBR 5419-3:2026 — Eq. 6.1: s = ki × (kc/km) × l"
      />
      <div className="space-y-5">
        <div>
          <FieldLabel>Número de descidas do SPDA</FieldLabel>
          <div className="grid grid-cols-4 gap-2">
            {["1", "2", "4", "6"].map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => onDescidasChange(valor)}
                className={`rounded-[6px] px-3 py-2 text-sm font-semibold ${
                  descidas === valor ? "bg-orange text-white" : "bg-white/8 text-white/60"
                }`}
              >
                {valor}
              </button>
            ))}
          </div>
        </div>
        {pontosCriticos.map((ponto, index) => (
          <div key={ponto.id} className="rounded-[8px] border border-white/15 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Ponto crítico #{index + 1}</p>
              <button
                type="button"
                onClick={() =>
                  onPontosCriticosChange(pontosCriticos.filter((item) => item.id !== ponto.id))
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/15 text-white/55 hover:bg-white/10 hover:text-white"
                aria-label={`Remover ponto crítico ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DarkInput
                className="md:col-span-2"
                placeholder="Ex: Descida N1 → Quadro QG — Térreo"
                value={ponto.identificacao}
                onChange={(event) =>
                  onPontosCriticosChange(
                    pontosCriticos.map((item) =>
                      item.id === ponto.id ? { ...item, identificacao: event.target.value } : item,
                    ),
                  )
                }
              />
              <DarkInput
                type="number"
                placeholder="Comprimento do condutor (m)"
                value={ponto.comprimentoCondutor}
                onChange={(event) =>
                  onPontosCriticosChange(
                    pontosCriticos.map((item) =>
                      item.id === ponto.id
                        ? { ...item, comprimentoCondutor: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <DarkInput
                type="number"
                placeholder="Distância existente (m)"
                value={ponto.distanciaExistente}
                onChange={(event) =>
                  onPontosCriticosChange(
                    pontosCriticos.map((item) =>
                      item.id === ponto.id
                        ? { ...item, distanciaExistente: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <DarkSelect
                value={ponto.materialCondutor}
                onChange={(event) =>
                  onPontosCriticosChange(
                    pontosCriticos.map((item) =>
                      item.id === ponto.id
                        ? { ...item, materialCondutor: event.target.value }
                        : item,
                    ),
                  )
                }
              >
                {["Cobre (km=1,0)", "Alumínio (km=1,0)", "Aço (km=0,5)"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </DarkSelect>
              <DarkSelect
                value={ponto.configuracao}
                onChange={(event) =>
                  onPontosCriticosChange(
                    pontosCriticos.map((item) =>
                      item.id === ponto.id ? { ...item, configuracao: event.target.value } : item,
                    ),
                  )
                }
              >
                {["Não isolado", "Isolado", "Separação física garantida"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </DarkSelect>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onPontosCriticosChange([...pontosCriticos, novoPontoCritico()])}
          className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-white/25 px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/8 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Adicionar ponto crítico
        </button>
      </div>
    </>
  );
}

function EtapaDps({
  quadros,
  onChange,
}: {
  quadros: QuadroDpsForm[];
  onChange: (quadros: QuadroDpsForm[]) => void;
}) {
  return (
    <>
      <EtapaTitulo
        titulo="Dimensionamento de DPS"
        subtitulo="NBR 5419-4 / IEC 62305-4 — classe, corrente de impulso e Up"
      />
      <div className="space-y-3">
        {quadros.map((quadro, index) => (
          <div key={quadro.id} className="rounded-[8px] border border-white/15 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Quadro / ponto #{index + 1}</p>
              <button
                type="button"
                onClick={() => onChange(quadros.filter((item) => item.id !== quadro.id))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-white/15 text-white/55 hover:bg-white/10 hover:text-white"
                aria-label={`Remover quadro ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DarkInput
                className="md:col-span-2"
                placeholder="Ex: Quadro Geral — Entrada BT / Térreo"
                value={quadro.identificacao}
                onChange={(event) =>
                  onChange(
                    quadros.map((item) =>
                      item.id === quadro.id ? { ...item, identificacao: event.target.value } : item,
                    ),
                  )
                }
              />
              <DarkSelect
                value={quadro.tipoLinha}
                onChange={(event) =>
                  onChange(
                    quadros.map((item) =>
                      item.id === quadro.id ? { ...item, tipoLinha: event.target.value } : item,
                    ),
                  )
                }
              >
                {["Energia BT", "Energia MT", "Sinal / telecom", "Dados"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </DarkSelect>
              <DarkSelect
                value={quadro.tensao}
                onChange={(event) =>
                  onChange(
                    quadros.map((item) =>
                      item.id === quadro.id ? { ...item, tensao: event.target.value } : item,
                    ),
                  )
                }
              >
                {["127 V", "220 V", "380 V", "440 V"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </DarkSelect>
              <DarkSelect
                value={quadro.topologia}
                onChange={(event) =>
                  onChange(
                    quadros.map((item) =>
                      item.id === quadro.id ? { ...item, topologia: event.target.value } : item,
                    ),
                  )
                }
              >
                {["TN-S", "TN-C", "TN-C-S", "TT", "IT"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </DarkSelect>
              <DarkSelect
                value={quadro.categoria}
                onChange={(event) =>
                  onChange(
                    quadros.map((item) =>
                      item.id === quadro.id ? { ...item, categoria: event.target.value } : item,
                    ),
                  )
                }
              >
                {["Residencial", "Comercial", "Industrial", "Crítica"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </DarkSelect>
              <DarkInput
                type="number"
                className="md:col-span-2"
                placeholder="Distância da estrutura ao quadro (m)"
                value={quadro.distancia}
                onChange={(event) =>
                  onChange(
                    quadros.map((item) =>
                      item.id === quadro.id ? { ...item, distancia: event.target.value } : item,
                    ),
                  )
                }
              />
              <label className="flex items-center gap-3 text-sm text-white/75 md:col-span-2">
                <input
                  type="checkbox"
                  checked={quadro.equipamentosSensiveis}
                  onChange={(event) =>
                    onChange(
                      quadros.map((item) =>
                        item.id === quadro.id
                          ? { ...item, equipamentosSensiveis: event.target.checked }
                          : item,
                      ),
                    )
                  }
                  className="h-4 w-4 accent-orange"
                />
                Há equipamentos sensíveis
              </label>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...quadros, novoQuadroDps()])}
          className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-dashed border-white/25 px-4 py-3 text-sm font-semibold text-white/75 hover:bg-white/8 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          Adicionar quadro
        </button>
      </div>
    </>
  );
}

function EtapaRascunho({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <EtapaTitulo titulo="Rascunho do laudo" subtitulo="Revise e edite o texto técnico" />
      <DarkTextarea rows={14} value={value} onChange={(event) => onChange(event.target.value)} />
    </>
  );
}

function EtapaAssinatura({
  assinatura,
  onChange,
  clienteNome,
  pontos,
  nivelProtecao,
}: {
  assinatura: {
    nomeCompleto: string;
    crea: string;
    cpf: string;
    assinaturaTexto: string;
  };
  onChange: (assinatura: {
    nomeCompleto: string;
    crea: string;
    cpf: string;
    assinaturaTexto: string;
  }) => void;
  clienteNome: string;
  pontos: number;
  nivelProtecao: NivelProtecao;
}) {
  return (
    <>
      <EtapaTitulo titulo="Assinatura digital" subtitulo="Dados do responsável técnico" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FieldLabel>Nome completo</FieldLabel>
          <DarkInput
            placeholder="Eng. Responsável técnico"
            value={assinatura.nomeCompleto}
            onChange={(event) => onChange({ ...assinatura, nomeCompleto: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>CREA</FieldLabel>
          <DarkInput
            placeholder="Ex: SP-123456/D"
            value={assinatura.crea}
            onChange={(event) => onChange({ ...assinatura, crea: event.target.value })}
          />
        </div>
        <div>
          <FieldLabel>CPF</FieldLabel>
          <DarkInput
            placeholder="000.000.000-00"
            value={assinatura.cpf}
            onChange={(event) => onChange({ ...assinatura, cpf: event.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <FieldLabel>Assinatura</FieldLabel>
            <button
              type="button"
              onClick={() => onChange({ ...assinatura, assinaturaTexto: "" })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white/45 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar
            </button>
          </div>
          <DarkTextarea
            rows={5}
            placeholder="Digite a assinatura ou observação de aceite técnico"
            value={assinatura.assinaturaTexto}
            onChange={(event) => onChange({ ...assinatura, assinaturaTexto: event.target.value })}
          />
        </div>
        <div className="rounded-[8px] border border-white/15 bg-white/5 p-4 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
            Resumo do laudo
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-white/75 md:grid-cols-3">
            <span>Cliente: {clienteNome}</span>
            <span>Pontos: {pontos}</span>
            <span>NP: {nivelProtecao}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function montarNotasGerais(input: {
  observacoesGerais: string;
  edificio: EdificioForm;
  risco: { cd: string; rf: string; pa: string; lf: string };
  linhas: LinhaExternaForm[];
  descidas: string;
  pontosCriticos: PontoCriticoForm[];
  quadrosDps: QuadroDpsForm[];
  assinatura: {
    nomeCompleto: string;
    crea: string;
    cpf: string;
    assinaturaTexto: string;
  };
  rascunho: string;
}): string {
  const blocos = [
    input.observacoesGerais && `Observações gerais: ${input.observacoesGerais}`,
    `Edifício: ${input.edificio.nome}; ${input.edificio.endereco}; ${input.edificio.cidade}/${input.edificio.uf}; uso ${input.edificio.tipoUso}; dimensões ${input.edificio.comprimento} x ${input.edificio.largura} x ${input.edificio.altura} m; ${input.edificio.pavimentos} pavimento(s); estrutura ${input.edificio.estrutura}; cobertura ${input.edificio.cobertura || "não informada"}; SPDA instalado: ${input.edificio.possuiSpda ? "sim" : "não"}.`,
    `Risco: Cd=${input.risco.cd}; rf=${input.risco.rf}; PA=${input.risco.pa}; Lf=${input.risco.lf}.`,
    `Linhas externas: ${input.linhas.map((linha) => `${linha.tipo} ${linha.comprimento}m, ${linha.instalacao}, ${linha.ambiente}, ${linha.dps}`).join(" | ") || "não informadas"}.`,
    `Segurança: ${input.descidas} descida(s); pontos críticos: ${input.pontosCriticos.map((ponto) => `${ponto.identificacao || "sem identificação"} (${ponto.materialCondutor}, ${ponto.configuracao})`).join(" | ") || "não informados"}.`,
    `DPS: ${input.quadrosDps.map((quadro) => `${quadro.identificacao || "sem identificação"} (${quadro.tipoLinha}, ${quadro.tensao}, ${quadro.topologia}, ${quadro.categoria})`).join(" | ") || "não informado"}.`,
    input.assinatura.nomeCompleto &&
      `Responsável: ${input.assinatura.nomeCompleto}; CREA ${input.assinatura.crea || "—"}; CPF ${input.assinatura.cpf || "—"}.`,
    input.assinatura.assinaturaTexto && `Assinatura: ${input.assinatura.assinaturaTexto}`,
    `Rascunho técnico:\n${input.rascunho}`,
  ];
  return blocos.filter(Boolean).join("\n\n");
}
