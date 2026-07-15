import { obterChaveObra, obterObraDaAtividade } from "./obras";

export const atividadeIniciaLocacao = (atividade) => {
  if (atividade.iniciaLocacao !== undefined) return atividade.iniciaLocacao === true;
  return atividade.servico === "Instala\u00e7\u00e3o";
};

export const atividadeEncerraLocacao = (atividade) => {
  if (atividade.encerraLocacao !== undefined) return atividade.encerraLocacao === true;
  return atividade.servico === "Remo\u00e7\u00e3o";
};

export const normalizarAlteracaoContrapeso = (atividade) => {
  const valor = String(atividade?.alteracaoContrapeso || "nenhuma").trim().toLowerCase();
  return ["adicionar", "remover"].includes(valor) ? valor : "nenhuma";
};

export const obterQuantidadeContrapeso = (atividade) => {
  const quantidade = Number(atividade?.quantidadeContrapeso);
  if (!Number.isFinite(quantidade)) return 0;
  return Math.max(0, Math.trunc(quantidade));
};

export const obterMovimentosLocacao = (atividade) => {
  const movimentos = [];
  const quantidade = Number(atividade.quantidade) || 1;
  const entradaBase = atividadeIniciaLocacao(atividade);
  const saidaBase = atividadeEncerraLocacao(atividade);
  const alteracaoContrapeso = normalizarAlteracaoContrapeso(atividade);
  const quantidadeContrapeso = obterQuantidadeContrapeso(atividade);
  const ehBalancinho = atividade.equipamento === "Balancinho";

  if (entradaBase || saidaBase) {
    movimentos.push({
      ...atividade,
      quantidade,
      usaContrapeso: false,
      tipoMovimentoLocacao: "base",
      iniciaLocacao: entradaBase,
      encerraLocacao: saidaBase,
    });
  }

  if (ehBalancinho && entradaBase && atividade.usaContrapeso) {
    movimentos.push({
      ...atividade,
      quantidade,
      usaContrapeso: true,
      tipoMovimentoLocacao: "contrapeso",
      iniciaLocacao: true,
      encerraLocacao: false,
    });
  }

  if (ehBalancinho && alteracaoContrapeso !== "nenhuma" && quantidadeContrapeso > 0) {
    movimentos.push({
      ...atividade,
      quantidade: quantidadeContrapeso,
      usaContrapeso: true,
      tipoMovimentoLocacao: "contrapeso",
      iniciaLocacao: alteracaoContrapeso === "adicionar",
      encerraLocacao: alteracaoContrapeso === "remover",
    });
  }

  return movimentos;
};

const criarDataLocal = (data) => {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
};

const calcularDiasInclusivos = (dataInicio, dataFim) => {
  const inicio = criarDataLocal(dataInicio);
  const fim = criarDataLocal(dataFim);
  return Math.floor((fim - inicio) / 86400000) + 1;
};

