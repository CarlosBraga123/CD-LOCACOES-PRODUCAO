import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { obterUnidadesEquipamentosAtivos } from "../utils/equipamentosAtivos";
import {
  montarControleGeralPatrimonios,
  normalizarNumeroPatrimonio,
  obterRegistrosPatrimonio,
  obterResumoControlePatrimonios,
} from "../utils/patrimoniosEquipamentos";
import PatrimonioEquipamentosModal from "./PatrimonioEquipamentosModal";
import CadastroEquipamentoMestreModal from "./CadastroEquipamentoMestreModal";
import VincularPatrimonioModal from "./VincularPatrimonioModal";
import { obterPendenciasOperacionais } from "../utils/pendenciasOperacionais";
import {
  alterarEquipamentoPatrimonio,
  migrarEquipamentosConhecidos,
  obterEquipamentosPatrimonio,
  salvarEquipamentosPatrimonio,
  sincronizarPatrimoniosMestres,
} from "../utils/equipamentosPatrimonio";

const normalizar = (valor) =>
  String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const texto = (valor) => String(valor || "").trim();
const dataBr = (data) => {
  if (!data) return "—";
  const [ano, mes, dia] = String(data).split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : data;
};
const subtipo = (item) =>
  item.equipamento === "Balancinho"
    ? item.tipoBalancinho || "Elétrico"
    : item.equipamento === "Mini Grua"
      ? item.tipoMiniGrua || ""
      : "";
const descricao = (item) =>
  [item.equipamento || "Equipamento não identificado", subtipo(item)].filter(Boolean).join(" ");
const ultimaAlteracao = (item) =>
  [...(item.historico || [])].sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))[0];

