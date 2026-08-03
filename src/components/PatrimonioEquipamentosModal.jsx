import { useMemo, useState } from "react";
import {
  consultarPatrimonio,
  normalizarNumeroPatrimonio,
  obterIdItemPatrimonio,
  obterPatrimonioAtual,
  registrarCadastroInicialPatrimonio,
  registrarTrocaPatrimonio,
  salvarRegistrosPatrimonio,
  validarNumeroPatrimonio,
  verificarPatrimonioDuplicado,
} from "../utils/patrimoniosEquipamentos";
import {
  obterEquipamentosPatrimonio,
  salvarEquipamentosPatrimonio,
  sincronizarPatrimoniosMestres,
  registrarSubstituicaoEquipamento,
} from "../utils/equipamentosPatrimonio";
import { obterUnidadesEquipamentosAtivos } from "../utils/equipamentosAtivos";
import TrocaPatrimonioModal from "./TrocaPatrimonioModal";

const hoje = () => new Date().toISOString().slice(0, 10);
const texto = (valor) => String(valor || "").trim();
const descricaoItem = (item) =>
  [item.equipamento || item.tipoEquipamento || "Equipamento", item.tamanho && `${item.tamanho} m`, item.ancoragem]
    .filter(Boolean)
    .join(" • ");

export default function PatrimonioEquipamentosModal({
  contexto,
  registros,
  equipamentosAtivos,
  obras,
  onClose,
  onRegistrosAlterados,
  onSubstituicaoConcluida,
}) {
  const [filtro, setFiltro] = useState("sem");
  const [edicoes, setEdicoes] = useState({});
  const [troca, setTroca] = useState(null);
  const [consulta, setConsulta] = useState("");
  const [resultadoConsulta, setResultadoConsulta] = useState(undefined);
  const [salvando, setSalvando] = useState(false);
  const itens = contexto?.itens || [];
  const itensVisiveis = useMemo(
    () =>
      itens.filter((item) => {
        const possui = Boolean(obterPatrimonioAtual(item, registros));
        return filtro === "todos" || (filtro === "com" ? possui : !possui);
      }),
    [filtro, itens, registros]
  );
  const localizarItem = (idItem) =>
    equipamentosAtivos.find((item) => obterIdItemPatrimonio(item) === String(idItem || ""));
  const mensagemDuplicidade = (duplicidade, numero) =>
    duplicidade?.tipo === "historico"
      ? `O patrimônio ${numero} já foi utilizado anteriormente.`
      : `O patrimônio ${numero} já está vinculado a outro equipamento.`;

  const salvarCadastros = () => {
    if (salvando) return;
    const preenchidos = itens
      .map((item) => ({
        item,
        idItem: obterIdItemPatrimonio(item),
        numero: normalizarNumeroPatrimonio(edicoes[obterIdItemPatrimonio(item)]),
      }))
      .filter(({ numero }) => numero);
    if (!preenchidos.length) return alert("Informe ao menos um número de patrimônio.");
    if (preenchidos.some(({ numero }) => !validarNumeroPatrimonio(numero))) {
      return alert("O patrimônio deve conter somente números. Zeros à esquerda são preservados.");
    }
    for (const entrada of preenchidos) {
      const duplicidade = verificarPatrimonioDuplicado(
        entrada.numero,
        entrada.idItem,
        registros,
        equipamentosAtivos,
        preenchidos
      );
      if (duplicidade) return alert(mensagemDuplicidade(duplicidade, entrada.numero));
    }
    setSalvando(true);
    let atualizados = registros;
    preenchidos.forEach(({ item, numero }) => {
      atualizados = registrarCadastroInicialPatrimonio({
        registros: atualizados,
        item,
        numeroNovo: numero,
        data: hoje(),
        obraId: contexto.obra?.id || "",
      });
    });
    salvarRegistrosPatrimonio(atualizados);
    salvarEquipamentosPatrimonio(
      sincronizarPatrimoniosMestres(
        obterEquipamentosPatrimonio(),
        atualizados
      )
    );
    setEdicoes({});
    onRegistrosAlterados(atualizados);
    alert("Patrimônios cadastrados com sucesso.");
    setSalvando(false);
  };

  const confirmarTroca = () => {
    if (salvando) return;
    const numero = normalizarNumeroPatrimonio(troca?.numeroNovo);
    const motivo = troca?.motivo === "Outro" ? texto(troca?.motivoOutro) : texto(troca?.motivo);
    if (!validarNumeroPatrimonio(numero)) return alert("Informe um patrimônio contendo somente números.");
    if (!troca?.data || !motivo) return alert("Informe a data e o motivo da troca.");
    const duplicidade = verificarPatrimonioDuplicado(
      numero,
      obterIdItemPatrimonio(troca.item),
      registros,
      equipamentosAtivos
    );
    if (duplicidade) return alert(mensagemDuplicidade(duplicidade, numero));
    setSalvando(true);
    const atualizados = registrarTrocaPatrimonio({
      registros,
      item: troca.item,
      numeroNovo: numero,
      data: troca.data,
      obraId: contexto.obra?.id || "",
      motivo,
      observacao: troca.observacao,
    });
    salvarRegistrosPatrimonio(atualizados);
    salvarEquipamentosPatrimonio(
      sincronizarPatrimoniosMestres(
        obterEquipamentosPatrimonio(),
        atualizados
      )
    );
    setTroca(null);
    onRegistrosAlterados(atualizados);
    alert("Patrimônio atualizado com sucesso.");
    setSalvando(false);
  };

  const montarAtivosAtuais = () => {
    const atividadesAtuais = JSON.parse(localStorage.getItem("atividades") || "[]");
    const obrasAtuais = JSON.parse(localStorage.getItem("obras") || "[]");
    return obrasAtuais.flatMap((obra) =>
      obterUnidadesEquipamentosAtivos(obra, atividadesAtuais).map((item) => ({
        ...item,
        obraId: obra.id || item.obraId || "",
        obraNome: obra.nome || item.obra || "",
        construtoraNome: obra.construtora || item.construtora || "",
      }))
    );
  };

  const abrirEscolhaTroca = (item) => {
    const unidade = montarAtivosAtuais().find(
      (ativo) => String(ativo.idEquipamento || "") === String(item.idEquipamento || "")
    );
    setTroca({
      item,
      modo: "escolha",
      unidadeOrigemId: unidade?.idUnidade || "",
      obraOrigemId: unidade?.obraId || "",
      numeroNovo: "",
      data: hoje(),
      motivo: "",
      motivoOutro: "",
      observacao: "",
      destinoId: "",
    });
  };

  const mestresAtuais = obterEquipamentosPatrimonio();
  const mestreOrigem = troca
    ? mestresAtuais.find(
        (item) => String(item.idEquipamento) === String(troca.item?.idEquipamento || "")
      )
    : null;
  const candidatosSubstituicao = useMemo(() => {
    if (!troca || troca.modo !== "substituir" || !mestreOrigem) return [];
    return mestresAtuais
      .filter((item) => {
        if (item.idEquipamento === mestreOrigem.idEquipamento) return false;
        if (
          ["BAIXADO", "EM_MANUTENCAO", "INDISPONIVEL"].includes(item.situacaoAdministrativa) ||
          !normalizarNumeroPatrimonio(item.numeroPatrimonioAtual) ||
          item.equipamento !== mestreOrigem.equipamento
        ) return false;
        return item.equipamento === "Balancinho"
          ? (item.tipoBalancinho || "Eletrico") === (mestreOrigem.tipoBalancinho || "Eletrico")
          : String(item.tipoMiniGrua || "") === String(mestreOrigem.tipoMiniGrua || "");
      })
      .map((item) => ({
        item,
        ativo: equipamentosAtivos.find(
          (unidade) => String(unidade.idEquipamento || "") === String(item.idEquipamento)
        ),
      }))
      .filter(({ item, ativo }) => Boolean(ativo) || item.situacaoAdministrativa === "NO_GALPAO");
  }, [equipamentosAtivos, mestreOrigem, mestresAtuais, troca]);

  const confirmarSubstituicao = () => {
    if (salvando) return;
    const motivo = troca?.motivo === "Outro" ? texto(troca?.motivoOutro) : texto(troca?.motivo);
    if (!troca?.destinoId || !troca?.data || !motivo) {
      alert("Selecione o equipamento substituto e informe data e motivo.");
      return;
    }
    const ativosAtuais = montarAtivosAtuais();
    const origemAtual = ativosAtuais.find(
      (item) => String(item.idEquipamento || "") === String(troca.item.idEquipamento || "")
    );
    const candidato = candidatosSubstituicao.find(
      ({ item }) => String(item.idEquipamento) === String(troca.destinoId)
    );
    const destinoAtual = ativosAtuais.find(
      (item) => String(item.idEquipamento) === String(troca.destinoId)
    );
    if (
      !origemAtual ||
      origemAtual.idUnidade !== troca.unidadeOrigemId ||
      String(origemAtual.obraId || "") !== String(troca.obraOrigemId || "")
    ) {
      alert("A localização do equipamento mudou. Atualize a tela e tente novamente.");
      return;
    }
    if (
      !candidato ||
      String(destinoAtual?.idUnidade || "") !== String(candidato.ativo?.idUnidade || "") ||
      String(destinoAtual?.obraId || "") !== String(candidato.ativo?.obraId || "")
    ) {
      alert("A situação do substituto mudou. Atualize a tela e tente novamente.");
      return;
    }
    const obraOrigem = origemAtual.obraNome || origemAtual.obra || "obra atual";
    const localDestino = destinoAtual
      ? destinoAtual.obraNome || destinoAtual.obra || "outra obra"
      : "o galpão";
    const resumo = destinoAtual
      ? `${candidato.item.numeroPatrimonioAtual} ficará em ${obraOrigem} e ${mestreOrigem.numeroPatrimonioAtual} ficará em ${localDestino}. As configurações e locações de cada obra serão preservadas.`
      : `${candidato.item.numeroPatrimonioAtual} ficará em ${obraOrigem} e ${mestreOrigem.numeroPatrimonioAtual} retornará ao galpão. A locação e os valores serão preservados.`;
    if (!window.confirm(resumo)) return;
    setSalvando(true);
    try {
      const resultado = registrarSubstituicaoEquipamento({
        equipamentoOrigemId: mestreOrigem.idEquipamento,
        equipamentoDestinoId: troca.destinoId,
        equipamentosAtivos: ativosAtuais,
        data: troca.data,
        motivo,
        observacao: troca.observacao,
      });
      setTroca(null);
      onSubstituicaoConcluida?.(resultado);
      alert("Substituição registrada com sucesso.");
    } catch (erro) {
      alert(erro.message || "Não foi possível concluir toda a substituição.");
    } finally {
      setSalvando(false);
    }
  };

  const pesquisar = () => {
    const numero = normalizarNumeroPatrimonio(consulta);
    if (!numero) return setResultadoConsulta(null);
    const administrativo = consultarPatrimonio(numero, registros);
    if (administrativo) {
      setResultadoConsulta({
        ...administrativo,
        item: localizarItem(administrativo.registro.idItem),
      });
      return;
    }
    const item = equipamentosAtivos.find(
      (candidato) => obterPatrimonioAtual(candidato, registros) === numero
    );
    setResultadoConsulta(item ? { situacao: "Ativo", item, registro: null, evento: null } : null);
  };
  const nomeObra = (obraId) =>
    obras.find((obra) => String(obra.id) === String(obraId))?.nome || "Obra não localizada";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-4xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">
              {contexto?.modo === "consulta" ? "Consultar patrimônio" : "Atualizar patrimônios"}
            </h3>
            {contexto?.obra && (
              <p className="text-sm text-gray-500">
                {contexto.obra.nome} • {contexto.construtora?.nome || contexto.obra.construtora}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1">Fechar</button>
        </div>
        {contexto?.modo === "consulta" ? (
          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <input inputMode="numeric" value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Número do patrimônio" className="min-w-0 flex-1 rounded border p-2" />
              <button type="button" onClick={pesquisar} className="rounded bg-blue-600 px-4 text-white">Consultar</button>
            </div>
            {resultadoConsulta === null && <p className="rounded border bg-gray-50 p-3 text-sm">Patrimônio não localizado.</p>}
            {resultadoConsulta && (
              <div className="space-y-2 rounded-xl border p-3 text-sm">
                <p><strong>Situação:</strong> {resultadoConsulta.situacao}</p>
                <p><strong>Equipamento:</strong> {resultadoConsulta.item ? descricaoItem(resultadoConsulta.item) : "Não está ativo atualmente"}</p>
                {resultadoConsulta.item?.construtoraNome && <p><strong>Construtora atual:</strong> {resultadoConsulta.item.construtoraNome}</p>}
                {resultadoConsulta.item?.obraNome && <p><strong>Obra atual:</strong> {resultadoConsulta.item.obraNome}</p>}
                {resultadoConsulta.evento?.obraId && <p><strong>Última obra registrada:</strong> {nomeObra(resultadoConsulta.evento.obraId)}</p>}
                {(resultadoConsulta.registro?.historico || []).length > 0 && (
                  <div>
                    <strong>Histórico:</strong>
                    <ul className="mt-1 space-y-1">
                      {resultadoConsulta.registro.historico.map((evento) => (
                        <li key={evento.id} className="rounded bg-gray-50 p-2">
                          {evento.data || "Sem data"}: {evento.numeroAnterior || "Sem patrimônio"} → {evento.numeroNovo}
                          {evento.motivo ? ` • ${evento.motivo}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="mt-4 rounded-lg bg-blue-50 p-2 text-sm text-blue-900">
              {itens.filter((item) => obterPatrimonioAtual(item, registros)).length === itens.length
                ? "Todos os equipamentos ativos desta obra possuem patrimônio."
                : `${itens.filter((item) => obterPatrimonioAtual(item, registros)).length} de ${itens.length} equipamentos possuem patrimônio.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[["sem", "Sem patrimônio"], ["todos", "Todos"]].map(([valor, rotulo]) => (
                <button key={valor} type="button" onClick={() => setFiltro(valor)} className={`rounded-full border px-3 py-1 text-sm ${filtro === valor ? "bg-blue-600 text-white" : "bg-white"}`}>{rotulo}</button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {itensVisiveis.length === 0 ? (
                <p className="rounded border bg-gray-50 p-3 text-sm text-gray-500">Nenhum equipamento neste filtro.</p>
              ) : itensVisiveis.map((item, indice) => {
                const idItem = obterIdItemPatrimonio(item);
                const atual = obterPatrimonioAtual(item, registros);
                return (
                  <div key={idItem || indice} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_220px_auto] sm:items-center">
                    <div><p className="font-semibold">{descricaoItem(item)}</p><p className="text-xs text-gray-500">Item {indice + 1}</p></div>
                    {atual ? <p className="font-mono text-lg font-bold">{atual}</p> : (
                      <input inputMode="numeric" value={edicoes[idItem] || ""} onChange={(e) => setEdicoes({ ...edicoes, [idItem]: e.target.value })} placeholder="Novo patrimônio" className="rounded border p-2" />
                    )}
                    {atual && <button type="button" onClick={() => abrirEscolhaTroca(item)} className="rounded border px-3 py-2 text-sm text-blue-700">Trocar</button>}
                  </div>
                );
              })}
            </div>
            {itens.some((item) => !obterPatrimonioAtual(item, registros)) && (
              <button type="button" disabled={salvando} onClick={salvarCadastros} className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60 sm:w-auto">{salvando ? "Salvando..." : "Salvar patrimônios"}</button>
            )}
          </>
        )}
        {troca && (
          <TrocaPatrimonioModal
            troca={troca}
            setTroca={setTroca}
            patrimonioAtual={obterPatrimonioAtual(troca.item, registros)}
            candidatos={candidatosSubstituicao}
            salvando={salvando}
            confirmarNumero={confirmarTroca}
            confirmarSubstituicao={confirmarSubstituicao}
          />
        )}
        {troca && false && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
            <div className="w-full space-y-3 rounded-t-2xl bg-white p-4 sm:max-w-lg sm:rounded-2xl">
              <h4 className="font-bold">Trocar patrimônio {obterPatrimonioAtual(troca.item, registros)}</h4>
              <input inputMode="numeric" value={troca.numeroNovo} onChange={(e) => setTroca({ ...troca, numeroNovo: e.target.value })} placeholder="Novo patrimônio" className="w-full rounded border p-2" />
              <input type="date" value={troca.data} onChange={(e) => setTroca({ ...troca, data: e.target.value })} className="w-full rounded border p-2" />
              <select value={troca.motivo} onChange={(e) => setTroca({ ...troca, motivo: e.target.value })} className="w-full rounded border p-2"><option value="">Motivo da troca</option><option>Substituição do quadro de comando</option><option>Etiqueta danificada</option><option>Correção de numeração</option><option>Outro</option></select>
              {troca.motivo === "Outro" && <input value={troca.motivoOutro} onChange={(e) => setTroca({ ...troca, motivoOutro: e.target.value })} placeholder="Descreva o motivo" className="w-full rounded border p-2" />}
              <textarea value={troca.observacao} onChange={(e) => setTroca({ ...troca, observacao: e.target.value })} placeholder="Observação (opcional)" className="w-full rounded border p-2" />
              <div className="flex justify-end gap-2"><button type="button" disabled={salvando} onClick={() => setTroca(null)} className="rounded border px-4 py-2">Cancelar</button><button type="button" disabled={salvando} onClick={confirmarTroca} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60">{salvando ? "Salvando..." : "Confirmar troca"}</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
