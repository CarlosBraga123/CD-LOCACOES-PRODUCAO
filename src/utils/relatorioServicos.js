import {
  atividadeEhServicoFaturavel,
  obterQuantidadeFinanceira,
  obterValorEfetivoServico,
} from "./financeiroAtividades";

const ORDEM_SERVICOS = [
  "Instalação",
  "Deslocamento",
  "Ascensão",
  "Remoção",
  "Manutenção",
];

const ROTULOS_SERVICOS = {
  Instalação: "Instalações",
  Deslocamento: "Deslocamentos",
  Ascensão: "Ascensões",
  Remoção: "Remoções",
  Manutenção: "Manutenções",
};

const texto = (valor) => String(valor ?? "").trim();

const formatarTamanho = (valor) => {
  const tamanho = texto(valor);
  return tamanho ? `${tamanho} m` : "";
};

const obterItens = (atividade) =>
  Array.isArray(atividade?.itensEquipamentos)
    ? atividade.itensEquipamentos
    : [];

export const obterPatrimoniosRelatorioServico = (atividade) => {
  const patrimoniosItens = obterItens(atividade).map((item) =>
    texto(item.numeroPatrimonio)
  );
  const patrimoniosLegados = Array.isArray(atividade?.numerosPatrimonio)
    ? atividade.numerosPatrimonio.map(texto)
    : [];
  const patrimonioPrincipal = texto(atividade?.numeroPatrimonio);

  const patrimonios = [
    ...patrimoniosItens,
    ...patrimoniosLegados,
    patrimonioPrincipal,
  ].filter(Boolean);

  return [...new Set(patrimonios)];
};

const obterDetalheItem = (atividade, item = {}) => {
  if (atividade.servico === "Deslocamento") {
    const anterior = formatarTamanho(
      item.tamanhoAnterior || atividade.tamanhoAnterior || item.tamanho || atividade.tamanho
    );
    const novo = formatarTamanho(
      item.tamanhoNovo || atividade.tamanhoNovo || atividade.tamanho
    );
    if (anterior && novo) return `${anterior} → ${novo}`;
    return anterior || novo;
  }

  return formatarTamanho(item.tamanho || atividade.tamanho);
};

export const obterDetalhesRelatorioServico = (atividade) => {
  const itens = obterItens(atividade);
  const detalhes = (itens.length ? itens : [{}])
    .map((item) => obterDetalheItem(atividade, item))
    .filter(Boolean);

  return [...new Set(detalhes)];
};

export const consolidarRelatorioServicos = ({
  atividades = [],
  valoresServicos = {},
  valoresPadrao = {},
} = {}) => {
  const contextoValores = { valoresServicos, valoresPadrao };
  const detalhes = atividades
    .filter((atividade) =>
      atividadeEhServicoFaturavel(atividade, contextoValores)
    )
    .map((atividade) => {
      const valorEfetivo = obterValorEfetivoServico(
        atividade,
        contextoValores
      );
      return {
        atividade,
        id: atividade.id,
        data: atividade.dataLiberacao || "",
        servico: atividade.servico,
        quantidade: obterQuantidadeFinanceira(atividade),
        patrimonios: obterPatrimoniosRelatorioServico(atividade),
        detalhes: obterDetalhesRelatorioServico(atividade),
        numeroOsCampo: texto(atividade.numeroOsCampo),
        valor: valorEfetivo.valor,
        origemValor: valorEfetivo.origem,
      };
    });

  const resumoPorServico = new Map();
  detalhes.forEach((item) => {
    const atual = resumoPorServico.get(item.servico) || {
      servico: item.servico,
      rotulo: ROTULOS_SERVICOS[item.servico] || item.servico,
      quantidade: 0,
      valor: 0,
    };
    atual.quantidade += item.quantidade;
    atual.valor += item.valor;
    resumoPorServico.set(item.servico, atual);
  });

  const resumo = [...resumoPorServico.values()].sort((a, b) => {
    const indiceA = ORDEM_SERVICOS.indexOf(a.servico);
    const indiceB = ORDEM_SERVICOS.indexOf(b.servico);
    return indiceA - indiceB;
  });
  const totalServicos = detalhes.reduce(
    (total, item) => total + Number(item.valor || 0),
    0
  );

  return { resumo, detalhes, totalServicos };
};
