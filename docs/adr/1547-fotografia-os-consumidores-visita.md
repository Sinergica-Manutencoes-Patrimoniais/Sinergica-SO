# ADR-1547 — Fotografia de OS nos consumidores de Visita

Status: proposto; implementação parcial, sem homologação. Depende das migrations 1687 e 1689 e da revisão dos consumidores de retorno.

A origem operacional da OS criada a partir de Chamado poderá ser congelada por OS e diferir da versão que gerou a ocorrência. A ausência de vínculo legado não prova que a OS não seja de Visita. Consumidores de retorno e cobertura deverão usar a fotografia da OS e preservar o comportamento histórico para OS sem fotografia, sem deduzir nova versão para essas OS. A migração inicial amplia apenas a barreira de consumidor não integrado para reconhecer a fotografia. Nenhuma guarda de execução é aberta; 1045 não é alterada.

A migration 1692 prepara a adaptação da classificação, prévia e cobertura; continuam pendentes as provas funcionais correspondentes, concorrência, compatibilidade de OS anteriores e testes integrados antes de liberar a barreira.
