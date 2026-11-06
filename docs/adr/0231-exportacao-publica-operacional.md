# ADR-0231 — Leitura e exportação pública operacional

**Estado:** preparação fechada, não homologada nem implantada.

Detalhes e PDF de proposta operacional usam somente snapshot público explicitamente revisado, tanto para origem com oportunidade quanto para origem diretamente operacional. A consulta confere contato ativo e vínculo atual com a Conta, OS, lista e versão; não retorna payload privado nem custa, margem ou comprovantes. O Portal gera PDF localmente a partir dessa projeção após nova consulta autorizada e nova verificação antes do download; não cria link ou arquivo público no Storage.

Gate próprio e RPCs permanecem fechados. O snapshot depende de revisão humana de texto. Somente a versão atual publicada é servida nesta fatia; exportação de versões históricas requer política própria. Antes de ativar, verificar acessos legados e PDFs prévios, concorrência de revogação, validação de payload, cache, escopo e links, além de testes integrados e revisão adversarial. Não enviar proposta ou executar cobrança.
