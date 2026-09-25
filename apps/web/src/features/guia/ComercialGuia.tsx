import { Callout, GuiaTitulo, Secao, StatusModulo } from "./GuiaUi";

interface OpcaoComercial {
  nome: string;
  paraQueServe: string;
  comoUsar: string;
  resultado: string;
  atencao?: string;
}

interface GrupoComercial {
  titulo: string;
  sentido: string;
  opcoes: OpcaoComercial[];
}

const GRUPOS_COMERCIAL: GrupoComercial[] = [
  {
    titulo: "Visão geral",
    sentido: "Começar o dia entendendo como o funil está andando e onde agir.",
    opcoes: [
      {
        nome: "Dashboard",
        paraQueServe:
          "Resume conversão por etapa, tempo médio até fechar (ciclo de venda), ticket médio, motivo das oportunidades perdidas, desconto médio praticado e de onde vêm os leads.",
        comoUsar:
          "É a tela que abre por padrão no Comercial. Observe onde o funil trava (etapa com menos avanço) e se o desconto médio está corroendo a margem.",
        resultado: "Mostra se o funil está saudável e onde intervir antes de perder mais negócio.",
        atencao:
          'Enquanto não houver oportunidade suficiente num período, o bloco mostra "sem dados ainda" — não é erro, é ausência real de base.',
      },
    ],
  },
  {
    titulo: "Funil e Contas",
    sentido: "Acompanhar cada negociação da entrada até o fechamento, sem duplicar cadastro.",
    opcoes: [
      {
        nome: "Funil",
        paraQueServe:
          "Board Kanban com uma oportunidade por card, uma coluna por etapa. Oportunidade entra por cadastro manual, pelo Zé no WhatsApp ou por levantamento de pré-venda feito em campo.",
        comoUsar:
          "Arraste o card pra etapa seguinte conforme a negociação avança. Ao mover pra uma etapa de perda, informe o motivo.",
        resultado: "Visão em tempo real de onde está cada negociação, sem depender de planilha.",
        atencao:
          "Motivo de perda é obrigatório — o sistema recusa mover o card pra uma etapa de perda sem ele, porque é o dado que explica por que a empresa deixou de vender.",
      },
      {
        nome: "Contas",
        paraQueServe:
          "Lista as Contas com oportunidade comercial aberta. Conta é o mesmo cadastro de cliente do PCM — lead, prospecto, cliente ativo e cliente antigo não são cadastros diferentes.",
        comoUsar:
          "Abra a Conta pra cair na Visão 360 dela no PCM. Lá, a aba Comercial mostra propostas, levantamentos e contratos daquela Conta especificamente.",
        resultado:
          "Evita cadastro duplicado quando um lead vira cliente — o histórico segue no mesmo registro.",
      },
      {
        nome: "Configuração do funil",
        paraQueServe:
          "Define as etapas do funil (nome, ordem, cor) e os motivos de perda disponíveis.",
        comoUsar:
          'Cadastre etapas na ordem em que a negociação realmente acontece. Marque uma etapa como "entrada do agente" pra receber os leads que o Zé identifica no WhatsApp automaticamente.',
        resultado: "O funil se adapta ao processo real de venda da empresa, sem mexer em código.",
        atencao:
          "Só uma etapa pode estar marcada como entrada do agente por vez — é pra onde todo lead novo do WhatsApp cai.",
      },
    ],
  },
  {
    titulo: "Propostas e contratos",
    sentido: "Da oportunidade qualificada até o contrato que vira receita recorrente.",
    opcoes: [
      {
        nome: "Precificação",
        paraQueServe:
          "Parâmetros de custo (mão de obra por nível, veículo, materiais) e margem mínima que o motor de cálculo usa pra montar o valor de cada proposta.",
        comoUsar:
          "Mantenha os valores atualizados — toda proposta nova calcula o preço a partir daqui, ao vivo, enquanto o comercial monta a composição.",
        resultado: "Garante que nenhuma proposta saia com preço abaixo do que cobre o custo real.",
        atencao:
          "Piso e desconto máximo: o sistema recusa salvar uma proposta com preço abaixo do valor mínimo calculado, mesmo que alguém tente aplicar desconto manual pra fechar mais rápido.",
      },
      {
        nome: "Contratos",
        paraQueServe:
          "Lista os contratos gerados a partir de uma proposta aceita — residente, volante ou avulso.",
        comoUsar:
          "Ative o contrato quando o cliente confirmar: isso cria o plano de faturamento no Financeiro automaticamente. Encerre quando o cliente cancelar ou o contrato vencer.",
        resultado: "Contrato ativo vira receita recorrente no Financeiro sem lançamento manual.",
        atencao:
          'Contrato tipo "avulso" (serviço pontual, não mensalidade) nunca gera plano de faturamento — é esperado, não é falha.',
      },
      {
        nome: "Propostas",
        paraQueServe:
          "Documento de pré-venda com escopo, materiais, mão de obra e preço calculado — aberta a partir de uma oportunidade na Conta.",
        comoUsar:
          "Monte a composição, avance de rascunho pra em revisão e aprovada. Baixe o PDF ou envie — enviar publica automaticamente no portal do síndico pra aprovação.",
        resultado: "O síndico aprova ou recusa pelo próprio portal, sem trocar mensagem manual.",
        atencao:
          "Proposta recusada move a oportunidade pra etapa de perdida com motivo próprio — não fica parada sem status.",
      },
      {
        nome: "Levantamento de pré-venda",
        paraQueServe:
          "Reaproveita a inspeção feita em campo pelo PCM (mesmo formulário do Assessment) como base pra montar a composição da proposta.",
        comoUsar:
          "Na Conta, vincule o Assessment já feito e importe os itens encontrados — só o que foi identificado como não conforme ou que precisa de atenção vira item de proposta.",
        resultado:
          "Evita visitar o cliente duas vezes: uma vistoria serve pra inspeção e pra venda.",
      },
    ],
  },
];

