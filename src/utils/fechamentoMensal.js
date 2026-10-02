import { obterChaveObra, obterObraDaAtividade } from "./obras";

export const consolidarFechamentoMensal = ({
  atividadesServicos = [],
  periodosLocacao = [],
  obras = [],
  obterValorServico,
}) => {
  const mapa = new Map();
  const obterLinha = (origem) => {
    const obra = obterObraDaAtividade(origem, obras);
    const chave = obra
      ? obterChaveObra({ obraId: obra.id })
      : origem.chaveObra || obterChaveObra(origem);
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        obraId: obra?.id || origem.obraId || "",
        construtora:
          obra?.construtora || origem.construtora || "Sem construtora",
        obra: obra?.nome || origem.obra || "Sem obra",
        totalServicos: 0,
        totalLocacoes: 0,
      });
    }
    return mapa.get(chave);
  };

  atividadesServicos.forEach((atividade) => {
    obterLinha(atividade).totalServicos += Number(
      obterValorServico(atividade).valor || 0
    );
  });
  periodosLocacao.forEach((periodo) => {
    obterLinha(periodo).totalLocacoes += Number(periodo.valorProporcional || 0);
  });

  const obrasConsolidadas = [...mapa.values()]
    .map((linha) => ({
      ...linha,
      totalGeral: linha.totalServicos + linha.totalLocacoes,
    }))
    .filter((linha) => linha.totalServicos !== 0 || linha.totalLocacoes !== 0)
    .sort(
      (a, b) =>
        a.construtora.localeCompare(b.construtora, "pt-BR") ||
        a.obra.localeCompare(b.obra, "pt-BR")
    );
  const totais = obrasConsolidadas.reduce(
    (acc, linha) => {
      acc.totalServicos += linha.totalServicos;
      acc.totalLocacoes += linha.totalLocacoes;
      acc.totalGeral += linha.totalGeral;
      return acc;
    },
    { totalServicos: 0, totalLocacoes: 0, totalGeral: 0 }
  );

  return { obras: obrasConsolidadas, totais };
};
