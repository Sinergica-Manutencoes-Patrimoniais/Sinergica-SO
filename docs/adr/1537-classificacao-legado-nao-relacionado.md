# ADR-1537 — Classificar Plano legado não relacionado

A avaliação de revisão contava como indeterminado todo Plano legado sem relação declarada, mesmo quando o PCM constatava que não pertencia ao escopo. A declaração positiva não prova equivalência.

O PCM pode classificar um par como não relacionado mediante contexto, motivo e confirmação de fotografia vinculada à revisão do Plano, Plano legado, relação, ocorrências e OS conhecidas do Cliente. A gravação é auditada, idempotente e compara a fotografia sob travas. A avaliação existente exclui do contador apenas a classificação que ainda corresponde integralmente à fotografia; mudança de revisão, relação ou fontes volta a torná-la indeterminada. A classificação não altera geradores, ocorrências, OS nem prova fontes externas. Relações declaradas continuam exigindo tratamento próprio.

A guarda 1045 permanece. Implantação exige rever autorização, limite de 1000 itens, fontes não cobertas, custos das travas globais, concorrência, retry e execução completa dos testes, além de revisão adversarial. A reversão restaura a avaliação anterior e mantém o histórico auditável; nunca apagar decisões.
