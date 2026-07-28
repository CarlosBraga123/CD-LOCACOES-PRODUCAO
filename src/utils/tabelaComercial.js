import { normalizarValoresMonetarios } from "./moeda";

export const tabelaComercialInicial = {
  versao: 1,
  servicos: {
    "Balancinho-Eletrico-Instala\u00e7\u00e3o": 1000,
    "Balancinho-Eletrico-Deslocamento": 1000,
    "Balancinho-Eletrico-Manuten\u00e7\u00e3o": 0,
    "Balancinho-Eletrico-Remo\u00e7\u00e3o": 1000,
    "Balancinho-Manual-Instala\u00e7\u00e3o": 900,
    "Balancinho-Manual-Deslocamento": 900,
    "Balancinho-Manual-Manuten\u00e7\u00e3o": 0,
    "Balancinho-Manual-Remo\u00e7\u00e3o": 900,
    "Balancinho-Contrapeso-Instala\u00e7\u00e3o": 0,
    "Balancinho-Contrapeso-Deslocamento": 0,
    "Balancinho-Contrapeso-Manuten\u00e7\u00e3o": 0,
    "Balancinho-Contrapeso-Remo\u00e7\u00e3o": 0,
    "Mini Grua-500kg-Instala\u00e7\u00e3o": 4000,
    "Mini Grua-500kg-Ascens\u00e3o": 900,
    "Mini Grua-500kg-Manuten\u00e7\u00e3o": 0,
    "Mini Grua-500kg-Remo\u00e7\u00e3o": 4000,
    "Mini Grua-1T-Instala\u00e7\u00e3o": 8500,
    "Mini Grua-1T-Ascens\u00e3o": 1000,
    "Mini Grua-1T-Manuten\u00e7\u00e3o": 0,
    "Mini Grua-1T-Remo\u00e7\u00e3o": 8500,
  },
  locacoes: {
    "Balancinho-Eletrico": 1200,
    "Balancinho-Manual": 1000,
    "Balancinho-Contrapeso": 600,
    "Mini Grua-500kg": 0,
    "Mini Grua-1T": 0,
  },
};

export const criarTabelaComercialInicial = (dados = {}) => ({
  ...dados,
  versao: dados.versao || tabelaComercialInicial.versao,
  servicos: {
    ...tabelaComercialInicial.servicos,
    ...(dados.servicos || {}),
  },
  locacoes: {
    ...tabelaComercialInicial.locacoes,
    ...(dados.locacoes || {}),
  },
});

export const normalizarTabelaComercial = (
  tabela = {},
  { incluirVersaoPadrao = false } = {}
) => ({
  ...tabela,
  ...(incluirVersaoPadrao ? { versao: tabela.versao || 1 } : {}),
  servicos: {
    ...tabelaComercialInicial.servicos,
    ...(tabela.servicos || {}),
  },
  locacoes: {
    ...tabelaComercialInicial.locacoes,
    ...(tabela.locacoes || {}),
  },
});

export const normalizarTabelaComercialParaSalvar = (
  tabela,
  opcoesNormalizacao
) => {
  const normalizada = normalizarTabelaComercial(tabela, opcoesNormalizacao);

  return {
    ...normalizada,
    servicos: normalizarValoresMonetarios(normalizada.servicos),
    locacoes: normalizarValoresMonetarios(normalizada.locacoes),
  };
};

export const copiarTabelaComercialPadrao = (tabelaPadraoSalva, atualizadoEm) => {
  const tabelaPadrao = normalizarTabelaComercial(
    tabelaPadraoSalva || tabelaComercialInicial,
    { incluirVersaoPadrao: true }
  );

  return {
    origem: "padrao",
    versaoBase: tabelaPadrao.versao,
    atualizadoEm,
    servicos: { ...tabelaPadrao.servicos },
    locacoes: { ...tabelaPadrao.locacoes },
  };
};

export const herdarTabelaComercialDaConstrutora = ({
  tabelaConstrutora,
  tabelaPadraoSalva,
  construtoraId,
  atualizadoEm,
}) => {
  const tabelaPadrao = normalizarTabelaComercial(
    tabelaPadraoSalva || tabelaComercialInicial
  );
  const tabelaOrigem = tabelaConstrutora || tabelaPadrao;

  return {
    origem: "construtora",
    construtoraId: construtoraId || null,
    atualizadoEm,
    servicos: { ...tabelaPadrao.servicos, ...(tabelaOrigem.servicos || {}) },
    locacoes: { ...tabelaPadrao.locacoes, ...(tabelaOrigem.locacoes || {}) },
  };
};
