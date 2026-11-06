# Programa SSO — Caderno Técnico e Plano de Manutenção

**Pacote vigente de especificação, revisado em 26/10/2026:** [Programa SSO para Terra](programa-sso-terra.md).

22 stories E01-S165–S186 cobrem todo o Caderno Técnico v1 e as respostas posteriores do Fabrício. Não houve implementação desta iniciativa. As pastas antigas S165–S170 foram revisadas; IDs/caminhos mantidos por compatibilidade. O levantamento histórico de 14/10 não foi refeito.

## Ordem de leitura

1. CLAUDE.md, AGENTS.md, constituição e linhas da story escolhida no ROADMAP.
2. [Caderno Técnico v1](../../../Caderno_Tecnico_Implementacao_SSO_v1.docx) — origem recebida, base 23/10/2026.
3. [Definições posteriores do Fabrício](definicoes-fabricio-caderno-v1.md), que encerram as quatro dúvidas e P01/P02/P03.
4. [Programa/stories/dependências](programa-sso-terra.md), [contratos compartilhados](contratos-programa.md) e ADR0026/27/28 em docs/adr.
5. [Matriz SSO/CT/AUT/RF](matriz-rastreabilidade.md), [guia Terra](guia-execucao-terra.md), [validação documental](validacao-documental.md).
6. Spec/plan/tasks/research/data-model/contracts/quickstart/checklist da story ativa.

## Fontes anteriores preservadas

- [Decisões de 16/10](decisoes-consolidadas.md) e [respostas originais](fontes/respostas-fabricio-2026-10-16.txt).
- [Especificação funcional v2](fontes/especificacao-fabricio-v2.docx).
- [Plano Rimini](fontes/plano-rimini-2026-final.xlsx) e [Plano I Home](fontes/plano-i-home-2026.xlsx).
- [Hashes dos quatro originais](fontes/SHA256SUMS). Nenhum original foi modificado.

## Autoridade e limites

Respostas posteriores prevalecem sobre o Caderno e fontes antigas incompatíveis. Plano multialvo/Rotina com alvo único, modo por Visita/calendário, tolerâncias, código substituto com alias e levantamento aprovado são decisões fechadas. Preservar UI Componentes/Sistemas, identidades, códigos e cadastros. Propostas técnicas estão nas ADRs, não alteram a operação.

Planilhas são programação/massa de homologação, não execução. Rimini tem 25 tempos SPCI a validar; I Home cruza 2026/2027; SNN não é chave global. Não inferir cadastro/tempo/vínculo Auvo. API real, migration de produção, deploy, cobrança e tarefas reais não estão autorizados nesta entrega. Copiloto completo fica em etapa própria.

Relatórios anteriores: [entregas 14/10](../../entregas/2026-10-14/README.md). Fonte de estado operacional deve ser revalidada antes de implementar, não presumida por este documento.
