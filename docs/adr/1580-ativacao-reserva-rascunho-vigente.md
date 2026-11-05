# ADR 1580 — Aplicação de escolha de rascunho após vigência

## Contexto
A decisão PCM em rascunho não pode alterar a geração antes da aprovação e da data de vigência. O selo auditado registra a escolha vinculada à versão aprovada; suas fontes ainda podem mudar antes da execução.

## Decisão
Os consumidores de geração legada, execução SSO e ponte consultam a escolha selada somente após verificar versão aprovada, vigência no fuso aplicável e identidade do ciclo. A validação verifica fotografia da regra aprovada e das fontes relevantes, sem alterar registros históricos nem introduzir efeito em leitura. Se a fonte mudou ou a identidade for ambígua, o comando que produziria efeito falha e exige reconciliação. Uma escolha ainda não vigente não suprime geração. Os consumidores usam as mesmas travas transacionais da reserva e não criam identidade nem tarefa por mera consulta.

## Limites
A implementação não ativa a guarda 1045, não prova fontes externas e não cancela ou reescreve OS. Concorrência, troca de versão, feriados de Visita, fontes alteradas e as três escolhas devem ser exercitadas antes da homologação.
