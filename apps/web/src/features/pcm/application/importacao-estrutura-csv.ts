/** Entrada de planilha exportada em CSV UTF-8; não interpreta fórmulas nem perde colunas. */
export const COLUNAS_ESTRUTURA = ["chave", "tipo", "nome", "observacoes", "quantidade", "codigoInformado", "referenciaPai", "sistemaProvisorio", "localProvisorio", "classificacao"] as const;
const colunas = COLUNAS_ESTRUTURA;
const tipos = new Set(["area","local","sublocal","sistema","equipamento","componente","grupo_quantitativo"]);
export type LinhaImportacaoEstrutura = { chave:string; tipo:string; atributos:Record<string,string> };
export type DiagnosticoLinhaCsv = { numero:number; chave:string; tipo:string; celulas:string[]; erros:string[]; alertas:string[]; linha:LinhaImportacaoEstrutura | null };

export function analisarEstruturaCsv(texto:string): DiagnosticoLinhaCsv[] {
  if (new TextEncoder().encode(texto).length > 1_048_576) throw new Error("Arquivo excede 1 MiB.");
  const linhas:string[][]=[]; let linha:string[]=[]; let campo=""; let citado=false; let fechou=false;
  const textoLimpo=texto.replace(/^\uFEFF/,"");
  for(let i=0;i<textoLimpo.length;i++){
    const c=textoLimpo[i];
    if(citado){if(c==='"'){if(textoLimpo[i+1]==='"'){campo+='"';i++;}else{citado=false;fechou=true;}}else campo+=c;continue;}
    if(fechou && c!==";" && c!=="\r" && c!=="\n") throw new Error("Texto após aspas de fechamento.");
    if(c==='"'){if(campo || fechou)throw new Error("Aspas em posição inválida.");citado=true;continue;}
    if(c===';'){linha.push(campo);campo="";fechou=false;continue;}
    if(c==='\r' || c==='\n'){if(c==='\r' && textoLimpo[i+1]==='\n')i++;linha.push(campo);linhas.push(linha);linha=[];campo="";fechou=false;continue;}
    campo+=c;
  }
  if(citado)throw new Error("Campo entre aspas não foi fechado.");
  if(campo || linha.length || fechou){linha.push(campo);linhas.push(linha);}
  const cabecalho=linhas[0];
  if(!cabecalho || cabecalho.length!==colunas.length || colunas.some((c,i)=>cabecalho[i]!==c))
    throw new Error(`Cabeçalho deve conter exatamente: ${colunas.join(";")}.`);
  // Mantém o número do registro original mesmo quando há registros vazios entre dados.
  const dados=linhas.slice(1).map((celulas,indice)=>({celulas,numero:indice+2})).filter(({celulas})=>celulas.some((c)=>c!==""));
  if(!dados.length || dados.length>1000)throw new Error("Informe entre 1 e 1000 linhas.");
  const contagem=new Map<string,number>();
  for(const {celulas:l} of dados){const chave=(l[0] ?? "").trim();if(chave)contagem.set(chave,(contagem.get(chave) ?? 0)+1);}
  const diagnosticos = dados.map(({celulas:l,numero})=>{
    const erros:string[]=[];const alertas:string[]=[];
    if(l.length!==colunas.length)erros.push("Quantidade incorreta de colunas.");
    const chave=(l[0] ?? "").trim();const tipo=(l[1] ?? "").trim();
    if(!chave || chave.length>200)erros.push("Chave ausente ou maior que 200 caracteres.");
    if(chave && (contagem.get(chave) ?? 0)>1)erros.push("Chave duplicada no arquivo.");
    if(!tipos.has(tipo))erros.push("Tipo inválido.");
    const atributos:Record<string,string>={};
    for(const [n,coluna] of colunas.entries()){if(n<2)continue;const valor=l[n] ?? "";if(valor.length>4000)erros.push(`${coluna} excede 4000 caracteres.`);if(valor!=="")atributos[coluna]=valor;}
    if(new TextEncoder().encode(JSON.stringify({chave,tipo,atributos})).length>32768)erros.push("Registro excede limite de recepção.");
    if(!atributos.nome?.trim())alertas.push("Nome ausente; precisa de conferência no lote.");
    const codigo=atributos.codigoInformado?.trim();if(codigo && (codigo.length>200 || codigo!==codigo.toUpperCase() || /\s/.test(codigo)))alertas.push("Código em formato inválido; será preservado para correção.");
    if (tipo === "grupo_quantitativo") {
      const quantidade = atributos.quantidade?.trim();
      if (!quantidade || !/^[1-9][0-9]{0,15}$/.test(quantidade) || !Number.isSafeInteger(Number(quantidade)))
        alertas.push("Quantidade do Grupo ausente ou incompatível; confira e corrija antes da incorporação.");
    }
    const linha=erros.length ? null : {chave,tipo,atributos};
    return {numero,chave,tipo,celulas:[...l],erros,alertas,linha};
  });
  // Referências são chaves declaradas no lote, não evidência sobre o cadastro oficial.
  const unicas = new Map(diagnosticos.filter((d) => d.chave && contagem.get(d.chave) === 1).map((d) => [d.chave, d]));
  const codigos = new Map<string, DiagnosticoLinhaCsv[]>();
  for (const diagnostico of diagnosticos) {
    const codigo = (diagnostico.celulas[5] ?? "").trim().toUpperCase();
    if (!codigo) continue;
    const grupo = codigos.get(codigo) ?? []; grupo.push(diagnostico); codigos.set(codigo, grupo);
  }
  for (const grupo of codigos.values()) if (grupo.length > 1)
    for (const diagnostico of grupo) diagnostico.alertas.push("Código informado repetido no arquivo; confira possível duplicidade.");
  const nomes = new Map<string, DiagnosticoLinhaCsv[]>();
  for (const diagnostico of diagnosticos) {
    const nome = (diagnostico.celulas[2] ?? "").trim().normalize("NFC").toLocaleLowerCase("pt-BR");
    if (!nome || !tipos.has(diagnostico.tipo)) continue;
    const chave = JSON.stringify([diagnostico.tipo, nome]);
    const iguais = nomes.get(chave) ?? [];
    iguais.push(diagnostico);
    nomes.set(chave, iguais);
  }
  for (const iguais of nomes.values()) if (iguais.length > 1)
    for (const diagnostico of iguais) diagnostico.alertas.push("Nome e tipo repetidos no arquivo; podem ser ativos distintos, confira Local e identificação.");
  const paisPermitidos: Record<string, readonly string[]> = {
    local: ["area"], sublocal: ["local", "sublocal"], sistema: ["area", "local", "sublocal"],
    equipamento: ["local", "sublocal"], componente: ["local", "sublocal", "equipamento"],
    grupo_quantitativo: ["local", "sublocal"],
  };
  const paiPorChave = new Map<string, string>();
  for (const diagnostico of diagnosticos) {
    const pai = (diagnostico.celulas[6] ?? "").trim();
    if (!pai) continue;
    if (diagnostico.tipo === "area") diagnostico.alertas.push("Área com referência de pai; revise a hierarquia antes da aprovação.");
    if (contagem.has(pai) && contagem.get(pai) !== 1) {
      diagnostico.alertas.push("Referência de pai ambígua no arquivo; há chaves repetidas.");
    } else if (!unicas.has(pai)) {
      diagnostico.alertas.push("Referência de pai não encontrada neste arquivo; confira vínculo no cadastro oficial.");
    } else if (diagnostico.chave && unicas.get(diagnostico.chave) === diagnostico) {
      const linhaPai = unicas.get(pai);
      const tipoPai = linhaPai?.tipo;
      if (linhaPai?.erros.length)
        diagnostico.alertas.push("Referência aponta para linha pai com erro estrutural; corrija e revise a dependência antes da aprovação.");
      if (diagnostico.tipo !== "area" && tipoPai && tipos.has(diagnostico.tipo) && tipos.has(tipoPai) && !paisPermitidos[diagnostico.tipo]?.includes(tipoPai))
        diagnostico.alertas.push("Tipo do pai no arquivo é incompatível; revise a hierarquia antes da aprovação.");
      paiPorChave.set(diagnostico.chave, pai);
    }
  }
  // Sistema e Local provisórios também podem ser descrições livres. Correspondência
  // com chave do lote é apenas indício, nunca vínculo confirmado ou erro definitivo.
  for (const diagnostico of diagnosticos) {
    const referencias = [
      { valor: (diagnostico.celulas[7] ?? "").trim(), rotulo: "Sistema sugerido", permitidos: ["sistema"] },
      { valor: (diagnostico.celulas[8] ?? "").trim(), rotulo: "Local sugerido", permitidos: ["local", "sublocal"] },
    ];
    for (const referencia of referencias) {
      if (!referencia.valor) continue;
      if ((contagem.get(referencia.valor) ?? 0) > 1) {
        diagnostico.alertas.push(`${referencia.rotulo} coincide com chaves repetidas no arquivo; se for referência, confira a ambiguidade.`);
        continue;
      }
      const destino = unicas.get(referencia.valor);
      if (!destino) {
        diagnostico.alertas.push(`${referencia.rotulo} não coincide com chave do arquivo; pode ser descrição ou referência externa, confira no cadastro oficial.`);
      } else if (!referencia.permitidos.includes(destino.tipo)) {
        diagnostico.alertas.push(`${referencia.rotulo} coincide com chave de tipo incompatível; se for referência, revise o vínculo.`);
      } else if (destino.erros.length) {
        diagnostico.alertas.push(`${referencia.rotulo} coincide com linha com erro estrutural; se for referência, revise o vínculo.`);
      }
    }
  }
  const visitadas = new Set<string>();
  const membrosCiclo = new Set<string>();
  for (const chave of paiPorChave.keys()) {
    if (visitadas.has(chave)) continue;
    const caminho: string[] = [];
    const posicoes = new Map<string, number>();
    let atual: string | undefined = chave;
    while (atual && !visitadas.has(atual)) {
      const posicao = posicoes.get(atual);
      if (posicao !== undefined) {
        for (const membro of caminho.slice(posicao)) {
          membrosCiclo.add(membro);
          unicas.get(membro)?.alertas.push("Ciclo de referências de pai no arquivo; revise a hierarquia.");
        }
        break;
      }
      posicoes.set(atual, caminho.length);
      caminho.push(atual);
      atual = paiPorChave.get(atual);
    }
    for (const membro of caminho) visitadas.add(membro);
  }
  // Uma linha fora do ciclo também fica sem caminho hierárquico confiável
  // quando depende de algum membro dele. Não bloquear ou incorporar o lote.
  const alcancaCiclo = new Map<string, boolean>([...membrosCiclo].map((chave) => [chave, true]));
  for (const chave of paiPorChave.keys()) {
    if (alcancaCiclo.has(chave)) continue;
    const caminho: string[] = [];
    let atual: string | undefined = chave;
    while (atual && !alcancaCiclo.has(atual)) {
      caminho.push(atual);
      atual = paiPorChave.get(atual);
    }
    const afetada = atual !== undefined && alcancaCiclo.get(atual) === true;
    for (const membro of caminho) {
      alcancaCiclo.set(membro, afetada);
      if (afetada) unicas.get(membro)?.alertas.push("Referência depende de uma hierarquia com ciclo no arquivo; revise o caminho antes da aprovação.");
    }
  }
  return diagnosticos;
}

export function lerEstruturaCsv(texto:string): LinhaImportacaoEstrutura[] {
  const diagnosticos=analisarEstruturaCsv(texto);const falha=diagnosticos.find(d=>d.erros.length);
  if(falha)throw new Error(`Linha ${falha.numero}: ${falha.erros.join(" ")}`);
  return diagnosticos.map(d=>d.linha!);
}
