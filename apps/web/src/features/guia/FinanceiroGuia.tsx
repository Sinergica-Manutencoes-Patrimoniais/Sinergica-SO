import { Callout, GuiaTitulo, ListaFuncoes, Secao, StatusModulo } from "./GuiaUi";

export function FinanceiroGuia() {
  return (
    <div className="page-stack">
      <GuiaTitulo
        titulo="Financeiro"
        subtitulo="Caixa, faturamento, cobrança e — o mais importante — saber se cada contrato dá lucro."
      />
      <StatusModulo status="prototipo" />

      <Callout titulo="Isto é um protótipo navegável">
        <p>
          A aba Financeiro que você vê hoje no sistema tem dado <strong>fictício</strong>, só pra
          dar ideia de como as telas vão funcionar antes da equipe investir tempo construindo de
          verdade (banco de dados, integrações, cálculo real). Navegue à vontade — nada ali é salvo
          — e use pra imaginar o que falta ou o que mudaria no seu jeito de trabalhar.
        </p>
      </Callout>

      <Secao titulo="Pra que serve, de verdade">
        <p>
          Hoje a Sinérgica não sabe, com precisão, se cada contrato de manutenção dá lucro — o custo
          real (mão de obra + material + deslocamento) nunca foi comparado com o que o cliente paga.
          O Financeiro nasce pra resolver exatamente isso, além de organizar o controle de caixa
          (entradas e saídas) que hoje não tem sistema nenhum.
        </p>
      </Secao>

      <Secao titulo="As 10 telas planejadas">
        <ListaFuncoes
          itens={[
            {
              nome: "Dashboard",
              descricao:
                "Posição de caixa, quanto entrou e saiu no mês, gráfico de gastos por categoria, projeção pros próximos 30/60/90 dias.",
            },
            {
              nome: "Lançamentos",
              descricao:
                "Toda entrada e saída de dinheiro, uma por uma — com data, categoria, cliente (se for o caso) e status (previsto ou já realizado).",
            },
            {
              nome: "Categorias",
              descricao:
                "O plano de contas — como cada gasto/receita é classificado (Pessoal, Combustível, Peças, Receita de contrato...).",
            },
            {
              nome: "Contas bancárias",
              descricao: "Onde o dinheiro está — cada conta com seu saldo atualizado.",
            },
            {
              nome: "Importar extrato (OFX)",
              descricao:
                "Sobe o arquivo que o banco exporta e o sistema sugere automaticamente como classificar cada transação — economiza o trabalho manual de digitar tudo de novo.",
            },
            {
              nome: "Contas a receber",
              descricao:
                "O que os clientes devem pagar, com aviso visual de quem está atrasado (3, 7, 15+ dias).",
            },
            {
              nome: "Contratos",
              descricao:
                "O valor mensal que cada cliente paga — é essa informação que vira a receita prevista todo mês.",
            },
            {
              nome: "Contas a pagar",
              descricao:
                "Fornecedores e despesas fixas (aluguel, salário) — o que a empresa deve pagar e quando.",
            },
            {
              nome: "Rentabilidade por cliente",
              descricao:
                "A tela mais importante do módulo: receita menos custo real de cada cliente, mês a mês — com alerta quando um contrato dá margem negativa por 2 meses seguidos.",
            },
            {
              nome: "Custos de pessoal",
              descricao:
                "Custo mensal de cada funcionário, usado pra calcular quanto vale a hora de trabalho dele — é esse número que entra na conta da rentabilidade.",
            },
          ]}
        />
      </Secao>

      <Secao titulo="Como ajuda no dia a dia">
        <p>
          Em vez de descobrir só no fim do ano que um contrato está dando prejuízo, o dono/gestor
          vai poder ver isso todo mês, por cliente, e decidir a tempo — renegociar valor, revisar
          escopo ou até encerrar um contrato que não compensa. E o time financeiro deixa de depender
          de planilha paralela pra saber quanto tem em caixa.
        </p>
      </Secao>
    </div>
  );
}
