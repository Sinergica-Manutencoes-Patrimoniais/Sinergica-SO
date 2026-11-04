# ADR-0578 — Preparação do recebimento de retorno por Visita

O classificador manual passa a resolver origem por Visita usando o resolvedor privado da ADR-0501, com identidade de Cliente, alvo e versão aprovada comprovados. O caminho de calendário existente permanece inalterado. A classificação continua declarada por pessoa e não autentica conteúdo externo.

A barreira da migration 0729 permanece ativa: o retorno de Visita não é inserido, e nenhuma validação, aprovação ou execução é liberada. A adaptação dos demais consumidores, revisão de concorrência, testes e homologação continuam obrigatórios antes de qualquer ativação. A alteração depende da forma exata da função anterior e falha fechada se ela divergir. Nenhum gate é ativado ou permissão concedida nesta migration.
