import { normalizarTexto, obterObraDaAtividade } from "./obras";

export const SERVICOS_FATURAVEIS_PADRAO = [
  "Instalação",
  "Deslocamento",
  "Ascensão",
  "Remoção",
];

export const obterQuantidadeFinanceira = (atividade) => {
  const quantidade = Number(atividade?.quantidade);
  return quantidade > 0 ? quantidade : 1;
};

export const obterValorEfetivoServico = (
  atividade,
  { valoresServicos = {}, valoresPadrao = {} } = {}
) => {
  if (atividade?.valoresCongelados?.totalServico !== undefined) {
    return {
      valor: Number(atividade.valoresCongelados.totalServico || 0),
      origem: "Congelado",
    };
  }

  const chave = `${atividade?.equipamento}-${atividade?.servico}`;
  const quantidade = obterQuantidadeFinanceira(atividade);

  if (valoresServicos[chave] !== undefined) {
    return {
      valor: Number(valoresServicos[chave] || 0) * quantidade,
      origem: "Fallback valoresServicos",
    };
  }

  if (valoresPadrao[chave] !== undefined) {
    return {
      valor: Number(valoresPadrao[chave] || 0) * quantidade,
      origem: "Fallback valoresPadrao",
    };
  }

  return { valor: 0, origem: "Sem valor" };
};

export const atividadeEhServicoFaturavel = (
  atividade,
  contextoValores = {}
) => {
  if (!atividade) return false;
  if (["Somente aluguel", "Somente recolhimento"].includes(atividade.servico)) {
    return false;
  }
  if (atividade.servico === "Manutenção") {
    return obterValorEfetivoServico(atividade, contextoValores).valor > 0;
  }
  if (!SERVICOS_FATURAVEIS_PADRAO.includes(atividade.servico)) return false;
  return atividade.cobraServico !== false;
};

const obterChavesLocacao = (atividade) => {
  if (atividade.equipamento === "Balancinho") {
    const tipo = atividade.tipoBalancinho === "Manual" ? "Manual" : "Eletrico";
    return {
      base: `Balancinho-${tipo}`,
      adicionalContrapeso: "Balancinho-Contrapeso",
    };
  }
  if (atividade.equipamento === "Mini Grua") {
    return {
      base: `Mini Grua-${atividade.tipoMiniGrua || "500kg"}`,
      adicionalContrapeso: null,
    };
  }
  return { base: atividade.equipamento, adicionalContrapeso: null };
};

const calcularValorLocacaoPorTabela = (atividade, tabela) => {
  const quantidade = obterQuantidadeFinanceira(atividade);
  const chaves = obterChavesLocacao(atividade);

  if (atividade.tipoMovimentoLocacao === "contrapeso") {
    if (!chaves.adicionalContrapeso) return null;
    if (tabela.locacoes?.[chaves.adicionalContrapeso] === undefined) return null;
    return Number(tabela.locacoes[chaves.adicionalContrapeso] || 0) * quantidade;
  }
  if (tabela.locacoes?.[chaves.base] === undefined) return null;

  const base = Number(tabela.locacoes[chaves.base] || 0);
  const adicional =
    !atividade.tipoMovimentoLocacao &&
    atividade.usaContrapeso &&
    chaves.adicionalContrapeso
      ? Number(tabela.locacoes?.[chaves.adicionalContrapeso] || 0)
      : 0;
  return (base + adicional) * quantidade;
};

export const obterValorMensalLocacaoEfetivo = (
  atividade,
  { obras = [], construtoras = [], tabelaComercialPadrao = { locacoes: {} } } = {}
) => {
  const quantidade = obterQuantidadeFinanceira(atividade);
  if (
    atividade.tipoMovimentoLocacao === "contrapeso" &&
    atividade.valoresCongelados?.adicionalContrapesoLocacao !== undefined
  ) {
    return {
      valor:
        Number(atividade.valoresCongelados.adicionalContrapesoLocacao || 0) *
        quantidade,
      origem: "Congelado",
    };
  }
  if (
    atividade.tipoMovimentoLocacao === "base" &&
    atividade.valoresCongelados?.locacaoMensalUnitario !== undefined
  ) {
    return {
      valor:
        Number(atividade.valoresCongelados.locacaoMensalUnitario || 0) *
        quantidade,
      origem: "Congelado",
    };
  }
  if (atividade.valoresCongelados?.totalLocacaoMensal !== undefined) {
    return {
      valor: Number(atividade.valoresCongelados.totalLocacaoMensal || 0),
      origem: "Congelado",
    };
  }

  const obra = obterObraDaAtividade(atividade, obras);
  const nomeConstrutora = obra?.construtora || atividade.construtora;
  const construtora = construtoras.find(
    (item) => normalizarTexto(item.nome) === normalizarTexto(nomeConstrutora)
  );
  const tabelas = [
    { tabela: obra?.tabelaComercial, origem: "Estimado obra" },
    { tabela: construtora?.tabelaComercial, origem: "Estimado construtora" },
    { tabela: tabelaComercialPadrao, origem: "Estimado padrão" },
  ].filter((item) => item.tabela);

  for (const item of tabelas) {
    const valor = calcularValorLocacaoPorTabela(atividade, item.tabela);
    if (valor !== null) return { valor, origem: item.origem };
  }
  return { valor: 0, origem: "Sem valor" };
};

export const formatarEquipamentoFinanceiro = (atividade) => {
  if (atividade.tipoMovimentoLocacao === "contrapeso") return "Kit Contrapeso";
  if (atividade.equipamento === "Mini Grua") {
    return atividade.tipoMiniGrua
      ? `Mini Grua ${atividade.tipoMiniGrua}`
      : "Mini Grua";
  }
  if (atividade.equipamento !== "Balancinho") {
    return atividade.equipamento || "Sem equipamento";
  }
  return atividade.tipoBalancinho === "Manual"
    ? "Balancinho Manual"
    : "Balancinho Elétrico";
};
