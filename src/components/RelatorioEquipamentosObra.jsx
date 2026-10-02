import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { obterEquipamentosPatrimonio } from "../utils/equipamentosPatrimonio";
import { obterRegistrosPatrimonio } from "../utils/patrimoniosEquipamentos";
import { montarEquipamentosPorObra, montarRelatorioGeralEquipamentos } from "../utils/equipamentosPorObra";

const lerLista = (chave) => {
  try {
    const valor = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(valor) ? valor : [];
  } catch { return []; }
};
const formatarData = (data) => { const [ano, mes, dia] = data.split("-"); return `${dia}/${mes}/${ano}`; };
const obterNomeConstrutora = (obra, construtoras) => {
  const cadastro = construtoras.find((item) => String(item.id) === String(obra?.construtoraId || ""));
  return cadastro?.nome || obra?.construtora || "Sem construtora";
};

const Resumo = ({ resumo, titulo = "" }) => (
  <div className="resumo-relatorio mt-2 border-t pt-1.5 text-[11px]">
    {titulo && <p className="mb-1 font-bold">{titulo}</p>}
    <div className="flex flex-wrap gap-x-5 gap-y-0.5">
      {resumo.categorias.map((categoria) => <span key={categoria.chave}>{categoria.rotulo}: <strong>{categoria.quantidade}</strong></span>)}
    </div>
    <p className="mt-1 font-bold">TOTAL GERAL: {resumo.totalGeral}</p>
  </div>
);

const TabelaEquipamentos = ({ linhas }) => (
  <div className="relatorio-tabela mx-auto w-[65%] min-w-[320px] max-w-full">
    <table className="w-full table-fixed border-collapse text-[11px]">
      <colgroup><col className="w-[70%]" /><col className="w-[30%]" /></colgroup>
      <thead><tr className="bg-gray-100 text-left"><th className="border px-2 py-1">Equipamento</th><th className="border px-2 py-1">Patrimônio</th></tr></thead>
      <tbody>{linhas.map((linha) => <tr key={linha.identidade}><td className="border px-2 py-0.5">{linha.equipamento}</td><td className="border px-2 py-0.5 font-mono">{linha.patrimonio}</td></tr>)}</tbody>
    </table>
  </div>
);

const BlocoObra = ({ item }) => (
  <section className="bloco-obra mb-3">
    <h3 className="cabecalho-obra border-b pb-1 text-xs font-bold uppercase">{item.obra.nome || "Obra sem nome"}</h3>
    <TabelaEquipamentos linhas={item.linhas} />
    <Resumo resumo={item.resumo} />
  </section>
);

