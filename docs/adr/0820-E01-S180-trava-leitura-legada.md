# ADR-0820 — Trava de acesso legado a comprovante mediado

Status: preparado; exige testes de concorrência, revisão e rollout coordenado.

A flag da Edge legada e o gate da ingestão podem divergir. Não confiar apenas em configuração da aplicação. Separar o resolvedor canônico interno, usado por seletores autorizados, da função legada: esta deve negar qualquer caminho com reserva de ingestão, mesmo pendente e independentemente da flag. Comprovantes sem reserva preservam comportamento legado. Ambas as funções permanecem revogadas aos papéis de aplicação; não conceder acesso direto.

Os seletores de serviço previamente preparados são atualizados para chamar apenas o resolvedor interno, preservando sua autorização e gates. A trava não revoga URLs ou bytes já emitidos, não prova ausência de outros leitores e não garante imutabilidade. Antes de habilitar, inventariar todos os acessos, testar concorrência, aplicar migrations sequenciais em ambiente seguro, revisar adversarialmente e homologar. Não alterar políticas Storage ou abrir gates.
