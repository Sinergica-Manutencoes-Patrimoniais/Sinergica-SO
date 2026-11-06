# ADR-0077 — Prévia de ciclos de Rotina aprovada

## Decisão

Oferecer consulta somente leitura por Plano, versão aprovada e Rotina de calendário, autorizada por Cliente com `plano.gerir`. A fonte é exclusivamente o snapshot aprovado; ausência ou inconsistência falha explicitamente. A consulta limita janela a 366 dias, aplica vigência da versão e calcula ciclos a partir da âncora original via ADR-0076. Retorna vencimento e tolerâncias congeladas, sem alterar dados, gerar Ocorrências ou acionar Auvo.

Rotinas por Visita não usam esta consulta: dependem da agenda contratual e de feriados. Esta prévia não identifica feriados, ciclos já materializados, cancelamentos ou impactos; não constitui autorização para geração. A materialização futura deve reler e validar dados sob bloqueio, conforme ADR-0075.

## Compatibilidade e reversão

Consulta aditiva; não modifica o modelo legado nem os consumidores existentes. Pode ser retirada após remoção de seus consumidores. Antes de adoção operacional, validar performance, acesso de perfis além do gestor, concorrência, fusos aplicáveis e consistência com a geração transacional.
