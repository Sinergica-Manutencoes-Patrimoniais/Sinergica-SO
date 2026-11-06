# ADR-0819 — Seleção única da leitura de comprovantes

Status: preparado, gate fechado, não homologado.

O serviço classifica a referência vigente após autorização atual. Com vínculo íntegro a reserva e confirmação da ingestão, retorna origem mediada e digest; sem qualquer reserva para o caminho ou objeto, retorna legado. Referência parcialmente vinculada ou ambígua falha fechada. Não há fallback para legado quando a leitura mediada ou verificação do hash falhar.

A Edge busca bytes e reconsulta a mesma referência antes de responder; para mediada exige correspondência de SHA-256. Legado permanece sem garantia retrospectiva de digest. Isso não demonstra armazenamento imutável. Resolver e função de leitura não autorizam rollout: além dos testes, é necessária coordenação para impedir acesso paralelo por leitores legados, revisão de segurança e homologação. Gates iniciam fechados, nenhuma política Storage é alterada.
