const camposConstrutora = {
  nome: "",
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  ativa: true,
  responsavel: "",
  cargoResponsavel: "",
  telefone: "",
  whatsapp: "",
  email: "",
  emailFinanceiro: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  condicaoPagamento: "",
  responsavelComercial: "",
  observacoesInternas: "",
};

const clonarDados = (valor) => {
  if (Array.isArray(valor)) return valor.map(clonarDados);
  if (!valor || typeof valor !== "object") return valor;

  return Object.entries(valor).reduce((copia, [chave, item]) => {
    copia[chave] = clonarDados(item);
    return copia;
  }, {});
};

const limparTexto = (valor) => String(valor || "").trim();

export const criarFormularioConstrutora = (construtora = {}) => {
  const dados = clonarDados(construtora);

  return {
    ...camposConstrutora,
    ...dados,
    ativa: dados.ativa !== false,
  };
};

export const prepararConstrutoraParaSalvar = (formulario = {}) => ({
  ...clonarDados(formulario),
  nome: limparTexto(formulario.nome),
  razaoSocial: limparTexto(formulario.razaoSocial),
  nomeFantasia: limparTexto(formulario.nomeFantasia),
  cnpj: limparTexto(formulario.cnpj),
  inscricaoEstadual: limparTexto(formulario.inscricaoEstadual),
  inscricaoMunicipal: limparTexto(formulario.inscricaoMunicipal),
  responsavel: limparTexto(formulario.responsavel),
  cargoResponsavel: limparTexto(formulario.cargoResponsavel),
  telefone: limparTexto(formulario.telefone),
  whatsapp: limparTexto(formulario.whatsapp),
  email: limparTexto(formulario.email),
  emailFinanceiro: limparTexto(formulario.emailFinanceiro),
  cep: limparTexto(formulario.cep),
  logradouro: limparTexto(formulario.logradouro),
  numero: limparTexto(formulario.numero),
  complemento: limparTexto(formulario.complemento),
  bairro: limparTexto(formulario.bairro),
  cidade: limparTexto(formulario.cidade),
  estado: limparTexto(formulario.estado),
  condicaoPagamento: limparTexto(formulario.condicaoPagamento),
  responsavelComercial: limparTexto(formulario.responsavelComercial),
  observacoesInternas: limparTexto(formulario.observacoesInternas),
  ativa: formulario.ativa !== false,
});

export const mesclarConstrutoraEditada = ({
  registroExistente,
  dadosEditados,
  tabelaComercial,
}) => ({
  ...clonarDados(registroExistente),
  ...clonarDados(dadosEditados),
  id: registroExistente.id,
  tabelaComercial: clonarDados(tabelaComercial),
});
