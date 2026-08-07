import { Callout, GuiaTitulo, Secao, StatusModulo } from "./GuiaUi";

interface OpcaoFinanceiro {
  nome: string;
  paraQueServe: string;
  comoUsar: string;
  resultado: string;
  atencao?: string;
}

interface GrupoFinanceiro {
  titulo: string;
  sentido: string;
  opcoes: OpcaoFinanceiro[];
}

const GRUPOS_FINANCEIRO: GrupoFinanceiro[] = [
  {
    titulo: "Visão geral",
    sentido: "Começar o dia entendendo saúde do caixa e riscos próximos.",
    opcoes: [
      {
        nome: "Dashboard",
        paraQueServe:
          "Resume posição de caixa, entradas, saídas, resultado, valores a receber e pagar, inadimplência e projeção dos próximos 90 dias.",
        comoUsar:
          "Abra diariamente depois de atualizar os movimentos. Observe o alerta de saldo negativo, o previsto × realizado e quais categorias mais consumiram caixa.",
        resultado:
          "Mostra se a empresa consegue honrar compromissos e onde agir antes de faltar dinheiro.",
        atencao:
          "O Dashboard é visão de caixa, baseada no pagamento. Para resultado por competência, use a DRE.",
      },
    ],
  },
  {
    titulo: "Caixa",
    sentido: "Registrar, classificar e conferir todo dinheiro que entra ou sai.",
    opcoes: [
      {
        nome: "Lançamentos",
        paraQueServe:
          "É o livro operacional do Financeiro: reúne entradas e saídas previstas ou realizadas.",
        comoUsar:
          "Crie o lançamento com competência, vencimento, categoria, valor, conta e cliente/fornecedor quando aplicável. Quando o dinheiro movimentar, use Dar baixa. Use filtros para revisar, Exportar CSV para compartilhar e anexe o comprovante ao realizado. Correção e estorno preservam auditoria.",
        resultado:
          "Mantém caixa, DRE, contas a receber/pagar, impostos e indicadores usando a mesma fonte.",
        atencao:
          "Não apague e recrie um pagamento para corrigir histórico. Use Corrigir ou Estornar baixa.",
      },
      {
        nome: "Categorias",
        paraQueServe:
          "Organiza o plano de contas: explica de onde veio uma receita e em que a empresa gastou.",
        comoUsar:
          "Crie categorias de Entrada ou Saída. Use categoria raiz para grupos amplos e subcategoria para detalhar. Edite nomes quando necessário e desative o que não deve mais ser usado.",
        resultado:
          "Permite analisar gasto por grupo, montar DRE e orçamento sem depender da descrição digitada.",
        atencao:
          "Cadastre estrutura simples e estável antes de lançar dados; categorias excessivas dificultam análise.",
      },
      {
        nome: "Contas Bancárias",
        paraQueServe: "Representa onde o dinheiro está e calcula saldo de cada conta.",
        comoUsar:
          "Cadastre nome, banco, saldo inicial e data de corte. Depois, vincule baixas e importações à conta correta. Para mover dinheiro entre contas próprias, use Transferência entre contas.",
        resultado:
          "O saldo fica derivado dos movimentos, sem ajuste manual que esconda divergências.",
        atencao:
          "Transferência cria os dois lados da movimentação e não representa receita nem despesa.",
      },
      {
        nome: "Importar Extrato",
        paraQueServe:
          "Traz o extrato OFX do banco e transforma movimentos bancários em conferência do sistema.",
        comoUsar:
          "Selecione a conta, escolha o arquivo .ofx, confira a prévia e confirme. Para cada pendência, concilie com um lançamento previsto, crie um novo lançamento com categoria ou ignore quando não pertencer ao controle.",
        resultado:
          "Evita digitação duplicada e confirma que previsão e banco contam a mesma história.",
        atencao:
          "O FITID impede importar a mesma transação duas vezes. Concilie antes de criar novo lançamento para evitar duplicidade.",
      },
    ],
  },
  {
    titulo: "Recebimentos",
    sentido: "Transformar contratos em receita prevista, cobrar e confirmar o que entrou.",
    opcoes: [
      {
        nome: "Contas a Receber",
        paraQueServe:
          "Mostra recebíveis por vencimento e atraso, além da inadimplência consolidada por cliente.",
        comoUsar:
          "Alterne entre Por faixa e Por cliente. Use Baixar quando receber. Em Cobrança, emita PIX ou boleto e copie o código/link para envio ao cliente.",
        resultado: "Deixa claro quem deve, há quanto tempo e qual valor precisa de ação.",
        atencao:
          "Baixa manual exige a data real do recebimento. Cobrança bancária depende do provedor configurado.",
      },
      {
        nome: "Contratos",
        paraQueServe:
          "Registra receita recorrente mensal de cada cliente e alimenta previsão, cobrança e rentabilidade.",
        comoUsar:
          "Cadastre cliente, valor mensal, dia de vencimento, início, fim opcional e status. No começo de cada competência, use Gerar previstos do mês; repetir a ação não duplica recebíveis.",
        resultado: "Converte carteira contratual em contas a receber e projeção de caixa.",
        atencao:
          "A opção de bloquear OS por atraso hoje é aviso visual; não impede operação do PCM.",
      },
      {
        nome: "Cobrança",
        paraQueServe:
          "Automatiza lembretes antes e depois do vencimento por WhatsApp, e-mail ou ambos.",
        comoUsar:
          "Crie pontos da régua informando quantos dias antes ou depois do vencimento, canal e mensagem-modelo. Edite ou desative pontos e acompanhe o Histórico de envios.",
        resultado: "Padroniza cobrança, reduz esquecimento e mantém prova do que foi enviado.",
        atencao:
          "Sem ponto ativo, nada é enviado. Recebível pago sai da régua; canal indisponível fica registrado no histórico.",
      },
    ],
  },
  {
    titulo: "Pagamentos",
    sentido: "Antecipar compromissos e evitar surpresa no caixa.",
    opcoes: [
      {
        nome: "Contas a Pagar",
        paraQueServe: "Controla despesas fixas e pagamentos previstos por vencimento ou atraso.",
        comoUsar:
          "Cadastre cada despesa recorrente com descrição, valor, vencimento, categoria e conta opcional. Edite quando a regra mudar, desative quando terminar e use Pagar na data efetiva.",
        resultado: "Alimenta projeção de caixa e mostra compromissos futuros antes de vencerem.",
        atencao:
          "Use Lançamentos para despesas avulsas; despesas fixas devem ficar aqui para repetir corretamente.",
      },
    ],
  },
  {
    titulo: "Impostos",
    sentido: "Reservar dinheiro do tributo antes de ele virar pagamento.",
    opcoes: [
      {
        nome: "Impostos",
        paraQueServe: "Calcula provisão gerencial do DAS/Simples Nacional por competência.",
        comoUsar:
          "Configure cálculo por faixas de RBT12 ou alíquota fixa. Revise faixas e percentuais e use Provisionar competência para criar a saída prevista do imposto.",
        resultado:
          "O imposto passa a aparecer na projeção e no resultado do mês, evitando tratar faturamento bruto como dinheiro livre.",
        atencao: "É estimativa gerencial; não substitui apuração fiscal oficial do contador.",
      },
    ],
  },
  {
    titulo: "Fechamento",
    sentido: "Congelar mês revisado e manter números históricos confiáveis.",
    opcoes: [
      {
        nome: "Fechamento Mensal",
        paraQueServe: "Trava lançamentos e alterações de uma competência já conferida.",
        comoUsar:
          "Depois de importar extratos, conciliar pendências, dar baixas e provisionar impostos, clique em Fechar mês. Se houver erro, somente superadmin pode Reabrir, informando motivo; depois corrija e feche novamente.",
        resultado: "Evita que relatórios antigos mudem sem controle e mantém trilha de auditoria.",
        atencao:
          "Exporte os lançamentos em CSV antes de enviar ao contador. Mês fechado bloqueia novas alterações naquela competência.",
      },
    ],
  },
  {
    titulo: "Rentabilidade",
    sentido: "Descobrir se cada cliente remunera o trabalho que consome.",
    opcoes: [
      {
        nome: "Rentabilidade",
        paraQueServe:
          "Compara receita do cliente com custo real de horas e despesas das OS nos últimos 12 meses.",
        comoUsar:
          "Abra o cliente para ver margem mês a mês; abra o mês para chegar às OS que formaram o custo. Priorize contratos com margem negativa por dois meses.",
        resultado:
          "Dá base para renegociar preço, ajustar escopo ou reduzir desperdício com evidência.",
        atencao:
          "Observe o indicador de cobertura. Sem custo de pessoal ou despesas do Auvo, a margem aparece parcial e não deve ser tratada como definitiva.",
      },
      {
        nome: "Custos de Pessoal",
        paraQueServe:
          "Transforma custo mensal do funcionário em custo por hora usado na rentabilidade das OS.",
        comoUsar:
          "Cadastre funcionário, custo mensal completo, horas-base e data de início da vigência. Quando o custo mudar, crie nova vigência em vez de alterar o passado.",
        resultado: "Cada hora apontada passa a ter valor real e histórico correto.",
        atencao:
          "Inclua no custo mensal tudo que a empresa considera custo do colaborador, usando critério contábil consistente.",
      },
    ],
  },
  {
    titulo: "Gerencial",
    sentido: "Sair da operação diária e tomar decisões de resultado, meta e sobrevivência.",
    opcoes: [
      {
        nome: "DRE",
        paraQueServe:
          "Mostra receita, despesas por grupo e resultado líquido no mês em que foram gerados.",
        comoUsar:
          "Compare os meses e identifique quais grupos explicam melhora ou piora do resultado. Use junto do Dashboard, não no lugar dele.",
        resultado:
          "Responde se a operação deu lucro por competência, mesmo quando pagamento ocorreu em outra data.",
        atencao:
          "É DRE gerencial, não demonstração contábil oficial. Diferença para o Dashboard é esperada: competência e caixa medem momentos diferentes.",
      },
      {
        nome: "Orçamento",
        paraQueServe: "Define limite/meta por categoria e compara o planejado com o realizado.",
        comoUsar:
          "Escolha o ano, a categoria e o valor mensal; Aplicar aos 12 meses grava a meta anual. Acompanhe desvio percentual e categorias que estouraram.",
        resultado: "Transforma gasto desejado em referência objetiva para controlar execução.",
        atencao: "Categoria sem meta mostra realizado, mas não calcula desvio.",
      },
      {
        nome: "Cockpit",
        paraQueServe:
          "Entrega ao dono visão executiva de runway, ponto de equilíbrio, ticket médio, inadimplência e margem por cliente.",
        comoUsar:
          "Consulte após fechar competências. Observe alertas de pouco fôlego de caixa, clientes negativos e tendência de entradas, saídas e resultado.",
        resultado:
          "Concentra decisões que exigem ação da gestão, sem percorrer todas as telas operacionais.",
        atencao:
          "Poucos meses fechados geram aviso de amostra pequena. Este é o cockpit financeiro; o cockpit geral da empresa continua sendo outro módulo.",
      },
    ],
  },
];

