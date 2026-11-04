# ADR-0484 — caixa de triagem de respostas incertas de OS

Status: proposto; não aplicado nem homologado. A caixa reutiliza OS e declarações já existentes, sem criar uma segunda ocorrência ou alterar estados. Lista candidatos locais com status ou vínculo Auvo e a última declaração manual, com paginação por UUID e autorização de reconciliação no Cliente. O recorte não prova que cada resposta esteja efetivamente incerta nem abrange OS sem metadados locais. Situação remota permanece desconhecida e nenhuma retentativa é autorizada; testes de escopo, concorrência e dados são obrigatórios.
