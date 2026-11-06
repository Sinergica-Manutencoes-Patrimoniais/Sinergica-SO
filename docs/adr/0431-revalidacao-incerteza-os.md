# ADR-0431 — revalidação local da incerteza de OS

Status: proposto; não aplicado nem homologado.

Uma consulta autorizada relê a fonte local da OS e identifica a última declaração humana registrada, sem acessar o Auvo. Compara a versão e os campos de sincronização observados na declaração com a fonte atual. Ela expõe somente se houve alteração local e mantém estado remoto desconhecido e retry proibido em todos os casos.

A equivalência não garante que nada tenha sido alterado e revertido nem comprova o estado remoto. Não confirma vínculo, não fecha ocorrência e não executa escrita. O vínculo inequívoco e eventual retentativa dependem de fluxo proprietário, consulta remota segura, autorização e testes. Gates e grants permanecem fechados.
