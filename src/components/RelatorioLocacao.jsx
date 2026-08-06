import { Fragment, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  calcularPeriodosFinanceirosLocacao,
  auditarPeriodosFinanceirosObra,
  auditarLinhaLocacao,
  obterMovimentosLocacao,
} from "../utils/locacaoFinanceira";
import { normalizarTexto, obterChaveObra, obterObraDaAtividade } from "../utils/obras";
import { atividadeTemPatrimonioPendente } from "../utils/pendenciasOperacionais";
import { obterIdentidadeCanonicaUnidade } from "../utils/unidadesEquipamentos";
import { obterUnidadesEquipamentosAtivos } from "../utils/equipamentosAtivos";

const normalizarCategoriaLocacao = (valor) =>
  normalizarTexto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const formatarOrigemFinanceiraVisual = (origem) => {
  const valorOriginal = String(origem || "").trim();
  const valorNormalizado = normalizarCategoriaLocacao(valorOriginal);

  if (!valorNormalizado || valorNormalizado === "sem valor") return "Sem valor";
  if (valorNormalizado === "congelado") return "Congelado";
  if (["obra", "estimado obra", "tabela da obra"].includes(valorNormalizado)) {
    return "Tabela da Obra";
  }
  if (
    ["construtora", "estimado construtora", "tabela da construtora"].includes(
      valorNormalizado
    )
  ) {
    return "Tabela da Construtora";
  }
  if (
    [
      "padrao",
      "estimado padrao",
      "tabela padrao",
      "tabela comercial",
    ].includes(valorNormalizado)
  ) {
    return "Tabela Comercial";
  }

  return valorOriginal;
};

const classificarOrigemFinanceiraLinha = (periodos = []) => {
  const origens = new Set(
    periodos.map((periodo) =>
      formatarOrigemFinanceiraVisual(periodo.origemValor)
    )
  );

  if (origens.size === 0) return "Sem valor";
  if (origens.size === 1) return Array.from(origens)[0];
  return "Múltiplas origens";
};

const formatarTituloUnidadeNaCompetencia = (periodo) => {
  const titulo = String(periodo?.equipamento || "Unidade não identificada");
  if (periodo?.saidaNoPeriodo) return titulo;

  return titulo.replace(
    /\s+—\s+(?:Saída|Removid[oa]|Recolhid[oa])(?:\s+.*)?$/i,
    ""
  );
};

const categoriasResumoLocacao = [
  {
    chave: "balancinho-eletrico",
    rotulo: "Balancinhos Elétricos",
    corresponde: (equipamento) =>
      normalizarCategoriaLocacao(equipamento).includes("balancinho") &&
      normalizarCategoriaLocacao(equipamento).includes("eletrico"),
  },
  {
    chave: "balancinho-manual",
    rotulo: "Balancinhos Manuais",
    corresponde: (equipamento) =>
      normalizarCategoriaLocacao(equipamento).includes("balancinho") &&
      normalizarCategoriaLocacao(equipamento).includes("manual"),
  },
  {
    chave: "mini-grua",
    rotulo: "Mini Gruas",
    corresponde: (equipamento) => normalizarCategoriaLocacao(equipamento).startsWith("mini grua"),
  },
  {
    chave: "kit-contrapeso",
    rotulo: "Kits Contrapeso",
    corresponde: (equipamento) => normalizarCategoriaLocacao(equipamento) === "kit contrapeso",
  },
];

const criarResumoCategoriasLocacao = (linhas, { ocultarZerados = false } = {}) => {
  const itens = categoriasResumoLocacao.map((categoria) => ({
    ...categoria,
    valor: linhas
      .filter((linha) =>
        categoria.corresponde(
          linha.equipamentoCategoria || linha.equipamento || ""
        )
      )
      .reduce((total, linha) => total + Number(linha.valorProporcionalMes || 0), 0),
  }));
  const itensVisiveis = ocultarZerados ? itens.filter((item) => item.valor > 0) : itens;

  return {
    itens: itensVisiveis,
    total: itens.reduce((total, item) => total + item.valor, 0),
  };
};

