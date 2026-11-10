import { useEffect, useRef, useState } from "react";
import {
  type EdicaoMateriais,
  criarEdicaoMateriais,
  conferirTrechosMateriais,
  dividirLinhaMaterial,
  juntarLinhasMateriais,
  moverLinhaMaterial,
} from "../../domain/edicao-materiais";

export type RascunhoEditorMateriais = {
  edicao: EdicaoMateriais;
  divisao: { indice: number; primeira: string; segunda: string } | null;
  selecionadas: number[];
  descricaoReunida: string;
  adicao?: { indiceFonte: string; descricao: string } | null;
};
type Props = {
  contexto: string;
  textoOriginal: string;
  edicaoInicial?: EdicaoMateriais;
  rascunho?: RascunhoEditorMateriais;
  onRascunho?: (rascunho: RascunhoEditorMateriais) => void;
  salvar?: (edicao: EdicaoMateriais) => Promise<void>;
};

/** Contexto deve incluir sessão, Cliente, lista e revisão; gateway exige autorização no servidor. */
export function EditorMateriais(props: Props) {
  return <Conteudo key={props.contexto} {...props} />;
}

function Conteudo({ textoOriginal, edicaoInicial, rascunho, salvar, onRascunho }: Props) {
  const [edicao, setEdicao] = useState(
    () => rascunho?.edicao ?? edicaoInicial ?? criarEdicaoMateriais(textoOriginal),
  );
  const [chaves, setChaves] = useState(() => edicao.linhas.map(() => crypto.randomUUID()));
  const [divisao, setDivisao] = useState<{
    indice: number;
    primeira: string;
    segunda: string;
  } | null>(rascunho?.divisao ?? null);
  const [selecionadas, setSelecionadas] = useState<number[]>(rascunho?.selecionadas ?? []);
  const [descricaoReunida, setDescricaoReunida] = useState(rascunho?.descricaoReunida ?? "");
  const [adicao, setAdicao] = useState<{ indiceFonte: string; descricao: string } | null>(rascunho?.adicao ?? null);
  const fontes = edicao.textoOriginal.split(/\r\n|\n|\r/).filter((trecho) => trecho.trim().length > 0);
  const estadoInicial = useRef(JSON.stringify({ edicao, divisao, selecionadas, descricaoReunida, adicao }));
  const relatarRascunho = useRef(onRascunho);
  relatarRascunho.current = onRascunho;
  useEffect(() => {
    const estado = { edicao, divisao, selecionadas, descricaoReunida, adicao };
    if (JSON.stringify(estado) !== estadoInicial.current) relatarRascunho.current?.(estado);
  }, [edicao, divisao, selecionadas, descricaoReunida, adicao]);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  const [confirmarRestauracao, setConfirmarRestauracao] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const conferencia = conferirTrechosMateriais(edicao);
  const enviando = useRef(false);
  function adicionarLinha() {
    setConfirmarRestauracao(false);
    const indice = Number(adicao?.indiceFonte);
    const trecho = fontes[indice];
    if (!adicao || adicao.indiceFonte === "" || !Number.isInteger(indice) || !trecho || !adicao.descricao.trim()) {
      setErro("Selecione um trecho original e informe a descrição da nova linha.");
      return;
    }
    if (edicao.linhas.length >= 1000 || adicao.descricao.length > 4000) {
      setErro("A lista aceita até 1.000 linhas e a descrição até 4.000 caracteres.");
      return;
    }
    setEdicao((atual) => ({ ...atual, linhas: [...atual.linhas, {
      descricao: adicao.descricao, quantidade: null, unidade: null, trechosOriginais: [trecho],
    }] }));
    setChaves((atuais) => [...atuais, crypto.randomUUID()]);
    setAdicao(null);
    setConfirmarLimpeza(false);
    setErro("");
    setSucesso(false);
  }
  function confirmarDivisao() {
    setConfirmarRestauracao(false);
    if (!divisao || !divisao.primeira.trim() || !divisao.segunda.trim()) {
      setErro("Informe as duas descrições para dividir a linha.");
      return;
    }
    if (edicao.linhas.length >= 1000 || divisao.primeira.length > 4000 || divisao.segunda.length > 4000) {
      setErro("A lista aceita até 1.000 linhas e cada descrição até 4.000 caracteres.");
      return;
    }
    const campos = [divisao.primeira, divisao.segunda].map((descricao) => ({
      descricao,
      quantidade: null,
      unidade: null,
    }));
    setEdicao((atual) => dividirLinhaMaterial(atual, divisao.indice, campos));
    setChaves((atuais) => [
      ...atuais.slice(0, divisao.indice),
      crypto.randomUUID(),
      crypto.randomUUID(),
      ...atuais.slice(divisao.indice + 1),
    ]);
    setDivisao(null);
    setConfirmarLimpeza(false);
    setSelecionadas([]);
    setErro("");
    setSucesso(false);
  }
  function juntar() {
    setConfirmarRestauracao(false);
    if (selecionadas.length < 2 || !descricaoReunida.trim()) {
      setErro("Selecione ao menos duas linhas e informe a descrição reunida.");
      return;
    }
    const referencias = selecionadas.reduce((total, indice) => total + (edicao.linhas[indice]?.trechosOriginais.length ?? 0), 0);
    if (descricaoReunida.length > 4000 || referencias > 1000) {
      setErro("A descrição aceita até 4.000 caracteres e a linha até 1.000 referências originais.");
      return;
    }
    setEdicao((atual) =>
      juntarLinhasMateriais(atual, selecionadas, {
        descricao: descricaoReunida,
        quantidade: null,
        unidade: null,
      }),
    );
    setChaves((atuais) => {
      const primeira = Math.min(...selecionadas);
      return atuais.filter((_, i) => i === primeira || !selecionadas.includes(i));
    });
    setSelecionadas([]);
    setDescricaoReunida("");
    setConfirmarLimpeza(false);
    setErro("");
    setSucesso(false);
  }
  function atualizar(indice: number, campo: "descricao" | "quantidade" | "unidade", valor: string) {
    setConfirmarLimpeza(false);
    setConfirmarRestauracao(false);
    setEdicao((atual) => ({
      ...atual,
      linhas: atual.linhas.map((linha, i) =>
        i === indice ? { ...linha, [campo]: campo === "descricao" ? valor : valor || null } : linha,
      ),
    }));
    setErro("");
    setSucesso(false);
  }
  function mover(indice: number, destino: number) {
    setConfirmarLimpeza(false);
    setConfirmarRestauracao(false);
    setEdicao((atual) => moverLinhaMaterial(atual, indice, destino));
    setChaves((atuais) => {
      const proximas = [...atuais];
      const [chave] = proximas.splice(indice, 1);
      if (chave === undefined) return atuais;
      proximas.splice(destino, 0, chave);
      return proximas;
    });
    setSelecionadas([]);
    setErro("");
    setSucesso(false);
  }
  function remover(indice: number) {
    setConfirmarRestauracao(false);
    setEdicao((atual) => ({ ...atual, linhas: atual.linhas.filter((_, i) => i !== indice) }));
    setChaves((atuais) => atuais.filter((_, i) => i !== indice));
    setSelecionadas([]);
    setConfirmarLimpeza(false);
    setErro("");
    setSucesso(false);
  }
  function limparOrganizacao() {
    setConfirmarRestauracao(false);
    setEdicao((atual) => ({ ...atual, linhas: [] }));
    setChaves([]);
    setSelecionadas([]);
    setDescricaoReunida("");
    setConfirmarLimpeza(false);
    setErro("");
    setSucesso(false);
  }
  function restaurarOrganizacao() {
    const inicial = criarEdicaoMateriais(edicao.textoOriginal);
    if (inicial.linhas.length > 1000) {
      setErro("A leitura inicial contém mais de 1.000 linhas; organize o texto em listas menores.");
      setConfirmarRestauracao(false);
      return;
    }
    setEdicao(inicial);
    setChaves(inicial.linhas.map(() => crypto.randomUUID()));
    setSelecionadas([]);
    setDescricaoReunida("");
    setConfirmarLimpeza(false);
    setConfirmarRestauracao(false);
    setErro("");
    setSucesso(false);
  }
  async function enviar() {
    if (!salvar || enviando.current) return;
    if (edicao.linhas.length > 1000) {
      setErro("A lista aceita até 1.000 linhas. Revise a organização antes de salvar.");
      return;
    }
    for (const [indice, linha] of edicao.linhas.entries()) {
      const numero = indice + 1;
      if (!linha.descricao.trim() || linha.descricao.length > 4000) {
        setErro(`Linha ${numero}: informe descrição com até 4.000 caracteres.`);
        return;
      }
      if (linha.quantidade !== null && (!linha.quantidade.trim() || linha.quantidade.length > 200)) {
        setErro(`Linha ${numero}: quantidade deve ter entre 1 e 200 caracteres, ou ficar vazia.`);
        return;
      }
      if (linha.unidade !== null && (!linha.unidade.trim() || linha.unidade.length > 200)) {
        setErro(`Linha ${numero}: unidade deve ter entre 1 e 200 caracteres, ou ficar vazia.`);
        return;
      }
      if (linha.trechosOriginais.length < 1 || linha.trechosOriginais.length > 1000 || linha.trechosOriginais.some((trecho) => trecho.length === 0)) {
        setErro(`Linha ${numero}: revise as referências ao texto original antes de salvar.`);
        return;
      }
    }
    enviando.current = true;
    setOcupado(true);
    setErro("");
    setSucesso(false);
    try {
      await salvar(edicao);
      setSucesso(true);
    } catch {
      setErro("Não foi possível salvar. A edição permanece disponível.");
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }
  return (
    <section aria-label="Editor de materiais">
      <label>
        Texto original
        <textarea readOnly value={edicao.textoOriginal} />
      </label>
      <p>Organização opcional; revise os itens sem alterar a evidência original.</p>
      {(conferencia.ausentes.length > 0 || conferencia.naoReconhecidos.length > 0) && <details>
        <summary>Conferir referências dos trechos originais</summary>
        <p>Comparação informativa por texto; trechos idênticos e divisões não comprovam cobertura de cada ocorrência. O texto original permanece preservado.</p>
        {conferencia.ausentes.length > 0 && <><p>Trechos reconhecidos na leitura inicial sem referência nas linhas atuais:</p><ul>{conferencia.ausentes.map((trecho)=><li key={trecho}>{trecho}</li>)}</ul></>}
        {conferencia.naoReconhecidos.length > 0 && <><p>Referências não reconhecidas na leitura inicial:</p><ul>{conferencia.naoReconhecidos.map((trecho)=><li key={trecho}>{trecho}</li>)}</ul></>}
      </details>}
      {edicao.linhas.map((linha, indice) => (
        <fieldset key={chaves[indice]} disabled={ocupado}>
          <legend>Linha {indice + 1}</legend>
          <label>
            <input
              type="checkbox"
              checked={selecionadas.includes(indice)}
              onChange={(e) =>
                setSelecionadas((atuais) =>
                  e.target.checked ? [...atuais, indice] : atuais.filter((i) => i !== indice),
                )
              }
            />
            Selecionar linha {indice + 1} para juntar
          </label>
          <p>Trecho original: {linha.trechosOriginais.join(" · ")}</p>
          <label>
            Descrição da linha {indice + 1}
            <input
              value={linha.descricao}
              onChange={(e) => atualizar(indice, "descricao", e.target.value)}
            />
          </label>
          <label>
            Quantidade da linha {indice + 1}
            <input
              value={linha.quantidade ?? ""}
              onChange={(e) => atualizar(indice, "quantidade", e.target.value)}
            />
          </label>
          <label>
            Unidade da linha {indice + 1}
            <input
              value={linha.unidade ?? ""}
              onChange={(e) => atualizar(indice, "unidade", e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={divisao !== null || edicao.linhas.length >= 1000}
            onClick={() => setDivisao({ indice, primeira: "", segunda: "" })}
          >
            Dividir linha {indice + 1}
          </button>
          <button type="button" disabled={divisao !== null || indice === 0} onClick={() => mover(indice, indice - 1)}>
            Mover linha {indice + 1} para cima
          </button>
          <button type="button" disabled={divisao !== null || indice === edicao.linhas.length - 1} onClick={() => mover(indice, indice + 1)}>
            Mover linha {indice + 1} para baixo
          </button>
          <button type="button" disabled={divisao !== null || adicao !== null} onClick={() => remover(indice)}>
            Remover linha {indice + 1}
          </button>
        </fieldset>
      ))}
      {edicao.linhas.length > 0 && !confirmarLimpeza && (
        <button type="button" disabled={ocupado || divisao !== null || adicao !== null} onClick={() => setConfirmarLimpeza(true)}>
          Limpar itens organizados
        </button>
      )}
      {confirmarLimpeza && (
        <fieldset disabled={ocupado || divisao !== null || adicao !== null}>
          <legend>Limpar itens organizados?</legend>
          <p>As edições das linhas serão removidas. O texto original permanece preservado.</p>
          <button type="button" onClick={limparOrganizacao}>Confirmar limpeza</button>
          <button type="button" onClick={() => setConfirmarLimpeza(false)}>Manter itens</button>
        </fieldset>
      )}
      {!confirmarRestauracao ? (
        <button type="button" disabled={ocupado || divisao !== null || adicao !== null} onClick={() => { setConfirmarLimpeza(false); setConfirmarRestauracao(true); }}>
          Refazer organização a partir do original
        </button>
      ) : (
        <fieldset disabled={ocupado || divisao !== null || adicao !== null}>
          <legend>Refazer organização?</legend>
          <p>As linhas editadas serão substituídas pela leitura inicial. O texto original não será alterado.</p>
          <button type="button" onClick={restaurarOrganizacao}>Confirmar nova organização</button>
          <button type="button" onClick={() => setConfirmarRestauracao(false)}>Manter edição</button>
        </fieldset>
      )}
      {adicao ? (
        <fieldset disabled={ocupado}>
          <legend>Adicionar linha vinculada ao original</legend>
          <label>Trecho original
            <select value={adicao.indiceFonte} onChange={(e) => setAdicao({ ...adicao, indiceFonte: e.target.value })}>
              <option value="">Selecione um trecho</option>
              {fontes.map((trecho, indice) => <option key={indice} value={indice}>{trecho}</option>)}
            </select>
          </label>
          <label>Descrição da nova linha
            <input value={adicao.descricao} onChange={(e) => setAdicao({ ...adicao, descricao: e.target.value })} />
          </label>
          <p>Quantidade e unidade ficam em branco até serem informadas.</p>
          <button type="button" onClick={adicionarLinha}>Adicionar linha</button>
          <button type="button" onClick={() => { setAdicao(null); setErro(""); }}>Cancelar adição</button>
        </fieldset>
      ) : (
        <button type="button" disabled={ocupado || divisao !== null || fontes.length === 0 || edicao.linhas.length >= 1000}
          onClick={() => setAdicao({ indiceFonte: "", descricao: "" })}>Nova linha a partir do original</button>
      )}
      {edicao.linhas.length >= 2 && (
        <fieldset disabled={ocupado || divisao !== null}>
          <legend>Juntar linhas</legend>
          <p>Quantidades e unidades devem ser informadas novamente após a junção.</p>
          <label>
            Descrição da linha reunida
            <input value={descricaoReunida} onChange={(e) => setDescricaoReunida(e.target.value)} />
          </label>
          <button type="button" onClick={juntar}>
            Juntar linhas selecionadas
          </button>
        </fieldset>
      )}
      {divisao && (
        <fieldset disabled={ocupado}>
          <legend>Dividir linha {divisao.indice + 1}</legend>
          <p>Quantidades e unidades devem ser informadas novamente após a divisão.</p>
          <label>
            Primeira descrição
            <input
              value={divisao.primeira}
              onChange={(e) => setDivisao({ ...divisao, primeira: e.target.value })}
            />
          </label>
          <label>
            Segunda descrição
            <input
              value={divisao.segunda}
              onChange={(e) => setDivisao({ ...divisao, segunda: e.target.value })}
            />
          </label>
          <button type="button" onClick={confirmarDivisao}>
            Confirmar divisão
          </button>
          <button
            type="button"
            onClick={() => {
              setDivisao(null);
              setErro("");
            }}
          >
            Cancelar divisão
          </button>
        </fieldset>
      )}
      {!salvar ? (
        <p>Esta edição não está conectada à gravação.</p>
      ) : (
        <button type="button" disabled={ocupado || divisao !== null || adicao !== null} onClick={() => void enviar()}>
          Salvar linhas
        </button>
      )}
      {erro && <p role="alert">{erro}</p>}
      {sucesso && <output>Linhas enviadas ao serviço configurado.</output>}
    </section>
  );
}