export default function ControlePatrimonios() {
  const [atividades, setAtividades] = useState([]);
  const [obras, setObras] = useState([]);
  const [construtoras, setConstrutoras] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [equipamentosMestres, setEquipamentosMestres] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState({
    situacao: "Todos", tipo: "Todos", balancinho: "Todos",
    miniGrua: "Todos", construtora: "Todos", obra: "Todos",
  });
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [editor, setEditor] = useState(null);
  const [cadastroMestre, setCadastroMestre] = useState(undefined);
  const [situacao, setSituacao] = useState(null);
  const [pendenciaParaVincular, setPendenciaParaVincular] = useState(null);

  useEffect(() => {
    setAtividades(JSON.parse(localStorage.getItem("atividades") || "[]"));
    setObras(JSON.parse(localStorage.getItem("obras") || "[]"));
    setConstrutoras(JSON.parse(localStorage.getItem("construtoras") || "[]"));
    setRegistros(obterRegistrosPatrimonio());
    setEquipamentosMestres(obterEquipamentosPatrimonio());
  }, []);

  const ativos = useMemo(
    () => obras.flatMap((obra) =>
      obterUnidadesEquipamentosAtivos(obra, atividades, registros, equipamentosMestres).map((item) => ({
        ...item, obraId: obra.id || "", obraNome: obra.nome || "",
      }))
    ),
    [atividades, equipamentosMestres, obras, registros]
  );
  const consolidados = useMemo(
    () => montarControleGeralPatrimonios({
      registrosPatrimonio: registros,
      equipamentosMestres,
      equipamentosAtivos: ativos,
      construtoras,
      obras,
    }),
    [ativos, construtoras, equipamentosMestres, obras, registros]
  );
  useEffect(() => {
    const migracao = migrarEquipamentosConhecidos({
      equipamentos: equipamentosMestres,
      registrosPatrimonio: registros,
      equipamentosAtivos: ativos,
    });
    if (migracao.alterado) {
      salvarEquipamentosPatrimonio(migracao.equipamentos);
      setEquipamentosMestres(migracao.equipamentos);
    }
  }, [ativos, equipamentosMestres, registros]);
  const resumo = useMemo(() => obterResumoControlePatrimonios(consolidados), [consolidados]);
  const pendenciasOperacionais = useMemo(
    () => obterPendenciasOperacionais(atividades),
    [atividades]
  );
  const obrasDoFiltro = useMemo(
    () => obras.filter((obra) =>
      filtros.construtora === "Todos" ||
      String(obra.construtoraId || "") === filtros.construtora ||
      normalizar(obra.construtora) === normalizar(
        construtoras.find((item) => String(item.id) === filtros.construtora)?.nome
      )
    ),
    [construtoras, filtros.construtora, obras]
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    const resultado = consolidados.filter((item) => {
      const encontrouAntigo = (item.numerosAnteriores || []).some((numero) => normalizar(numero).includes(termo));
      const correspondeBusca = !termo || encontrouAntigo || [
        item.numeroPatrimonioAtual, item.construtoraNome, item.obraNome,
        item.equipamento, subtipo(item), item.tamanho,
      ].some((valor) => normalizar(valor).includes(termo));
      const correspondeSituacao =
        filtros.situacao === "Todos" ||
        (filtros.situacao === "SUBSTITUÍDO"
          ? (item.numerosAnteriores || []).length > 0
          : filtros.situacao === "SEM PATRIMÔNIO"
            ? !item.numeroPatrimonioAtual
            : item.situacao === filtros.situacao);
      return correspondeBusca && correspondeSituacao &&
        (filtros.tipo === "Todos" || item.equipamento === filtros.tipo) &&
        (filtros.balancinho === "Todos" || item.equipamento !== "Balancinho" || (item.tipoBalancinho || "Elétrico") === filtros.balancinho) &&
        (filtros.miniGrua === "Todos" || item.equipamento !== "Mini Grua" || item.tipoMiniGrua === filtros.miniGrua) &&
        (filtros.construtora === "Todos" || String(item.construtoraId) === filtros.construtora) &&
        (filtros.obra === "Todos" || String(item.obraId) === filtros.obra);
    });
    return resultado.sort((a, b) => {
      const grupo = (item) => !item.numeroPatrimonioAtual ? 0 : item.situacao === "LOCADO" ? 1 : item.situacao === "NO_GALPAO" ? 2 : 3;
      const porGrupo = grupo(a) - grupo(b);
      if (porGrupo) return porGrupo;
      if (!a.numeroPatrimonioAtual || !b.numeroPatrimonioAtual) {
        const local = `${a.construtoraNome}|${a.obraNome}`.localeCompare(`${b.construtoraNome}|${b.obraNome}`, "pt-BR");
        if (local) return local;
      }
      const porNumero = String(a.numeroPatrimonioAtual || "").localeCompare(String(b.numeroPatrimonioAtual || ""), "pt-BR", { numeric: true });
      return porNumero || a.ordemOriginal - b.ordemOriginal;
    });
  }, [busca, consolidados, filtros]);

  const abrirEditor = (item) => {
    const obra = obras.find((candidata) => String(candidata.id) === String(item.obraId));
    const construtora = construtoras.find((candidata) => String(candidata.id) === String(item.construtoraId));
    setEditor({ modo: "obra", obra: obra || { id: item.obraId, nome: item.obraNome }, construtora, itens: [item] });
  };
  const confirmarSituacao = () => {
    if (!situacao?.nova || !situacao.data || !situacao.motivo.trim()) {
      alert("Informe a situação, a data e o motivo.");
      return;
    }
    if (situacao.item.situacao === "LOCADO" && situacao.nova === "NO_GALPAO") {
      alert("Equipamento locado não pode ser enviado manualmente ao galpão.");
      return;
    }
    const atualizados = alterarEquipamentoPatrimonio({
      equipamentos: equipamentosMestres,
      idEquipamento: situacao.item.idEquipamento,
      alteracoes: {
        situacaoAdministrativa: situacao.nova,
        ativo: situacao.nova !== "BAIXADO",
      },
      data: situacao.data,
      motivo: situacao.motivo,
      observacao: situacao.observacao,
      tipo: situacao.nova === "BAIXADO" ? "baixa" : "mudanca_situacao",
    });
    salvarEquipamentosPatrimonio(atualizados);
    setEquipamentosMestres(atualizados);
    setSituacao(null);
  };
  const exportar = () => {
    const linhas = visiveis.map((item) => {
      const ultimo = ultimaAlteracao(item);
      return {
        Patrimônio: item.numeroPatrimonioAtual || "Sem patrimônio",
        Situação: item.situacao,
        Equipamento: item.equipamento || "",
        Subtipo: subtipo(item),
        "Configuração atual - tamanho":
          item.situacao === "LOCADO" ? item.tamanho || "" : "",
        "Configuração atual - ancoragem":
          item.situacao === "LOCADO" ? item.ancoragem || "" : "",
        "Localização atual": item.obraNome
          ? `${item.construtoraNome} / ${item.obraNome}`
          : item.situacao === "NO_GALPAO"
            ? "Galpão"
            : "Sem localização atual",
        Construtora: item.construtoraNome || "",
        Obra: item.obraNome || "",
        "Data de cadastro": item.dataCadastro || "",
        "Números anteriores": (item.numerosAnteriores || []).join(", "),
        "Última movimentação":
          [...(item.historicoAdministrativo || [])].sort((a, b) =>
            String(b.data || "").localeCompare(String(a.data || ""))
          )[0]?.data || ultimo?.data || "",
        Observação: item.observacao || ultimo?.observacao || "",
      };
    });
    const planilha = XLSX.utils.json_to_sheet(linhas);
    const arquivo = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(arquivo, planilha, "Patrimônios");
    XLSX.writeFile(arquivo, "controle-patrimonios.xlsx");
  };
  const buscaAntiga = (item) =>
    (item.numerosAnteriores || []).find((numero) => normalizar(numero).includes(normalizar(busca)));
  const atividadesDoDetalhe = detalhe
    ? atividades
        .filter((atividade) =>
          (atividade.itensEquipamentos || []).some(
            (item) =>
              (detalhe.idEquipamento &&
                String(item.idEquipamento || "") === String(detalhe.idEquipamento)) ||
              (detalhe.idItem &&
                (String(item.idItem || "") === String(detalhe.idItem) ||
                  String(item.idItemOrigem || "") === String(detalhe.idItem)))
          )
        )
        .sort((a, b) =>
          String(b.dataLiberacao || b.dataAgendamento || "").localeCompare(
            String(a.dataLiberacao || a.dataAgendamento || "")
          )
        )
    : [];

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Controle de Patrimônios</h2>
        <div className="flex gap-2"><button type="button" onClick={() => setCadastroMestre(null)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Novo equipamento</button><button type="button" onClick={exportar} className="rounded-lg border bg-white px-4 py-2 text-sm text-blue-700">Exportar Excel</button></div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Total cadastrado", resumo.totalCadastrado],
          ["No galpão", resumo.noGalpao],
          ["Locados", resumo.locados],
          ["Em manutenção", resumo.emManutencao],
          ["Indisponíveis", resumo.indisponiveis],
          ["Sem localização", resumo.semLocalizacao],
          ["Baixados", resumo.baixados],
        ].map(([rotulo, valor]) => <div key={rotulo} className="rounded-xl border bg-gray-50 p-3"><p className="text-xs text-gray-500">{rotulo}</p><p className="text-2xl font-bold text-blue-700">{valor}</p></div>)}
      </div>
      <section className="rounded-xl border bg-amber-50 p-3">
        <h3 className="font-semibold text-amber-900">Pendências Operacionais ({pendenciasOperacionais.length})</h3>
        {pendenciasOperacionais.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">Nenhuma pendência operacional.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {pendenciasOperacionais.map(({ atividade, resumo }) => (
              <div key={atividade.id} className="flex flex-col gap-2 rounded-lg border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-semibold">{atividade.servico} • {atividade.equipamento}</p>
                  <p>{atividade.construtora} • {atividade.obra}</p>
                  <p className="text-gray-500">{dataBr(atividade.dataLiberacao || atividade.dataAgendamento)} • {atividade.equipeResponsavel || "Sem responsável"}</p>
                  <p className="text-amber-700">{resumo.total} equipamento(s) • Vinculados: {resumo.vinculados} • Pendentes: {resumo.pendentes}</p>
                </div>
                <button type="button" onClick={() => setPendenciaParaVincular(atividade)} className="rounded border px-3 py-2 text-sm text-amber-700">Vincular patrimônio</button>
              </div>
            ))}
          </div>
        )}
      </section>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar patrimônio, obra, construtora ou equipamento" className="w-full rounded-xl border p-3" />
      <button type="button" onClick={() => setFiltrosAbertos(!filtrosAbertos)} className="w-full rounded-lg border px-3 py-2 text-left text-sm sm:hidden">Filtros {filtrosAbertos ? "▲" : "▼"}</button>
      <div className={`${filtrosAbertos ? "grid" : "hidden"} grid-cols-1 gap-2 rounded-xl border bg-gray-50 p-3 sm:grid sm:grid-cols-3 lg:grid-cols-6`}>
        <select value={filtros.situacao} onChange={(e) => setFiltros({ ...filtros, situacao: e.target.value })} className="rounded border p-2"><option value="Todos">Todos</option><option value="NO_GALPAO">No galpão</option><option value="LOCADO">Locados</option><option value="EM_MANUTENCAO">Em manutenção</option><option value="INDISPONIVEL">Indisponível</option><option value="SEM_LOCALIZACAO_ATUAL">Sem localização atual</option><option value="BAIXADO">Baixado</option><option value="SEM PATRIMÔNIO">Sem patrimônio</option><option value="SUBSTITUÍDO">Substituídos</option></select>
        <select value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })} className="rounded border p-2"><option>Todos</option><option>Balancinho</option><option>Mini Grua</option></select>
        <select value={filtros.balancinho} disabled={filtros.tipo === "Mini Grua"} onChange={(e) => setFiltros({ ...filtros, balancinho: e.target.value })} className="rounded border p-2"><option>Todos</option><option value="Eletrico">Elétrico</option><option>Manual</option></select>
        <select value={filtros.miniGrua} disabled={filtros.tipo === "Balancinho"} onChange={(e) => setFiltros({ ...filtros, miniGrua: e.target.value })} className="rounded border p-2"><option>Todos</option><option value="500kg">500 kg</option><option value="1T">1 T</option></select>
        <select value={filtros.construtora} onChange={(e) => setFiltros({ ...filtros, construtora: e.target.value, obra: "Todos" })} className="rounded border p-2"><option>Todos</option>{construtoras.map((item) => <option key={item.id || item.nome} value={item.id || ""}>{item.nome}</option>)}</select>
        <select value={filtros.obra} onChange={(e) => setFiltros({ ...filtros, obra: e.target.value })} className="rounded border p-2"><option>Todos</option>{obrasDoFiltro.map((item) => <option key={item.id || item.nome} value={item.id || ""}>{item.nome}</option>)}</select>
      </div>
      <p className="text-sm text-gray-500">{visiveis.length} equipamento(s) encontrado(s)</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visiveis.map((item) => {
          const ultimo = ultimaAlteracao(item);
          const antigo = buscaAntiga(item);
          return (
            <article key={item.idItem} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-mono text-2xl font-bold text-blue-700">{item.numeroPatrimonioAtual || "Sem patrimônio"}</p><p className="font-semibold">{descricao(item)}</p></div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold">{item.situacao}</span>
              </div>
              {antigo && <div className="mt-2 rounded bg-amber-50 p-2 text-sm"><strong>Patrimônio pesquisado:</strong> {antigo}<br />Situação do número: Substituído<br />Patrimônio atual: {item.numeroPatrimonioAtual}</div>}
              {!antigo && filtros.situacao === "SUBSTITUÍDO" && (
                <div className="mt-2 rounded bg-amber-50 p-2 text-sm">
                  <strong>Números substituídos:</strong> {(item.numerosAnteriores || []).join(", ")}
                  <br />Patrimônio atual do equipamento: {item.numeroPatrimonioAtual || "Sem patrimônio"}
                </div>
              )}
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {item.obraNome && <p>{item.construtoraNome} • {item.obraNome}</p>}
                {item.situacao === "LOCADO" &&
                  (item.tamanho || item.ancoragem || item.usaContrapeso) && (
                    <div className="mt-2 rounded bg-blue-50 p-2">
                      <p className="font-semibold text-blue-900">Configuração atual da locação</p>
                      {item.tamanho && <p>Tamanho: {item.tamanho} m</p>}
                      {item.ancoragem && <p>Ancoragem: {item.ancoragem}</p>}
                      <p>{item.usaContrapeso ? "Com contrapeso" : "Sem contrapeso"}</p>
                    </div>
                  )}
                <p>Última alteração: {dataBr(ultimo?.data)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setDetalhe(item)} className="rounded border px-3 py-2 text-sm">Ver detalhes</button>
                {item.idEquipamento && <button type="button" onClick={() => setCadastroMestre(item)} className="rounded border px-3 py-2 text-sm">Editar</button>}
                <button type="button" onClick={() => abrirEditor({ ...item, numeroPatrimonio: item.numeroPatrimonioAtual })} className="rounded border px-3 py-2 text-sm text-blue-700">{item.numeroPatrimonioAtual ? "Trocar patrimônio" : "Cadastrar patrimônio"}</button>
                {item.idEquipamento && item.situacao !== "LOCADO" && <button type="button" onClick={() => setSituacao({ item, nova: item.situacao, data: new Date().toISOString().slice(0,10), motivo: "", observacao: "" })} className="rounded border px-3 py-2 text-sm">Alterar situação</button>}
              </div>
            </article>
          );
        })}
      </div>
      {detalhe && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-2xl sm:rounded-2xl">
            <h3 className="text-lg font-bold">{detalhe.numeroPatrimonioAtual || "Sem patrimônio"}</h3>
            <p>{descricao(detalhe)} • {detalhe.situacao}</p>
            {detalhe.obraNome && <p className="text-sm text-gray-600">{detalhe.construtoraNome} • {detalhe.obraNome}</p>}
            {detalhe.situacao === "LOCADO" &&
              (detalhe.tamanho || detalhe.ancoragem || detalhe.usaContrapeso) && (
                <div className="mt-3 rounded bg-blue-50 p-3 text-sm">
                  <h4 className="font-semibold text-blue-900">Configuração atual da locação</h4>
                  {detalhe.tamanho && <p>Tamanho: {detalhe.tamanho} m</p>}
                  {detalhe.ancoragem && <p>Ancoragem: {detalhe.ancoragem}</p>}
                  <p>{detalhe.usaContrapeso ? "Com contrapeso" : "Sem contrapeso"}</p>
                </div>
              )}
            <p className="mt-2 text-sm">Origem: {detalhe.origemPatrimonio}</p>
            <h4 className="mt-4 font-semibold">Histórico administrativo</h4>
            <div className="mt-2 space-y-2">{[...(detalhe.historicoAdministrativo || [])].sort((a,b) => String(b.data || "").localeCompare(String(a.data || ""))).map((evento) => { const obraAnterior = obras.find((obra) => String(obra.id) === String(evento.obraAnteriorId || "")); const obraNova = obras.find((obra) => String(obra.id) === String(evento.obraNovaId || "")); return <div key={evento.id} className="rounded border bg-blue-50 p-2 text-sm"><p>{dataBr(evento.data)}: {evento.situacaoAnterior || "Cadastro"} → {evento.situacaoNova}</p>{evento.patrimonioRelacionado && <p>Patrimônio relacionado: {evento.patrimonioRelacionado}</p>}{obraAnterior && <p>Origem: {obraAnterior.nome}</p>}{obraNova ? <p>Destino: {obraNova.nome}</p> : evento.tipo === "SUBSTITUICAO" && <p>Destino: Galpão</p>}{evento.motivo && <p>Motivo: {evento.motivo}</p>}{evento.observacao && <p>Observação: {evento.observacao}</p>}</div>; })}</div>
            <h4 className="mt-4 font-semibold">Histórico de patrimônio</h4>
            <div className="mt-2 space-y-2">{[...(detalhe.historico || [])].sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))).map((evento) => {
              const obraEvento = obras.find((obra) => String(obra.id) === String(evento.obraId));
              return <div key={evento.id} className="rounded border bg-gray-50 p-2 text-sm"><p>{dataBr(evento.data)}: {evento.numeroAnterior || "Sem patrimônio"} → {evento.numeroNovo}</p>{evento.motivo && <p>Motivo: {evento.motivo}</p>}{evento.observacao && <p>Observação: {evento.observacao}</p>}{obraEvento && <p>Obra: {obraEvento.nome}</p>}</div>;
            })}</div>
            <h4 className="mt-4 font-semibold">Histórico operacional</h4>
            {atividadesDoDetalhe.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Nenhuma atividade vinculada localizada.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {atividadesDoDetalhe.map((atividade) => (
                  <div key={atividade.id} className="rounded border p-2 text-sm">
                    <p>{dataBr(atividade.dataLiberacao || atividade.dataAgendamento)} • {atividade.servico}</p>
                    <p>{atividade.construtora} • {atividade.obra}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setDetalhe(null)} className="rounded border px-4 py-2">Fechar</button><button type="button" onClick={() => { setDetalhe(null); abrirEditor(detalhe); }} className="rounded bg-blue-600 px-4 py-2 text-white">{detalhe.numeroPatrimonioAtual ? "Trocar patrimônio" : "Cadastrar patrimônio"}</button></div>
          </div>
        </div>
      )}
      {editor && <PatrimonioEquipamentosModal contexto={editor} registros={registros} equipamentosAtivos={ativos} obras={obras} onClose={() => setEditor(null)} onRegistrosAlterados={(novos) => { setRegistros(novos); const mestres = sincronizarPatrimoniosMestres(equipamentosMestres, novos); salvarEquipamentosPatrimonio(mestres); setEquipamentosMestres(mestres); }} onSubstituicaoConcluida={({ equipamentos }) => { setEquipamentosMestres(equipamentos); setEditor(null); }} />}
      {pendenciaParaVincular && (
        <VincularPatrimonioModal
          atividade={pendenciaParaVincular}
          atividades={atividades}
          obras={obras}
          onClose={() => setPendenciaParaVincular(null)}
          onVinculado={(atualizadas, mestresAtualizados) => {
            setAtividades(atualizadas);
            setEquipamentosMestres(mestresAtualizados);
            setPendenciaParaVincular(null);
          }}
        />
      )}
      {cadastroMestre !== undefined && <CadastroEquipamentoMestreModal equipamento={cadastroMestre || null} equipamentos={equipamentosMestres} registrosPatrimonio={registros} equipamentosAtivos={ativos} onClose={() => setCadastroMestre(undefined)} onSalvar={(novos, novosRegistros) => { setEquipamentosMestres(novos); setRegistros(novosRegistros); setCadastroMestre(undefined); }} />}
      {situacao && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"><div className="w-full space-y-3 rounded-t-2xl bg-white p-4 sm:max-w-lg sm:rounded-2xl"><h3 className="font-bold">Alterar situação</h3><select value={situacao.nova} onChange={(e) => setSituacao({ ...situacao, nova: e.target.value })} className="w-full rounded border p-2"><option value="NO_GALPAO">No galpão</option><option value="EM_MANUTENCAO">Em manutenção</option><option value="INDISPONIVEL">Indisponível</option><option value="BAIXADO">Baixado</option><option value="SEM_LOCALIZACAO_ATUAL">Sem localização atual</option></select><input type="date" value={situacao.data} onChange={(e) => setSituacao({ ...situacao, data: e.target.value })} className="w-full rounded border p-2" /><input value={situacao.motivo} onChange={(e) => setSituacao({ ...situacao, motivo: e.target.value })} placeholder="Motivo obrigatório" className="w-full rounded border p-2" /><textarea value={situacao.observacao} onChange={(e) => setSituacao({ ...situacao, observacao: e.target.value })} placeholder="Observação" className="w-full rounded border p-2" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setSituacao(null)} className="rounded border px-4 py-2">Cancelar</button><button type="button" onClick={confirmarSituacao} className="rounded bg-blue-600 px-4 py-2 text-white">Salvar</button></div></div></div>}
    </div>
  );
}
