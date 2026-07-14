import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { atividadePertenceObra, normalizarTexto, obterChaveObra, obterObraDaAtividade } from "../utils/obras";

export default function RelatorioServicos() {
  const [atividades, setAtividades] = useState([]);
  const [construtoras, setConstrutoras] = useState([]);
  const [obras, setObras] = useState([]);
  const [filtros, setFiltros] = useState({ construtora: "", obra: "", dataInicio: "", dataFim: "" });
  const [mostrarFechamentoMes, setMostrarFechamentoMes] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState("");

  useEffect(() => {
    setAtividades(JSON.parse(localStorage.getItem("atividades") || "[]"));
    setConstrutoras(JSON.parse(localStorage.getItem("construtoras") || "[]"));
    setObras(JSON.parse(localStorage.getItem("obras") || "[]"));
  }, []);

  const formatarData = (data) => {
    if (!data) return "—";
    const [y, m, d] = data.split("-");
    return `${d}/${m}/${y}`;
  };

  const servicosValidos = ["Instalação", "Deslocamento", "Manutenção", "Ascensão", "Remoção"];
  const atividadeCobraServico = (atividade) => {
    if (atividade.cobraServico === false) return false;
    if (atividade.cobraServico === true) return true;
    return servicosValidos.includes(atividade.servico);
  };

  const formatarEquipamento = (atividade) => {
    if (atividade.equipamento === "Mini Grua") {
      return atividade.tipoMiniGrua ? `Mini Grua ${atividade.tipoMiniGrua}` : "Mini Grua";
    }

    if (atividade.equipamento !== "Balancinho") return atividade.equipamento;
    if (atividade.tipoBalancinho === "Manual") return "Balancinho Manual";
    return "Balancinho Elétrico";
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

  const obrasPorMes = atividades
    .filter((a) => a.dataLiberacao?.startsWith(mesSelecionado))
    .filter(atividadeCobraServico)
    .filter((a) => a.servico !== "Manutenção")
    .reduce((acc, a) => {
      const chave = obterChaveObra(a);
      if (!acc[chave]) acc[chave] = { rotulo: obterRotuloObra(a), Balancinho: [], "Mini Grua": [] };
      acc[chave][a.equipamento].push(a);
      return acc;
    }, {});

  const totaisMes = atividades
    .filter((a) => a.dataLiberacao?.startsWith(mesSelecionado))
    .filter(atividadeCobraServico)
    .filter((a) => a.servico !== "Manutenção")
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
      wsData.push(["Data", "Equipamento", "Serviço"]);
      ["Balancinho", "Mini Grua"].forEach((eq) => {
        dados[eq].forEach((a) => {
          wsData.push([
            formatarData(a.dataLiberacao),
            `${formatarEquipamento(a)}${a.usaContrapeso ? " - CONTRAPESO" : ""}`,
            a.servico
          ]);
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `Relatório de fechamento do mês ${formatarData(mesSelecionado + "-01").slice(3)}.xlsx`);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">📄 Relatório de Serviços</h2>

      <button
        onClick={() => setMostrarFechamentoMes(!mostrarFechamentoMes)}
        className="bg-blue-600 text-white px-4 py-2 rounded shadow"
      >
        Relatório Fechamento de Mês Geral
      </button>

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
                              {a.usaContrapeso && (
                                <span className="ml-2 inline-block rounded bg-yellow-200 px-2 py-1 text-xs font-bold text-yellow-900">
                                  CONTRAPESO
                                </span>
                              )}
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
                            <li key={a.id}>{a.servico.toUpperCase()} — Data {formatarData(a.dataLiberacao)}</li>
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <select
              value={filtros.construtora}
              onChange={(e) => setFiltros({ ...filtros, construtora: e.target.value, obra: "" })}
              className="border p-2 rounded"
            >
              <option value="">Todas as Construtoras</option>
              {construtoras.map((c) => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>

            <select
              value={filtros.obra}
              onChange={(e) => setFiltros({ ...filtros, obra: e.target.value })}
              className="border p-2 rounded"
            >
              <option value="">Todas as Obras</option>
              {obras
                .filter((o) => !filtros.construtora || o.construtora === filtros.construtora)
                .map((o) => (
                  <option key={o.id} value={obterChaveObraCadastrada(o)}>{o.nome}</option>
                ))}
            </select>

            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
              className="border p-2 rounded"
            />
          </div>

          {filtradas.length > 0 && (
            <ul className="mt-4 space-y-2">
              {filtradas.map((item) => (
                <li key={item.id} className="border p-3 rounded bg-white shadow-sm">
                  <strong>{item.servico} - {formatarEquipamento(item)}</strong>
                  {item.usaContrapeso && (
                    <span className="ml-2 inline-block rounded bg-yellow-200 px-2 py-1 text-xs font-bold text-yellow-900">
                      CONTRAPESO
                    </span>
                  )}
                  {item.equipamento === "Balancinho" && item.tamanho ? ` [${item.tamanho}m]` : ""}<br />
                  {item.construtora} / {item.obra} <br />
                  Liberado: {formatarData(item.dataLiberacao)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}


