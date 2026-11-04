# ADR-0902 — Evidência de fórmulas na prévia XLSX

Data: 2026-10-30 · Status: preparação local; não ativa importação.

## Contexto

Cronogramas de origem contêm fórmulas e resultados armazenados, inclusive fórmulas compartilhadas. Ignorar o cache como dado operacional é necessário, mas substituir células por `null` sem registrar a origem perderia evidência. O staging de Plano ainda exige reconciliação com E01-S178.

## Decisão

Separar a matriz de conferência de uma coleção de evidências não confiáveis por célula, com referência, tipo, valor armazenado interpretado, fórmula e metadados de compartilhamento. A coleção é apenas uma representação local dos campos interpretados: não substitui o arquivo original nem garante preservação byte a byte, estilos completos ou XML. Fórmulas não são executadas, caches não alimentam cálculos nem aprovação, e campos necessários com fórmula continuam bloqueados. Limites de leitura existentes continuam vigentes.

A persistência dessa evidência e/ou do arquivo de origem, identidade/hash, autorização e retenção devem ser projetadas e testadas no staging canônico antes de qualquer integração operacional. Não colocar fórmulas em CSV/XLSX exportável sem prevenção de execução. Não registrar conteúdo em logs. Rollback: manter o leitor desligado. Seguem abertas a revisão adversarial, limites de memória e conexão à interface.

A preparação local calcula SHA-256 da mesma cópia limitada de bytes enviada à extração, para identificar a origem sem expor seu conteúdo. O hash isolado não comprova autenticidade, não substitui o arquivo nem sua custódia e deverá ser conferido pelo servidor antes de qualquer vínculo persistente.
