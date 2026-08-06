import { GuiaTitulo, ListaFuncoes, Secao, StatusModulo } from "./GuiaUi";

interface ModuloPlanejado {
  titulo: string;
  subtitulo: string;
  paraQueServe: string;
  diaADia: string;
  funcoes: Array<{ nome: string; descricao: string }>;
}

function PaginaPlanejada({ dados }: { dados: ModuloPlanejado }) {
  return (
    <div className="page-stack">
      <GuiaTitulo titulo={dados.titulo} subtitulo={dados.subtitulo} />
      <StatusModulo status="planejado" />
      <Secao titulo="Pra que serve">
        <p>{dados.paraQueServe}</p>
      </Secao>
      <Secao titulo="Como vai ajudar no dia a dia">
        <p>{dados.diaADia}</p>
      </Secao>
      <Secao titulo="Funcionalidades previstas">
        <ListaFuncoes itens={dados.funcoes} />
      </Secao>
    </div>
  );
}

export function ComercialGuia() {
  return (
    <PaginaPlanejada
      dados={{
        titulo: "Comercial",
        subtitulo: "CRM, propostas com apoio de IA e gestão de contratos.",
        paraQueServe:
          "Organizar o processo de venda desde o primeiro contato (lead) até o contrato assinado — hoje esse controle não existe de forma centralizada.",
        diaADia:
          "Em vez de perder lead por falta de acompanhamento, o time comercial vai ver em que etapa está cada negociação e receber lembrete de quando cobrar retorno do cliente.",
        funcoes: [
          {
            nome: "Leads",
            descricao: "Toda oportunidade comercial, de onde veio e em que etapa está.",
          },
          {
            nome: "Propostas com IA",
            descricao:
              "Geração assistida de proposta comercial a partir do levantamento feito em campo.",
          },
          {
            nome: "Contratos",
            descricao:
              "Gestão do contrato fechado — vira a fonte de receita recorrente do Financeiro.",
          },
        ],
      }}
    />
  );
}

export function MarketingGuia() {
  return (
    <PaginaPlanejada
      dados={{
        titulo: "Marketing",
        subtitulo: "Calendário editorial e geração de conteúdo com apoio de IA.",
        paraQueServe:
          "Manter uma presença constante nas redes (Instagram, LinkedIn) sem depender de alguém lembrar de postar — hoje o marketing é reativo e para quando a operação aperta.",
        diaADia:
          "O time deixa de perder semanas sem postar nada porque a produção de conteúdo (texto + imagem) é assistida por IA, com aprovação humana antes de publicar.",
        funcoes: [
          {
            nome: "Calendário editorial",
            descricao: "O que vai ser publicado e quando, com fluxo de aprovação.",
          },
          {
            nome: "Geração de conteúdo",
            descricao: "Redação e imagem geradas com apoio de IA, prontas pra revisão.",
          },
          {
            nome: "Leads e campanhas",
            descricao: "Resultado de anúncios pagos (Growth) e atribuição de lead a canal.",
          },
        ],
      }}
    />
  );
}

export function CockpitGuia() {
  return (
    <PaginaPlanejada
      dados={{
        titulo: "Cockpit geral",
        subtitulo: "Painel executivo — os números de todos os módulos num só lugar.",
        paraQueServe:
          "Dar à liderança uma visão consolidada da empresa sem precisar abrir módulo por módulo — operação, financeiro, comercial e atendimento resumidos numa tela. O Cockpit do Financeiro já existe e cobre apenas indicadores financeiros.",
        diaADia:
          "O gestor abre uma tela só pela manhã e já sabe: quantas OS estão atrasadas, qual a margem média dos contratos, quantos leads entraram, se algum indicador crítico pede atenção.",
        funcoes: [
          {
            nome: "KPIs operacionais",
            descricao: "SLA, OS abertas, produtividade do técnico, aderência ao preventivo.",
          },
          {
            nome: "Margem e caixa",
            descricao: "Rentabilidade média e posição de caixa, vindo direto do Financeiro.",
          },
          {
            nome: "Funil comercial",
            descricao: "Quantos leads, propostas e contratos fechados no período.",
          },
        ],
      }}
    />
  );
}

export function AreaClienteGuia() {
  return (
    <div className="page-stack">
      <GuiaTitulo
        titulo="Área do Cliente"
        subtitulo="Portal do síndico — acompanhamento do próprio condomínio com dados reais."
      />
      <StatusModulo status="real" />
      <Secao titulo="Pra que serve">
        <p>
          Dá ao síndico ou administradora acesso direto às informações do próprio condomínio, sem
          expor custo interno, margem ou dados de outro cliente.
        </p>
      </Secao>
      <Secao titulo="Como usar">
        <ListaFuncoes
          itens={[
            {
              nome: "Painel do condomínio",
              descricao:
                "Comece aqui para ver resumo de OS, pendências, preventivos, documentos e indicadores do condomínio.",
            },
            {
              nome: "Histórico de OS",
              descricao:
                "Consulte andamento e serviços concluídos, incluindo notas, anexos e evidências permitidas.",
            },
            {
              nome: "Documentos",
              descricao:
                "Baixe laudos, certificados e relatórios publicados especificamente para o condomínio.",
            },
            {
              nome: "Situação financeira",
              descricao:
                "Consulte faturas, vencimentos e status do próprio condomínio; custos internos nunca aparecem.",
            },
            {
              nome: "Abrir chamado",
              descricao:
                "Registre uma solicitação pelo portal, acompanhe a resposta e aprove orçamento quando o fluxo exigir.",
            },
          ]}
        />
      </Secao>
      <Secao titulo="Qual o sentido">
        <p>
          Reduz perguntas repetidas no WhatsApp, dá transparência ao cliente e mantém cada interação
          ligada aos mesmos chamados, OS e documentos usados pela equipe interna.
        </p>
      </Secao>
    </div>
  );
}
