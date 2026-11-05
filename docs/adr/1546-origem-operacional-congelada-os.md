# ADR-1546 — Origem operacional congelada por OS

Uma ocorrência pode sobreviver a várias versões; a OS aberta antes da revisão deve preservar a versão e o questionário usados na criação. Novas OS de Chamado preventivo usam a versão operacional efetiva e registram fotografia imutável com versão, Rotina, ocorrência e snapshot aprovado. Alterações posteriores da OS validam a fotografia original, não a versão vigente da ocorrência.

OS anteriores sem fotografia continuam na regra anterior, usando a versão da ocorrência; não se cria retrospectivamente uma origem incerta. Isso não muda OS existentes, códigos, histórico ou guarda 1045. A implantação exige coordenar 1687/1689 e consumidores de retorno, ACL, concorrência com aprovação, OS criadas antes/depois de vigência, replay, rollback e revisão adversarial; não habilitar antes dessas provas. Reversão restaura o trigger 1584 e mantém a tabela auditável sem apagar registros.
