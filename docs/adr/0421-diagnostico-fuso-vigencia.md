# ADR-0421 — Diagnóstico de datas civis na revisão

Status: preparado, gate desligado, não aplicado nem homologado. O diagnóstico compara a data UTC de 0342 com as datas locais no mesmo instante para fusos IANA encontrados em Visitas do Cliente; fusos desconhecidos são contados, sem conversão. A lista é limitada a 50 fusos válidos e a consulta exige permissão e revisão do Plano.

Fuso de Visita não é automaticamente fuso do Plano, nem prova aplicação contratual. O diagnóstico não define política, não altera vigência nem autoriza aprovação. A fronteira de dia em UTC e o fuso operacional do Plano permanecem sujeitos a decisão e testes antes da ativação.
