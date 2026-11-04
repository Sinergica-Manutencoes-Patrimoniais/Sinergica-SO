# ADR-1194 — Identidade da OS na leitura de tarefa T−24

## Contexto

A confirmação de campos críticos comparava tarefa, técnico, alvo, horário e questionário, mas a leitura normalizada não verificava se o identificador externo remoto correspondia à OS. Uma tarefa errada com campos semelhantes poderia ser aceita; em atualização, o efeito poderia ser iniciado sem conferir a identidade remota.

## Decisão

Exigir a identidade da OS em cada leitura do fornecedor preparado. Antes de iniciar uma atualização, ler a tarefa e conferir a identidade; após a autorização e imediatamente antes do PATCH, reler; depois do efeito, repetir a leitura com a mesma expectativa. Ausência, formato inválido, divergência ou falha de leitura impedem atualização ou confirmação e encaminham à reconciliação. Preservar o contrato de leitura remota como hipótese até prova independente.

## Limitações

Uma leitura antes do envio não impede troca concorrente na origem entre leitura e PATCH. Nenhuma destas verificações comprova a semântica, unicidade ou imutabilidade do campo no Auvo. Testar contrato real, corrida, perda de resposta, persistência e revisão adversarial antes de conectar a rede; nenhum envio é autorizado por esta decisão.
