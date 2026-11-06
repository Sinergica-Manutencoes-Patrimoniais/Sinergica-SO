# ADR-0198 — Despesas por Cliente, período e técnico

**Estado:** proposta preparatória, sem homologação nem implantação.

Totais por Cliente e data da despesa contam cada despesa ativa uma vez; previsão e realizado são eixos distintos, e ausência de realizado continua desconhecida. Rateios por OS não entram no cálculo do total por Cliente. O técnico responsável é atribuição explícita e opcional a uma participação da equipe da mesma Visita/Cliente, com revisão e histórico; o sistema não infere responsabilidade pelo autor do cadastro, nem duplica uma despesa para cada membro da equipe. Despesas sem atribuição formam uma categoria separada. Vínculo encerrado posteriormente permanece identificável como histórico, sem apagamento da atribuição.

Os comandos e consultas estão revogados; gate desligado. A atribuição é classificatória e não representa execução, comprovante, pagamento ou ciência do técnico. Antes de ativar, validar regra de responsabilidade com casos de despesas compartilhadas, integridade inversa dos vínculos, desempenho de períodos longos, autorizações, revogação, concorrência, limites monetários, rateios e relatórios, com testes integrados e revisão adversarial.
