import React from "react";
import { useState } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addWeeks,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { obterObraDaAtividade } from "../utils/obras";

const logoURL = "/CD LOCACOES.png";

type Atividade = {
  id: string;
  obraId?: string | number;
  obra: string;
  construtora: string;
  servico: string;
  equipamento: string;
  dataAgendamento: string;
  dataLiberacao?: string;
};

type Obra = {
  id: string | number;
  nome: string;
  construtora: string;
};

export default function Agenda() {
  const [modo, setModo] = useState("semana");
  const [referencia, setReferencia] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);

  const atividades: Atividade[] = JSON.parse(localStorage.getItem("atividades") || "[]");
  const obras: Obra[] = JSON.parse(localStorage.getItem("obras") || "[]");

  const inicioSemana = startOfWeek(referencia, { weekStartsOn: 1 });
  const diasDaSemana = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i));

  const baseData = (a: Atividade) =>
    new Date((a.dataLiberacao || a.dataAgendamento) + "T00:00:00");

  const obterStatus = (a: Atividade) => {
    if (a.dataLiberacao) return "CONCLUÍDO";
    if ((a as any).iniciado) return "EM ANDAMENTO";
    return "AGENDADO";
  };

  const obterDadosObra = (a: Atividade) => {
    const obra = obterObraDaAtividade(a, obras);

    return {
      obra: obra?.nome || a.obra,
      construtora: obra?.construtora || a.construtora,
    };
  };
  

  const inicioMes = startOfMonth(referencia);
  const fimMes = endOfMonth(referencia);
  const diasDoMes = eachDayOfInterval({ start: inicioMes, end: fimMes });

  const primeiroDiaSemana = getDay(inicioMes) || 7;
  const diasAntes = Array.from({ length: primeiroDiaSemana - 1 }, () => null);
  const totalCelas = diasAntes.length + diasDoMes.length;
  const diasDepois = Array.from({ length: 42 - totalCelas }, () => null);

  const calendarioCompleto = [...diasAntes, ...diasDoMes, ...diasDepois];
  const hoje = new Date();

  const exportarPDF = async () => {
    const { default: html2canvas } = await import("html2canvas");
    const { default: jsPDF } = await import("jspdf");

    const element = document.getElementById("agenda-mensal");
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height + 100] });

    const logo = new Image();
    logo.src = logoURL;
    await new Promise((resolve) => (logo.onload = resolve));

    pdf.addImage(logo, "PNG", canvas.width / 2 - 80, 10, 160, 40);
    const titulo = `Agenda de ${format(referencia, "MMMM yyyy", { locale: ptBR })}`;
    pdf.setFontSize(18);
    pdf.text(titulo, canvas.width / 2, 65, { align: "center" });
    pdf.addImage(imgData, "PNG", 0, 90, canvas.width, canvas.height);

    const nomeArquivo = `agenda-${format(referencia, "MMMM-yyyy", { locale: ptBR }).toLowerCase()}.pdf`;
    pdf.save(nomeArquivo);
  };

  const atividadesPorDia = diasDaSemana.map((dia) => {
    const atividadesDoDia = atividades.filter((a) => isSameDay(baseData(a), dia));
    return { dia, atividades: atividadesDoDia };
  });

  return (
    <div className="p-4 overflow-x-auto">
      <h2 className="text-xl font-semibold mb-4">Agenda</h2>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setModo("semana")}
          className={`px-4 py-2 rounded-full shadow text-sm font-medium ${modo === "semana" ? "bg-black text-white" : "bg-gray-200 text-gray-700"}`}
        >
          Semana
        </button>
        <button
          onClick={() => setModo("mensal")}
          className={`px-4 py-2 rounded-full shadow text-sm font-medium ${modo === "mensal" ? "bg-black text-white" : "bg-gray-200 text-gray-700"}`}
        >
          Mês
        </button>
        {modo === "mensal" && (
          <button
            onClick={exportarPDF}
            className="ml-auto px-4 py-2 rounded-full bg-blue-600 text-white text-sm shadow"
          >
            Exportar PDF
          </button>
        )}
      </div>

      {modo === "semana" && (
        <>
          <div className="flex justify-between mb-4">
            <button onClick={() => setReferencia(subWeeks(referencia, 1))} className="text-blue-600">
              ← Semana anterior
            </button>
            <button onClick={() => setReferencia(new Date())} className="text-gray-600">
              Semana atual
            </button>
            <button onClick={() => setReferencia(addWeeks(referencia, 1))} className="text-blue-600">
              Próxima semana →
            </button>
          </div>

          <div className="grid gap-4">
            {atividadesPorDia.map(({ dia, atividades }) => (
              <div key={dia.toISOString()} className="bg-white rounded-2xl shadow p-4">
                <h3 className="font-semibold text-gray-700 mb-2">
                  {format(dia, "EEEE dd/MM", { locale: ptBR })}
                </h3>
                {atividades.length === 0 ? (
                  <p className="text-gray-400 text-sm">Nenhuma atividade</p>
                ) : (
                  <ul className="space-y-1">
                    {atividades.map((a) => {
                      const dadosObra = obterDadosObra(a);

                      return (
                        <li key={a.id} className="text-sm text-gray-800">
                          <strong>{dadosObra.construtora} - {dadosObra.obra}</strong> — {a.servico} ({a.equipamento})
                          <span className={`ml-2 text-xs font-semibold ${obterStatus(a) === "CONCLUÍDO" ? "text-green-600" : "text-gray-500"}`}>
                            {obterStatus(a)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {modo === "mensal" && (
        <div className="w-full overflow-x-auto">
          <div
            id="agenda-mensal"
            style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(120px, 1fr))", gap: "6px" }}
            className="min-w-[980px]"
          >
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((dia) => (
              <div key={dia} className="text-center font-semibold text-gray-600 p-2 border-b">
                {dia}
              </div>
            ))}
            {calendarioCompleto.map((dia, i) => {
              const atividadesDoDia = dia ? atividades.filter((a) => isSameDay(baseData(a), dia)) : [];
              const isHoje = dia && isSameDay(dia, hoje);
              return (
                <div
                  key={i}
                  onClick={() => dia && setDiaSelecionado(dia)}
                  className={`border rounded-lg bg-white min-h-[120px] p-2 text-xs flex flex-col items-start justify-start hover:bg-gray-100 cursor-pointer ${isHoje ? "border-blue-500" : "border-gray-300"}`}
                >
                  <div className={`font-semibold mb-1 ${isHoje ? "text-blue-600" : "text-gray-800"}`}>
                    {dia ? format(dia, "d") : ""}
                  </div>
                  {atividadesDoDia.length === 0 ? (
                    <span className="text-[10px] text-gray-400">Sem atividades</span>
                  ) : (
                    atividadesDoDia.map((a) => {
                      const dadosObra = obterDadosObra(a);

                      return (
                        <div key={a.id} className="leading-tight text-[10px] text-gray-700">
                          <span className="block truncate font-medium">
                            {a.servico} — {dadosObra.obra} ({dadosObra.construtora})
                          </span>
                          <span className={`text-[10px] ${obterStatus(a) === "CONCLUÍDO" ? "text-green-600" : "text-gray-500"}`}>
                            {obterStatus(a)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
