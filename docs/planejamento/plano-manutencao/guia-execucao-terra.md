# Guia de execução — Terra

**Só especificação nesta entrega.** Este guia orienta futura sessão de implementação; não concede deploy, push ou tarefas reais.

## Selecionar uma fatia

Começar por E01-S184 (proteção imediata de custos), depois E01-S170. Consultar tabela/ordem de [programa-sso-terra.md](programa-sso-terra.md) e abrir só story escolhida. Confirmar owner Terra e dependências. Manter mudanças locais de terceiros. Fazer branch de implementação por ID quando iniciar código; documentação fica na branch de handoff atual.

Executar Spec Kit com `SPECIFY_FEATURE_DIRECTORY` apontando pasta exata; não usar numeração automática NNN. Ler spec, plan, research, data-model, contracts, quickstart, tasks e constitution antes de codar. Todas as tarefas estão abertas; checklists de requisitos avaliam documento, não execução.

## Contrato mínimo de cada entrega

1. Revalidar reuso e banco aplicado, sem confiar no status histórico do ROADMAP ou caderno como prova de produção.
2. Escrever teste significativo que falha; implementar regra; passar teste focado e teste de permissão negada/concorrência aplicável.
3. Evoluir RPC/schema por migration nova sequencial, expandir antes de retirar unicidade/trigger. Preservar IDs e mappings; não tocar migration aplicada.
4. Integrar mesma regra nas superfícies existentes com TanStack Query/keys Cliente-scoped; não importar outra feature.
5. Demonstrar AC com comando e resultado; tarefa só recebe X depois da evidência.
6. Executar quickstart e revisão adversarial no tier arquitetural; ao finalizar incremento sensível, ci:local e futura CI/db-tests sem pular. Atualizar graphify após código e glossário conforme objeto introduzido.
7. Remover linha do ROADMAP só no fechamento conforme Definition-of-Done, não ao terminar esta especificação.

## Interrupções justificadas

Gate Auvo real sem prova mantém envio fechado e permite trabalhar com doubles; falta de mapeamento não cria ativo remoto. Resultado incerto não autoriza POST. Incompatibilidade com regra aprovada vira SPEC_DEVIATION + ADR e revisão da fatia afetada, sem reabrir P01/P02/P03. Token/senha nunca entra no chat/Git. Migração real, liberação e ampliação de piloto ficam na etapa humana/DevOps.

## Exceção temporária — banco local indisponível (2026-10-29)

Lucas autorizou seguir sem exigir testes de banco no computador enquanto o ambiente é recuperado. Não executar `supabase start`, `supabase test db` nem reiniciar ou resetar o Colima comprometido como pré-requisito para desenvolver. Manter testes de código viáveis localmente; não declarar uma tarefa de banco testada apenas por existir arquivo pgTAP.

O workflow existente `.github/workflows/ci.yml` executa o job **db-tests** em runner do GitHub, iniciando Supabase descartável e executando `supabase test db`. Ele é acionado em pull requests para `main` ou `develop` e em push nessas branches; um push isolado nesta branch não o aciona. Humano ou `@devops` deve publicar as alterações e abrir o PR, conforme AGENTS.md. Não há PR aberto para esta branch na data deste registro. Até existir execução do commit que contém as alterações, a CI é uma validação planejada, não um resultado obtido.

Registrar por story e commit o resultado do job **db-tests**, sem aceitar skip; corrigir falhas antes de PASS e manter revisão adversarial, homologação e deploy bloqueados até os demais gates. A CI não substitui automaticamente testes manuais de duas sessões, jornadas Auth/Storage ou validação de integração externa: executá-los em ambiente seguro apropriado e registrar evidências. Retomar também os testes de banco locais após recuperação do Colima, sem reset ou perda de volumes.

## Verificações deste pacote

O eval de spec legado retorna sucesso olhando só duas pastas antigas. Não confundir esse resultado com cobertura E01-S165–S186. A validação documental desta entrega inspeciona essas 22 pastas explicitamente: completude de arquivos, IDs, AC declarados, referências de teste+implementação, tarefas abertas, cobertura SSO/CT/AUT/RF, links e dependências acíclicas.

Não foi executada aplicação de migrations ou teste de código inexistente. Quickstarts documentam comandos a executar quando arquivos previstos existirem.

## Prompt de retomada

Continue o programa SSO usando docs/planejamento/plano-manutencao/programa-sso-terra.md. Execute apenas a próxima story liberada pelas dependências, em branch própria. Leia as fontes e ADR0026/27/28, respeite nomes Componentes/Sistemas e decisões do Fabrício. Comece testes antes da regra, preserve legado e registre evidências por AC. Não faça deploy, push, cobrança real ou tarefa real Auvo sem a autoridade operacional correspondente. Não reconstrua relatórios de 14/10 nem implemente Copiloto completo. Registre SPEC_DEVIATION se contrato real contrariar o design.