export default function RelatorioEquipamentosObra() {
  const atividades = useMemo(() => lerLista("atividades"), []);
  const obras = useMemo(() => lerLista("obras"), []);
  const construtoras = useMemo(() => lerLista("construtoras"), []);
  const registrosPatrimonio = useMemo(() => obterRegistrosPatrimonio(), []);
  const equipamentosMestres = useMemo(() => obterEquipamentosPatrimonio(), []);
  const [modo, setModo] = useState("obra");
  const [construtoraSelecionada, setConstrutoraSelecionada] = useState("");
  const [obraSelecionada, setObraSelecionada] = useState("");

  const nomesConstrutoras = useMemo(() => [...new Set(obras.map((item) => obterNomeConstrutora(item, construtoras)))], [obras, construtoras]);
  const obrasFiltradas = useMemo(() => obras.filter((item) => obterNomeConstrutora(item, construtoras) === construtoraSelecionada), [obras, construtoras, construtoraSelecionada]);
  const obra = obras.find((item) => String(item.id) === String(obraSelecionada));
  const relatorioObra = useMemo(() => montarEquipamentosPorObra({ obra, atividades, registrosPatrimonio, equipamentosMestres }), [atividades, equipamentosMestres, obra, registrosPatrimonio]);
  const relatorioGeral = useMemo(() => montarRelatorioGeralEquipamentos({ construtoras, obras, atividades, registrosPatrimonio, equipamentosMestres }), [atividades, construtoras, equipamentosMestres, obras, registrosPatrimonio]);
  const podeImprimir = modo === "geral" || Boolean(obra);
  const dataConsulta = formatarData(new Date().toISOString().slice(0, 10));

  return (
    <section id="equipamentos-obra-pagina" className="mx-auto max-w-6xl p-4 sm:p-6">
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden; }
          body > #root, #root > div, main, #equipamentos-obra-pagina {
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
          #equipamentos-obra-impressao, #equipamentos-obra-impressao * { visibility: visible; }
          #equipamentos-obra-impressao {
            position: static !important;
            width: 194mm !important;
            max-width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            box-sizing: border-box !important;
            font-size: 8.5pt;
          }
          #equipamentos-obra-impressao .relatorio-tabela { width: 65% !important; min-width: 0 !important; margin-left: auto !important; margin-right: auto !important; }
          #equipamentos-obra-impressao table { page-break-inside: auto; }
          #equipamentos-obra-impressao thead { display: table-header-group; }
          #equipamentos-obra-impressao tr { break-inside: avoid; page-break-inside: avoid; }
          #equipamentos-obra-impressao th, #equipamentos-obra-impressao td { padding: 1.2mm 1.5mm; }
          #equipamentos-obra-impressao .cabecalho-construtora, #equipamentos-obra-impressao .cabecalho-obra { break-after: avoid; page-break-after: avoid; }
          #equipamentos-obra-impressao .resumo-relatorio { break-inside: avoid; page-break-inside: avoid; }
          #equipamentos-obra-impressao .bloco-obra { margin-bottom: 3mm; }
          .nao-imprimir { display: none !important; }
        }
      `}</style>

      <div className="nao-imprimir mb-5 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex overflow-hidden rounded-lg border">
          <button type="button" onClick={() => setModo("obra")} className={`px-4 py-2.5 text-sm font-semibold ${modo === "obra" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}>Por Obra</button>
          <button type="button" onClick={() => setModo("geral")} className={`border-l px-4 py-2.5 text-sm font-semibold ${modo === "geral" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}>Geral</button>
        </div>
        {modo === "obra" && <>
          <label className="min-w-52 flex-1 text-sm font-medium text-gray-700">Construtora<select value={construtoraSelecionada} onChange={(evento) => { setConstrutoraSelecionada(evento.target.value); setObraSelecionada(""); }} className="mt-1 w-full rounded-lg border p-2.5"><option value="">Selecione</option>{nomesConstrutoras.map((nome) => <option key={nome}>{nome}</option>)}</select></label>
          <label className="min-w-52 flex-1 text-sm font-medium text-gray-700">Obra<select value={obraSelecionada} onChange={(evento) => setObraSelecionada(evento.target.value)} disabled={!construtoraSelecionada} className="mt-1 w-full rounded-lg border p-2.5 disabled:bg-gray-100"><option value="">Selecione</option>{obrasFiltradas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
        </>}
        <button type="button" disabled={!podeImprimir} onClick={() => window.print()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40"><Printer size={18} /> Imprimir / Salvar PDF</button>
      </div>

      {modo === "obra" && !obra ? <p className="nao-imprimir rounded-xl border bg-gray-50 p-6 text-center text-gray-500">Selecione uma construtora e uma obra para visualizar o relatório.</p> : (
        <article id="equipamentos-obra-impressao" className="rounded-xl border bg-white p-4 print:rounded-none print:border-0 print:p-0">
          <header className="mb-3 border-b pb-2 text-center">
            <p className="text-sm font-bold tracking-wide">CD LOCAÇÕES</p><h1 className="text-lg font-bold">EQUIPAMENTOS INSTALADOS</h1>
            <div className="mt-1 flex flex-wrap justify-between gap-2 text-left text-[11px]"><p><strong>Modo:</strong> {modo === "geral" ? "Geral" : "Por Obra"}</p>{modo === "obra" && <p><strong>Construtora:</strong> {obterNomeConstrutora(obra, construtoras)}</p>}{modo === "obra" && <p><strong>Obra:</strong> {obra.nome}</p>}<p><strong>Data da consulta:</strong> {dataConsulta}</p></div>
          </header>
          {modo === "obra" ? (relatorioObra.linhas.length ? <BlocoObra item={{ obra, ...relatorioObra }} /> : <p className="p-5 text-center text-gray-500">Nenhum equipamento instalado nesta obra.</p>) : <>
            {relatorioGeral.grupos.map((grupo) => <div key={grupo.construtora.id || grupo.construtora.nome}><h2 className="cabecalho-construtora mb-1 mt-3 border-b-2 border-gray-800 pb-1 text-sm font-bold uppercase">{grupo.construtora.nome || "Construtora sem nome"}</h2>{grupo.obras.map((item) => <BlocoObra key={item.obra.id || item.obra.nome} item={item} />)}</div>)}
            {relatorioGeral.grupos.length === 0 && <p className="p-5 text-center text-gray-500">Nenhuma obra possui equipamento instalado.</p>}
            {relatorioGeral.grupos.length > 0 && <Resumo resumo={relatorioGeral.resumoGeral} titulo="RESUMO GERAL" />}
          </>}
        </article>
      )}
    </section>
  );
}
