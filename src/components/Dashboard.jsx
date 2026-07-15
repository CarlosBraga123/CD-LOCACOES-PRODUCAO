import { useEffect, useState } from "react";
import { calcularPeriodosLocacao } from "../utils/locacaoFinanceira";
import { formatarMoeda } from "../utils/moeda";
import { obterObraDaAtividade, normalizarTexto } from "../utils/obras";

const servicosValidos = ["Instalação", "Deslocamento", "Manutenção", "Ascensão", "Remoção"];

export default function Dashboard({ abrirAtividade }) {
  const [tarefasPendentes, setTarefasPendentes] = useState([]);
  const [usuario, setUsuario] = useState("Usuário");
  const [recentes, setRecentes] = useState([]);
  const [agendados, setAgendados] = useState([]);
  const [cards, setCards] = useState([]);
  const [obras, setObras] = useState([]);
  const [faturamentoMeses, setFaturamentoMeses] = useState([]);

  useEffect(() => {
    const usuarioSalvo = JSON.parse(localStorage.getItem("usuarioLogado"));
    if (usuarioSalvo?.nome) setUsuario(usuarioSalvo.nome);

    const tarefasTodas = JSON.parse(localStorage.getItem("tarefas") || "[]");
    setTarefasPendentes(tarefasTodas.filter((t) => !t.concluida));

    const todas = JSON.parse(localStorage.getItem("atividades") || "[]");
    const obrasSalvas = JSON.parse(localStorage.getItem("obras") || "[]");
    const construtorasSalvas = JSON.parse(localStorage.getItem("construtoras") || "[]");
    const valoresServicos = JSON.parse(localStorage.getItem("valoresServicos") || "{}");
    const valoresPadrao = JSON.parse(localStorage.getItem("valoresPadrao") || "{}");
    setObras(obrasSalvas);

    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);

    const atividadesRecentes = todas
      .filter((a) => a.dataLiberacao)
      .map((a) => ({ ...a, dataObj: new Date(a.dataLiberacao) }))
      .filter((a) => a.dataObj >= seteDiasAtras && a.dataObj <= hoje)
      .sort((a, b) => b.dataObj - a.dataObj);

    const atividadesAgendadas = todas
      .filter((a) => a.dataAgendamento && !a.dataLiberacao)
      .map((a) => ({ ...a, dataObj: new Date(a.dataAgendamento) }))
      .sort((a, b) => a.dataObj - b.dataObj);

    setRecentes(atividadesRecentes);
    setAgendados(atividadesAgendadas);

    const obterQuantidade = (atividade) => Number(atividade.quantidade) || 1;

    const atividadeIniciaLocacao = (atividade) =>
      atividade.iniciaLocacao === true ||
      (atividade.iniciaLocacao === undefined && atividade.servico === "Instalação");

    const atividadeEncerraLocacao = (atividade) =>
      atividade.encerraLocacao === true ||
      (atividade.encerraLocacao === undefined && atividade.servico === "Remoção");

    const atividadeCobraServico = (atividade) => {
      if (atividade.cobraServico === false) return false;
      if (atividade.cobraServico === true) return true;
      return servicosValidos.includes(atividade.servico);
    };

    const obterValorServico = (atividade) => {
      if (atividade.valoresCongelados?.totalServico !== undefined) {
        return Number(atividade.valoresCongelados.totalServico || 0);
      }

      const chave = `${atividade.equipamento}-${atividade.servico}`;
      const quantidade = obterQuantidade(atividade);
      if (valoresServicos[chave] !== undefined) return Number(valoresServicos[chave] || 0) * quantidade;
      if (valoresPadrao[chave] !== undefined) return Number(valoresPadrao[chave] || 0) * quantidade;
      return 0;
    };

    const obterTipoMiniGrua = (atividade) => {
      if (atividade.tipoMiniGrua === "500kg") return "500 kg";
      if (atividade.tipoMiniGrua === "1T") return "1 T";
      return "Sem tipo";
    };

    const obterTipoBalancinho = (atividade) => {
      if (atividade.tipoBalancinho === "Eletrico") return "Eletricos";
      if (atividade.tipoBalancinho === "Manual") return "Manuais";
      return "Sem tipo";
    };

    const contarAtivosPorTipo = (equipamento, obterTipo) => {
      return todas
        .filter((a) => a.equipamento === equipamento && a.dataLiberacao)
        .reduce(
          (acc, atividade) => {
            const quantidade = obterQuantidade(atividade);
            const tipo = obterTipo(atividade);
            const movimento = atividadeIniciaLocacao(atividade)
              ? quantidade
              : atividadeEncerraLocacao(atividade)
                ? -quantidade
                : 0;

            acc.total += movimento;
            if (movimento !== 0) acc.porTipo[tipo] = (acc.porTipo[tipo] || 0) + movimento;
            return acc;
          },
          { total: 0, porTipo: {} }
        );
    };

    const ativosBalancinho = contarAtivosPorTipo("Balancinho", obterTipoBalancinho);
    const ativosMiniGrua = contarAtivosPorTipo("Mini Grua", obterTipoMiniGrua);

    const mesAtual = new Date().toISOString().slice(0, 7);
    const servicosMes = todas.filter((atividade) => {
      const mesReferencia = (atividade.dataLiberacao || atividade.dataAgendamento || "").slice(0, 7);
      return mesReferencia === mesAtual && atividadeCobraServico(atividade);
    });
    const quantidadeServicosMes = servicosMes.reduce((acc, atividade) => {
      acc[atividade.servico] = (acc[atividade.servico] || 0) + obterQuantidade(atividade);
      return acc;
    }, {});
    const totalQuantidadeServicosMes = Object.values(quantidadeServicosMes).reduce(
      (total, quantidade) => total + Number(quantidade || 0),
      0
    );

    const formatarEquipamento = (atividade) => {
      if (atividade.tipoMovimentoLocacao === "contrapeso") return "Kit Contrapeso";

      if (atividade.equipamento === "Mini Grua") {
        return atividade.tipoMiniGrua ? `Mini Grua ${atividade.tipoMiniGrua}` : "Mini Grua";
      }

      if (atividade.equipamento !== "Balancinho") return atividade.equipamento || "Sem equipamento";
      if (atividade.tipoBalancinho === "Manual") return "Balancinho Manual";
      return "Balancinho Eletrico";
    };

    const obterTabelasFallbackLocacao = (atividade) => {
      const obra = obterObraDaAtividade(atividade, obrasSalvas);
      const nomeConstrutora = obra?.construtora || atividade.construtora;
      const construtora = construtorasSalvas.find(
        (item) => normalizarTexto(item.nome) === normalizarTexto(nomeConstrutora)
      );
      const tabelaComercialPadrao = JSON.parse(localStorage.getItem("tabelaComercialPadrao") || "null") || {
        locacoes: {},
      };

      return [
        obra?.tabelaComercial,
        construtora?.tabelaComercial,
        tabelaComercialPadrao,
      ].filter(Boolean);
    };

    const obterChavesLocacao = (atividade) => {
      if (atividade.equipamento === "Balancinho") {
        const tipo = atividade.tipoBalancinho === "Manual" ? "Manual" : "Eletrico";
        return { base: `Balancinho-${tipo}`, adicionalContrapeso: "Balancinho-Contrapeso" };
      }

      if (atividade.equipamento === "Mini Grua") {
        return { base: `Mini Grua-${atividade.tipoMiniGrua || "500kg"}`, adicionalContrapeso: null };
      }

      return { base: atividade.equipamento, adicionalContrapeso: null };
    };

    const calcularValorLocacaoPorTabela = (atividade, tabela) => {
      const chaves = obterChavesLocacao(atividade);
      const quantidade = obterQuantidade(atividade);

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
        return { valor: Number(atividade.valoresCongelados.totalLocacaoMensal || 0), origem: "Congelado" };
      }

      for (const tabela of obterTabelasFallbackLocacao(atividade)) {
        const valor = calcularValorLocacaoPorTabela(atividade, tabela);
        if (valor !== null) return { valor, origem: "Estimado" };
      }

      return { valor: 0, origem: "Sem valor" };
    };

    const obterMesesGrafico = () => {
      const meses = [];
      const base = new Date();
      base.setDate(1);

      for (let i = 5; i >= 0; i -= 1) {
        const data = new Date(base.getFullYear(), base.getMonth() - i, 1);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
        const rotulo = data.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
        meses.push({ mes, rotulo });
      }

      return meses;
    };

    const faturamento = obterMesesGrafico().map(({ mes, rotulo }) => {
      const inicioMes = `${mes}-01`;
      const fimMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)
        .toISOString()
        .slice(0, 10);
      const diasNoMes = Number(fimMes.slice(8, 10));
      const servicos = todas
        .filter((atividade) => {
          const mesReferencia = (atividade.dataLiberacao || atividade.dataAgendamento || "").slice(0, 7);
          return mesReferencia === mes && atividadeCobraServico(atividade);
        })
        .reduce((total, atividade) => total + obterValorServico(atividade), 0);
      const locacoes = calcularPeriodosLocacao({
        atividadesBase: todas,
        inicioMes,
        fimMes,
        diasNoMes,
        obras: obrasSalvas,
        formatarEquipamento,
        obterValorMensalLocacao,
      }).reduce((total, periodo) => total + Number(periodo.valorProporcional || 0), 0);

      return { mes, rotulo, servicos, locacoes, totalGeral: servicos + locacoes };
    });

    setFaturamentoMeses(faturamento);
    setCards([
      { titulo: "Servicos nos ultimos 7 dias", valor: atividadesRecentes.length, cor: "bg-blue-100" },
      { titulo: "Servicos Agendados", valor: atividadesAgendadas.length, cor: "bg-yellow-100" },
      {
        titulo: "Servicos do Mes",
        valor: totalQuantidadeServicosMes,
        cor: "bg-green-100",
        detalhes: quantidadeServicosMes,
      },
      { titulo: "Balancinhos Ativos", valor: ativosBalancinho.total, cor: "bg-purple-100", detalhes: ativosBalancinho.porTipo },
      { titulo: "Mini Gruas Ativas", valor: ativosMiniGrua.total, cor: "bg-purple-200", detalhes: ativosMiniGrua.porTipo },
    ]);
  }, []);

  const concluir = (id) => {
    const todas = JSON.parse(localStorage.getItem("tarefas") || "[]");
    const atualizadas = todas.map((t) =>
      t.id === id
        ? {
            ...t,
            concluida: true,
            concluidaEm: new Date().toISOString(),
            concluidaPor: usuario
          }
        : t
    );
    localStorage.setItem("tarefas", JSON.stringify(atualizadas));
    setTarefasPendentes(atualizadas.filter((t) => !t.concluida));
  };

  const formatarData = (data) => {
    if (!data) return "-";
    const [y, m, d] = data.split("-");
    return `${d}/${m}/${y}`;
  };

  const obterDadosObra = (atividade) => {
    const obra = obterObraDaAtividade(atividade, obras);

    return {
      construtora: obra?.construtora || atividade.construtora,
      obra: obra?.nome || atividade.obra,
    };
  };

  const abrirAtividadeSegura = (id) => {
    if (!id || !abrirAtividade) return;
    abrirAtividade(id);
  };

  const obterAtividadeIdDaTarefa = (tarefa) => {
    return tarefa.atividadeId || tarefa.idAtividade || tarefa.atividade?.id || null;
  };

  const rotuloServico = {
    Instalação: "Instalacoes",
    Deslocamento: "Deslocamentos",
    Ascensão: "Ascensoes",
    Manutenção: "Manutencoes",
    Remoção: "Remocoes",
  };

  const maiorValorGrafico = Math.max(
    1,
    ...faturamentoMeses.flatMap((item) => [
      Number(item.servicos || 0),
      Number(item.locacoes || 0),
      Number(item.totalGeral || 0),
    ])
  );

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold mb-4">Painel CD Locacoes</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((card, idx) => (
          <div key={idx} className={`${card.cor} p-4 rounded shadow-sm`}>
            <div className="text-sm text-gray-600">{card.titulo}</div>
            <div className="text-2xl font-bold">{card.valor}</div>
            {card.detalhes && (
              <div className="mt-2 space-y-1 text-xs text-gray-700">
                {Object.entries(card.detalhes)
                  .filter(([, valor]) => Number(valor || 0) !== 0)
                  .map(([chave, valor]) => (
                    <div key={chave} className="flex justify-between gap-2">
                      <span>{rotuloServico[chave] || chave}:</span>
                      <strong>{valor}</strong>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <section className="rounded border bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-3">Faturamento dos ultimos 6 meses</h3>
        <div className="flex items-center gap-4 text-xs text-gray-600 mb-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-blue-600" /> Servicos
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-green-600" /> Locacoes
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-slate-700" /> Total Geral
          </span>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[720px] grid-cols-6 gap-4">
          {[...faturamentoMeses].reverse().map((item) => (
            <div key={item.mes} className="min-w-0">
              <div className="flex h-36 items-end justify-center gap-1.5 border-b border-gray-200 pb-1">
                <div
                  className="w-7 rounded-t bg-blue-600"
                  style={{ height: `${Math.max(4, (item.servicos / maiorValorGrafico) * 100)}%` }}
                  title={`Servicos: ${formatarMoeda(item.servicos)}`}
                />
                <div
                  className="w-7 rounded-t bg-green-600"
                  style={{ height: `${Math.max(4, (item.locacoes / maiorValorGrafico) * 100)}%` }}
                  title={`Locacoes: ${formatarMoeda(item.locacoes)}`}
                />
                <div
                  className="w-7 rounded-t bg-slate-700"
                  style={{ height: `${Math.max(4, (item.totalGeral / maiorValorGrafico) * 100)}%` }}
                  title={`Total Geral: ${formatarMoeda(item.totalGeral)}`}
                />
              </div>
              <div className="mt-2 text-center text-xs font-medium text-gray-700">{item.rotulo}</div>
              <div className="mt-1 text-center text-[11px] text-gray-500">
                <div>Serv.: {formatarMoeda(item.servicos)}</div>
                <div>Loc.: {formatarMoeda(item.locacoes)}</div>
                <div>Total: {formatarMoeda(item.totalGeral)}</div>
              </div>
            </div>
          ))}
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-2">Proximos Servicos Agendados</h3>
        {agendados.length === 0 ? (
          <p className="text-gray-500">Nenhum servico agendado.</p>
        ) : (
          <ul className="space-y-2">
            {agendados.map((a) => {
              const dadosObra = obterDadosObra(a);

              return (
                <li
                  key={a.id}
                  onClick={() => abrirAtividadeSegura(a.id)}
                  className="border rounded p-3 bg-white shadow-sm cursor-pointer hover:bg-blue-50"
                  title="Abrir atividade"
                >
                  <strong>{a.servico} - {a.equipamento}</strong>
                  {a.equipamento === "Balancinho" && a.tamanho ? ` [${a.tamanho}m]` : ""}<br />
                  {dadosObra.construtora} / {dadosObra.obra} <br />
                  Agendado: {formatarData(a.dataAgendamento)}{" "}
                  {a.iniciado && <span className="text-orange-600 font-semibold">(Em Andamento)</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Tarefas Pendentes</h2>
        <div className="space-y-2">
          {tarefasPendentes.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma tarefa pendente.</p>
          ) : (
            tarefasPendentes.map((tarefa) => {
              const atividadeId = obterAtividadeIdDaTarefa(tarefa);

              return (
                <div
                  key={tarefa.id}
                  onClick={() => atividadeId && abrirAtividadeSegura(atividadeId)}
                  className={`border p-3 rounded-md shadow-sm bg-white flex justify-between items-start ${
                    atividadeId ? "cursor-pointer hover:bg-blue-50" : ""
                  }`}
                  title={atividadeId ? "Abrir atividade relacionada" : ""}
                >
                  <div>
                    <p className="font-medium">{tarefa.texto}</p>
                    <p className="text-xs text-gray-500">
                      Criada em: {new Date(tarefa.criadaEm).toLocaleString()}
                    </p>
                    {atividadeId && (
                      <p className="text-xs text-blue-600">Clique para abrir a atividade relacionada.</p>
                    )}
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      concluir(tarefa.id);
                    }}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm h-fit"
                  >
                    Concluir
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-2">Atividades Recentes (ultimos 7 dias)</h3>
        {recentes.length === 0 ? (
          <p className="text-gray-500">Nenhuma atividade recente registrada.</p>
        ) : (
          <ul className="space-y-2">
            {recentes.map((a) => {
              const dadosObra = obterDadosObra(a);

              return (
                <li
                  key={a.id}
                  onClick={() => abrirAtividadeSegura(a.id)}
                  className="border rounded p-3 bg-white shadow-sm cursor-pointer hover:bg-blue-50"
                  title="Abrir atividade"
                >
                  <strong>{a.servico} - {a.equipamento}</strong>
                  {a.equipamento === "Balancinho" && a.tamanho ? ` [${a.tamanho}m]` : ""}<br />
                  {dadosObra.construtora} / {dadosObra.obra} <br />
                  Liberado: {formatarData(a.dataLiberacao)}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
