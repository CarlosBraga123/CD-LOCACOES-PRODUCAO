import { Fragment, useEffect, useMemo, useState } from "react";
import { calcularPeriodosLocacao } from "../utils/locacaoFinanceira";
import { normalizarTexto, obterChaveObra, obterObraDaAtividade } from "../utils/obras";

export default function RelatorioLocacao() {
  const [atividades, setAtividades] = useState([]);
  const [mesSelecionado, setMesSelecionado] = useState(() => new Date().toISOString().slice(0, 7));
  const [visualizacao, setVisualizacao] = useState("data");
  const [mostrarZerados, setMostrarZerados] = useState(false);
  const [linhasExpandidas, setLinhasExpandidas] = useState({});

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
      if (atividade.equipamento === "Mini Grua") {
        return atividade.tipoMiniGrua ? `Mini Grua ${atividade.tipoMiniGrua}` : "Mini Grua";
      }

      if (atividade.equipamento !== "Balancinho") return atividade.equipamento || "Sem equipamento";
      if (atividade.tipoBalancinho === "Manual") return "Balancinho Manual";
      return "Balancinho Elétrico";
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

      if (tabela.locacoes?.[chaves.base] === undefined) return null;

      const base = Number(tabela.locacoes[chaves.base] || 0);
      const adicional =
        atividade.usaContrapeso && chaves.adicionalContrapeso
          ? Number(tabela.locacoes?.[chaves.adicionalContrapeso] || 0)
          : 0;

      return (base + adicional) * quantidade;
    };

    const obterValorMensalLocacao = (atividade) => {
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

    // Regras operacionais atuais, com fallback para registros antigos.
    const atividadeIniciaLocacao = (atividade) => {
      if (atividade.iniciaLocacao !== undefined) return atividade.iniciaLocacao === true;
      return atividade.servico === "Instalação";
    };

    const atividadeEncerraLocacao = (atividade) => {
      if (atividade.encerraLocacao !== undefined) return atividade.encerraLocacao === true;
      return atividade.servico === "Remoção";
    };

    // Saldos permanecem pelo calculo historico; o proporcional e substituido abaixo.
    atividades
      .filter((atividade) => atividade.dataLiberacao)
      .sort((a, b) => new Date(a.dataLiberacao) - new Date(b.dataLiberacao))
      .forEach((atividade) => {
        const quantidade = Number(atividade.quantidade) || 1;
        const entrada = atividadeIniciaLocacao(atividade);
        const saida = atividadeEncerraLocacao(atividade);

        if (!entrada && !saida) return;

        const linha = obterLinha(atividade);
        const movimento = entrada ? quantidade : -quantidade;
        const valorMensalLocacao = obterValorMensalLocacao(atividade);
        const valorMensal = valorMensalLocacao.valor;
        linha.origensValor.add(valorMensalLocacao.origem);

        if (atividade.dataLiberacao < inicioMes) {
          linha.saldoAnterior += movimento;
          linha.valorProporcionalMes += entrada ? valorMensal : -valorMensal;
          linha.valorMensalAtivo += entrada ? valorMensal : -valorMensal;
        }

        if (atividade.dataLiberacao >= inicioMes && atividade.dataLiberacao <= fimMes) {
          const diaMovimento = Number(atividade.dataLiberacao.slice(8, 10));

          if (entrada) linha.entradasMes += quantidade;
          if (entrada) {
            const diasCobrados = diasNoMes - diaMovimento + 1;
            linha.valorProporcionalMes += (valorMensal * diasCobrados) / diasNoMes;
            linha.valorMensalAtivo += valorMensal;
          }

          if (saida) {
            linha.saidasMes += quantidade;
            if (linha.valorMensalAtivo > 0) {
              const diasSemCobranca = diasNoMes - diaMovimento;
              linha.valorProporcionalMes -= (valorMensal * diasSemCobranca) / diasNoMes;
            } else {
              linha.valorProporcionalMes += (valorMensal * diaMovimento) / diasNoMes;
            }
            linha.valorMensalAtivo -= valorMensal;
          }
        }

        if (atividade.dataLiberacao <= fimMes) {
          linha.saldoFinal += movimento;
          linha.valorMensal = linha.valorMensalAtivo;
        }
      });

    const periodosLocacao = calcularPeriodosLocacao({
      atividadesBase: atividades,
      inicioMes,
      fimMes,
      diasNoMes,
      obras,
      formatarEquipamento,
      obterValorMensalLocacao,
    });
    periodosLocacao.forEach((periodo) => {
      const chaveLinha = [
        periodo.chaveObra,
        periodo.equipamento,
        periodo.usaContrapeso ? "contrapeso" : "",
      ].join("||");
      const linha = mapa.get(chaveLinha);
      if (linha) linha.periodosLocacao.push(periodo);
    });

    return Array.from(mapa.values()).map((linha) => {
      // Usa periodos reais no proporcional; sem periodos, mantem fallback antigo.
      const valorProporcionalPeriodos = linha.periodosLocacao.reduce(
        (total, periodo) => total + Number(periodo.valorProporcional || 0),
        0
      );
      const valorProporcionalMes =
        linha.periodosLocacao.length > 0 ? valorProporcionalPeriodos : linha.valorProporcionalMes;

      return {
        ...linha,
        valorMensal: Math.max(0, linha.valorMensal),
        valorProporcionalMes: Math.max(0, valorProporcionalMes),
        origemValor: Array.from(linha.origensValor).join(" / ") || "Sem valor",
      };
    }).sort((a, b) => {
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

  // Expansao visual dos periodos, sem interferir nos calculos.
  const obterChaveExpansao = (linha, index, prefixo) =>
    `${prefixo}-${linha.chaveObra || "sem-obra"}-${linha.equipamento}-${linha.usaContrapeso ? "contrapeso" : "padrao"}-${index}`;

  const alternarExpansao = (chave) => {
    setLinhasExpandidas((estadoAtual) => ({
      ...estadoAtual,
      [chave]: !estadoAtual[chave],
    }));
  };

  const renderLinha = (linha, index, prefixo = "linha") => {
    const chave = obterChaveExpansao(linha, index, prefixo);
    const temPeriodos = Array.isArray(linha.periodosLocacao) && linha.periodosLocacao.length > 0;
    const expandida = !!linhasExpandidas[chave];

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
                {linha.usaContrapeso && (
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
          <td className="px-4 py-2 text-xs text-gray-500">{linha.origemValor}</td>
        </tr>

        {temPeriodos && expandida && (
          <tr className="border-t bg-gray-50">
            <td className="px-4 py-3" colSpan="10">
              <div className="space-y-3">
                <div className="text-sm font-semibold text-gray-700">Periodos da locacao</div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {linha.periodosLocacao.map((periodo, periodoIndex) => (
                    <div
                      key={`${chave}-periodo-${periodo.atividadeInicioId || "sem-inicio"}-${periodo.atividadeFimId || "aberto"}-${periodoIndex}`}
                      className="rounded border bg-white p-3 text-xs text-gray-700 shadow-sm"
                    >
                      <div className="mb-2 font-semibold text-gray-900">
                        {periodo.equipamento}
                        {periodo.usaContrapeso && (
                          <span className="ml-2 inline-block rounded bg-yellow-200 px-2 py-0.5 text-[10px] font-bold text-yellow-900">
                            CONTRAPESO
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <span>Inicio:</span>
                        <strong>{formatarData(periodo.dataInicio)}</strong>
                        <span>Fim:</span>
                        <strong>{formatarData(periodo.dataFim)}</strong>
                        <span>Dias:</span>
                        <strong>{periodo.diasLocados}</strong>
                        <span>Valor mensal:</span>
                        <strong>{formatarMoeda(periodo.valorMensal)}</strong>
                        <span>Valor proporcional:</span>
                        <strong>{formatarMoeda(periodo.valorProporcional)}</strong>
                        <span>Origem:</span>
                        <strong>{periodo.origemValor}</strong>
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
                  ))}
                </div>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">Relatório de Locação</h2>

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
              gruposPorObra.map((grupo, grupoIndex) => (
                <Fragment key={`grupo-${grupo.chaveObra}-${grupoIndex}`}>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-700" colSpan="10">
                      {grupo.construtora} | {grupo.obra}
                    </td>
                  </tr>
                  {grupo.linhas.map((linha, index) => renderLinha(linha, index, `obra-${grupoIndex}`))}
                </Fragment>
              ))
            ) : (
              dadosVisiveis.map((linha, index) => renderLinha(linha, index, "data"))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
