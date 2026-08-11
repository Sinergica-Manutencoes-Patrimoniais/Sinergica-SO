export function marcarInicioNavegacaoChamados() {
  performance.clearMarks("chamados:navigation-start");
  performance.clearMarks("chamados:data-ready");
  performance.clearMarks("chamados:content-painted");
  performance.mark("chamados:navigation-start");
}

export function marcarDadosProntosChamados() {
  performance.mark("chamados:data-ready");
}

export function marcarConteudoPintadoChamados() {
  performance.mark("chamados:content-painted");
}
