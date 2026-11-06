# Ensaio isolado S165 — preparação parcial

O workflow dedicado prepara um clone sintético com Auth e PostgREST oficiais em rede interna e cron desligado. O operador e os dois Clientes são sintéticos; a senha é aleatória e transitória. O navegador e o build são executados em contêiner sem portas ou mounts, usando proxy restrito aos serviços do clone. A origem do código é o HEAD confirmado e limpo; o bootstrap rejeita dependências que apontem fora do checkout.

O cenário conectado cria um rascunho e troca de Cliente. Isso não comprova RLS: o mesmo operador tem concessão para ambos. O relatório exige exatamente um teste aprovado e não aceita skip como sucesso. O segundo cenário Playwright, de aprovação e questionário, ainda não está conectado a uma fixture canônica.

Permanecem pendentes: preparar revisão e impactos por comandos reais, questionário e versão histórica, retirada e suspensão; verificar snapshot e efeitos no banco; testar dois atores/Clientes e concorrência. A preparação histórica 1703 usa `session_replication_role=replica` e não é adotada como prova de integridade. Nenhuma prova de aprovação completa, produção ou Auvo é alegada.

O monitor e a limpeza verificam a identidade dos recursos e há etapa adicional de limpeza mesmo após falha. Cancelamento forçado, perda do runner ou indisponibilidade do daemon podem impedir limpeza; nesses casos o ambiente descartável deve ser destruído pelo provedor. As sondas de rede são limitadas e não substituem auditoria da rede. Esta preparação não foi executada.
