import { normalizarTexto, obterChaveObra, obterObraDaAtividade } from "./obras";
import {
  criarUnidadesDaEntrada,
  localizarIndiceUnidade,
  unidadeCompativelComAtividade,
} from "./unidadesEquipamentos";
import { itemPossuiVinculoPatrimonial } from "./pendenciasOperacionais";
import {
  ajustePertenceUnidade,
  aplicarAjusteConfiguracaoNaUnidade,
  obterAjustesConfiguracaoEquipamentos,
} from "./ajustesConfiguracaoEquipamentos";

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

export const calcularValorProporcionalLocacao = ({
  valorMensal,
  diasLocados,
  mesCompleto,
}) =>
  mesCompleto
    ? valorMensal
    : (valorMensal * diasLocados) / 30;

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
    const mesCompleto =
      inicioPeriodo === inicioMes && fimPeriodo === fimMes;

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
      quantidadeFinanceira: quantidade,
      mesCompleto,
      valorMensal,
      valorProporcional: calcularValorProporcionalLocacao({
        valorMensal,
        diasLocados,
        mesCompleto,
      }),
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
    .map((atividade) => {
      if (
        atividade.pendenteVinculoPatrimonio !== true ||
        atividadeIniciaLocacao(atividade) ||
        atividadeEncerraLocacao(atividade)
      ) {
        return atividade;
      }
      const vinculados = (atividade.itensEquipamentos || []).filter(
        itemPossuiVinculoPatrimonial
      ).length;
      return vinculados > 0 ? { ...atividade, quantidade: vinculados } : null;
    })
    .filter(Boolean)
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

