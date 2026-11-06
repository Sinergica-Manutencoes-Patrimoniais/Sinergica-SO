# ADR-0571 — Materialização de Visita em Plano legado existente

Status: preparada, gates desligados, não aplicada nem homologada. Para ocorrência preparada por Visita, o comando exige Plano legado existente relacionado pelo PCM, mesmo Cliente/alvo, origem contratual, ciclo/data compatíveis, data civil do snapshot e ausência de feriado declarado aplicável. Cria ou reutiliza somente o ciclo legado e vincula por 0723 na mesma transação, que também confere questionário e ausência de OS/tarefa. Não cria Plano fictício, OS ou Auvo.

Fonte de feriados é incompleta e vínculo humano não prova equivalência geral. A fila/retorno oficiais não consomem a ponte de Visita e 0729 mantém consumidores bloqueados; não é entrega operacional completa. Falta rever concorrência com gerador legado, locks, férias/feriados tardios, testes e revisão adversarial antes da ativação.
