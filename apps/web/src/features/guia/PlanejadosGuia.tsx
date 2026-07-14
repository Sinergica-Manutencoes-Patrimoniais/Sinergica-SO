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
        titulo: "Cockpit",
        subtitulo: "Painel executivo — os números de todos os módulos num só lugar.",
        paraQueServe:
          "Dar à liderança uma visão consolidada da empresa sem precisar abrir módulo por módulo — operação, financeiro, comercial e atendimento resumidos numa tela.",
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
    <PaginaPlanejada
      dados={{
        titulo: "Área do Cliente",
        subtitulo: "Portal do síndico — o cliente enxergando o próprio condomínio.",
        paraQueServe:
          "Dar ao síndico/administradora acesso direto ao andamento do próprio condomínio, sem precisar ligar ou mandar mensagem pra saber o status de uma manutenção.",
        diaADia:
          'Reduz o volume de "como está minha OS?" que hoje cai no WhatsApp do escritório — o síndico confere sozinho, a qualquer hora, e ainda consegue abrir um chamado novo direto pelo portal.',
        funcoes: [
          {
            nome: "Painel do condomínio",
            descricao: "OS abertas, backlog visível, preventivo do mês.",
          },
          {
            nome: "Histórico de OS",
            descricao: "O que já foi feito, com foto antes/depois quando houver.",
          },
          {
            nome: "Documentos",
            descricao: "Laudos (SPDA, PMOC), relatórios mensais e certificados pra baixar.",
          },
          {
            nome: "Situação financeira",
            descricao:
              "Faturas do próprio condomínio, vencimento e status — nunca custo interno da Sinérgica.",
          },
          {
            nome: "Abrir chamado",
            descricao: "Formulário alternativo ao WhatsApp do Zé, direto pelo portal.",
          },
        ],
      }}
    />
  );
}
