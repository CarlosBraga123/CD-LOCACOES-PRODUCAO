import { useMemo, useState } from "react";
import { ArrowRight, Boxes, FileBarChart } from "lucide-react";
import { calcularPeriodosFinanceirosLocacao } from "../utils/locacaoFinanceira";
import { consolidarFechamentoMensal } from "../utils/fechamentoMensal";
import {
  atividadeEhServicoFaturavel,
  formatarEquipamentoFinanceiro,
  obterValorEfetivoServico,
  obterValorMensalLocacaoEfetivo,
} from "../utils/financeiroAtividades";

const obterCompetenciaAtual = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
};

const carregarJson = (chave, padrao) => {
  try {
    return JSON.parse(localStorage.getItem(chave) || "null") || padrao;
  } catch {
    return padrao;
  }
};

const formatarMoeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function FechamentoMensal({ navegar }) {
  const [competencia, setCompetencia] = useState(obterCompetenciaAtual);
  const [dadosBase] = useState(() => ({
    atividades: carregarJson("atividades", []),
    obras: carregarJson("obras", []),
    construtoras: carregarJson("construtoras", []),
    valoresServicos: carregarJson("valoresServicos", {}),
    valoresPadrao: carregarJson("valoresPadrao", {}),
    tabelaComercialPadrao: carregarJson("tabelaComercialPadrao", { locacoes: {} }),
  }));

  const fechamento = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      return { obras: [], totais: { totalServicos: 0, totalLocacoes: 0, totalGeral: 0 } };
    }

    const [ano, mes] = competencia.split("-").map(Number);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const inicioMes = `${competencia}-01`;
    const fimMes = `${competencia}-${String(ultimoDia).padStart(2, "0")}`;
    const contextoServicos = {
      valoresServicos: dadosBase.valoresServicos,
      valoresPadrao: dadosBase.valoresPadrao,
    };
    const atividadesServicos = dadosBase.atividades.filter(
      (atividade) =>
        atividade.dataLiberacao?.startsWith(competencia) &&
        atividadeEhServicoFaturavel(atividade, contextoServicos)
    );
    const resultadoLocacoes = calcularPeriodosFinanceirosLocacao({
      atividadesBase: dadosBase.atividades,
      inicioMes,
      fimMes,
      diasNoMes: ultimoDia,
      obras: dadosBase.obras,
      formatarEquipamento: formatarEquipamentoFinanceiro,
      obterValorMensalLocacao: (atividade) =>
        obterValorMensalLocacaoEfetivo(atividade, {
          obras: dadosBase.obras,
          construtoras: dadosBase.construtoras,
          tabelaComercialPadrao: dadosBase.tabelaComercialPadrao,
        }),
    });

    return consolidarFechamentoMensal({
      atividadesServicos,
      periodosLocacao: resultadoLocacoes.periodos,
      obras: dadosBase.obras,
      obterValorServico: (atividade) =>
        obterValorEfetivoServico(atividade, contextoServicos),
    });
  }, [competencia, dadosBase]);

  const abrirRelatorio = (pagina, linha) =>
    navegar(pagina, {
      origem: "fechamento-mensal",
      competencia,
      obraId: linha.obraId,
      construtora: linha.construtora,
      obra: linha.obra,
    });

  return (
    <section className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Fechamento Mensal</h1>
          <p className="mt-1 text-sm text-gray-500">Serviços e locações consolidados por obra.</p>
        </div>
        <label className="text-sm font-medium text-gray-700">
          Mês
          <input
            type="month"
            value={competencia}
            onChange={(evento) => setCompetencia(evento.target.value)}
            className="ml-2 rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Serviços", fechamento.totais.totalServicos],
          ["Locações", fechamento.totais.totalLocacoes],
          ["Total geral", fechamento.totais.totalGeral],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-sm text-gray-500">{rotulo}</span>
            <strong className="mt-1 block text-xl text-gray-800">{formatarMoeda(valor)}</strong>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3">Construtora</th>
              <th className="px-4 py-3">Obra</th>
              <th className="px-4 py-3 text-right">Serviços</th>
              <th className="px-4 py-3 text-right">Locação</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fechamento.obras.map((linha) => (
              <tr key={linha.chave} className="text-gray-700">
                <td className="px-4 py-3">{linha.construtora}</td>
                <td className="px-4 py-3 font-medium">{linha.obra}</td>
                <td className="px-4 py-3 text-right">{formatarMoeda(linha.totalServicos)}</td>
                <td className="px-4 py-3 text-right">{formatarMoeda(linha.totalLocacoes)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatarMoeda(linha.totalGeral)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => abrirRelatorio("relatorioservicos", linha)} className="rounded-md p-2 text-blue-700 hover:bg-blue-50" title="Abrir serviços"><FileBarChart size={18} /></button>
                    <button type="button" onClick={() => abrirRelatorio("relatoriolocacao", linha)} className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50" title="Abrir locação"><Boxes size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {fechamento.obras.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-10 text-center text-gray-500">Nenhum movimento financeiro no mês selecionado.</td></tr>
            )}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800">
            <tr>
              <td colSpan="2" className="px-4 py-3">Total geral</td>
              <td className="px-4 py-3 text-right">{formatarMoeda(fechamento.totais.totalServicos)}</td>
              <td className="px-4 py-3 text-right">{formatarMoeda(fechamento.totais.totalLocacoes)}</td>
              <td className="px-4 py-3 text-right">{formatarMoeda(fechamento.totais.totalGeral)}</td>
              <td className="px-4 py-3 text-right"><ArrowRight size={18} className="ml-auto text-gray-400" /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