export const calcularPeriodosLocacaoIndividuais = ({
  atividadesBase,
  inicioMes,
  fimMes,
  diasNoMes,
  obras,
  formatarEquipamento,
  obterValorMensalLocacao,
}) => {
  const atividadesOrdenadas = atividadesBase
    .filter((atividade) => atividade.dataLiberacao)
    .sort((a, b) => {
      const porData = String(a.dataLiberacao).localeCompare(
        String(b.dataLiberacao)
      );
      if (porData !== 0) return porData;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
  const origensReferenciadas = new Set(
    atividadesOrdenadas
      .flatMap((atividade) =>
        Array.isArray(atividade.itensEquipamentos)
          ? atividade.itensEquipamentos
          : []
      )
      .map((item) => item.atividadeOrigemId)
      .filter((id) => id !== undefined && id !== null)
      .map(String)
  );
  const unidadeCompativelComSaida = (unidade, atividade) =>
    unidadeCompativelComAtividade(unidade, atividade) &&
    obterChaveObra(unidade) === obterChaveObra(atividade);
  const atividadesIndividualizadas = new Set();
  const unidadesAbertas = [];
  const registros = [];
  const kitsAbertos = new Map();

  const prepararAtividadeUnitaria = (
    atividade,
    unidade,
    tipoMovimentoLocacao
  ) => {
    const quantidadeOrigem = Math.max(1, Number(atividade.quantidade) || 1);
    const valoresCongelados = atividade.valoresCongelados
      ? {
          ...atividade.valoresCongelados,
          ...(atividade.valoresCongelados.locacaoMensalUnitario === undefined &&
          atividade.valoresCongelados.totalLocacaoMensal !== undefined
            ? {
                totalLocacaoMensal:
                  Number(atividade.valoresCongelados.totalLocacaoMensal || 0) /
                  quantidadeOrigem,
              }
            : {}),
        }
      : atividade.valoresCongelados;

    return {
      ...atividade,
      ...unidade,
      quantidade: 1,
      valoresCongelados,
      tipoMovimentoLocacao,
      usaContrapeso: tipoMovimentoLocacao === "contrapeso",
    };
  };

  const abrirRegistro = ({
    atividade,
    unidade,
    tipoMovimentoLocacao,
    idRegistro,
    vinculoBase,
  }) => {
    if (registros.some((registro) => registro.idRegistro === idRegistro)) {
      return null;
    }

    const atividadeUnitaria = prepararAtividadeUnitaria(
      atividade,
      unidade,
      tipoMovimentoLocacao
    );
    const valorMensal = obterValorMensalLocacao(atividadeUnitaria);
    const registro = {
      idRegistro,
      vinculoBase,
      unidadeInicial: { ...unidade },
      unidade: { ...unidade },
      atividadeInicio: atividadeUnitaria,
      atividadeFim: null,
      dataInicio: atividade.dataLiberacao,
      dataFim: null,
      valorMensalUnitario: Number(valorMensal.valor || 0),
      origemValor: valorMensal.origem,
      tipoMovimentoLocacao,
      historico: [],
    };
    registros.push(registro);
    return registro;
  };

  const fecharRegistro = (registro, atividade) => {
    if (!registro || registro.dataFim) return;
    registro.dataFim = atividade.dataLiberacao;
    registro.atividadeFim = prepararAtividadeUnitaria(
      atividade,
      registro.unidade,
      registro.tipoMovimentoLocacao
    );
  };

  const ajustesConfiguracao = obterAjustesConfiguracaoEquipamentos().sort(
    (a, b) =>
      String(a.data || "").localeCompare(String(b.data || "")) ||
      String(a.criadoEm || "").localeCompare(String(b.criadoEm || ""))
  );
  let indiceAjuste = 0;
  const aplicarAjustesAte = (dataLimite, incluirDataLimite = true) => {
    while (
      indiceAjuste < ajustesConfiguracao.length &&
      (incluirDataLimite
        ? String(ajustesConfiguracao[indiceAjuste].data || "") <= dataLimite
        : String(ajustesConfiguracao[indiceAjuste].data || "") < dataLimite)
    ) {
      const ajuste = ajustesConfiguracao[indiceAjuste];
      const indiceUnidade = unidadesAbertas.findIndex(
        (unidade) =>
          (!ajuste.obraId ||
            String(ajuste.obraId) === String(unidade.obraId || "")) &&
          ajustePertenceUnidade(ajuste, unidade)
      );
      if (indiceUnidade >= 0) {
        const unidade = unidadesAbertas[indiceUnidade];
        const tamanhoAnterior = unidade.tamanho;
        const ancoragemAnterior = unidade.ancoragem;
        const usavaContrapeso = unidade.usaContrapeso === true;
        const unidadeAjustada = aplicarAjusteConfiguracaoNaUnidade(
          unidade,
          ajuste
        );
        Object.assign(unidade, unidadeAjustada);
        unidade.registroBase.unidade = { ...unidade };
        unidade.registroBase.historico.push({
          atividadeId: null,
          ajusteConfiguracaoId: ajuste.id,
          origem: "CONFERENCIA_CADASTRAL",
          data: ajuste.data,
          tamanhoAnterior,
          tamanhoNovo: unidade.tamanho,
          ancoragemAnterior,
          ancoragemNova: unidade.ancoragem,
          usaContrapesoAnterior: usavaContrapeso,
          usaContrapesoNovo: unidade.usaContrapeso,
        });

        if (
          ajuste.usaContrapeso === true &&
          !kitsAbertos.has(unidade.idUnidade)
        ) {
          const atividadeAjuste = {
            ...unidade.registroBase.atividadeInicio,
            id: `ajuste:${ajuste.id}`,
            dataLiberacao: ajuste.data,
          };
          const registroKit = abrirRegistro({
            atividade: atividadeAjuste,
            unidade,
            tipoMovimentoLocacao: "contrapeso",
            idRegistro: `${unidade.idUnidade}:contrapeso:ajuste:${ajuste.id}`,
            vinculoBase: unidade.idUnidade,
          });
          if (registroKit) kitsAbertos.set(unidade.idUnidade, registroKit);
        }
        if (
          ajuste.usaContrapeso === false &&
          kitsAbertos.has(unidade.idUnidade)
        ) {
          fecharRegistro(kitsAbertos.get(unidade.idUnidade), {
            ...unidade.registroBase.atividadeInicio,
            id: `ajuste:${ajuste.id}`,
            dataLiberacao: ajuste.data,
          });
          kitsAbertos.delete(unidade.idUnidade);
        }
      }
      indiceAjuste += 1;
    }
  };

  atividadesOrdenadas.forEach((atividade) => {
    const dataAtividade = String(atividade.dataLiberacao || "");
    aplicarAjustesAte(dataAtividade, false);
    try {
    const itens = Array.isArray(atividade.itensEquipamentos)
      ? atividade.itensEquipamentos
      : [];
    const iniciaLocacao = atividadeIniciaLocacao(atividade);
    const encerraLocacao = atividadeEncerraLocacao(atividade);
    const entradaPossuiAjusteCadastral = iniciaLocacao &&
      criarUnidadesDaEntrada(atividade).some((unidade) =>
        ajustesConfiguracao.some((ajuste) =>
          ajustePertenceUnidade(ajuste, unidade)
        )
      );
    const entradaIndividual =
      iniciaLocacao &&
      (itens.length > 0 ||
        origensReferenciadas.has(String(atividade.id)) ||
        entradaPossuiAjusteCadastral);

    if (entradaIndividual) {
      atividadesIndividualizadas.add(String(atividade.id));
      const unidades = criarUnidadesDaEntrada(atividade);

      unidades.forEach((unidade) => {
        if (
          unidadesAbertas.some(
            (aberta) => aberta.idUnidade === unidade.idUnidade
          )
        ) {
          return;
        }

        const registroBase = abrirRegistro({
          atividade,
          unidade,
          tipoMovimentoLocacao: "base",
          idRegistro: `${unidade.idUnidade}:base`,
          vinculoBase: unidade.idUnidade,
        });
        if (!registroBase) return;

        unidadesAbertas.push({
          ...unidade,
          registroBase,
        });

        if (unidade.equipamento === "Balancinho" && unidade.usaContrapeso) {
          const idKit = `${unidade.idUnidade}:contrapeso`;
          const registroKit = abrirRegistro({
            atividade,
            unidade,
            tipoMovimentoLocacao: "contrapeso",
            idRegistro: idKit,
            vinculoBase: unidade.idUnidade,
          });
          if (registroKit) kitsAbertos.set(unidade.idUnidade, registroKit);
        }
      });
      return;
    }

    if (itens.length === 0) return;
    const possuiVinculoIndividual = itens.some(
      (item) => localizarIndiceUnidade(unidadesAbertas, item) >= 0
    );
    const possuiVinculoKit = itens.some((item) =>
      Array.from(kitsAbertos.values()).some(
        (registro) => localizarIndiceUnidade([registro.unidade], item) === 0
      )
    );
    if (!possuiVinculoIndividual && !possuiVinculoKit) return;
    atividadesIndividualizadas.add(String(atividade.id));

    let unidadesEncerradas = 0;
    itens.forEach((item) => {
      const alteracaoContrapeso = normalizarAlteracaoContrapeso(item);
      const indice = localizarIndiceUnidade(unidadesAbertas, item);
      if (indice < 0) {
        if (encerraLocacao && alteracaoContrapeso === "remover") {
          const kitAberto = Array.from(kitsAbertos.entries()).find(([, registro]) =>
            localizarIndiceUnidade([registro.unidade], item) === 0
          );
          if (kitAberto) {
            fecharRegistro(kitAberto[1], atividade);
            kitsAbertos.delete(kitAberto[0]);
          }
        }
        return;
      }

      const unidadeAberta = unidadesAbertas[indice];
      if (atividade.servico === "Deslocamento") {
        const tamanhoAnterior = unidadeAberta.tamanho;
        const ancoragemAnterior = unidadeAberta.ancoragem;

        unidadeAberta.tamanho = String(
          item.tamanhoNovo ?? unidadeAberta.tamanho ?? ""
        );
        unidadeAberta.ancoragem =
          item.ancoragem || unidadeAberta.ancoragem || "";
        unidadeAberta.registroBase.unidade = { ...unidadeAberta };
        unidadeAberta.registroBase.historico.push({
          atividadeId: atividade.id,
          data: atividade.dataLiberacao,
          tamanhoAnterior,
          tamanhoNovo: unidadeAberta.tamanho,
          ancoragemAnterior,
          ancoragemNova: unidadeAberta.ancoragem,
          alteracaoContrapeso,
        });

        if (alteracaoContrapeso === "adicionar" && !kitsAbertos.has(unidadeAberta.idUnidade)) {
          const registroKit = abrirRegistro({
            atividade,
            unidade: unidadeAberta,
            tipoMovimentoLocacao: "contrapeso",
            idRegistro: `${unidadeAberta.idUnidade}:contrapeso:${atividade.id}`,
            vinculoBase: unidadeAberta.idUnidade,
          });
          if (registroKit) kitsAbertos.set(unidadeAberta.idUnidade, registroKit);
          unidadeAberta.usaContrapeso = true;
        }

        if (alteracaoContrapeso === "remover") {
          fecharRegistro(kitsAbertos.get(unidadeAberta.idUnidade), atividade);
          kitsAbertos.delete(unidadeAberta.idUnidade);
          unidadeAberta.usaContrapeso = false;
        }
      }

      if (encerraLocacao) {
        fecharRegistro(unidadeAberta.registroBase, atividade);
        if (alteracaoContrapeso === "remover") {
          fecharRegistro(kitsAbertos.get(unidadeAberta.idUnidade), atividade);
          kitsAbertos.delete(unidadeAberta.idUnidade);
        }
        unidadesAbertas.splice(indice, 1);
        unidadesEncerradas += 1;
      }
    });

    if (encerraLocacao && atividade.pendenteVinculoPatrimonio === true) {
      let quantidadeRestante =
        Math.max(1, Number(atividade.quantidade) || 1) - unidadesEncerradas;
      for (
        let indice = unidadesAbertas.length - 1;
        indice >= 0 && quantidadeRestante > 0;
        indice -= 1
      ) {
        const unidadeAberta = unidadesAbertas[indice];
        if (!unidadeCompativelComSaida(unidadeAberta, atividade)) continue;
        fecharRegistro(unidadeAberta.registroBase, atividade);
        if (normalizarAlteracaoContrapeso(atividade) === "remover") {
          fecharRegistro(kitsAbertos.get(unidadeAberta.idUnidade), atividade);
          kitsAbertos.delete(unidadeAberta.idUnidade);
        }
        unidadesAbertas.splice(indice, 1);
        quantidadeRestante -= 1;
      }
    }
    } finally {
      aplicarAjustesAte(dataAtividade);
    }
  });

  aplicarAjustesAte("9999-12-31");

  const periodos = registros
    .map((registro) => {
      const dataFimReal = registro.dataFim || fimMes;
      const inicioPeriodo =
        registro.dataInicio < inicioMes ? inicioMes : registro.dataInicio;
      const fimPeriodo = dataFimReal > fimMes ? fimMes : dataFimReal;

      if (
        fimPeriodo < inicioMes ||
        inicioPeriodo > fimMes ||
        fimPeriodo < inicioPeriodo
      ) {
        return null;
      }

      const [anoInicio, mesInicio, diaInicio] = inicioPeriodo
        .split("-")
        .map(Number);
      const [anoFim, mesFim, diaFim] = fimPeriodo.split("-").map(Number);
      const diasLocados =
        Math.floor(
          (new Date(anoFim, mesFim - 1, diaFim) -
            new Date(anoInicio, mesInicio - 1, diaInicio)) /
            86400000
        ) + 1;
      const mesCompleto =
        inicioPeriodo === inicioMes && fimPeriodo === fimMes;
      const atividadeBase =
        registro.atividadeInicio || registro.atividadeFim;
      const saidaPatrimonialPendente =
        registro.atividadeFim?.saidaPatrimonialProvisoria === true ||
        (registro.atividadeFim?.pendenteVinculoPatrimonio === true &&
          atividadeEncerraLocacao(registro.atividadeFim));
      const obra = obterObraDaAtividade(atividadeBase, obras);
      const unidadeNoMes = registro.historico
        .filter((movimento) => movimento.data <= fimMes)
        .reduce(
          (unidade, movimento) => ({
            ...unidade,
            tamanho: String(
              movimento.tamanhoNovo ?? unidade.tamanho ?? ""
            ),
            ancoragem:
              movimento.ancoragemNova || unidade.ancoragem || "",
          }),
          { ...registro.unidadeInicial }
        );
      const equipamentoCategoria =
        registro.tipoMovimentoLocacao === "contrapeso"
          ? "Kit Contrapeso"
          : formatarEquipamento({
              ...atividadeBase,
              ...unidadeNoMes,
              usaContrapeso: false,
              tipoMovimentoLocacao: "base",
            });
      const descricaoUnidade =
        registro.tipoMovimentoLocacao === "contrapeso"
          ? `Kit Contrapeso — ${
              saidaPatrimonialPendente
                ? "Saída com patrimônio pendente de vínculo"
                : unidadeNoMes.numeroPatrimonio
                ? `Balancinho ${unidadeNoMes.numeroPatrimonio}`
                : `Unidade ${registro.vinculoBase}`
            }`
          : [
              equipamentoCategoria,
              unidadeNoMes.tamanho
                ? `${unidadeNoMes.tamanho} m`
                : "",
              saidaPatrimonialPendente
                ? "Saída com patrimônio pendente de vínculo"
                : "",
              !saidaPatrimonialPendente && unidadeNoMes.numeroPatrimonio
                ? `Patrimônio ${unidadeNoMes.numeroPatrimonio}`
                : !saidaPatrimonialPendente
                  ? "Sem patrimônio"
                  : "",
            ]
              .filter(Boolean)
              .join(" — ");

      return {
        idUnidade: registro.idRegistro,
        vinculoBase: registro.vinculoBase,
        idEquipamento: unidadeNoMes.idEquipamento || "",
        idItemOrigem: unidadeNoMes.idItemOrigem || registro.vinculoBase,
        atividadeOrigemId: unidadeNoMes.atividadeOrigemId || null,
        chaveObra: obterChaveObra(atividadeBase),
        construtora:
          obra?.construtora ||
          atividadeBase.construtora ||
          "Sem construtora",
        obra:
          obra?.nome ||
          String(atividadeBase.obra || "Sem obra").trim(),
        equipamento: descricaoUnidade,
        equipamentoCategoria,
        tipoBalancinho: unidadeNoMes.tipoBalancinho,
        tipoMiniGrua: unidadeNoMes.tipoMiniGrua,
        tamanho: unidadeNoMes.tamanho,
        ancoragem: unidadeNoMes.ancoragem,
        numeroPatrimonio: unidadeNoMes.numeroPatrimonio,
        usaContrapeso: registro.tipoMovimentoLocacao === "contrapeso",
        dataInicio: inicioPeriodo,
        dataFim: fimPeriodo,
        dataEntradaReal: registro.dataInicio,
        dataSaidaReal: registro.dataFim,
        diasLocados,
        quantidade: 1,
        mesCompleto,
        valorMensal: registro.valorMensalUnitario,
        valorProporcional: calcularValorProporcionalLocacao({
          valorMensal: registro.valorMensalUnitario,
          diasLocados,
          mesCompleto,
        }),
        origemValor: registro.origemValor,
        atividadeInicioId: registro.atividadeInicio?.id || null,
        atividadeFimId: registro.atividadeFim?.id || null,
        saidaPatrimonialPendente,
        historico: registro.historico,
      };
    })
    .filter(Boolean);
  const idsComPeriodo = new Set(
    periodos.map((periodo) => periodo.idUnidade)
  );
  const registrosZerados = registros
    .filter((registro) => !idsComPeriodo.has(registro.idRegistro))
    .map((registro) => {
      const atividadeBase =
        registro.atividadeInicio || registro.atividadeFim;
      const obra = obterObraDaAtividade(atividadeBase, obras);
      const equipamentoCategoria =
        registro.tipoMovimentoLocacao === "contrapeso"
          ? "Kit Contrapeso"
          : formatarEquipamento({
              ...atividadeBase,
              ...registro.unidade,
              usaContrapeso: false,
              tipoMovimentoLocacao: "base",
            });
      const equipamento =
        registro.tipoMovimentoLocacao === "contrapeso"
          ? `Kit Contrapeso — ${
              registro.unidade.numeroPatrimonio
                ? `Balancinho ${registro.unidade.numeroPatrimonio}`
                : `Unidade ${registro.vinculoBase}`
            }`
          : [
              equipamentoCategoria,
              registro.unidade.tamanho
                ? `${registro.unidade.tamanho} m`
                : "",
              registro.unidade.numeroPatrimonio
                ? `Patrimônio ${registro.unidade.numeroPatrimonio}`
                : "Sem patrimônio",
            ]
              .filter(Boolean)
              .join(" — ");

      return {
        idUnidade: registro.idRegistro,
        chaveObra: obterChaveObra(atividadeBase),
        construtora:
          obra?.construtora ||
          atividadeBase.construtora ||
          "Sem construtora",
        obra:
          obra?.nome ||
          String(atividadeBase.obra || "Sem obra").trim(),
        equipamento,
        equipamentoCategoria,
        tipoBalancinho: registro.unidade.tipoBalancinho,
        tipoMiniGrua: registro.unidade.tipoMiniGrua,
        tamanho: registro.unidade.tamanho,
        ancoragem: registro.unidade.ancoragem,
        numeroPatrimonio: registro.unidade.numeroPatrimonio,
        usaContrapeso: registro.tipoMovimentoLocacao === "contrapeso",
        origemValor: registro.origemValor,
      };
    });

  return {
    periodos,
    registrosZerados,
    atividadesIndividualizadas,
  };
};

export const normalizarPeriodoFinanceiroLocacao = ({
  periodo,
  indice,
  legado,
  atividadesPorId,
}) => {
  const atividadeInicio = atividadesPorId.get(
    String(periodo.atividadeInicioId || "")
  );
  const atividadeFim = atividadesPorId.get(String(periodo.atividadeFimId || ""));
  const quantidade = Math.max(
    1,
    Number(periodo.quantidadeFinanceira ?? periodo.quantidade) || 1
  );
  const valorMensalTotal = Number(periodo.valorMensal || 0);
  const dataEntrada =
    periodo.dataEntradaReal || atividadeInicio?.dataLiberacao || periodo.dataInicio || "";
  const dataSaida =
    periodo.dataSaidaReal || atividadeFim?.dataLiberacao || "";
  const identidadeUnidade =
    periodo.idEquipamento ||
    periodo.idItemOrigem ||
    periodo.vinculoBase ||
    periodo.idUnidade ||
    `legado:${periodo.atividadeInicioId || "sem-inicio"}:${indice}`;

  return {
    ...periodo,
    idPeriodo: `${legado ? "legado" : "individual"}:${periodo.atividadeInicioId || "sem-inicio"}:${periodo.atividadeFimId || "aberto"}:${indice}`,
    identidadeUnidade: String(identidadeUnidade),
    categoria: periodo.equipamentoCategoria || periodo.equipamento,
    dataEntrada,
    dataSaida,
    quantidade,
    saldoAnterior: dataEntrada < periodo.dataInicio && (!dataSaida || dataSaida >= periodo.dataInicio) ? quantidade : 0,
    entradaNoMes: dataEntrada >= periodo.dataInicio ? quantidade : 0,
    saidaNoMes: dataSaida && dataSaida <= periodo.dataFim ? quantidade : 0,
    saldoFinal: !dataSaida || dataSaida > periodo.dataFim ? quantidade : 0,
    valorMensalUnitario: valorMensalTotal / quantidade,
    valorMensalTotal,
    valorProporcional: Number(periodo.valorProporcional || 0),
    legado,
    patrimonio: periodo.numeroPatrimonio || null,
  };
};

export const calcularPeriodosFinanceirosLocacao = (parametros) => {
  const resultadoIndividual = calcularPeriodosLocacaoIndividuais(parametros);
  const atividadesLegadas = parametros.atividadesBase.filter(
    (atividade) =>
      !resultadoIndividual.atividadesIndividualizadas.has(String(atividade.id))
  );
  const periodosLegadosBrutos = calcularPeriodosLocacao({
    ...parametros,
    atividadesBase: atividadesLegadas,
  });
  const atividadesPorId = new Map(
    parametros.atividadesBase.map((atividade) => [String(atividade.id), atividade])
  );
  const periodosIndividuais = resultadoIndividual.periodos.map((periodo, indice) =>
    normalizarPeriodoFinanceiroLocacao({
      periodo,
      indice,
      legado: false,
      atividadesPorId,
    })
  );
  const periodosLegados = periodosLegadosBrutos.map((periodo, indice) =>
    normalizarPeriodoFinanceiroLocacao({
      periodo,
      indice,
      legado: true,
      atividadesPorId,
    })
  );

  return {
    periodos: [...periodosIndividuais, ...periodosLegados],
    periodosIndividuais,
    periodosLegados,
    registrosZerados: resultadoIndividual.registrosZerados,
    atividadesIndividualizadas: resultadoIndividual.atividadesIndividualizadas,
  };
};

export const auditarLinhaLocacao = (linha) => {
  const periodos = Array.isArray(linha.periodosFinanceiros)
    ? linha.periodosFinanceiros
    : [];
  const ids = periodos.map((periodo) => periodo.idPeriodo);
  const erros = [];
  const saldoEsperado =
    Number(linha.saldoAnterior || 0) +
    Number(linha.entradasMes || 0) -
    Number(linha.saidasMes || 0);
  const somaProporcional = periodos.reduce(
    (total, periodo) => total + Number(periodo.valorProporcional || 0),
    0
  );
  if (saldoEsperado !== Number(linha.saldoFinal || 0)) erros.push("SALDO");
  if (new Set(ids).size !== ids.length) erros.push("PERIODO_DUPLICADO");
  if (periodos.some((periodo) => Number(periodo.diasLocados || 0) < 0)) erros.push("DIAS_NEGATIVOS");
  if (periodos.some((periodo) => Number(periodo.quantidade || 0) < 0)) erros.push("QUANTIDADE_NEGATIVA");
  if (periodos.some((periodo) => Number(periodo.valorProporcional || 0) < 0)) erros.push("VALOR_NEGATIVO");
  if (periodos.some((periodo) => periodo.mesCompleto && Number(periodo.valorProporcional || 0) > Number(periodo.valorMensalTotal || 0) + 0.01)) erros.push("MES_COMPLETO_ACIMA_MENSAL");
  const totalAtivos = periodos.reduce((total, periodo) => total + Number(periodo.saldoFinal || 0), 0);
  const totalEntradas = periodos.reduce((total, periodo) => total + Number(periodo.entradaNoMes || 0), 0);
  const totalSaidas = periodos.reduce((total, periodo) => total + Number(periodo.saidaNoMes || 0), 0);
  if (totalAtivos !== Number(linha.saldoFinal || 0)) erros.push("DETALHE_ATIVOS");
  if (totalEntradas !== Number(linha.entradasMes || 0)) erros.push("DETALHE_ENTRADAS");
  if (totalSaidas !== Number(linha.saidasMes || 0)) erros.push("DETALHE_SAIDAS");
  const identidadesAtivas = periodos
    .filter((periodo) => Number(periodo.saldoFinal || 0) > 0)
    .map((periodo) => String(periodo.identidadeUnidade || ""))
    .filter(Boolean);
  if (new Set(identidadesAtivas).size !== identidadesAtivas.length) {
    erros.push("IDENTIDADE_ATIVA_DUPLICADA");
  }
  if (Math.abs(somaProporcional - Number(linha.valorProporcionalMes || 0)) > 0.01) erros.push("VALOR");
  return { valido: erros.length === 0, erros, somaProporcional, idsPeriodos: ids };
};

export const auditarPeriodosFinanceirosObra = ({
  periodos = [],
  atividadesBase = [],
  atividadesIndividualizadas = new Set(),
  construtora,
  obra,
  mes,
  ano,
  imprimir = import.meta.env?.DEV === true,
}) => {
  const mesReferencia = `${ano}-${String(mes).padStart(2, "0")}`;
  const corresponde = (periodo) =>
    normalizarTexto(periodo.construtora) === normalizarTexto(construtora) &&
    normalizarTexto(periodo.obra) === normalizarTexto(obra);
  const periodosObra = periodos.filter(corresponde);
  const idsIndividualizados = new Set(
    [...atividadesIndividualizadas].map(String)
  );
  const atividadesComData = atividadesBase.filter((atividade) => atividade.dataLiberacao);
  const atividadesLegadas = atividadesComData.filter(
    (atividade) => !idsIndividualizados.has(String(atividade.id))
  );
  const idsLegados = new Set(atividadesLegadas.map((atividade) => String(atividade.id)));
  const processadasNosDoisCaminhos = atividadesComData.filter(
    (atividade) =>
      idsIndividualizados.has(String(atividade.id)) &&
      idsLegados.has(String(atividade.id))
  );
  const atividadesIgnoradas = atividadesBase.filter(
    (atividade) => !atividade.dataLiberacao
  );
  const tabela = periodosObra.map((periodo, indice) => {
    const atividadeOrigem = atividadesBase.find(
      (atividade) =>
        String(atividade.id) === String(periodo.atividadeInicioId || "")
    );
    return {
      posicaoVisual: indice + 1,
      idPeriodo: periodo.idPeriodo,
      identidade: periodo.identidadeUnidade,
      idEquipamento: periodo.idEquipamento || "",
      idItemOrigem: periodo.idItemOrigem || "",
      categoria: periodo.categoria,
      origem: periodo.origemValor,
      entrada: periodo.dataEntrada,
      saida: periodo.dataSaida || "",
      quantidade: periodo.quantidade,
      saldoAnterior: periodo.saldoAnterior,
      entradaNoMes: periodo.entradaNoMes,
      saidaNoMes: periodo.saidaNoMes,
      saldoFinal: periodo.saldoFinal,
      valorMensalUnitario: periodo.valorMensalUnitario,
      valorProporcional: periodo.valorProporcional,
      atividadeOrigemId: periodo.atividadeInicioId,
      servicoOrigem: atividadeOrigem?.servico || "",
      legado: periodo.legado,
      individualizado: !periodo.legado,
      motivoNoMes:
        periodo.saidaNoMes > 0
          ? "SAIDA_NO_MES"
          : periodo.entradaNoMes > 0
            ? "ENTRADA_NO_MES"
            : periodo.saldoAnterior > 0
              ? "SALDO_ANTERIOR"
              : "SEM_MOVIMENTO_NO_MES",
      estadoFimMes:
        Number(periodo.saldoFinal || 0) > 0
          ? "ATIVA_NO_FIM_DO_MES"
          : Number(periodo.saidaNoMes || 0) > 0
            ? "SAIDA_NO_MES"
            : "HISTORICO",
      chaveAntiduplicidade: periodo.idPeriodo,
    };
  });
  const diagnostico = {
    referencia: mesReferencia,
    periodos: tabela,
    atividadesIndividualizadas: atividadesComData.filter((atividade) =>
      idsIndividualizados.has(String(atividade.id))
    ),
    atividadesLegadas,
    atividadesIgnoradas,
    processadasNosDoisCaminhos,
  };

  if (imprimir) {
    console.groupCollapsed(
      `Auditoria financeira: ${construtora} / ${obra} / ${mesReferencia}`
    );
    console.table(tabela);
    console.table(diagnostico.atividadesIndividualizadas);
    console.table(diagnostico.atividadesLegadas);
    console.table(diagnostico.atividadesIgnoradas);
    console.table(diagnostico.processadasNosDoisCaminhos);
    console.groupEnd();
  }

  return diagnostico;
};
