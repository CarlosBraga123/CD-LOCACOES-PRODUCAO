import { converterMoedaParaNumero, formatarMoeda } from "./moeda";
import { normalizarTexto, obterObraDaAtividade } from "./obras";

const normalizarServicoContrato = (valor) =>
  normalizarTexto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const obterTipoContrato = (atividade) => {
  const servico = normalizarServicoContrato(atividade?.servico);

  if (servico === "instalacao") return "instalacao";
  if (servico === "somente aluguel") return "somente-aluguel";

  return null;
};

export const formatarValorContrato = (valor) => formatarMoeda(Number(valor || 0));

const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const especiais = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const centenas = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

const extensoAte999 = (numero) => {
  if (numero === 0) return "";
  if (numero === 100) return "cem";

  const partes = [];
  const centena = Math.floor(numero / 100);
  const resto = numero % 100;

  if (centena) partes.push(centenas[centena]);
  if (resto >= 10 && resto < 20) {
    partes.push(especiais[resto - 10]);
  } else {
    const dezena = Math.floor(resto / 10);
    const unidade = resto % 10;
    if (dezena) partes.push(dezenas[dezena]);
    if (unidade) partes.push(unidades[unidade]);
  }

  return partes.join(" e ");
};

export const valorMonetarioPorExtenso = (valor) => {
  const numero = Math.round(Number(valor || 0) * 100) / 100;
  const reais = Math.floor(numero);
  const centavos = Math.round((numero - reais) * 100);
  const partes = [];

  const milhoes = Math.floor(reais / 1000000);
  const milhares = Math.floor((reais % 1000000) / 1000);
  const resto = reais % 1000;

  if (milhoes) partes.push(`${extensoAte999(milhoes)} ${milhoes === 1 ? "milhão" : "milhões"}`);
  if (milhares) partes.push(`${milhares === 1 ? "mil" : `${extensoAte999(milhares)} mil`}`);
  if (resto) partes.push(extensoAte999(resto));

  const textoReais = partes.length ? partes.join(" e ") : "zero";
  const texto = `${textoReais} ${reais === 1 ? "real" : "reais"}`;

  if (!centavos) return texto.charAt(0).toUpperCase() + texto.slice(1);

  const textoCentavos = `${extensoAte999(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  const completo = `${texto} e ${textoCentavos}`;
  return completo.charAt(0).toUpperCase() + completo.slice(1);
};

export const limparTextoContrato = (valor) => String(valor ?? "").trim();

export const juntarPartesEndereco = (partes) =>
  partes.map(limparTextoContrato).filter(Boolean).join(", ");

export const obterCampoContrato = (objeto, campos) => {
  for (const campo of campos) {
    const valor = limparTextoContrato(objeto?.[campo]);
    if (valor) return valor;
  }
  return "";
};

export const obterDadosContrato = (atividade, obras = [], construtoras = []) => {
  const obra = obterObraDaAtividade(atividade, obras) || {};
  const nomeConstrutora = obra?.construtora || atividade?.construtora;
  const construtora =
    construtoras.find((item) => normalizarTexto(item?.nome) === normalizarTexto(nomeConstrutora)) || {};

  const enderecoConstrutora = juntarPartesEndereco([
    obterCampoContrato(construtora, ["endereco", "endereço", "logradouro"]),
    obterCampoContrato(construtora, ["numero", "número"]),
    obterCampoContrato(construtora, ["complemento"]),
    obterCampoContrato(construtora, ["bairro"]),
    obterCampoContrato(construtora, ["cidade"]),
    obterCampoContrato(construtora, ["estado", "uf"]),
    obterCampoContrato(construtora, ["cep", "CEP"]),
  ]);

  const enderecoObra = juntarPartesEndereco([
    obterCampoContrato(obra, ["endereco", "endereço", "localizacao", "localização"]),
    obterCampoContrato(obra, ["numero", "número"]),
    obterCampoContrato(obra, ["complemento"]),
    obterCampoContrato(obra, ["bairro"]),
    obterCampoContrato(obra, ["cidade"]),
    obterCampoContrato(obra, ["estado", "uf"]),
    obterCampoContrato(obra, ["cep", "CEP"]),
  ]);

  return {
    obra,
    construtora,
    razaoSocial:
      obterCampoContrato(construtora, ["razaoSocial", "razãoSocial", "razao social", "razão social", "nome"]) ||
      limparTextoContrato(nomeConstrutora),
    cnpj: obterCampoContrato(construtora, ["cnpj", "cpfCnpj", "cpf/cnpj", "CNPJ"]),
    enderecoConstrutora,
    nomeObra: obterCampoContrato(obra, ["nome"]) || limparTextoContrato(atividade?.obra),
    enderecoObra,
  };
};

const obterTabelaPadrao = () => {
  try {
    return JSON.parse(localStorage.getItem("tabelaComercialPadrao") || "null") || { servicos: {}, locacoes: {} };
  } catch {
    return { servicos: {}, locacoes: {} };
  }
};

const obterChaveServicoContrato = (atividade, servico) => {
  if (atividade?.equipamento === "Balancinho") {
    const tipo = atividade?.tipoBalancinho === "Manual" ? "Manual" : "Eletrico";
    return `Balancinho-${tipo}-${servico}`;
  }

  if (atividade?.equipamento === "Mini Grua") {
    const tipo = atividade?.tipoMiniGrua || "500kg";
    return `Mini Grua-${tipo}-${servico}`;
  }

  return `${atividade?.equipamento}-${servico}`;
};

const obterChaveLocacaoContrato = (atividade) => {
  if (atividade?.equipamento === "Balancinho") {
    const tipo = atividade?.tipoBalancinho === "Manual" ? "Manual" : "Eletrico";
    return `Balancinho-${tipo}`;
  }

  if (atividade?.equipamento === "Mini Grua") {
    const tipo = atividade?.tipoMiniGrua || "500kg";
    return `Mini Grua-${tipo}`;
  }

  return atividade?.equipamento;
};

const obterFallbackServicoAntigoContrato = (atividade, servico) => {
  try {
    const valoresServicos = JSON.parse(localStorage.getItem("valoresServicos") || "{}");
    const valoresPadrao = JSON.parse(localStorage.getItem("valoresPadrao") || "{}");
    const chaveAntiga = `${atividade?.equipamento}-${servico}`;

    if (valoresServicos[chaveAntiga] !== undefined) return Number(valoresServicos[chaveAntiga] || 0);
    if (valoresPadrao[chaveAntiga] !== undefined) return Number(valoresPadrao[chaveAntiga] || 0);
  } catch {
    return null;
  }

  return null;
};

const obterValorServicoTabela = (atividade, tabelas, servico) => {
  const atividadeConsulta = { ...atividade, servico };
  const chave = obterChaveServicoContrato(atividadeConsulta, servico);

  for (const tabela of tabelas) {
    if (tabela?.servicos?.[chave] !== undefined) return Number(tabela.servicos[chave] || 0);
  }

  return obterFallbackServicoAntigoContrato(atividadeConsulta, servico);
};

const obterValorLocacaoTabela = (atividade, tabelas) => {
  const chave = obterChaveLocacaoContrato(atividade);

  for (const tabela of tabelas) {
    if (tabela?.locacoes?.[chave] !== undefined) return Number(tabela.locacoes[chave] || 0);
  }

  return 0;
};

export const obterValoresContratoInstalacao = (atividade, dadosContrato) => {
  const tabelas = [
    dadosContrato?.obra?.tabelaComercial,
    dadosContrato?.construtora?.tabelaComercial,
    obterTabelaPadrao(),
  ].filter(Boolean);

  const aluguel =
    converterMoedaParaNumero(atividade?.valorMensalLocacao) ??
    atividade?.valoresCongelados?.locacaoMensalUnitario ??
    obterValorLocacaoTabela(atividade, tabelas);

  const instalacao =
    converterMoedaParaNumero(atividade?.valorUnitarioServico) ??
    atividade?.valoresCongelados?.servicoUnitario ??
    obterValorServicoTabela(atividade, tabelas, "Instalação");
  const remocao = obterValorServicoTabela(atividade, tabelas, "Remoção");
  const deslocamento = obterValorServicoTabela(atividade, tabelas, "Deslocamento");

  return {
    aluguel,
    instalacao,
    remocao,
    deslocamento,
  };
};
