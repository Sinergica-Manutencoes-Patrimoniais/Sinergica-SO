# ADR-1170 — Observação de resposta tardia T−24

Status: proposta local, não aplicada nem homologada.

Quando a resposta de um efeito chega depois de a tentativa perder seu fence ou mudar de estado, registrar apenas observação imutável ligada à tentativa e ao fence anterior. A observação não altera o estado atual, não vincula tarefa à OS e não comprova sucesso ou cancelamento. O mesmo requestId com conteúdo idêntico devolve recibo; conteúdo diferente é conflito. Identificador remoto é dado observado, não identidade validada.

O serviço deve registrar somente respostas de tentativa que iniciou efeito comprovadamente; o comando exige evento de início com fence correspondente. Gate nasce fechado e função permanece sem EXECUTE. Ainda faltam registro de início confiável, consulta e triagem, retenção, privacidade, autorização, integração do executor, concorrência, FORCE RLS e revisão adversarial.