function OpcaoCard({ opcao }: { opcao: OpcaoFinanceiro }) {
  return (
    <li className="rounded-lg border border-line p-4">
      <h4 className="text-sm font-semibold text-ink">{opcao.nome}</h4>
      <dl className="mt-3 grid gap-3 text-sm leading-relaxed md:grid-cols-3">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-3">Para que serve</dt>
          <dd className="mt-1 text-ink-2">{opcao.paraQueServe}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-3">Como usar</dt>
          <dd className="mt-1 text-ink-2">{opcao.comoUsar}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-ink-3">Qual o sentido</dt>
          <dd className="mt-1 text-ink-2">{opcao.resultado}</dd>
        </div>
      </dl>
      {opcao.atencao && (
        <p className="mt-3 rounded-md bg-line-soft px-3 py-2 text-xs leading-relaxed text-ink-3">
          <strong className="text-ink-2">Atenção:</strong> {opcao.atencao}
        </p>
      )}
    </li>
  );
}

export function FinanceiroGuia() {
  return (
    <div className="page-stack">
      <GuiaTitulo
        titulo="Financeiro"
        subtitulo="Do lançamento ao fechamento: caixa, cobrança, impostos, resultado e rentabilidade com dados reais."
      />
      <StatusModulo status="real" />

      <Callout titulo="O sentido do módulo">
        <p>
          O Financeiro não é só uma lista do que entrou e saiu. Ele liga previsão, banco, contratos,
          despesas, impostos e custo das Ordens de Serviço para responder três perguntas:{" "}
          <strong>tem dinheiro para pagar, o mês deu resultado e cada cliente dá lucro?</strong>
        </p>
      </Callout>

      <Secao titulo="Quatro conceitos antes de começar">
        <dl className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-line p-3">
            <dt className="font-semibold text-ink">Previsto × realizado</dt>
            <dd>
              Previsto é compromisso futuro. Realizado significa dinheiro recebido ou pago. Dar
              baixa transforma previsão em fato.
            </dd>
          </div>
          <div className="rounded-md border border-line p-3">
            <dt className="font-semibold text-ink">Competência × caixa</dt>
            <dd>
              Competência diz a qual mês receita/despesa pertence. Caixa diz quando dinheiro
              movimentou. DRE usa competência; Dashboard usa caixa.
            </dd>
          </div>
          <div className="rounded-md border border-line p-3">
            <dt className="font-semibold text-ink">Categoria × conta bancária</dt>
            <dd>
              Categoria explica o motivo do dinheiro. Conta bancária explica onde ele está. Um
              lançamento precisa das duas dimensões quando realizado.
            </dd>
          </div>
          <div className="rounded-md border border-line p-3">
            <dt className="font-semibold text-ink">Receita × rentabilidade</dt>
            <dd>
              Faturar não significa lucrar. Rentabilidade desconta horas e despesas das OS para
              mostrar a margem real do cliente.
            </dd>
          </div>
        </dl>
      </Secao>

      <Secao titulo="Primeira configuração — faça nesta ordem">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Revise <strong className="text-ink">Categorias</strong> e deixe o plano de contas
            compreensível.
          </li>
          <li>
            Cadastre <strong className="text-ink">Contas Bancárias</strong> com saldo e data de
            corte corretos.
          </li>
          <li>
            Cadastre <strong className="text-ink">Custos de Pessoal</strong> para valorar horas das
            OS.
          </li>
          <li>
            Cadastre <strong className="text-ink">Contratos</strong> e{" "}
            <strong className="text-ink">Contas a Pagar</strong> recorrentes.
          </li>
          <li>
            Configure <strong className="text-ink">Impostos</strong>, provedor de cobrança e régua
            de lembretes.
          </li>
          <li>
            Gere previstos, importe OFX, concilie movimentos e só então feche a primeira
            competência.
          </li>
        </ol>
      </Secao>

      <Secao titulo="Como usar cada opção">
        <div className="flex flex-col gap-6">
          {GRUPOS_FINANCEIRO.map((grupo) => (
            <section key={grupo.titulo}>
              <h3 className="text-sm font-semibold text-ink">{grupo.titulo}</h3>
              <p className="mt-0.5 text-xs text-ink-3">{grupo.sentido}</p>
              <ul className="mt-3 flex flex-col gap-3">
                {grupo.opcoes.map((opcao) => (
                  <OpcaoCard key={opcao.nome} opcao={opcao} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Secao>

      <Secao titulo="Rotina recomendada">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <h4 className="font-semibold text-ink">Todo dia</h4>
            <p>
              Importar OFX, conciliar pendências, confirmar recebimentos/pagamentos e olhar alerta
              de caixa.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-ink">Toda semana</h4>
            <p>
              Revisar inadimplência, histórico da régua, contas próximas, projeção e contratos com
              margem ruim.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-ink">Todo mês</h4>
            <p>
              Gerar previstos, provisionar imposto, conciliar tudo, exportar, fechar competência e
              analisar DRE, orçamento, rentabilidade e cockpit.
            </p>
          </div>
        </div>
      </Secao>

      <Callout titulo="Permissões e segurança">
        <p>
          Usuário com permissão de leitura consulta dados; escrita permite criar, baixar, conciliar
          e configurar. Reabertura de mês é exclusiva de superadmin. Credenciais de cobrança ficam
          em Configurações e nunca devem ser compartilhadas em mensagem ou lançamento.
        </p>
      </Callout>
    </div>
  );
}
