# ADR-0367 — Conferência separada de confirmação para futuro envio

Status: proposta; gates fechados, sem testes nem envio.

A conferência PCM existente mantém sua projeção de ciência informativa; outra consulta informa separadamente se a política efetiva exige confirmação explícita e se existe confirmação do Portal vinculada à confirmação PCM e publicação vigentes. Não interpreta ciência prévia como aprovação. Política divergente do snapshot ou fonte indisponível resulta em pendência, não autorização. Esta leitura é apenas prévia: o comando futuro de intenção/envio deve revalidar tudo transacionalmente sob os locks de política e Visita, incluindo confirmação externa registrada pelo PCM quando houver contrato inequívoco. `autorizaEnvio` permanece falso, e esta etapa não cria intenção ou tarefa Auvo. Gate, permissões e UI permanecem fechados até testes e revisão.
