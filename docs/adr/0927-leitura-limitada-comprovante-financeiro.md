# ADR-0927 — Leitura limitada de comprovante financeiro

## Contexto

A rota protegida por lançamento verifica o tamanho do Blob após o SDK baixar o objeto. Um comprovante legado grande pode consumir memória antes da recusa de 10 MiB. A autorização e a revalidação existentes não limitam o consumo durante a transferência.

## Decisão

Usar a API autenticada do Storage configurado com credencial de serviço exclusivamente no servidor, sem redirecionamentos, e ler o corpo por partes até 10 MiB. Cancelar a leitura ao ultrapassar o limite, independentemente do `Content-Length`; não encaminhar bytes antes da revalidação de autorização. Preservar status 413 para excesso, 503 para erro de Storage, resposta binária sem caminho e a segunda consulta de autorização. Codificar cada segmento do caminho sem permitir segmentos vazios ou `.`/`..`; não registrar caminho, resposta do Storage ou credencial.

## Compatibilidade e limites

Arquivos dentro do limite continuam baixáveis. Caminhos malformados ou com segmentos especiais de navegação passam a falhar fechados; inventariar formatos legados e testar o Storage real antes da publicação. Um chunk de rede pode ser entregue inteiro antes da verificação e o consumo máximo de memória não é garantido apenas pelo limite acumulado. Sem timeout de leitura e sem prova de concorrência após a última verificação, o risco não está totalmente resolvido.

## Implantação e reversão

Alteração local da Edge Function, sem dados, gates, deploy ou permissões novos. Implantar somente após testes integrados e revisão adversarial; reversão coordenada para versão anterior mantém proteção de autorização, mas perde limitação antecipada de memória. Não alterar links históricos nem remover arquivos.
