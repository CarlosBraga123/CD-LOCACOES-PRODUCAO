import { useEffect, useState } from "react";
import { calcularPeriodosLocacao } from "../utils/locacaoFinanceira";
import { atividadePertenceObra, normalizarTexto, obterChaveObra, obterObraDaAtividade } from "../utils/obras";

export default function RelatorioFinanceiro() {
  const [atividades, setAtividades] = useState([]);
  const [obras, setObras] = useState([]);
  const [filtroConstrutora, setFiltroConstrutora] = useState("");
  const [filtroObra, setFiltroObra] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [visualizacao, setVisualizacao] = useState("atividade");

  useEffect(() => {
    const dados = JSON.parse(localStorage.getItem("atividades")) || [];
    setAtividades(dados);
    setObras(JSON.parse(localStorage.getItem("obras") || "[]"));
  }, []);

  let valoresServicos = {};
  let valoresPadrao = {};
  try {
    valoresServicos = JSON.parse(localStorage.getItem("valoresServicos")) || {};
    valoresPadrao = JSON.parse(localStorage.getItem("valoresPadrao")) || {};
  } catch {
    console.warn("Erro ao ler valores do localStorage");
  }

  const servicosValidos = ["Instalação", "Deslocamento", "Manutenção", "Ascensão", "Remoção"];

  const atividadeCobraServico = (item) => {
    if (item.cobraServico === false) return false;
    if (item.cobraServico === true) return true;
    return servicosValidos.includes(item.servico);
  };

  const obterQuantidade = (item) => {
    const quantidade = Number(item.quantidade);
    return quantidade > 0 ? quantidade : 1;
  };

  const formatarEquipamento = (item) => {
    if (item.tipoMovimentoLocacao === "contrapeso") return "Kit Contrapeso";

    if (item.equipamento === "Balancinho") {
      const tipo = item.tipoBalancinho === "Manual" ? "Manual" : "Elétrico";
      return `Balancinho ${tipo}${item.usaContrapeso ? " com Contrapeso" : ""}`;
    }

    if (item.equipamento === "Mini Grua") {
      if (item.tipoMiniGrua === "1T") return "Mini Grua 1T";
      if (item.tipoMiniGrua === "500kg") return "Mini Grua 500kg";
    }

    return item.equipamento;
  };

  const formatarMoeda = (valor) => {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const formatarOrigemValor = (origem) => {
    if (origem === "Congelado") return "Congelado";
    if (origem === "Sem valor") return "Sem valor";
    return "Legado";
  };

  const formatarStatus = (item) => {
    if (item.dataLiberacao) return "Concluído";
    if (item.iniciado) return "Em andamento";
    return "Agendado";
  };

  const obterValorServico = (item) => {
    if (item.valoresCongelados?.totalServico !== undefined) {
      return {
        valor: Number(item.valoresCongelados.totalServico || 0),
        origem: "Congelado",
      };
    }

    const chave = `${item.equipamento}-${item.servico}`;
    const quantidade = obterQuantidade(item);

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

    return {
      valor: 0,
      origem: "Sem valor",
    };
  };

  const obterTabelasFallbackLocacao = (atividade) => {
    const construtoras = JSON.parse(localStorage.getItem("construtoras") || "[]");
    const tabelaComercialPadrao = JSON.parse(localStorage.getItem("tabelaComercialPadrao") || "null") || {
      locacoes: {},
    };
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

  const calcularValorLocacaoPorTabela = (atividade, tabela) => {
    const quantidade = obterQuantidade(atividade);
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
    const quantidade = obterQuantidade(atividade);

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

    for (const item of obterTabelasFallbackLocacao(atividade)) {
      const valor = calcularValorLocacaoPorTabela(atividade, item.tabela);
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

  const obterMesAtual = () => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  };

  const obterDataReferenciaFinanceira = (item) => item.dataLiberacao || item.dataAgendamento || "";
  const obterMesReferenciaFinanceira = (item) => obterDataReferenciaFinanceira(item).slice(0, 7);

  const obterChaveObraCadastrada = (obra) =>
    obterChaveObra({ obraId: obra.id, obra: obra.nome, construtora: obra.construtora });

  const atividadeDentroDoFiltroObra = (atividade) => {
    if (!filtroObra) return true;

    const obraFiltrada = obras.find((obra) => obterChaveObraCadastrada(obra) === filtroObra);
    if (obraFiltrada) return atividadePertenceObra(atividade, obraFiltrada);

    return obterChaveObra(atividade) === filtroObra;
  };

  const opcoesObras = atividades.reduce((acc, atividade) => {
    const obra = obterObraDaAtividade(atividade, obras);
    const chave = obra ? obterChaveObraCadastrada(obra) : obterChaveObra(atividade);

    if (!chave || acc.some((item) => item.chave === chave)) return acc;

    acc.push({
      chave,
      nome: obra?.nome || String(atividade.obra || "").trim(),
      construtora: obra?.construtora || atividade.construtora || "",
    });

    return acc;
  }, []);
  const opcoesConstrutoras = [...new Set(atividades.map((a) => a.construtora))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const opcoesObrasOrdenadas = [...opcoesObras].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR")
  );

  const filtrosAtivos = filtroConstrutora || filtroObra || filtroMes;

  const atividadesFiltradas = filtrosAtivos
    ? atividades
        .filter((item) => {
          const obraAtividade = obterObraDaAtividade(item, obras);
          const matchConstrutora =
            !filtroConstrutora ||
            normalizarTexto(obraAtividade?.construtora || item.construtora) === normalizarTexto(filtroConstrutora);
          const matchObra = atividadeDentroDoFiltroObra(item);

          const mesReferencia = obterMesReferenciaFinanceira(item);
          let matchMes = true;
          if (filtroMes === "mesAtual") {
            matchMes = mesReferencia === obterMesAtual();
          } else if (filtroMes.startsWith("fechamento:")) {
            const mesAlvo = filtroMes.split(":")[1];
            matchMes = mesReferencia === mesAlvo;
          } else if (filtroMes && filtroMes.length === 7) {
            matchMes = mesReferencia === filtroMes;
          }

          return atividadeCobraServico(item) && matchConstrutora && matchObra && matchMes;
        })
        .sort((a, b) => {
  const dataA = new Date(obterDataReferenciaFinanceira(a));
  const dataB = new Date(obterDataReferenciaFinanceira(b));
  return dataA.getTime() - dataB.getTime();
})
    : [];

  const mesLocacao =
    filtroMes === "mesAtual"
      ? obterMesAtual()
      : filtroMes.startsWith("fechamento:")
        ? filtroMes.split(":")[1]
        : filtroMes && filtroMes.length === 7
          ? filtroMes
          : "";
  const atividadesBaseLocacao =
    filtrosAtivos && mesLocacao
      ? atividades.filter((item) => {
          const obraAtividade = obterObraDaAtividade(item, obras);
          const matchConstrutora =
            !filtroConstrutora ||
            normalizarTexto(obraAtividade?.construtora || item.construtora) === normalizarTexto(filtroConstrutora);
          const matchObra = atividadeDentroDoFiltroObra(item);

          return matchConstrutora && matchObra;
        })
      : [];
  const inicioMesLocacao = mesLocacao ? `${mesLocacao}-01` : "";
  const fimMesLocacao = mesLocacao
    ? new Date(Number(mesLocacao.slice(0, 4)), Number(mesLocacao.slice(5, 7)), 0)
        .toISOString()
        .slice(0, 10)
    : "";
  const diasNoMesLocacao = fimMesLocacao ? Number(fimMesLocacao.slice(8, 10)) : 0;
  const periodosLocacaoFinanceiro = mesLocacao
    ? calcularPeriodosLocacao({
        atividadesBase: atividadesBaseLocacao,
        inicioMes: inicioMesLocacao,
        fimMes: fimMesLocacao,
        diasNoMes: diasNoMesLocacao,
        obras,
        formatarEquipamento,
        obterValorMensalLocacao,
      })
    : [];
  const totalLocacoes = periodosLocacaoFinanceiro.reduce((acc, periodo) => {
    return acc + Number(periodo.valorProporcional || 0);
  }, 0);

  const totalPrevisto = atividadesFiltradas.reduce((acc, item) => {
    return acc + obterValorServico(item).valor;
  }, 0);
  const totalServicos = totalPrevisto;
  const totalGeral = totalServicos + totalLocacoes;

  const dadosConsolidadosPorObra = Array.from(
    atividadesFiltradas
      .reduce((acc, item) => {
        const obra = obterObraDaAtividade(item, obras);
        const chave = obra ? obterChaveObraCadastrada(obra) : obterChaveObra(item);

        if (!acc.has(chave)) {
          acc.set(chave, {
            chave,
            construtora: obra?.construtora || item.construtora || "Sem construtora",
            obra: obra?.nome || String(item.obra || "Sem obra").trim(),
            totalServicos: 0,
            totalLocacoes: 0,
          });
        }

        acc.get(chave).totalServicos += obterValorServico(item).valor;
        return acc;
      }, new Map())
      .values()
  );

  periodosLocacaoFinanceiro.forEach((periodo) => {
    if (!dadosConsolidadosPorObra.some((item) => item.chave === periodo.chaveObra)) {
      dadosConsolidadosPorObra.push({
        chave: periodo.chaveObra,
        construtora: periodo.construtora || "Sem construtora",
        obra: periodo.obra || "Sem obra",
        totalServicos: 0,
        totalLocacoes: 0,
      });
    }

    const linha = dadosConsolidadosPorObra.find((item) => item.chave === periodo.chaveObra);
    linha.totalLocacoes += Number(periodo.valorProporcional || 0);
  });

  dadosConsolidadosPorObra.sort((a, b) => {
    const construtora = a.construtora.localeCompare(b.construtora, "pt-BR");
    if (construtora !== 0) return construtora;
    return a.obra.localeCompare(b.obra, "pt-BR");
  });

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Relatório Financeiro</h2>

      <div className="grid gap-2 mb-4">
        <select
          value={filtroMes}
          onChange={(e) => setFiltroMes(e.target.value)}
          className="w-full border rounded-xl px-3 py-2 shadow-sm"
        >
          <option value="">Todos os meses</option>
          <option value="mesAtual">Mês Atual</option>

          {[...new Set(atividades.map((a) => obterMesReferenciaFinanceira(a)))]
            .filter(Boolean)
            .sort((a, b) => b.localeCompare(a))
            .map((mes) => (
              <option key={`fechamento:${mes}`} value={`fechamento:${mes}`}>
                Fechamento Mensal ({mes.split("-").reverse().join("/")})
              </option>
            ))}

          {[...new Set(atividades.map((a) => obterMesReferenciaFinanceira(a)))]
            .filter(Boolean)
            .sort((a, b) => b.localeCompare(a))
            .map((mes) => (
              <option key={mes} value={mes}>
                {mes.split("-").reverse().join("/")}
              </option>
            ))}
        </select>

        <select
          value={filtroConstrutora}
          onChange={(e) => setFiltroConstrutora(e.target.value)}
          className="w-full border rounded-xl px-3 py-2 shadow-sm"
        >
          <option value="">Filtrar por Construtora</option>
          {opcoesConstrutoras.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <select
          value={filtroObra}
          onChange={(e) => setFiltroObra(e.target.value)}
          className="w-full border rounded-xl px-3 py-2 shadow-sm"
        >
          <option value="">Filtrar por Obra</option>
          {opcoesObrasOrdenadas.map((obra) => (
            <option key={obra.chave} value={obra.chave}>
              {obra.construtora ? `${obra.nome} (${obra.construtora})` : obra.nome}
            </option>
          ))}
        </select>
      </div>

      {!filtrosAtivos && (
        <p className="text-sm text-gray-500 mt-4">🔍 Aplique um filtro para ver os resultados.</p>
      )}

      {filtrosAtivos && (
        <>
          <div className="grid gap-3 mb-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase text-gray-500">Total Serviços</p>
              <p className="text-lg font-semibold text-gray-800">{formatarMoeda(totalServicos)}</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase text-gray-500">Total Locações</p>
              <p className="text-lg font-semibold text-green-700">{formatarMoeda(totalLocacoes)}</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase text-gray-500">Total Geral</p>
              <p className="text-lg font-semibold text-orange-700">{formatarMoeda(totalGeral)}</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setVisualizacao("atividade")}
                className={`rounded-md px-3 py-1 text-sm ${
                  visualizacao === "atividade" ? "bg-blue-600 text-white" : "text-gray-700"
                }`}
              >
                Por Atividade
              </button>
              <button
                type="button"
                onClick={() => setVisualizacao("obra")}
                className={`rounded-md px-3 py-1 text-sm ${
                  visualizacao === "obra" ? "bg-blue-600 text-white" : "text-gray-700"
                }`}
              >
                Consolidado por Obra
              </button>
            </div>
          </div>

          {visualizacao === "atividade" ? (
            <div className="overflow-auto">
              <table className="w-full min-w-[860px] table-fixed border rounded-xl shadow text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="w-[90px] px-3 py-2">Data</th>
                    <th className="w-[135px] px-3 py-2">Construtora</th>
                    <th className="w-[150px] px-3 py-2">Obra</th>
                    <th className="w-[170px] px-3 py-2">Equipamento</th>
                    <th className="w-[120px] px-3 py-2">Serviço</th>
                    <th className="w-[105px] px-3 py-2">Status</th>
                    <th className="w-[115px] px-3 py-2 text-right">Valor</th>
                    <th className="w-[85px] px-3 py-2 text-center">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {atividadesFiltradas.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2">
                        {(item.dataLiberacao || item.dataAgendamento)?.split("-").reverse().join("/")}
                      </td>
                      <td className="px-3 py-2 break-words">{item.construtora}</td>
                      <td className="px-3 py-2 break-words">{item.obra}</td>
                      <td className="px-3 py-2 break-words">{formatarEquipamento(item)}</td>
                      <td className="px-3 py-2 break-words">{item.servico}</td>
                      <td className="px-3 py-2">
                        {formatarStatus(item)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatarMoeda(obterValorServico(item).valor)}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-gray-500">
                        {formatarOrigemValor(obterValorServico(item).origem)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[720px] table-fixed border rounded-xl shadow text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="w-[160px] px-3 py-2">Construtora</th>
                    <th className="w-[190px] px-3 py-2">Obra</th>
                    <th className="w-[120px] px-3 py-2 text-right">Total Serviços</th>
                    <th className="w-[120px] px-3 py-2 text-right">Total Locações</th>
                    <th className="w-[120px] px-3 py-2 text-right">Total Geral</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosConsolidadosPorObra.map((linha) => (
                    <tr key={linha.chave} className="border-t">
                      <td className="px-3 py-2 break-words">{linha.construtora}</td>
                      <td className="px-3 py-2 break-words">{linha.obra}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatarMoeda(linha.totalServicos)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatarMoeda(linha.totalLocacoes)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                        {formatarMoeda(linha.totalServicos + linha.totalLocacoes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