function OpcaoCard({ opcao }: { opcao: OpcaoComercial }) {
  return (
    <li className="rounded-lg border border-line p-4">
      <h4 className="text-body font-semibold text-ink">{opcao.nome}</h4>
      <dl className="mt-3 grid gap-3 text-body leading-relaxed md:grid-cols-3">
        <div>
          <dt className="text-caption font-bold uppercase tracking-wide text-ink-3">
            Para que serve
          </dt>
          <dd className="mt-1 text-ink-2">{opcao.paraQueServe}</dd>
        </div>
        <div>
          <dt className="text-caption font-bold uppercase tracking-wide text-ink-3">Como usar</dt>
          <dd className="mt-1 text-ink-2">{opcao.comoUsar}</dd>
        </div>
        <div>
          <dt className="text-caption font-bold uppercase tracking-wide text-ink-3">
            Qual o sentido
          </dt>
          <dd className="mt-1 text-ink-2">{opcao.resultado}</dd>
        </div>
      </dl>
      {opcao.atencao && (
        <p className="mt-3 rounded-md bg-line-soft px-3 py-2 text-caption leading-relaxed text-ink-3">
          <strong className="text-ink-2">Atenção:</strong> {opcao.atencao}
        </p>
      )}
    </li>
  );
}

export function ComercialGuia() {
  return (
    <div className="page-stack">
      <GuiaTitulo
        titulo="Comercial"
        subtitulo="Do primeiro contato ao contrato: funil, propostas com precificação automática e contratos que viram receita."
      />
      <StatusModulo status="real" />

      <Callout titulo="O sentido do módulo">
        <p>
          O Comercial organiza a venda desde o primeiro contato até o contrato assinado, tudo em
          cima da mesma Conta que o resto do sistema usa. Nada de planilha paralela ou negociação
          que só existe na cabeça de quem está conduzindo.
        </p>
      </Callout>

      <Secao titulo="Conceitos antes de começar">
        <dl className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-line p-3">
            <dt className="font-semibold text-ink">Conta</dt>
            <dd>
              Lead, prospecto, cliente ativo e cliente antigo são o mesmo cadastro (Conta), só em
              estágios diferentes. Ninguém precisa recadastrar quando um lead vira cliente.
            </dd>
          </div>
          <div className="rounded-md border border-line p-3">
            <dt className="font-semibold text-ink">Proposta × Orçamento de Serviço</dt>
            <dd>
              Proposta é pré-venda: para quem ainda não é cliente contratado, e quando aceita vira
              Contrato. Orçamento de Serviço é diferente — é do PCM, para cliente que já tem
              contrato e pede um serviço extra fora do que o contrato cobre, e vira Ordem de Serviço
              direto, sem passar por aqui.
            </dd>
          </div>
          <div className="rounded-md border border-line p-3">
            <dt className="font-semibold text-ink">Piso e desconto máximo</dt>
            <dd>
              Toda proposta tem um preço mínimo calculado a partir do custo real (mão de obra,
              material, veículo). O sistema recusa salvar preço abaixo desse piso, mesmo com
              desconto manual — é a trava que impede fechar negócio no prejuízo sem perceber.
            </dd>
          </div>
          <div className="rounded-md border border-line p-3">
            <dt className="font-semibold text-ink">Etapas configuráveis</dt>
            <dd>
              O funil não tem etapa fixa no código — quem administra cadastra as etapas do jeito que
              a empresa realmente vende. Por isso perder uma oportunidade sempre exige motivo: sem
              ele, ninguém aprende por que a venda não aconteceu.
            </dd>
          </div>
        </dl>
      </Secao>

      <Secao titulo="Como usar cada opção">
        <div className="flex flex-col gap-6">
          {GRUPOS_COMERCIAL.map((grupo) => (
            <section key={grupo.titulo}>
              <h3 className="text-body font-semibold text-ink">{grupo.titulo}</h3>
              <p className="mt-0.5 text-caption text-ink-3">{grupo.sentido}</p>
              <ul className="mt-3 flex flex-col gap-3">
                {grupo.opcoes.map((opcao) => (
                  <OpcaoCard key={opcao.nome} opcao={opcao} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Secao>

      <Callout titulo="Se conecta com outros módulos">
        <p>
          Lead que chega pelo WhatsApp e o Zé qualifica cai direto no Funil, na etapa configurada
          pra receber o agente — sem digitação manual. O Levantamento de pré-venda reaproveita a
          mesma inspeção que o PCM já usa em campo, então uma visita serve pra vender e pra
          diagnosticar ao mesmo tempo. Proposta enviada é aprovada ou recusada pelo próprio síndico
          no portal do cliente, sem troca de mensagem manual. E contrato ativado nasce como receita
          recorrente já configurada no Financeiro, sem lançamento manual.
        </p>
      </Callout>

      <Callout titulo="O que ainda não existe">
        <p>
          O módulo não gera proposta em DOCX (só PDF), não tem assinatura eletrônica do contrato
          (aceite é registrado no sistema, não assinatura digital juridicamente vinculante), e a
          proposta não é gerada automaticamente por IA — quem monta a composição é o comercial,
          usando o levantamento de campo como apoio quando existir.
        </p>
      </Callout>
    </div>
  );
}