export const calcularPeriodosLocacao = ({
  atividadesBase,
  inicioMes,
  fimMes,
  diasNoMes,
  obras,
  formatarEquipamento,
  obterValorMensalLocacao,
}) => {
  const abertasPorGrupo = new Map();
  const periodos = [];
  const formatarEquipamentoLocacao = (atividade) =>
    atividade.usaContrapeso ? "Kit Contrapeso" : formatarEquipamento(atividade);

  const obterChaveLinhaLocacao = (atividade) => {
    return [
      obterChaveObra(atividade),
      formatarEquipamentoLocacao(atividade),
      atividade.usaContrapeso ? "contrapeso" : "",
    ].join("||");
  };

  const montarPeriodoLocacao = ({
    atividadeInicio,
    atividadeFim,
    dataInicio,
    dataFim,
    quantidade,
    valorMensalUnitario,
    origemValor,
  }) => {
    const inicioPeriodo = dataInicio < inicioMes ? inicioMes : dataInicio;
    const fimPeriodo = dataFim > fimMes ? fimMes : dataFim;

    if (fimPeriodo < inicioMes || inicioPeriodo > fimMes || fimPeriodo < inicioPeriodo) {
      return null;
    }

    const atividadeBase = atividadeInicio || atividadeFim;
    const obra = obterObraDaAtividade(atividadeBase, obras);
    const diasLocados = calcularDiasInclusivos(inicioPeriodo, fimPeriodo);
    const valorMensal = valorMensalUnitario * quantidade;

    return {
      chaveObra: obterChaveObra(atividadeBase),
      construtora: obra?.construtora || atividadeBase.construtora || "Sem construtora",
      obra: obra?.nome || String(atividadeBase.obra || "Sem obra").trim(),
      equipamento: formatarEquipamentoLocacao(atividadeBase),
      tipoBalancinho: atividadeBase.tipoBalancinho,
      tipoMiniGrua: atividadeBase.tipoMiniGrua,
      usaContrapeso: !!atividadeBase.usaContrapeso,
      dataInicio: inicioPeriodo,
      dataFim: fimPeriodo,
      diasLocados,
      valorMensal,
      valorProporcional: (valorMensal * diasLocados) / diasNoMes,
      origemValor,
      atividadeInicioId: atividadeInicio?.id || null,
      atividadeFimId: atividadeFim?.id || null,
    };
  };

  // Saidas fecham primeiro entradas novas do mes; saldo anterior fica por ultimo.
  const obterIndiceAbertaParaSaida = (abertas) => {
    for (let index = abertas.length - 1; index >= 0; index -= 1) {
      if (abertas[index].dataInicio >= inicioMes) return index;
    }

    return abertas.length > 0 ? 0 : -1;
  };

  atividadesBase
    .filter((atividade) => atividade.dataLiberacao)
    .sort((a, b) => new Date(a.dataLiberacao) - new Date(b.dataLiberacao))
    .flatMap((atividade) => obterMovimentosLocacao(atividade))
    .forEach((atividade) => {
      const quantidade = Number(atividade.quantidade) || 1;
      const entrada = atividadeIniciaLocacao(atividade);
      const saida = atividadeEncerraLocacao(atividade);

      if (!entrada && !saida) return;

      const chaveLinha = obterChaveLinhaLocacao(atividade);
      if (!abertasPorGrupo.has(chaveLinha)) abertasPorGrupo.set(chaveLinha, []);

      if (entrada) {
        const valorMensalLocacao = obterValorMensalLocacao(atividade);
        const valorMensalUnitario = valorMensalLocacao.valor / quantidade;

        abertasPorGrupo.get(chaveLinha).push({
          atividadeInicio: atividade,
          dataInicio: atividade.dataLiberacao,
          quantidadeRestante: quantidade,
          valorMensalUnitario,
          origemValor: valorMensalLocacao.origem,
        });
      }

      if (saida) {
        let quantidadeSaida = quantidade;
        const abertas = abertasPorGrupo.get(chaveLinha);

        while (quantidadeSaida > 0) {
          const indiceAberta = obterIndiceAbertaParaSaida(abertas);
          const aberta = indiceAberta >= 0 ? abertas[indiceAberta] : null;
          const quantidadeFechada = aberta
            ? Math.min(aberta.quantidadeRestante, quantidadeSaida)
            : quantidadeSaida;

          const valorMensalLocacao = aberta ? null : obterValorMensalLocacao(atividade);
          const valorMensalUnitario = aberta
            ? aberta.valorMensalUnitario
            : valorMensalLocacao.valor / quantidadeFechada;
          const origemValor = aberta ? aberta.origemValor : valorMensalLocacao.origem;

          const periodo = montarPeriodoLocacao({
            atividadeInicio: aberta?.atividadeInicio || null,
            atividadeFim: atividade,
            dataInicio: aberta?.dataInicio || inicioMes,
            dataFim: atividade.dataLiberacao,
            quantidade: quantidadeFechada,
            valorMensalUnitario,
            origemValor,
          });

          if (periodo) periodos.push(periodo);

          if (aberta) {
            aberta.quantidadeRestante -= quantidadeFechada;
            if (aberta.quantidadeRestante <= 0) abertas.splice(indiceAberta, 1);
          }

          quantidadeSaida -= quantidadeFechada;
        }
      }
    });

  abertasPorGrupo.forEach((abertas) => {
    abertas.forEach((aberta) => {
      const periodo = montarPeriodoLocacao({
        atividadeInicio: aberta.atividadeInicio,
        atividadeFim: null,
        dataInicio: aberta.dataInicio,
        dataFim: fimMes,
        quantidade: aberta.quantidadeRestante,
        valorMensalUnitario: aberta.valorMensalUnitario,
        origemValor: aberta.origemValor,
      });

      if (periodo) periodos.push(periodo);
    });
  });

  return periodos;
};
