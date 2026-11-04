# ADR-1065 — Interface de rascunho a partir de Plano legado

**Status:** preparação não homologada. Complementa ADR-1064.

O diagnóstico permite consultar fotografia e criar rascunho somente sob flag desligada por padrão. A tela obriga escolha explícita de modo, intervalo, base e tolerâncias; registra a tentativa antes da chamada e repete os mesmos identificadores após resposta incerta. A migration concede EXECUTE somente ao papel autenticado; funções exigem superadmin ativo, capacidade de Plano, Cliente coerente e gates fechados por padrão.

A fotografia fica temporariamente na sessão do navegador durante tentativa pendente e deve ser revista quanto a privacidade e retenção. O rascunho não aprova ou migra histórico, e tipo de tarefa e equivalência exigem revisão. Antes de ativar, testar integridade da fotografia, repetição entre abas/dispositivos, sessão, permissões, RLS/FORCE, concorrência e revisão adversarial. Nenhuma integração externa é acionada.
