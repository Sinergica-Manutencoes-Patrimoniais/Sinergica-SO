import { useMemo, useState } from "react";
import { ONDAS_PILOTO } from "../../domain/migracao-programa";

// Roteiro documental: docs/planejamento/plano-manutencao/matriz-rastreabilidade.md.
// Não representa execução, evidência ou aceite de qualquer cenário.
const cenarios: readonly [string, string, string][] = [
  ["CT-001","E01-S167","Um Chamado, três OS; encerrar duas mantém contêiner aberto"],
  ["CT-002","E01-S167","Parcial preserva horas e continuação recebe restante"],
  ["CT-003","E01-S168","Confirmar sete dias antes; nenhum envio antes da janela"],
  ["CT-004","E01-S168","Confirmar dentro de 24 h; tarefa por OS elegível"],
  ["CT-005","E01-S168","Três reexecuções/envios concorrentes; mesmos IDs"],
  ["CT-006","E01-S171","Reprogramar associação e preservar tarefa; S168 executa atualização"],
  ["CT-007","E01-S166","Feriado por Visita sem Visita, ocorrência ou capacidade"],
  ["CT-008","E01-S166","Rotina legal/calendário permanece pendente; âncora e tolerância"],
  ["CT-009","E01-S166","Novo dia contratual só com vigência futura"],
  ["CT-010","E01-S171","Extra e regular coexistem sem mudar regra semanal"],
  ["CT-011","E01-S172","10 h em 8 h alerta confirmável; composição também verificada"],
  ["CT-012","E01-S176","Sistema distribuído em vários Locais, dois eixos"],
  ["CT-013","E01-S176","VRF sem ciclo, vínculo cruzado e com histórico"],
  ["CT-014","E01-S176","20 luminárias em Grupo por Local sem 20 TAGs"],
  ["CT-015","E01-S177","Identidade protegida; alias excepcional pesquisável"],
  ["CT-016","E01-S173","Três Não OK mantêm preventiva executada e três Pendências"],
  ["CT-017","E01-S173","Corrigido guarda evidência e não abre Pendência"],
  ["CT-018","E01-S173","Promover duas de sete; S174 compõe e preserva fontes"],
  ["CT-019","E01-S174","Devolver somente não resolvido ao Backlog"],
  ["CT-020","E01-S175","Task com ID válido liga Chamado correto"],
  ["CT-021","E01-S175","Sem ID válido: OS/provisório únicos e triagem"],
  ["CT-022","E01-S179","Bullets e prosa preservada, revisão juntar/dividir"],
  ["CT-023","E01-S179","Material faltante reabre exceção na mesma OS"],
  ["CT-024","E01-S184","Custo privado ausente em JSON/PDF/legado/anexo; preço em S181"],
  ["CT-025","E01-S181","Dispensa registrada sem zerar valor; versões congeladas"],
  ["CT-026","E01-S182","Origem única, parcial/complemento/estorno explícitos"],
  ["CT-027","E01-S183","Isolamento A/B e revogação, combinado S170/S184"],
  ["CT-028","E01-S168","Evento antigo não regride execução; S185 reconcilia"],
  ["CT-029","E01-S168","Timeout incerto reconcilia antes de POST; S185 expõe"],
  ["CT-030","E01-S186","Lote repetido sem diferença e reversão lógica controlada"],
];

export function MatrizCenarios() {
  const [filtro, setFiltro] = useState("");
  const visiveis = useMemo(() => {
    const termo = filtro.trim().toLocaleLowerCase("pt-BR");
    return termo ? cenarios.filter(c => c.some(v => v.toLocaleLowerCase("pt-BR").includes(termo))) : cenarios;
  }, [filtro]);
  if (import.meta.env.VITE_SSO_MATRIZ_HOMOLOGACAO_ENABLED !== "true") return null;
  return <section aria-label="Roteiro documental de homologação">
    <h3>Roteiro documental CT-001–030</h3>
    <p>Consulta da matriz de rastreabilidade, sem resultados ou evidências de execução. Não autoriza piloto, geração real, aceite ou retirada de planilhas.</p>
    <p>Cada execução exige versão, ambiente, executor, data, IDs, resultado, capturas ou logs seguros e ressalvas. A aprovação de cada onda depende de evidências e aceite explícito.</p>
    <h4>Ondas previstas</h4>
    <ol>{ONDAS_PILOTO.map((onda) => <li key={onda.id}>
      <strong>{onda.nome}</strong>
      <p>{onda.cenarios.length ? `Cenários: ${onda.cenarios.join(", ")}.` : "Sem cenários CT associados diretamente nesta prévia."}</p>
      <p>Conferências: {onda.verificacoes.join("; ")}.</p>
    </li>)}</ol>
    <p>CT-030 é uma conferência transversal de migração. Os cenários listados não esgotam os critérios de aceite de cada onda.</p>
    <label>Filtrar cenários <input value={filtro} onChange={e => setFiltro(e.target.value)} /></label>
    <p>{visiveis.length} de {cenarios.length} cenários do roteiro.</p>
    {visiveis.length ? <ol>{visiveis.map(([id,story,descricao]) => <li key={id}><strong>{id}</strong> · {story} · {descricao}</li>)}</ol> : <p>Nenhum cenário corresponde ao filtro.</p>}
  </section>;
}
