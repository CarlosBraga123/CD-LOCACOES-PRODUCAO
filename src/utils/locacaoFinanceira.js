import { obterChaveObra, obterObraDaAtividade } from "./obras";
import {
  criarUnidadesDaEntrada,
  localizarIndiceUnidade,
} from "./unidadesEquipamentos";

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

  atividadesOrdenadas.forEach((atividade) => {
    const itens = Array.isArray(atividade.itensEquipamentos)
      ? atividade.itensEquipamentos
      : [];
    const iniciaLocacao = atividadeIniciaLocacao(atividade);
    const encerraLocacao = atividadeEncerraLocacao(atividade);
    const entradaIndividual =
      iniciaLocacao &&
      (itens.length > 0 || origensReferenciadas.has(String(atividade.id)));

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
    atividadesIndividualizadas.add(String(atividade.id));

    itens.forEach((item) => {
      const indice = localizarIndiceUnidade(unidadesAbertas, item);
      if (indice < 0) return;

      const unidadeAberta = unidadesAbertas[indice];
      if (atividade.servico === "Deslocamento") {
        const alteracao = String(
          item.alteracaoContrapeso || "nenhuma"
        ).toLowerCase();
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
          alteracaoContrapeso: alteracao,
        });

        if (alteracao === "adicionar" && !kitsAbertos.has(unidadeAberta.idUnidade)) {
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

        if (alteracao === "remover") {
          fecharRegistro(kitsAbertos.get(unidadeAberta.idUnidade), atividade);
          kitsAbertos.delete(unidadeAberta.idUnidade);
          unidadeAberta.usaContrapeso = false;
        }
      }

      if (encerraLocacao) {
        fecharRegistro(unidadeAberta.registroBase, atividade);
        fecharRegistro(kitsAbertos.get(unidadeAberta.idUnidade), atividade);
        kitsAbertos.delete(unidadeAberta.idUnidade);
        unidadesAbertas.splice(indice, 1);
      }
    });
  });

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
      const atividadeBase =
        registro.atividadeInicio || registro.atividadeFim;
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
              unidadeNoMes.numeroPatrimonio
                ? `Balancinho ${unidadeNoMes.numeroPatrimonio}`
                : `Unidade ${registro.vinculoBase}`
            }`
          : [
              equipamentoCategoria,
              unidadeNoMes.tamanho
                ? `${unidadeNoMes.tamanho} m`
                : "",
              unidadeNoMes.numeroPatrimonio
                ? `Patrimônio ${unidadeNoMes.numeroPatrimonio}`
                : "Sem patrimônio",
            ]
              .filter(Boolean)
              .join(" — ");

      return {
        idUnidade: registro.idRegistro,
        vinculoBase: registro.vinculoBase,
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
        valorMensal: registro.valorMensalUnitario,
        valorProporcional:
          (registro.valorMensalUnitario * diasLocados) / diasNoMes,
        origemValor: registro.origemValor,
        atividadeInicioId: registro.atividadeInicio?.id || null,
        atividadeFimId: registro.atividadeFim?.id || null,
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
