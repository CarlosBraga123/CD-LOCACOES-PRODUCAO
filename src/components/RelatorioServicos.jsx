import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { FileBarChart, Printer } from "lucide-react";
import { atividadePertenceObra, normalizarTexto, obterChaveObra, obterObraDaAtividade } from "../utils/obras";
import {
  aplicarPatrimoniosAdministrativos,
  obterRegistrosPatrimonio,
} from "../utils/patrimoniosEquipamentos";
import { atividadeEhServicoFaturavel } from "../utils/financeiroAtividades";
import { consolidarRelatorioServicos } from "../utils/relatorioServicos";

const obterPeriodoCompetencia = (competencia) => {
  if (!/^\d{4}-\d{2}$/.test(competencia || "")) return { dataInicio: "", dataFim: "" };
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    dataInicio: `${competencia}-01`,
    dataFim: `${competencia}-${String(ultimoDia).padStart(2, "0")}`,
  };
};

export default function RelatorioServicos({ contextoNavegacao = null }) {
  const periodoInicial = obterPeriodoCompetencia(contextoNavegacao?.competencia);
  const [atividades, setAtividades] = useState([]);
  const [construtoras, setConstrutoras] = useState([]);
  const [obras, setObras] = useState([]);
  const [valoresServicos, setValoresServicos] = useState({});
  const [valoresPadrao, setValoresPadrao] = useState({});
  const [filtros, setFiltros] = useState({
    construtora: contextoNavegacao?.construtora || "",
    obra: contextoNavegacao?.obraId ? obterChaveObra({ obraId: contextoNavegacao.obraId }) : "",
    ...periodoInicial,
  });
  const [mostrarFechamentoMes, setMostrarFechamentoMes] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState(contextoNavegacao?.competencia || "");

  useEffect(() => {
    setAtividades(JSON.parse(localStorage.getItem("atividades") || "[]"));
    setConstrutoras(JSON.parse(localStorage.getItem("construtoras") || "[]"));
    setObras(JSON.parse(localStorage.getItem("obras") || "[]"));
    setValoresServicos(JSON.parse(localStorage.getItem("valoresServicos") || "{}"));
    setValoresPadrao(JSON.parse(localStorage.getItem("valoresPadrao") || "{}"));
  }, []);

  const formatarData = (data) => {
    if (!data) return "—";
    const [y, m, d] = data.split("-");
    return `${d}/${m}/${y}`;
  };

  const atividadeCobraServico = (atividade) =>
    atividadeEhServicoFaturavel(atividade, { valoresServicos, valoresPadrao });

  const obterNumeroOsCampo = (atividade) =>
    String(atividade?.numeroOsCampo ?? "").trim();

  const formatarEquipamento = (atividade) => {
    if (atividade.equipamento === "Mini Grua") {
      return atividade.tipoMiniGrua ? `Mini Grua ${atividade.tipoMiniGrua}` : "Mini Grua";
    }

    if (atividade.equipamento !== "Balancinho") return atividade.equipamento;
    if (atividade.tipoBalancinho === "Manual") return "Balancinho Manual";
    return "Balancinho Elétrico";
  };

  const obterItensEquipamentos = (atividade) =>
    Array.isArray(atividade.itensEquipamentos)
      ? atividade.itensEquipamentos
      : [];

  const obterQuantidadeAtividade = (atividade) => {
    const itens = obterItensEquipamentos(atividade);
    if (itens.length > 0) return itens.length;

    const quantidade = Number(atividade.quantidade);
    return quantidade > 0 ? quantidade : 1;
  };

  const obterItensEquipamentosParaApresentacao = (atividade) => {
    const itens = obterItensEquipamentos(atividade);
    const itensParaApresentacao = itens.length > 0
      ? [...itens]
      : (() => {
          const quantidade = obterQuantidadeAtividade(atividade);
          const patrimonios = Array.isArray(atividade.numerosPatrimonio)
            ? atividade.numerosPatrimonio
            : [];

          return Array.from({ length: quantidade }, (_, indice) => ({
            equipamento: atividade.equipamento,
            tipoBalancinho: atividade.tipoBalancinho,
            tipoMiniGrua: atividade.tipoMiniGrua,
            tamanho: atividade.tamanho,
            ancoragem: atividade.ancoragem,
            usaContrapeso: atividade.usaContrapeso,
            numeroPatrimonio:
              patrimonios[indice] ??
              (indice === 0 ? atividade.numeroPatrimonio : "") ??
              "",
          }));
        })();

    return aplicarPatrimoniosAdministrativos(
      itensParaApresentacao,
      obterRegistrosPatrimonio()
    );
  };

  const formatarTamanho = (valor) => {
    const tamanho = String(valor ?? "").trim();
    return tamanho ? `${tamanho} m` : "";
  };

  const normalizarServico = (servico) =>
    normalizarTexto(servico)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const normalizarMovimentoContrapeso = (valor) => {
    const movimento = normalizarServico(valor);
    if (["adicionar", "adicao", "incluir", "instalar"].includes(movimento)) {
      return "adicionar";
    }
    if (
      [
        "remover",
        "remocao",
        "removido",
        "retirada",
        "retirado",
        "retirar",
        "recolher",
        "recolhimento",
      ].includes(movimento)
    ) {
      return "remover";
    }
    return "nenhuma";
  };

  const obterInformacoesContrapesoServico = (
    atividade,
    item = null,
    indice = 0
  ) => {
    const possuiItens = obterItensEquipamentos(atividade).length > 0;
    const dados = { ...atividade, ...item };
    if (dados.equipamento !== "Balancinho") {
      return { aviso: "", temMovimento: false, quantidade: 0 };
    }

    const servico = normalizarServico(atividade.servico);
    const alteracao = normalizarMovimentoContrapeso(
      possuiItens ? item?.alteracaoContrapeso : atividade.alteracaoContrapeso
    );
    if (servico === "deslocamento") {
      const aviso =
        alteracao === "adicionar"
          ? "Adicionar Kit Contrapeso"
          : alteracao === "remover"
            ? "Remover Kit Contrapeso"
            : "";
      return { aviso, temMovimento: Boolean(aviso), quantidade: aviso ? 1 : 0 };
    }

    const possuiContrapeso =
      possuiItens
        ? item?.usaContrapesoAnterior === true || item?.usaContrapeso === true
        : atividade.usaContrapeso === true || alteracao === "remover";
    const servicoDeSaida = ["remocao", "somente recolhimento"].includes(
      servico
    );
    if (!servicoDeSaida || !possuiContrapeso || (!possuiItens && indice > 0)) {
      return { aviso: "", temMovimento: false, quantidade: 0 };
    }

    const quantidade = possuiItens
      ? 1
      : Math.max(1, Math.trunc(Number(atividade.quantidadeContrapeso) || 1));
    const acao = servico === "remocao" ? "Retirar" : "Recolher";
    const mostrarQuantidade =
      !possuiItens &&
      (quantidade > 1 || Number(atividade.quantidade) > 1);
    const aviso = mostrarQuantidade
      ? `${acao} ${quantidade} ${quantidade === 1 ? "Kit" : "Kits"} Contrapeso`
      : `${acao} Kit Contrapeso`;
    return { aviso, temMovimento: true, quantidade };
  };

  const atividadeTemMovimentoContrapeso = (atividade) => {
    const itens = obterItensEquipamentos(atividade);
    if (itens.length > 0) {
      return itens.some(
        (item, indice) =>
          obterInformacoesContrapesoServico(atividade, item, indice)
            .temMovimento || item.usaContrapeso === true
      );
    }
    return (
      obterInformacoesContrapesoServico(atividade).temMovimento ||
      atividade.usaContrapeso === true
    );
  };

  const formatarItemEquipamento = (
    item,
    atividade,
    incluirAviso = true,
    indice = 0
  ) => {
    const dados = { ...atividade, ...item };
    const partes = [];

    if (dados.equipamento === "Balancinho") {
      partes.push(formatarEquipamento(dados));

      const tamanhoAnterior = formatarTamanho(
        item.tamanhoAnterior || item.tamanho
      );
      const tamanhoNovo = formatarTamanho(item.tamanhoNovo);
      if (
        atividade.servico === "Deslocamento" &&
        tamanhoAnterior &&
        tamanhoNovo
      ) {
        partes.push(`${tamanhoAnterior} → ${tamanhoNovo}`);
      } else {
        const tamanho = formatarTamanho(item.tamanho || atividade.tamanho);
        if (tamanho) partes.push(tamanho);
      }

      if (item.ancoragem || atividade.ancoragem) {
        partes.push(`Ancoragem: ${item.ancoragem || atividade.ancoragem}`);
      }

      const avisoContrapeso = obterInformacoesContrapesoServico(
        atividade,
        item,
        indice
      ).aviso;
      const permiteDescricaoComKit =
        obterItensEquipamentos(atividade).length > 0 ||
        !["remocao", "somente recolhimento"].includes(
          normalizarServico(atividade.servico)
        );
      if (incluirAviso && avisoContrapeso) {
        partes.push(avisoContrapeso);
      } else if (
        !avisoContrapeso &&
        permiteDescricaoComKit &&
        item.usaContrapeso === true
      ) {
        partes.push("Com Kit Contrapeso");
      }
    } else {
      partes.push(formatarEquipamento(dados) || "Equipamento");
    }

    partes.push(
      item.numeroPatrimonio
        ? `Patrimônio ${item.numeroPatrimonio}`
        : atividade.pendenteVinculoPatrimonio
          ? "Patrimônio pendente"
          : "Sem patrimônio"
    );

    return partes.filter(Boolean).join(" - ");
  };

  const obterDescricoesEquipamentos = (atividade) =>
    obterItensEquipamentosParaApresentacao(atividade).map((item, indice) =>
      formatarItemEquipamento(item, atividade, true, indice)
    );

  const renderItensEquipamentos = (atividade) => {
    const itens = obterItensEquipamentosParaApresentacao(atividade);
    if (itens.length === 0) return null;

    return (
      <ul className="mt-1 space-y-0.5 pl-4 text-xs text-gray-600">
        {itens.map((item, indice) => {
          const informacoesContrapeso = obterInformacoesContrapesoServico(
            atividade,
            item,
            indice
          );
          return (
          <li key={`${atividade.id}-equipamento-${indice}`} className="list-disc">
            {formatarItemEquipamento(item, atividade, false, indice)}
            {informacoesContrapeso.aviso && (
              <span className="ml-2 inline-block rounded bg-yellow-200 px-2 py-1 text-xs font-bold text-yellow-900">
                {informacoesContrapeso.aviso}
              </span>
            )}
          </li>
          );
        })}
      </ul>
    );
  };

  const obterChaveObraCadastrada = (obra) =>
    obterChaveObra({ obraId: obra.id, obra: obra.nome, construtora: obra.construtora });

  const atividadeDentroDoFiltroObra = (atividade) => {
    if (!filtros.obra) return true;

    const obraFiltrada = obras.find((obra) => obterChaveObraCadastrada(obra) === filtros.obra);
    if (obraFiltrada) return atividadePertenceObra(atividade, obraFiltrada);

    return obterChaveObra(atividade) === filtros.obra;
  };

  const obterRotuloObra = (atividade) => {
    const obra = obterObraDaAtividade(atividade, obras);
    return `${obra?.construtora || atividade.construtora || "Sem construtora"} - ${
      obra?.nome || String(atividade.obra || "Sem obra").trim()
    }`;
  };

  const filtradas = atividades
    .filter((a) => a.dataLiberacao)
    .filter(atividadeCobraServico)
    .filter((a) => {
      const obraAtividade = obterObraDaAtividade(a, obras);
      const dentroConstrutora =
        !filtros.construtora ||
        normalizarTexto(obraAtividade?.construtora || a.construtora) === normalizarTexto(filtros.construtora);
      const dentroObra = atividadeDentroDoFiltroObra(a);
      const dentroPeriodo =
        (!filtros.dataInicio || a.dataLiberacao >= filtros.dataInicio) &&
        (!filtros.dataFim || a.dataLiberacao <= filtros.dataFim);
      return dentroConstrutora && dentroObra && dentroPeriodo;
    })
    .sort((a, b) => new Date(b.dataLiberacao) - new Date(a.dataLiberacao));

  const relatorioAtual = useMemo(
    () =>
      consolidarRelatorioServicos({
        atividades: filtradas.map((atividade) => ({
          ...atividade,
          itensEquipamentos: obterItensEquipamentosParaApresentacao(atividade),
        })),
        valoresServicos,
        valoresPadrao,
      }),
    [filtradas, valoresServicos, valoresPadrao]
  );

  const formatarMoeda = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const formatarCompetencia = () => {
    const inicio = filtros.dataInicio?.slice(0, 7);
    const fim = filtros.dataFim?.slice(0, 7);
    const competencia = inicio && inicio === fim ? inicio : contextoNavegacao?.competencia;
    if (!competencia) return "Todas as competências";
    const [ano, mes] = competencia.split("-").map(Number);
    const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
      new Date(ano, mes - 1, 1)
    );
    return `${nomeMes.charAt(0).toUpperCase()}${nomeMes.slice(1)}/${ano}`;
  };

  const obraSelecionada = obras.find(
    (obra) => obterChaveObraCadastrada(obra) === filtros.obra
  );
  const construtoraIdentificacao =
    filtros.construtora || obraSelecionada?.construtora || "Todas as construtoras";
  const obraIdentificacao = obraSelecionada?.nome || "Todas as obras";

  const obrasPorMes = atividades
    .filter((a) => a.dataLiberacao?.startsWith(mesSelecionado))
    .filter(atividadeCobraServico)
    .reduce((acc, a) => {
      const chave = obterChaveObra(a);
      if (!acc[chave]) acc[chave] = { rotulo: obterRotuloObra(a), Balancinho: [], "Mini Grua": [] };
      acc[chave][a.equipamento].push(a);
      return acc;
    }, {});

  const totaisMes = atividades
    .filter((a) => a.dataLiberacao?.startsWith(mesSelecionado))
    .filter(atividadeCobraServico)
    .reduce(
      (acc, a) => {
        const eq = a.equipamento;
        const serv = a.servico;
        if (!acc[eq]) acc[eq] = {};
        if (!acc[eq][serv]) acc[eq][serv] = 0;
        acc[eq][serv]++;
        return acc;
      },
      {}
    );

  const exportarPDF = async () => {
    const element = document.getElementById("relatorio-fechamento-mes");
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height + 50] });

    const titulo = `Relatório de fechamento do mês ${formatarData(mesSelecionado + "-01").slice(3)}`;
    pdf.setFontSize(16);
    pdf.text("CD LOCAÇÕES", canvas.width / 2, 30, { align: "center" });
    pdf.setFontSize(12);
    pdf.text(titulo, canvas.width / 2, 50, { align: "center" });
    pdf.addImage(imgData, "PNG", 0, 60, canvas.width, canvas.height);

    pdf.save(`Relatório de fechamento do mês ${formatarData(mesSelecionado + "-01").slice(3)}.pdf`);
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [[`Relatório de fechamento do mês ${formatarData(mesSelecionado + "-01").slice(3)}`]];

    Object.values(obrasPorMes).forEach((dados) => {
      wsData.push([]);
      wsData.push([dados.rotulo]);
      wsData.push([
        "Data",
        "Equipamento",
        "Quantidade",
        "Serviço",
        "OS de campo",
        "Descrição dos equipamentos",
      ]);
      ["Balancinho", "Mini Grua"].forEach((eq) => {
        dados[eq].forEach((a) => {
          wsData.push([
            formatarData(a.dataLiberacao),
            `${formatarEquipamento(a)}${atividadeTemMovimentoContrapeso(a) ? " - CONTRAPESO" : ""}`,
            obterQuantidadeAtividade(a),
            a.servico,
            obterNumeroOsCampo(a),
            obterDescricoesEquipamentos(a).join(" | "),
          ]);
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `Relatório de fechamento do mês ${formatarData(mesSelecionado + "-01").slice(3)}.xlsx`);
  };

  return (
    <div id="relatorio-servicos-impressao" className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden; }
          body > #root, #root > div, main {
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }
          aside { display: none !important; }
          #relatorio-servicos-impressao, #relatorio-servicos-impressao * { visibility: visible; }
          #relatorio-servicos-impressao {
            width: 194mm !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            color: #111827 !important;
          }
          #relatorio-servicos-impressao .nao-imprimir { display: none !important; }
          #relatorio-servicos-impressao .space-y-5 > :not([hidden]) ~ :not([hidden]) { margin-top: 3mm !important; }
          #relatorio-servicos-impressao section { box-shadow: none !important; }
          #relatorio-servicos-impressao section h3 { break-after: avoid; page-break-after: avoid; }
          #relatorio-servicos-impressao .resumo-impressao { break-inside: avoid; page-break-inside: avoid; }
          #relatorio-servicos-impressao .cabecalho-tabela-impressao { break-after: avoid; page-break-after: avoid; }
          #relatorio-servicos-impressao .overflow-x-auto { overflow: visible !important; }
          #relatorio-servicos-impressao table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: auto;
            font-size: 8pt !important;
          }
          #relatorio-servicos-impressao thead { display: table-header-group; }
          #relatorio-servicos-impressao tfoot { display: table-footer-group; }
          #relatorio-servicos-impressao tr { break-inside: avoid; page-break-inside: avoid; }
          #relatorio-servicos-impressao th, #relatorio-servicos-impressao td { padding: 1.4mm 1.2mm !important; }
          #relatorio-servicos-impressao td span { white-space: normal !important; }
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800">
          <FileBarChart size={22} aria-hidden="true" />RELATÓRIO DE SERVIÇOS
        </h2>

        <div className="nao-imprimir flex flex-wrap gap-2">
          {!mostrarFechamentoMes && (
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Printer size={18} aria-hidden="true" /> Imprimir / Salvar PDF
            </button>
          )}
          <button
            onClick={() => setMostrarFechamentoMes(!mostrarFechamentoMes)}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            {mostrarFechamentoMes ? "Voltar ao relatório" : "Fechamento geral e exportações"}
          </button>
        </div>
      </div>

      {mostrarFechamentoMes && (
        <div className="mt-4 space-y-4" id="relatorio-fechamento-mes">
          <input
            type="month"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="border p-2 rounded"
          />

          {mesSelecionado && (
            <>
              <div className="bg-gray-100 border p-3 rounded shadow">
                <h3 className="font-bold text-lg mb-2">CD LOCAÇÕES</h3>
                {Object.entries(totaisMes).map(([eq, servs]) => (
                  <div key={eq} className="mb-2">
                    <strong>{eq}:</strong>
                    <ul className="ml-4 text-sm list-disc">
                      {Object.entries(servs).map(([serv, count]) => (
                        <li key={serv}>{serv}: {count}</li>
                      ))}
                      <li><strong>Total: {Object.values(servs).reduce((a, b) => a + b, 0)}</strong></li>
                    </ul>
                  </div>
                ))}
                <div className="mt-2 font-semibold">TOTAL GERAL: {Object.values(totaisMes).reduce((acc, servs) => acc + Object.values(servs).reduce((a, b) => a + b, 0), 0)}</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={exportarExcel}
                  className="bg-green-600 text-white px-4 py-2 rounded shadow"
                >
                  Exportar Excel
                </button>
                <button
                  onClick={exportarPDF}
                  className="bg-red-600 text-white px-4 py-2 rounded shadow"
                >
                  Exportar PDF
                </button>
              </div>

              <div className="space-y-6 mt-4">
                {Object.entries(obrasPorMes).map(([chaveObra, dados]) => (
                  <div key={chaveObra} className="border p-3 rounded bg-white shadow-sm">
                    <h3 className="font-semibold text-md mb-1">🏗️ {dados.rotulo}</h3>

                    {dados.Balancinho.length > 0 && (
                      <div className="mt-2">
                        <strong>Balancinho:</strong>
                        <ul className="list-disc pl-5 text-sm">
                          {dados.Balancinho.sort((a, b) => new Date(a.dataLiberacao) - new Date(b.dataLiberacao)).map((a) => (
                            <li key={a.id}>
                              {a.servico.toUpperCase()} — Data {formatarData(a.dataLiberacao)} ({formatarEquipamento(a)})
                              {" — "}{obterQuantidadeAtividade(a)} equipamento(s)
                              {obterNumeroOsCampo(a) && (
                                <span className="block text-xs">
                                  OS de campo: {obterNumeroOsCampo(a)}
                                </span>
                              )}
                              {atividadeTemMovimentoContrapeso(a) && (
                                <span className="ml-2 inline-block rounded bg-yellow-200 px-2 py-1 text-xs font-bold text-yellow-900">
                                  CONTRAPESO
                                </span>
                              )}
                              {renderItensEquipamentos(a)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {dados["Mini Grua"].length > 0 && (
                      <div className="mt-2">
                        <strong>Mini Grua:</strong>
                        <ul className="list-disc pl-5 text-sm">
                          {dados["Mini Grua"].sort((a, b) => new Date(a.dataLiberacao) - new Date(b.dataLiberacao)).map((a) => (
                            <li key={a.id}>
                              {a.servico.toUpperCase()} — Data {formatarData(a.dataLiberacao)}
                              {" — "}{obterQuantidadeAtividade(a)} equipamento(s)
                              {obterNumeroOsCampo(a) && (
                                <span className="block text-xs">
                                  OS de campo: {obterNumeroOsCampo(a)}
                                </span>
                              )}
                              {renderItensEquipamentos(a)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!mostrarFechamentoMes && (
        <div className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="nao-imprimir grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Construtora
                <select
                  value={filtros.construtora}
                  onChange={(e) => setFiltros({ ...filtros, construtora: e.target.value, obra: "" })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm font-normal normal-case text-gray-800"
                >
                  <option value="">Todas as Construtoras</option>
                  {construtoras.map((c) => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Obra
                <select
                  value={filtros.obra}
                  onChange={(e) => setFiltros({ ...filtros, obra: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm font-normal normal-case text-gray-800"
                >
                  <option value="">Todas as Obras</option>
                  {obras
                    .filter((o) => !filtros.construtora || o.construtora === filtros.construtora)
                    .map((o) => (
                      <option key={o.id} value={obterChaveObraCadastrada(o)}>{o.nome}</option>
                    ))}
                </select>
              </label>

              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Data inicial
                <input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm font-normal text-gray-800"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Data final
                <input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm font-normal text-gray-800"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-2 border-t border-gray-100 pt-4 text-sm sm:grid-cols-3">
              <p><span className="text-gray-500">Competência:</span> <strong>{formatarCompetencia()}</strong></p>
              <p><span className="text-gray-500">Construtora:</span> <strong>{construtoraIdentificacao}</strong></p>
              <p><span className="text-gray-500">Obra:</span> <strong>{obraIdentificacao}</strong></p>
            </div>
          </section>

          <section className="resumo-impressao rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-700">Resumo</h3>
            <div className="divide-y divide-gray-100">
              {relatorioAtual.resumo.map((item) => (
                <div key={item.servico} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2 text-sm">
                  <span className="font-medium text-gray-700">{item.rotulo}</span>
                  <span className="min-w-8 text-right tabular-nums text-gray-600">{item.quantidade}</span>
                  <span className="min-w-28 text-right font-medium tabular-nums text-gray-800">{formatarMoeda(item.valor)}</span>
                </div>
              ))}
              {relatorioAtual.resumo.length === 0 && (
                <p className="py-5 text-center text-sm text-gray-500">Nenhum serviço faturável para os filtros selecionados.</p>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between border-t-2 border-gray-200 pt-3 font-bold text-gray-900">
              <span>TOTAL SERVIÇOS</span>
              <span className="tabular-nums">{formatarMoeda(relatorioAtual.totalServicos)}</span>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="cabecalho-tabela-impressao border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700">Detalhamento dos serviços</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Serviço</th>
                    <th className="px-4 py-3">Patrimônio</th>
                    <th className="px-4 py-3">Detalhe</th>
                    <th className="px-4 py-3">OS Campo</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {relatorioAtual.detalhes.map((item) => (
                    <tr key={item.id} className="align-top text-gray-700 hover:bg-gray-50/70">
                      <td className="whitespace-nowrap px-4 py-3">{formatarData(item.data)}</td>
                      <td className="px-4 py-3 font-medium">{item.servico}</td>
                      <td className="px-4 py-3">
                        {item.patrimonios.length > 0
                          ? item.patrimonios.map((patrimonio) => <span key={patrimonio} className="block">{patrimonio}</span>)
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {item.detalhes.length > 0
                          ? item.detalhes.map((detalhe) => <span key={detalhe} className="block whitespace-nowrap">{detalhe}</span>)
                          : "-"}
                      </td>
                      <td className="px-4 py-3">{item.numeroOsCampo || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{formatarMoeda(item.valor)}</td>
                    </tr>
                  ))}
                  {relatorioAtual.detalhes.length === 0 && (
                    <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-500">Nenhum serviço faturável encontrado.</td></tr>
                  )}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-bold text-gray-900">
                  <tr>
                    <td colSpan="5" className="px-4 py-3">TOTAL SERVIÇOS</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatarMoeda(relatorioAtual.totalServicos)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}


