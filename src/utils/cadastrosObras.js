export const situacoesObra = ["Ativa", "Paralisada", "Conclu\u00edda", "Inativa"];

const camposObra = {
  nome: "",
  construtora: "",
  construtoraId: "",
  cnpj: "",
  cno: "",
  codigoInterno: "",
  situacao: "Ativa",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  pontoReferencia: "",
  engenheiro: "",
  endereco: "",
  observacoes: "",
  responsavel: "",
  cargoResponsavel: "",
  telefone: "",
  whatsapp: "",
  email: "",
  horarioEntrega: "",
  orientacoesAcesso: "",
  enderecoEntregaDiferente: false,
  enderecoEntrega: "",
  contatos: [],
};

const clonarDados = (valor) => {
  if (Array.isArray(valor)) return valor.map(clonarDados);
  if (!valor || typeof valor !== "object") return valor;

  return Object.entries(valor).reduce((copia, [chave, item]) => {
    copia[chave] = clonarDados(item);
    return copia;
  }, {});
};

const texto = (valor) => String(valor || "").trim();

export const criarContato = (dados = {}) => ({
  ...clonarDados(dados),
  id: dados.id || String(Date.now() + Math.random()),
  tipo: dados.tipo || "Engenheiro",
  nome: dados.nome || "",
  cargo: dados.cargo || "",
  crea: dados.crea || "",
  telefone: dados.telefone || "",
  whatsapp: dados.whatsapp || "",
  email: dados.email || "",
  principal: dados.principal === true,
  ativo: dados.ativo !== false,
});

export const criarFormularioObra = (obra = {}) => {
  const dados = clonarDados(obra);

  return {
    ...camposObra,
    ...dados,
    situacao: dados.situacao || "Ativa",
    enderecoEntregaDiferente: dados.enderecoEntregaDiferente === true,
    contatos: Array.isArray(dados.contatos)
      ? dados.contatos.map(criarContato)
      : [],
  };
};

const contatoTemConteudo = (contato) =>
  [
    contato.tipo,
    contato.nome,
    contato.cargo,
    contato.crea,
    contato.telefone,
    contato.whatsapp,
    contato.email,
  ].some((valor) => texto(valor));

export const prepararContatosParaSalvar = (contatos = []) =>
  contatos
    .map((contato) => ({
      ...criarContato(contato),
      tipo: texto(contato.tipo) || "Contato",
      nome: texto(contato.nome),
      cargo: texto(contato.cargo),
      crea: texto(contato.crea),
      telefone: texto(contato.telefone),
      whatsapp: texto(contato.whatsapp),
      email: texto(contato.email),
      principal: contato.principal === true,
      ativo: contato.ativo !== false,
    }))
    .filter(contatoTemConteudo);

export const prepararObraParaSalvar = (formulario = {}) => ({
  ...clonarDados(formulario),
  nome: texto(formulario.nome),
  construtora: texto(formulario.construtora),
  construtoraId: formulario.construtoraId || "",
  cnpj: texto(formulario.cnpj),
  cno: texto(formulario.cno),
  codigoInterno: texto(formulario.codigoInterno),
  situacao: formulario.situacao || "Ativa",
  cep: texto(formulario.cep),
  logradouro: texto(formulario.logradouro),
  numero: texto(formulario.numero),
  complemento: texto(formulario.complemento),
  bairro: texto(formulario.bairro),
  cidade: texto(formulario.cidade),
  estado: texto(formulario.estado),
  pontoReferencia: texto(formulario.pontoReferencia),
  engenheiro: texto(formulario.engenheiro),
  endereco: texto(formulario.endereco),
  observacoes: texto(formulario.observacoes),
  responsavel: texto(formulario.responsavel),
  cargoResponsavel: texto(formulario.cargoResponsavel),
  telefone: texto(formulario.telefone),
  whatsapp: texto(formulario.whatsapp),
  email: texto(formulario.email),
  horarioEntrega: texto(formulario.horarioEntrega),
  orientacoesAcesso: texto(formulario.orientacoesAcesso),
  enderecoEntregaDiferente: formulario.enderecoEntregaDiferente === true,
  enderecoEntrega: texto(formulario.enderecoEntrega),
  contatos: prepararContatosParaSalvar(formulario.contatos || []),
});

export const aplicarConstrutoraAoFormularioObra = (formulario, construtora) => ({
  ...clonarDados(formulario),
  construtora: construtora?.nome || "",
  construtoraId: construtora?.id || "",
});

export const mesclarObraEditada = ({
  registroExistente,
  dadosEditados,
  construtoraId,
  tabelaComercial,
}) => ({
  ...clonarDados(registroExistente),
  ...clonarDados(dadosEditados),
  id: registroExistente.id,
  construtoraId:
    construtoraId ||
    dadosEditados.construtoraId ||
    registroExistente.construtoraId ||
    "",
  tabelaComercial: clonarDados(tabelaComercial),
});