export default function RelatorioLocacao() {
  const [atividades, setAtividades] = useState([]);
  const [mesSelecionado, setMesSelecionado] = useState(() => new Date().toISOString().slice(0, 7));
  const [visualizacao, setVisualizacao] = useState("data");
  const [mostrarZerados, setMostrarZerados] = useState(false);
  const [linhasExpandidas, setLinhasExpandidas] = useState({});
  const [resumosObraExpandidos, setResumosObraExpandidos] = useState({});
  const [exportacaoPdfAtiva, setExportacaoPdfAtiva] = useState(false);

  useEffect(() => {
    setAtividades(JSON.parse(localStorage.getItem("atividades") || "[]"));
  }, []);

  // Formatacao de exibicao.
  const formatarMoeda = (valor) => {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const formatarData = (data) => {
    if (!data) return "-";
    const [ano, mes, dia] = String(data).split("-");
    if (!ano || !mes || !dia) return data;
    return `${dia}/${mes}/${ano}`;
  };

  const dados = useMemo(() => {
    if (!mesSelecionado) return [];

    const obras = JSON.parse(localStorage.getItem("obras") || "[]");
    const construtoras = JSON.parse(localStorage.getItem("construtoras") || "[]");
    const tabelaComercialPadrao = JSON.parse(localStorage.getItem("tabelaComercialPadrao") || "null") || {
      locacoes: {},
    };
    const inicioMes = `${mesSelecionado}-01`;
    const fimMes = new Date(
      Number(mesSelecionado.slice(0, 4)),
      Number(mesSelecionado.slice(5, 7)),
      0
    )
      .toISOString()
      .slice(0, 10);
    const diasNoMes = Number(fimMes.slice(8, 10));

    const mapa = new Map();

    // Identificacao visual dos equipamentos.
    const formatarEquipamento = (atividade) => {
      if (atividade.tipoMovimentoLocacao === "contrapeso") return "Kit Contrapeso";

      if (atividade.equipamento === "Mini Grua") {
        return atividade.tipoMiniGrua ? `Mini Grua ${atividade.tipoMiniGrua}` : "Mini Grua";
      }

      if (atividade.equipamento !== "Balancinho") return atividade.equipamento || "Sem equipamento";
      if (atividade.tipoBalancinho === "Manual") return "Balancinho Manual";
      return "Balancinho Elétrico";
    };

    const formatarCategoriaGerencial = (categoria) => {
      if (categoria === "Mini Grua 500kg") return "Mini Grua 500 kg";
      if (categoria === "Mini Grua 1T") return "Mini Grua 1 T";
      return categoria || "Sem equipamento";
    };

    const obterLinha = (atividade) => {
      const obra = obterObraDaAtividade(atividade, obras);
      const equipamentoFormatado = formatarEquipamento(atividade);
      const chaveObra = obterChaveObra(atividade);
      const chave = [
        chaveObra,
        equipamentoFormatado,
        atividade.usaContrapeso ? "contrapeso" : "",
      ].join("||");

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chaveObra,
          construtora: obra?.construtora || atividade.construtora || "Sem construtora",
          obra: obra?.nome || String(atividade.obra || "Sem obra").trim(),
          equipamento: equipamentoFormatado,
          equipamentoCategoria: equipamentoFormatado,
          usaContrapeso: !!atividade.usaContrapeso,
          saldoAnterior: 0,
          entradasMes: 0,
          saidasMes: 0,
          saldoFinal: 0,
          valorMensal: 0,
          valorProporcionalMes: 0,
          valorMensalAtivo: 0,
          origensValor: new Set(),
          periodosLocacao: [],
        });
      }

      return mapa.get(chave);
    };

    // Valores de locacao: congelado primeiro, estimativas apenas como fallback.
    const obterTabelasFallback = (atividade) => {
      const obra = obterObraDaAtividade(atividade, obras);
      const nomeConstrutora = obra?.construtora || atividade.construtora;
      const construtora = construtoras.find(
        (item) => normalizarTexto(item.nome) === normalizarTexto(nomeConstrutora)
      );

      return [
        { tabela: obra?.tabelaComercial, origem: "Estimado obra" },
        { tabela: construtora?.tabelaComercial, origem: "Estimado construtora" },
        { tabela: tabelaComercialPadrao, origem: "Estimado padrão" },
      ].filter((item) => item.tabela);
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
        const tipo = atividade.tipoMiniGrua || "500kg";
        return {
          base: `Mini Grua-${tipo}`,
          adicionalContrapeso: null,
        };
      }

      return {
        base: atividade.equipamento,
        adicionalContrapeso: null,
      };
    };

    const calcularValorPorTabela = (atividade, tabela) => {
      const quantidade = Number(atividade.quantidade) || 1;
      const chaves = obterChavesLocacao(atividade);

      if (atividade.tipoMovimentoLocacao === "contrapeso") {
        if (!chaves.adicionalContrapeso) return null;
        if (tabela.locacoes?.[chaves.adicionalContrapeso] === undefined) return null;
        return Number(tabela.locacoes[chaves.adicionalContrapeso] || 0) * quantidade;
      }

      if (tabela.locacoes?.[chaves.base] === undefined) return null;

      const base = Number(tabela.locacoes[chaves.base] || 0);
      const adicional =
        !atividade.tipoMovimentoLocacao && atividade.usaContrapeso && chaves.adicionalContrapeso
          ? Number(tabela.locacoes?.[chaves.adicionalContrapeso] || 0)
          : 0;

      return (base + adicional) * quantidade;
    };

    const obterValorMensalLocacao = (atividade) => {
      const quantidade = Number(atividade.quantidade) || 1;

      if (atividade.tipoMovimentoLocacao === "contrapeso") {
        if (atividade.valoresCongelados?.adicionalContrapesoLocacao !== undefined) {
          return {
            valor: Number(atividade.valoresCongelados.adicionalContrapesoLocacao || 0) * quantidade,
            origem: "Congelado",
          };
        }
      }

      if (atividade.tipoMovimentoLocacao === "base") {
        if (atividade.valoresCongelados?.locacaoMensalUnitario !== undefined) {
          return {
            valor: Number(atividade.valoresCongelados.locacaoMensalUnitario || 0) * quantidade,
            origem: "Congelado",
          };
        }
      }

      if (atividade.valoresCongelados?.totalLocacaoMensal !== undefined) {
        return {
          valor: Number(atividade.valoresCongelados.totalLocacaoMensal || 0),
          origem: "Congelado",
        };
      }

      for (const item of obterTabelasFallback(atividade)) {
        const valor = calcularValorPorTabela(atividade, item.tabela);
        if (valor !== null) {
          return {
            valor,
            origem: item.origem,
          };
        }
      }

      return {
        valor: 0,
        origem: "Sem valor",
      };
    };

    const resultadoPeriodosFinanceiros = calcularPeriodosFinanceirosLocacao({
      atividadesBase: atividades,
      inicioMes,
      fimMes,
      diasNoMes,
      obras,
      formatarEquipamento,
      obterValorMensalLocacao,
    });
    if (import.meta.env.DEV) {
      auditarPeriodosFinanceirosObra({
        periodos: resultadoPeriodosFinanceiros.periodos,
        atividadesBase: atividades,
        atividadesIndividualizadas:
          resultadoPeriodosFinanceiros.atividadesIndividualizadas,
        construtora: "JOSE ROCHA",
        obra: "Rio Branco",
        mes: Number(mesSelecionado.slice(5, 7)),
        ano: Number(mesSelecionado.slice(0, 4)),
      });
    }
    const {
      periodosIndividuais,
      registrosZerados: registrosIndividuaisZerados,
      atividadesIndividualizadas,
    } = resultadoPeriodosFinanceiros;
    const atividadesLegadas = atividades.filter(
      (atividade) =>
        !atividadesIndividualizadas.has(String(atividade.id))
    );
    // Regras operacionais atuais, com fallback para registros antigos.
    const atividadeIniciaLocacao = (atividade) => {
      if (atividade.iniciaLocacao !== undefined) return atividade.iniciaLocacao === true;
      return atividade.servico === "Instalação";
    };

    const atividadeEncerraLocacao = (atividade) => {
      if (atividade.encerraLocacao !== undefined) return atividade.encerraLocacao === true;
      return atividade.servico === "Remoção";
    };

    // A apresentação reconstrói apenas saldos; valores vêm dos períodos oficiais.
    atividadesLegadas
      .filter((atividade) => atividade.dataLiberacao)
      .sort((a, b) => new Date(a.dataLiberacao) - new Date(b.dataLiberacao))
      .flatMap((atividade) => obterMovimentosLocacao(atividade))
      .forEach((atividade) => {
        const quantidade = Number(atividade.quantidade) || 1;
        const entrada = atividadeIniciaLocacao(atividade);
        const saida = atividadeEncerraLocacao(atividade);

        if (!entrada && !saida) return;

        const linha = obterLinha(atividade);
        const movimento = entrada ? quantidade : -quantidade;

        if (atividade.dataLiberacao < inicioMes) {
          linha.saldoAnterior += movimento;
        }

        if (atividade.dataLiberacao >= inicioMes && atividade.dataLiberacao <= fimMes) {
          if (entrada) linha.entradasMes += quantidade;
          if (saida) linha.saidasMes += quantidade;
        }

        if (atividade.dataLiberacao <= fimMes) {
          linha.saldoFinal += movimento;
        }
      });

    const periodosLocacao = resultadoPeriodosFinanceiros.periodosLegados;
    periodosLocacao.forEach((periodo) => {
      const chaveLinha = [
        periodo.chaveObra,
        periodo.equipamento,
        periodo.usaContrapeso ? "contrapeso" : "",
      ].join("||");
      const linha = mapa.get(chaveLinha);
      if (linha) linha.periodosLocacao.push(periodo);
    });

    periodosIndividuais.forEach((periodo) => {
      const entradaNoMes =
        periodo.dataEntradaReal >= inicioMes &&
        periodo.dataEntradaReal <= fimMes;
      const saidaNoMes =
        Boolean(periodo.dataSaidaReal) &&
        periodo.dataSaidaReal >= inicioMes &&
        periodo.dataSaidaReal <= fimMes;
      const ativaAntesDoMes =
        periodo.dataEntradaReal < inicioMes &&
        (!periodo.dataSaidaReal || periodo.dataSaidaReal >= inicioMes);
      const ativaAoFimDoMes =
        periodo.dataEntradaReal <= fimMes &&
        (!periodo.dataSaidaReal || periodo.dataSaidaReal > fimMes);
      const equipamentoAgrupado = periodo.equipamentoCategoria;
      const chave = [
        "individual",
        periodo.chaveObra,
        periodo.equipamentoCategoria,
        periodo.dataInicio,
        periodo.dataFim,
        Number(periodo.valorMensal || 0),
        periodo.origemValor || "",
        ativaAntesDoMes ? 1 : 0,
        entradaNoMes ? 1 : 0,
        saidaNoMes ? 1 : 0,
        ativaAoFimDoMes ? 1 : 0,
      ].join("||");

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chaveObra: periodo.chaveObra,
          construtora: periodo.construtora,
          obra: periodo.obra,
          equipamento: equipamentoAgrupado,
          equipamentoCategoria: periodo.equipamentoCategoria,
          usaContrapeso: periodo.usaContrapeso,
          saldoAnterior: 0,
          entradasMes: 0,
          saidasMes: 0,
          saldoFinal: 0,
          valorMensal: 0,
          valorProporcionalMes: 0,
          valorMensalAtivo: 0,
          origensValor: new Set(),
          periodosLocacao: [],
        });
      }

      const linha = mapa.get(chave);
      linha.saldoAnterior += ativaAntesDoMes ? 1 : 0;
      linha.entradasMes += entradaNoMes ? 1 : 0;
      linha.saidasMes += saidaNoMes ? 1 : 0;
      linha.saldoFinal += ativaAoFimDoMes ? 1 : 0;
      linha.valorMensalAtivo += ativaAoFimDoMes
        ? Number(periodo.valorMensal || 0)
        : 0;
      linha.origensValor.add(periodo.origemValor);
      linha.periodosLocacao.push(periodo);
    });

    registrosIndividuaisZerados.forEach((registro) => {
      const equipamentoAgrupado = registro.equipamentoCategoria;
      const chave = [
        "individual-zerado",
        registro.chaveObra,
        registro.equipamentoCategoria,
        registro.origemValor || "",
      ].join("||");

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chaveObra: registro.chaveObra,
          construtora: registro.construtora,
          obra: registro.obra,
          equipamento: equipamentoAgrupado,
          equipamentoCategoria: registro.equipamentoCategoria,
          usaContrapeso: registro.usaContrapeso,
          saldoAnterior: 0,
          entradasMes: 0,
          saidasMes: 0,
          saldoFinal: 0,
          valorMensal: 0,
          valorProporcionalMes: 0,
          valorMensalAtivo: 0,
          origensValor: new Set([registro.origemValor]),
          periodosLocacao: [],
        });
      }
    });

    const linhasCalculadas = Array.from(mapa.values()).map((linha) => {
      const valorProporcionalPeriodos = linha.periodosLocacao.reduce(
        (total, periodo) => total + Number(periodo.valorProporcional || 0),
        0
      );
      const valorMensalPeriodos = linha.periodosLocacao.reduce(
        (total, periodo) => total + Number(periodo.valorMensal || 0),
        0
      );
      const origensValorPeriodos = linha.periodosLocacao
        .map((periodo) => periodo.origemValor)
        .filter(Boolean);

      return {
        ...linha,
        valorMensal: valorMensalPeriodos,
        valorProporcionalMes: valorProporcionalPeriodos,
        origemValor: Array.from(new Set(origensValorPeriodos)).join(" / ") || "Sem valor",
      };
    });
    const mapaGerencial = linhasCalculadas.reduce((acc, linha) => {
      const categoria = formatarCategoriaGerencial(
        linha.equipamentoCategoria || linha.equipamento
      );
      const chave = `${linha.chaveObra}||${categoria}`;

      if (!acc.has(chave)) {
        acc.set(chave, {
          chaveObra: linha.chaveObra,
          construtora: linha.construtora,
          obra: linha.obra,
          equipamento: categoria,
          equipamentoCategoria: categoria,
          usaContrapeso: categoria === "Kit Contrapeso",
          saldoAnterior: 0,
          entradasMes: 0,
          saidasMes: 0,
          saldoFinal: 0,
          valorMensal: 0,
          valorProporcionalMes: 0,
          valorMensalAtivo: 0,
          origensValor: new Set(),
          periodosLocacao: [],
        });
      }

      const consolidada = acc.get(chave);
      consolidada.saldoAnterior += Number(linha.saldoAnterior || 0);
      consolidada.entradasMes += Number(linha.entradasMes || 0);
      consolidada.saidasMes += Number(linha.saidasMes || 0);
      consolidada.saldoFinal += Number(linha.saldoFinal || 0);
      consolidada.valorMensal += Number(linha.valorMensal || 0);
      consolidada.valorProporcionalMes += Number(
        linha.valorProporcionalMes || 0
      );
      consolidada.valorMensalAtivo += Number(linha.valorMensalAtivo || 0);
      linha.origemValor
        .split(" / ")
        .filter(Boolean)
        .forEach((origem) => consolidada.origensValor.add(origem));
      consolidada.periodosLocacao.push(...linha.periodosLocacao);

      return acc;
    }, new Map());

    const atividadesAteFim = atividades.filter(
      (atividade) =>
        atividade.dataLiberacao && atividade.dataLiberacao <= fimMes
    );
    const atividadesDoMes = atividades.filter(
      (atividade) =>
        atividade.dataLiberacao >= inicioMes &&
        atividade.dataLiberacao <= fimMes
    );
    const ajustarQuantidadeDetalhe = (itens, quantidadeOficial, linha, tipo) =>
      Array.from(
        { length: Math.max(0, Number(quantidadeOficial) || 0) },
        (_, indice) => itens[indice] || {
          identidadeCanonica: `legado:${linha.chaveObra}:${linha.equipamento}:${tipo}:${indice}`,
          equipamento: `${linha.equipamento} — Unidade não identificada`,
          unidadeLegada: true,
          ativaNoFim: tipo === "ativa",
          entradaNoPeriodo: tipo === "entrada",
          saidaNoPeriodo: tipo === "saida",
          dataEntradaOriginal: tipo === "entrada" ? inicioMes : "",
          dataSaidaEfetiva: tipo === "saida" ? fimMes : "",
        }
      );

    const montarDetalhamentoLinha = (linha) => {
      const obra = obras.find(
        (item) =>
          obterChaveObra({
            obraId: item.id,
            obra: item.nome,
            construtora: item.construtora,
          }) === linha.chaveObra
      );
      const periodosPorIdentidade = new Map();
      linha.periodosLocacao.forEach((periodo, indice) => {
        const identidade = obterIdentidadeCanonicaUnidade(
          periodo,
          `${periodo.atividadeInicioId || "sem-inicio"}:${periodo.idUnidade || indice}`
        );
        if (!periodosPorIdentidade.has(identidade)) {
          periodosPorIdentidade.set(identidade, periodo);
        }
      });

      const unidadesAtivas = obra
        ? obterUnidadesEquipamentosAtivos(obra, atividadesAteFim)
        : [];
      const candidatosAtivos = unidadesAtivas.flatMap((unidade) => {
        const base = {
          ...unidade,
          equipamentoCategoria: formatarCategoriaGerencial(
            formatarEquipamento({ ...unidade, usaContrapeso: false })
          ),
          tipoDetalhe: "base",
        };
        return unidade.equipamento === "Balancinho" && unidade.usaContrapeso
          ? [
              base,
              {
                ...unidade,
                equipamentoCategoria: "Kit Contrapeso",
                tipoDetalhe: "contrapeso",
              },
            ]
          : [base];
      });
      const mapaAtivos = new Map();
      candidatosAtivos
        .filter((unidade) => unidade.equipamentoCategoria === linha.equipamento)
        .forEach((unidade, indice) => {
          const identidadeBase = obterIdentidadeCanonicaUnidade(
            unidade,
            `${linha.chaveObra}:ativa:${indice}`
          );
          const identidade = `${unidade.tipoDetalhe}:${identidadeBase}`;
          if (mapaAtivos.has(identidade)) return;
          const periodo = periodosPorIdentidade.get(identidadeBase) || {};
          const patrimonio = unidade.numeroPatrimonio || "";
          mapaAtivos.set(identidade, {
            ...periodo,
            ...unidade,
            identidadeCanonica: identidade,
            equipamento: patrimonio
              ? `${linha.equipamento} — Patrimônio ${patrimonio}`
              : `${linha.equipamento} — Unidade não identificada`,
            ativaNoFim: true,
            entradaNoPeriodo:
              unidade.dataEntrada >= inicioMes && unidade.dataEntrada <= fimMes,
            saidaNoPeriodo: false,
            dataEntradaOriginal: unidade.dataEntrada || periodo.dataEntradaReal || "",
          });
        });

      const montarMovimentos = (tipo) => {
        const movimentos = [];
        atividadesDoMes
          .filter((atividade) => obterChaveObra(atividade) === linha.chaveObra)
          .forEach((atividade) => {
            obterMovimentosLocacao(atividade)
              .filter((movimento) =>
                formatarCategoriaGerencial(
                  movimento.tipoMovimentoLocacao === "contrapeso"
                    ? "Kit Contrapeso"
                    : formatarEquipamento(movimento)
                ) === linha.equipamento &&
                (tipo === "entrada"
                  ? movimento.iniciaLocacao === true
                  : movimento.encerraLocacao === true)
              )
              .forEach((movimento) => {
                const quantidade = Math.max(1, Number(movimento.quantidade) || 1);
                const itens = Array.isArray(atividade.itensEquipamentos)
                  ? atividade.itensEquipamentos
                  : [];
                const campoAtividadePeriodo =
                  tipo === "entrada" ? "atividadeInicioId" : "atividadeFimId";
                const periodosDaAtividade = linha.periodosLocacao.filter(
                  (registro) =>
                    String(registro[campoAtividadePeriodo] || "") ===
                    String(atividade.id)
                );
                Array.from({ length: quantidade }, (_, indice) => {
                  const item = itens[indice] || {};
                  const identidadeBase = obterIdentidadeCanonicaUnidade(
                    item,
                    `${atividade.id}:${movimento.tipoMovimentoLocacao || "base"}:${tipo}:${indice}`
                  );
                  const periodoIdentificado = periodosDaAtividade.find(
                    (registro) =>
                      item.idEquipamento &&
                      String(registro.idEquipamento || "") ===
                        String(item.idEquipamento)
                  );
                  const periodoPorPosicao =
                    periodosDaAtividade.length === quantidade
                      ? periodosDaAtividade[indice]
                      : null;
                  const periodoAgregado =
                    periodosDaAtividade.length === 1
                      ? {
                          ...periodosDaAtividade[0],
                          valorMensal:
                            Number(periodosDaAtividade[0].valorMensal || 0) /
                            quantidade,
                          valorProporcional:
                            Number(periodosDaAtividade[0].valorProporcional || 0) /
                            quantidade,
                        }
                      : null;
                  const periodo =
                    periodoIdentificado || periodoPorPosicao || periodoAgregado || {};
                  const patrimonio = item.numeroPatrimonio || periodo.numeroPatrimonio || "";
                  movimentos.push({
                    ...periodo,
                    ...item,
                    identidadeCanonica: `${tipo}:${atividade.id}:${identidadeBase}:${indice}`,
                    equipamento: patrimonio
                      ? `${linha.equipamento} — Patrimônio ${patrimonio}`
                      : `${linha.equipamento} — Unidade não identificada`,
                    ativaNoFim: false,
                    entradaNoPeriodo: tipo === "entrada",
                    saidaNoPeriodo: tipo === "saida",
                    dataEntradaOriginal:
                      tipo === "entrada" ? atividade.dataLiberacao : periodo.dataEntradaReal || "",
                    dataSaidaEfetiva:
                      tipo === "saida" ? atividade.dataLiberacao : "",
                    saidaPatrimonialPendente:
                      tipo === "saida" &&
                      atividade.pendenteVinculoPatrimonio === true &&
                      !patrimonio,
                  });
                });
              });
          });
        return movimentos;
      };

      return {
        ativos: ajustarQuantidadeDetalhe(
          Array.from(mapaAtivos.values()),
          linha.saldoFinal,
          linha,
          "ativa"
        ),
        entradas: ajustarQuantidadeDetalhe(
          montarMovimentos("entrada"),
          linha.entradasMes,
          linha,
          "entrada"
        ),
        saidas: ajustarQuantidadeDetalhe(
          montarMovimentos("saida"),
          linha.saidasMes,
          linha,
          "saida"
        ),
      };
    };

    const atividadesPorId = new Map(
      atividades.map((atividade) => [String(atividade.id), atividade])
    );
    const normalizarPeriodoFinanceiroDetalhe = (periodo, indice) => {
      const atividadeInicio = atividadesPorId.get(
        String(periodo.atividadeInicioId || "")
      );
      const atividadeFim = atividadesPorId.get(
        String(periodo.atividadeFimId || "")
      );
      const dataEntradaReal =
        periodo.dataEntradaReal || atividadeInicio?.dataLiberacao || periodo.dataInicio || "";
      const dataSaidaReal =
        periodo.dataSaidaReal || atividadeFim?.dataLiberacao || "";
      const quantidadeDetalhe = Math.max(
        1,
        Number(periodo.quantidadeFinanceira ?? periodo.quantidade) || 1
      );
      const entradaNoPeriodo =
        dataEntradaReal >= inicioMes && dataEntradaReal <= fimMes;
      const saidaNoPeriodo =
        Boolean(dataSaidaReal) &&
        dataSaidaReal >= inicioMes && dataSaidaReal <= fimMes;
      const ativaNoFim =
        dataEntradaReal <= fimMes &&
        (!dataSaidaReal || dataSaidaReal > fimMes);
      const identidadeCanonica = obterIdentidadeCanonicaUnidade(
        periodo,
        `${periodo.atividadeInicioId || "sem-inicio"}:${periodo.atividadeFimId || "aberto"}:${indice}`
      );
      const patrimonio = periodo.numeroPatrimonio || "";

      return {
        ...periodo,
        identidadeCanonica: `financeiro:${identidadeCanonica}:${indice}`,
        equipamento: patrimonio
          ? `${periodo.equipamentoCategoria || periodo.equipamento} — Patrimônio ${patrimonio}`
          : periodo.equipamento || "Unidade não identificada",
        quantidadeDetalhe,
        valorMensal: Number(periodo.valorMensal || 0),
        valorProporcional: Number(periodo.valorProporcional || 0),
        diasLocados: Number(periodo.diasLocados || 0),
        dataEntradaOriginal: dataEntradaReal,
        dataSaidaEfetiva: dataSaidaReal,
        entradaNoPeriodo,
        saidaNoPeriodo,
        ativaNoFim,
      };
    };
    const montarDetalhamentoFinanceiroOficial = (linha) => {
      const periodosFinanceiros = linha.periodosLocacao.map((periodo) => ({
        ...periodo,
        identidadeCanonica: periodo.idPeriodo,
        quantidadeDetalhe: periodo.quantidade,
        dataEntradaOriginal: periodo.dataEntrada,
        dataSaidaEfetiva: periodo.dataSaida,
        entradaNoPeriodo:
          periodo.dataEntrada >= inicioMes && periodo.dataEntrada <= fimMes,
        saidaNoPeriodo:
          Boolean(periodo.dataSaida) &&
          periodo.dataSaida >= inicioMes &&
          periodo.dataSaida <= fimMes,
        ativaNoFim:
          periodo.dataEntrada <= fimMes &&
          (!periodo.dataSaida || periodo.dataSaida > fimMes),
      }));
      const saidas = periodosFinanceiros.filter((periodo) => periodo.saidaNoPeriodo);
      const ativos = periodosFinanceiros.filter(
        (periodo) => !periodo.saidaNoPeriodo && periodo.ativaNoFim
      );
      const entradas = periodosFinanceiros.filter(
        (periodo) =>
          !periodo.saidaNoPeriodo &&
          !periodo.ativaNoFim &&
          periodo.entradaNoPeriodo
      );
      const auditoria = auditarLinhaLocacao({
        ...linha,
        periodosFinanceiros,
      });
      if (import.meta.env.DEV && !auditoria.valido) {
        console.error("Auditoria financeira da locação", {
          construtora: linha.construtora,
          obra: linha.obra,
          categoria: linha.equipamento,
          mes: mesSelecionado,
          saldoAnterior: linha.saldoAnterior,
          entradas: linha.entradasMes,
          saidas: linha.saidasMes,
          saldoFinal: linha.saldoFinal,
          valorLinha: linha.valorProporcionalMes,
          ...auditoria,
        });
      }

      return { ativos, entradas, saidas, periodosFinanceiros };
    };

    return Array.from(mapaGerencial.values()).map((linha) => ({
      ...linha,
      origemValor:
        Array.from(linha.origensValor).join(" / ") || "Sem valor",
      origemValorExibicao: classificarOrigemFinanceiraLinha(
        linha.periodosLocacao
      ),
      detalhamentoUnidades: montarDetalhamentoFinanceiroOficial(linha),
    })).sort((a, b) => {
      const construtora = a.construtora.localeCompare(b.construtora);
      if (construtora !== 0) return construtora;
      const obra = a.obra.localeCompare(b.obra);
      if (obra !== 0) return obra;
      return a.equipamento.localeCompare(b.equipamento);
    });
  }, [atividades, mesSelecionado]);

  const linhaZerada = (linha) => {
    return (
      Number(linha.saldoAnterior || 0) === 0 &&
      Number(linha.entradasMes || 0) === 0 &&
      Number(linha.saidasMes || 0) === 0 &&
      Number(linha.saldoFinal || 0) === 0 &&
      (!Array.isArray(linha.periodosLocacao) || linha.periodosLocacao.length === 0) &&
      Number(linha.valorMensal || 0) === 0 &&
      Number(linha.valorProporcionalMes || 0) === 0
    );
  };

  const dadosVisiveis = mostrarZerados ? dados : dados.filter((linha) => !linhaZerada(linha));
  const resumoLocacao = dadosVisiveis.reduce(
    (acc, linha) => {
      acc.totalValorMensal += Number(linha.valorMensal || 0);
      acc.totalProporcionalMes += Number(linha.valorProporcionalMes || 0);
      acc.totalEquipamentosLocados += Number(linha.saldoFinal || 0);
      acc.obras.add(linha.chaveObra || `nome:${normalizarTexto(linha.construtora)}||${normalizarTexto(linha.obra)}`);
      return acc;
    },
    {
      totalValorMensal: 0,
      totalProporcionalMes: 0,
      totalEquipamentosLocados: 0,
      obras: new Set(),
    }
  );

  const dadosPorObra = dadosVisiveis.reduce((acc, linha) => {
    const chave = linha.chaveObra || `nome:${normalizarTexto(linha.construtora)}||${normalizarTexto(linha.obra)}`;
    if (!acc[chave]) {
      acc[chave] = {
        chaveObra: chave,
        construtora: linha.construtora,
        obra: linha.obra,
        linhas: [],
      };
    }

    acc[chave].linhas.push(linha);
    return acc;
  }, {});

  const gruposPorObra = Object.values(dadosPorObra);
  const resumoCategoriasGeral = criarResumoCategoriasLocacao(dadosVisiveis);

  const formatarMesRelatorio = () => {
    if (!mesSelecionado) return "";
    const [ano, mes] = mesSelecionado.split("-");
    return `${mes}/${ano}`;
  };

  const renderResumoCategorias = (titulo, resumo, rotuloTotal = "TOTAL GERAL DA LOCAÇÃO") => (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold uppercase text-gray-700">{titulo}</h3>
      <div className="space-y-2 text-sm">
        {resumo.itens.map((item) => (
          <div key={item.chave} className="flex items-center justify-between gap-4">
            <span className="text-gray-700">{item.rotulo}</span>
            <span className="font-semibold text-gray-900">{formatarMoeda(item.valor)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t pt-3">
        <p className="text-xs font-bold uppercase text-gray-500">{rotuloTotal}</p>
        <p className="text-xl font-bold text-green-700">{formatarMoeda(resumo.total)}</p>
      </div>
    </div>
  );

  const montarLinhasResumoExcel = (titulo, resumo, rotuloTotal = "TOTAL GERAL DA LOCAÇÃO") => {
    const linhas = [[titulo]];
    resumo.itens.forEach((item) => {
      linhas.push([item.rotulo, item.valor]);
    });
    linhas.push([rotuloTotal, resumo.total]);
    return linhas;
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [[`Relatório de Locação - ${formatarMesRelatorio()}`], []];

    wsData.push(...montarLinhasResumoExcel("Resumo da Locação", resumoCategoriasGeral));
    wsData.push([]);

    const cabecalho = [
      "Construtora",
      "Obra",
      "Equipamento",
      "Saldo anterior",
      "Entradas no mês",
      "Saídas no mês",
      "Saldo final",
      "Valor mensal",
      "Valor proporcional do mês",
      "Origem",
    ];

    if (visualizacao === "obra") {
      gruposPorObra.forEach((grupo) => {
        wsData.push([`${grupo.construtora} | ${grupo.obra}`]);
        wsData.push(cabecalho);
        grupo.linhas.forEach((linha) => {
          wsData.push([
            linha.construtora,
            linha.obra,
            linha.equipamento,
            linha.saldoAnterior,
            linha.entradasMes,
            linha.saidasMes,
            linha.saldoFinal,
            linha.valorMensal,
            linha.valorProporcionalMes,
            linha.origemValor,
          ]);
        });
        wsData.push([]);
        wsData.push(
          ...montarLinhasResumoExcel(
            "Resumo da Locação da Obra",
            criarResumoCategoriasLocacao(grupo.linhas, { ocultarZerados: true }),
            "TOTAL DA LOCAÇÃO DA OBRA"
          )
        );
        wsData.push([]);
      });
    } else {
      wsData.push(cabecalho);
      dadosVisiveis.forEach((linha) => {
        wsData.push([
          linha.construtora,
          linha.obra,
          linha.equipamento,
          linha.saldoAnterior,
          linha.entradasMes,
          linha.saidasMes,
          linha.saldoFinal,
          linha.valorMensal,
          linha.valorProporcionalMes,
          linha.origemValor,
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 28 },
      { wch: 30 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Locação");
    XLSX.writeFile(wb, `Relatório de Locação ${formatarMesRelatorio().replace("/", "-")}.xlsx`);
  };

  const exportarPDF = async () => {
    const element = document.getElementById("relatorio-locacao-exportacao");
    if (!element) return;

    setExportacaoPdfAtiva(true);

    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let y = margin;
    let heightLeft = imgHeight;

    pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      pdf.addPage();
      y = margin - (imgHeight - heightLeft);
      pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    pdf.save(`Relatório de Locação ${formatarMesRelatorio().replace("/", "-")}.pdf`);
    } finally {
      setExportacaoPdfAtiva(false);
    }
  };

  // Expansao visual dos periodos, sem interferir nos calculos.
  const obterChaveExpansao = (linha, index, prefixo) =>
    `${prefixo}-${linha.chaveObra || "sem-obra"}-${linha.equipamento}-${linha.usaContrapeso ? "contrapeso" : "padrao"}-${index}`;

  const alternarExpansao = (chave) => {
    setLinhasExpandidas((estadoAtual) => ({
      ...estadoAtual,
      [chave]: !estadoAtual[chave],
    }));
  };

  const alternarResumoObra = (chave) => {
    setResumosObraExpandidos((estadoAtual) => ({
      ...estadoAtual,
      [chave]: !estadoAtual[chave],
    }));
  };

  const renderLinha = (linha, index, prefixo = "linha") => {
    const chave = obterChaveExpansao(linha, index, prefixo);
    const detalhes = linha.detalhamentoUnidades || {};
    const detalhesAtivos = Array.isArray(detalhes.ativos) ? detalhes.ativos : [];
    const detalhesSaidas = Array.isArray(detalhes.saidas) ? detalhes.saidas : [];
    const detalhesEntradas = Array.isArray(detalhes.entradas) ? detalhes.entradas : [];
    const contarQuantidadeDetalhe = (itens) =>
      itens.reduce(
        (total, item) => total + Math.max(1, Number(item.quantidadeDetalhe) || 1),
        0
      );
    const quantidadeAtivosDetalhe = contarQuantidadeDetalhe(detalhesAtivos);
    const quantidadeSaidasDetalhe = contarQuantidadeDetalhe(detalhesSaidas);
    const temPeriodos =
      detalhesAtivos.length + detalhesSaidas.length + detalhesEntradas.length > 0;
    const expandida = !!linhasExpandidas[chave];

    const renderCardUnidade = (periodo) => (
      <div
        key={`${chave}-${periodo.identidadeCanonica}`}
        className="rounded border bg-white p-3 text-xs text-gray-700 shadow-sm"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 font-semibold text-gray-900">
          <span>{formatarTituloUnidadeNaCompetencia(periodo)}</span>
          {periodo.saidaNoPeriodo && periodo.saidaPatrimonialPendente && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">
              Patrimônio pendente
            </span>
          )}
          {periodo.entradaNoPeriodo && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] text-blue-800">
              Entrada no período
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {periodo.quantidadeDetalhe > 1 && (
            <>
              <span>Quantidade:</span>
              <strong>{periodo.quantidadeDetalhe}</strong>
            </>
          )}
          <span>Entrada:</span>
          <strong>{formatarData(periodo.dataEntradaOriginal || periodo.dataInicio)}</strong>
          <span>{periodo.saidaNoPeriodo ? "Removida em:" : "Posição até:"}</span>
          <strong>
            {formatarData(
              periodo.saidaNoPeriodo
                ? periodo.dataSaidaEfetiva || periodo.dataFim
                : periodo.dataFim
            )}
          </strong>
          <span>Dias no período:</span>
          <strong>{periodo.diasLocados}</strong>
          <span>Valor mensal:</span>
          <strong>{formatarMoeda(periodo.valorMensal)}</strong>
          <span>Valor proporcional:</span>
          <strong>{formatarMoeda(periodo.valorProporcional)}</strong>
          <span>Origem:</span>
          <strong>{formatarOrigemFinanceiraVisual(periodo.origemValor)}</strong>
          {periodo.tipoBalancinho && (
            <>
              <span>Tipo balancinho:</span>
              <strong>{periodo.tipoBalancinho}</strong>
            </>
          )}
          {periodo.tipoMiniGrua && (
            <>
              <span>Tipo mini grua:</span>
              <strong>{periodo.tipoMiniGrua}</strong>
            </>
          )}
        </div>
      </div>
    );

    return (
      <Fragment key={chave}>
        <tr className="border-t">
          <td className="px-4 py-2">{linha.construtora}</td>
          <td className="px-4 py-2">{linha.obra}</td>
          <td className="px-4 py-2">
            <div className="flex items-center gap-2">
              {temPeriodos && (
                <button
                  type="button"
                  onClick={() => alternarExpansao(chave)}
                  className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  aria-expanded={expandida}
                >
                  {expandida ? "-" : "+"}
                </button>
              )}
              <span>
                {linha.equipamento}
                {linha.usaContrapeso && linha.equipamento !== "Kit Contrapeso" && (
                  <span className="ml-2 inline-block rounded bg-yellow-200 px-2 py-1 text-xs font-bold text-yellow-900">
                    CONTRAPESO
                  </span>
                )}
              </span>
            </div>
          </td>
          <td className="px-4 py-2">{linha.saldoAnterior}</td>
          <td className="px-4 py-2">{linha.entradasMes}</td>
          <td className="px-4 py-2">{linha.saidasMes}</td>
          <td className="px-4 py-2 font-semibold">{linha.saldoFinal}</td>
          <td className="px-4 py-2">{formatarMoeda(linha.valorMensal)}</td>
          <td className="px-4 py-2 font-semibold">{formatarMoeda(linha.valorProporcionalMes)}</td>
          <td className="px-4 py-2 text-xs text-gray-500">
            {linha.origemValorExibicao}
          </td>
        </tr>

        {temPeriodos && expandida && (
          <tr className="border-t bg-gray-50">
            <td className="px-4 py-3" colSpan="10">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded bg-green-100 px-2 py-1 text-green-800">Unidades ativas: {quantidadeAtivosDetalhe}</span>
                  <span className="rounded bg-red-100 px-2 py-1 text-red-800">Saídas no período: {quantidadeSaidasDetalhe}</span>
                  <span className="rounded bg-blue-100 px-2 py-1 text-blue-800">Entradas no período: {linha.entradasMes}</span>
                </div>
                {detalhesAtivos.length > 0 && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-semibold text-green-800">Unidades ativas — {quantidadeAtivosDetalhe}</h4>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{detalhesAtivos.map(renderCardUnidade)}</div>
                  </section>
                )}
                {detalhesSaidas.length > 0 && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-semibold text-red-800">Saídas no período — {quantidadeSaidasDetalhe}</h4>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{detalhesSaidas.map(renderCardUnidade)}</div>
                  </section>
                )}
                {detalhesEntradas.length > 0 && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-semibold text-blue-800">Entradas no período — {detalhesEntradas.length}</h4>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{detalhesEntradas.map(renderCardUnidade)}</div>
                  </section>
                )}
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const encerramentosPendentes = atividades.filter(
    (atividade) =>
      atividadeTemPatrimonioPendente(atividade) &&
      ["Remoção", "Somente recolhimento"].includes(atividade.servico)
  );

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">Relatório de Locação</h2>

      {encerramentosPendentes.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Existem {encerramentosPendentes.length} atividade(s) de encerramento aguardando vínculo patrimonial. As unidades permanecem abertas até a regularização.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Mês</label>
          <input
            type="month"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="border p-2 rounded w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Visualização</label>
          <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setVisualizacao("data")}
              className={`rounded-md px-3 py-1 text-sm ${
                visualizacao === "data" ? "bg-blue-600 text-white" : "text-gray-700"
              }`}
            >
              Por Data
            </button>
            <button
              type="button"
              onClick={() => setVisualizacao("obra")}
              className={`rounded-md px-3 py-1 text-sm ${
                visualizacao === "obra" ? "bg-blue-600 text-white" : "text-gray-700"
              }`}
            >
              Por Obra
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={mostrarZerados}
            onChange={(e) => setMostrarZerados(e.target.checked)}
          />
          Mostrar zerados
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportarExcel}
          className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow"
        >
          Exportar Excel
        </button>
        <button
          type="button"
          onClick={exportarPDF}
          className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow"
        >
          Exportar PDF
        </button>
      </div>

      <div id="relatorio-locacao-exportacao" className="space-y-4 bg-white">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Total Valor Mensal</p>
          <p className="text-lg font-semibold text-gray-800">{formatarMoeda(resumoLocacao.totalValorMensal)}</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Total Proporcional do Mês</p>
          <p className="text-lg font-semibold text-green-700">
            {formatarMoeda(resumoLocacao.totalProporcionalMes)}
          </p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Total de Obras</p>
          <p className="text-lg font-semibold text-blue-700">{resumoLocacao.obras.size}</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">Total de Equipamentos Locados</p>
          <p className="text-lg font-semibold text-orange-700">{resumoLocacao.totalEquipamentosLocados}</p>
        </div>
      </div>

      {renderResumoCategorias("Resumo da Locação", resumoCategoriasGeral)}

      <div className="overflow-auto">
        <table className="min-w-full border rounded-xl shadow text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="px-4 py-2">Construtora</th>
              <th className="px-4 py-2">Obra</th>
              <th className="px-4 py-2">Equipamento</th>
              <th className="px-4 py-2">Saldo anterior</th>
              <th className="px-4 py-2">Entradas no mês</th>
              <th className="px-4 py-2">Saídas no mês</th>
              <th className="px-4 py-2">Saldo final</th>
              <th className="px-4 py-2">Valor mensal</th>
              <th className="px-4 py-2">Valor proporcional do mês</th>
              <th className="px-4 py-2">Origem</th>
            </tr>
          </thead>
          <tbody>
            {dadosVisiveis.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-gray-500" colSpan="10">
                  Nenhuma movimentação de locação encontrada para o mês selecionado.
                </td>
              </tr>
            ) : visualizacao === "obra" ? (
              gruposPorObra.map((grupo, grupoIndex) => {
                const chaveResumoObra = `resumo-${grupo.chaveObra}`;
                const resumoObraAberto = exportacaoPdfAtiva || !!resumosObraExpandidos[chaveResumoObra];

                return (
                <Fragment key={`grupo-${grupo.chaveObra}-${grupoIndex}`}>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-700" colSpan="10">
                      {grupo.construtora} | {grupo.obra}
                    </td>
                  </tr>
                  {grupo.linhas.map((linha, index) => renderLinha(linha, index, `obra-${grupoIndex}`))}
                  <tr className="border-t bg-white">
                    <td className="px-4 py-3" colSpan="10">
                      <button
                        type="button"
                        onClick={() => alternarResumoObra(chaveResumoObra)}
                        className="rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                        aria-expanded={resumoObraAberto}
                      >
                        {resumoObraAberto ? "-" : "+"} Resumo da Locação da Obra
                      </button>

                      {resumoObraAberto && renderResumoCategorias(
                        "Resumo da Locação da Obra",
                        criarResumoCategoriasLocacao(grupo.linhas, { ocultarZerados: true }),
                        "TOTAL DA LOCAÇÃO DA OBRA"
                      )}
                    </td>
                  </tr>
                </Fragment>
                );
              })
            ) : (
              dadosVisiveis.map((linha, index) => renderLinha(linha, index, "data"))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
