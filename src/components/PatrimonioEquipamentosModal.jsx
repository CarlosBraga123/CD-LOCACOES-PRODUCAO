import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import {
  criarAjusteConfiguracao,
  obterAjustesConfiguracaoEquipamentos,
  obterUltimoAjusteConfiguracao,
  salvarAjustesConfiguracaoEquipamentos,
} from "../utils/ajustesConfiguracaoEquipamentos";

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
  navegacaoConferencia,
}) {
  const itens = contexto?.fluxoIndividual
    ? contexto.unidadeSelecionada
      ? [contexto.unidadeSelecionada]
      : Array.isArray(contexto?.itens)
        ? contexto.itens.slice(0, 1)
        : []
    : Array.isArray(contexto?.itens)
      ? contexto.itens
      : [];
  const [filtro, setFiltro] = useState(contexto?.fluxoIndividual ? "todos" : "sem");
  const [edicoes, setEdicoes] = useState(() =>
    Object.fromEntries(
      itens.map((item) => [
        obterIdItemPatrimonio(item),
        obterPatrimonioAtual(item, registros) || "",
      ])
    )
  );
  const [configuracoes, setConfiguracoes] = useState(() =>
    Object.fromEntries(
      itens.map((item) => {
        const ultimaConferencia = obterUltimoAjusteConfiguracao(
          item,
          obterAjustesConfiguracaoEquipamentos()
        );
        return [
          obterIdItemPatrimonio(item),
          {
            tamanho: ultimaConferencia
              ? String(ultimaConferencia.tamanho ?? "")
              : item.tamanho || "",
            ancoragem: ultimaConferencia
              ? ultimaConferencia.ancoragem || ""
              : item.ancoragem || "",
            tipoMiniGrua: item.tipoMiniGrua || "",
            usaContrapeso: ultimaConferencia
              ? typeof ultimaConferencia.usaContrapeso === "boolean"
                ? ultimaConferencia.usaContrapeso
                  ? "sim"
                  : "nao"
                : "nao_conferido"
              : item.usaContrapeso === true
                ? "sim"
                : "nao_conferido",
            observacao: ultimaConferencia?.observacao || "",
            observacaoEditada: false,
          },
        ];
      })
    )
  );
  const [dataConferencia, setDataConferencia] = useState(hoje());
  const [observacaoGeral, setObservacaoGeral] = useState(
    "Conferido fisicamente na obra"
  );
  const [troca, setTroca] = useState(null);
  const [consulta, setConsulta] = useState("");
  const [resultadoConsulta, setResultadoConsulta] = useState(undefined);
  const [salvando, setSalvando] = useState(false);
  const salvamentoConferenciaEmAndamento = useRef(false);
  const itemEstaPendente = (item) => {
    const idItem = obterIdItemPatrimonio(item);
    const configuracao = configuracoes[idItem] || {};
    if (!normalizarNumeroPatrimonio(edicoes[idItem])) return true;
    if (item.equipamento !== "Balancinho") return false;
    return (
      !configuracao.tamanho ||
      configuracao.usaContrapeso === "nao_conferido"
    );
  };
  const itensVisiveis = useMemo(
    () => contexto?.fluxoIndividual
      ? itens
      : itens.filter((item) => filtro === "todos" || itemEstaPendente(item)),
    [configuracoes, contexto?.fluxoIndividual, edicoes, filtro, itens]
  );
  const localizarItem = (idItem) =>
    equipamentosAtivos.find((item) => obterIdItemPatrimonio(item) === String(idItem || ""));
  const mensagemDuplicidade = (duplicidade, numero) =>
    duplicidade?.tipo === "historico"
      ? `O patrimônio ${numero} já foi utilizado anteriormente.`
      : `O patrimônio ${numero} já está vinculado a outro equipamento.`;

  const salvarCadastros = () => {
    if (salvando || salvamentoConferenciaEmAndamento.current) return;
    if (!dataConferencia) return alert("Informe a data da conferência.");
    const linhas = itens.map((item, indice) => {
      const idItem = obterIdItemPatrimonio(item);
      return {
        item,
        indice,
        idItem,
        numero: normalizarNumeroPatrimonio(edicoes[idItem]),
        atual: obterPatrimonioAtual(item, registros),
        configuracao: configuracoes[idItem] || {},
      };
    });
    for (const linha of linhas) {
      if (!linha.idItem) {
        return alert(`Equipamento ${linha.indice + 1}: unidade sem identidade estável.`);
      }
      if (linha.numero && !validarNumeroPatrimonio(linha.numero)) {
        return alert(`Equipamento ${linha.indice + 1}: o patrimônio deve conter somente números.`);
      }
      if (linha.atual && linha.numero !== linha.atual) {
        return alert(`Equipamento ${linha.indice + 1}: use “Trocar patrimônio” para substituir o número ${linha.atual}.`);
      }
      if (
        linha.configuracao.tamanho &&
        !["1", "1.5", "2", "3", "4", "5", "6"].includes(
          String(linha.configuracao.tamanho)
        )
      ) {
        return alert(`Equipamento ${linha.indice + 1}: tamanho inválido.`);
      }
      if (
        linha.item.equipamento === "Mini Grua" &&
        linha.configuracao.tipoMiniGrua &&
        !["500kg", "1T"].includes(linha.configuracao.tipoMiniGrua)
      ) {
        return alert(`Equipamento ${linha.indice + 1}: tipo de Mini Grua inválido.`);
      }
    }
    const preenchidos = linhas.filter(({ numero }) => numero);
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
    salvamentoConferenciaEmAndamento.current = true;
    setSalvando(true);
    try {
      let atualizados = registros;
      preenchidos
        .filter(({ atual }) => !atual)
        .forEach(({ item, numero }) => {
          atualizados = registrarCadastroInicialPatrimonio({
            registros: atualizados,
            item,
            numeroNovo: numero,
            data: dataConferencia,
            obraId: contexto.obra?.id || "",
          });
        });
      const novosAjustes = linhas.map(({ item, configuracao }) =>
        criarAjusteConfiguracao({
          item,
          obraId: contexto.obra?.id || "",
          data: dataConferencia,
          tamanho: item.equipamento === "Balancinho" ? configuracao.tamanho : "",
          ancoragem: item.equipamento === "Balancinho" ? configuracao.ancoragem : "",
          usaContrapeso:
            item.equipamento !== "Balancinho" ||
            configuracao.usaContrapeso === "nao_conferido"
              ? null
              : configuracao.usaContrapeso === "sim",
          observacao: configuracao.observacaoEditada
            ? configuracao.observacao
            : configuracao.observacao || observacaoGeral,
        })
      );
      const ajustesAtualizados = [
        ...obterAjustesConfiguracaoEquipamentos(),
        ...novosAjustes,
      ];
      salvarRegistrosPatrimonio(atualizados);
      salvarAjustesConfiguracaoEquipamentos(ajustesAtualizados);
      const mestresSincronizados = sincronizarPatrimoniosMestres(
        obterEquipamentosPatrimonio(),
        atualizados
      ).map((mestre) => {
        const linha = linhas.find(
          ({ item, idItem }) =>
            item.equipamento === "Mini Grua" &&
            (String(item.idEquipamento || "") === String(mestre.idEquipamento || "") ||
              String(idItem) === String(mestre.idItemOrigem || ""))
        );
        return linha?.configuracao.tipoMiniGrua
          ? { ...mestre, tipoMiniGrua: linha.configuracao.tipoMiniGrua }
          : mestre;
      });
      salvarEquipamentosPatrimonio(mestresSincronizados);
      onRegistrosAlterados(atualizados);
      alert("Conferência cadastral salva com sucesso.");
    } finally {
      salvamentoConferenciaEmAndamento.current = false;
      setSalvando(false);
    }
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
              {contexto?.modo === "consulta" ? "Consultar patrimônio" : contexto?.fluxoIndividual ? "Conferir equipamento" : "Atualizar patrimônios"}
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
            <div className="sticky top-0 z-10 mt-4 space-y-3 rounded-xl border bg-white p-3 shadow-sm">
              <p className="font-semibold text-blue-900">
                Equipamentos conferidos: {itens.filter((item) => !itemEstaPendente(item)).length} de {itens.length}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  Data da conferência
                  <input type="date" value={dataConferencia} onChange={(e) => setDataConferencia(e.target.value)} className="mt-1 w-full rounded border p-3" />
                </label>
                <label className="text-sm font-medium">
                  Observação geral
                  <input value={observacaoGeral} onChange={(e) => setObservacaoGeral(e.target.value)} className="mt-1 w-full rounded border p-3" />
                </label>
              </div>
            </div>
            {!contexto?.fluxoIndividual && <div className="mt-4 flex flex-wrap gap-2">
              {[["sem", "Pendentes de conferência"], ["todos", "Todos"]].map(([valor, rotulo]) => (
                <button key={valor} type="button" onClick={() => setFiltro(valor)} className={`rounded-full border px-3 py-1 text-sm ${filtro === valor ? "bg-blue-600 text-white" : "bg-white"}`}>{rotulo}</button>
              ))}
            </div>}
            <div className="mt-3 space-y-2">
              {itensVisiveis.length === 0 ? (
                <p className="rounded border bg-gray-50 p-3 text-sm text-gray-500">Nenhum equipamento neste filtro.</p>
              ) : itensVisiveis.map((item, indice) => {
                const idItem = obterIdItemPatrimonio(item);
                const atual = obterPatrimonioAtual(item, registros);
                const configuracao = configuracoes[idItem] || {};
                const atualizarConfiguracao = (campo, valor) =>
                  setConfiguracoes((anteriores) => ({
                    ...anteriores,
                    [idItem]: { ...anteriores[idItem], [campo]: valor },
                  }));
                return (
                  <div key={idItem || indice} className="space-y-3 rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="font-semibold">{descricaoItem(item)}</p><p className="text-xs text-gray-500">Unidade {itens.indexOf(item) + 1} • {item.tipoBalancinho || item.tipoMiniGrua || item.equipamento}</p></div>
                      {itemEstaPendente(item) && <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Dados pendentes</span>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium">
                        Patrimônio
                        <input inputMode="numeric" value={edicoes[idItem] || ""} readOnly={Boolean(atual)} onChange={(e) => setEdicoes({ ...edicoes, [idItem]: e.target.value })} placeholder="Número do patrimônio" className={`mt-1 w-full rounded border p-3 font-mono text-lg font-bold ${atual ? "bg-gray-50" : "bg-white"}`} />
                      </label>
                      {item.equipamento === "Mini Grua" && (
                        <label className="text-sm font-medium">Tipo
                          <select value={configuracao.tipoMiniGrua || ""} onChange={(e) => atualizarConfiguracao("tipoMiniGrua", e.target.value)} className="mt-1 w-full rounded border bg-white p-3"><option value="">Não informado</option><option value="500kg">500 kg</option><option value="1T">1 T</option></select>
                        </label>
                      )}
                      {item.equipamento === "Balancinho" && (
                        <>
                          <label className="text-sm font-medium">Tamanho atual
                            <select value={configuracao.tamanho || ""} onChange={(e) => atualizarConfiguracao("tamanho", e.target.value)} className="mt-1 w-full rounded border bg-white p-3">
                              <option value="">Não informado</option>
                              {[1, 1.5, 2, 3, 4, 5, 6].map((valor) => <option key={valor} value={valor}>{valor} m</option>)}
                            </select>
                          </label>
                          <label className="text-sm font-medium">Ancoragem atual
                            <select value={configuracao.ancoragem || ""} onChange={(e) => atualizarConfiguracao("ancoragem", e.target.value)} className="mt-1 w-full rounded border bg-white p-3">
                              <option value="">Não informada</option><option>Andaime Simples</option><option>Andaime Duplo</option><option>Afastador</option>
                            </select>
                          </label>
                          <label className="text-sm font-medium sm:col-span-2">Usa Kit Contrapeso atualmente?
                            <select value={configuracao.usaContrapeso || "nao_conferido"} onChange={(e) => atualizarConfiguracao("usaContrapeso", e.target.value)} className="mt-1 w-full rounded border bg-white p-3">
                              <option value="nao_conferido">Não conferido</option><option value="sim">Sim</option><option value="nao">Não</option>
                            </select>
                          </label>
                        </>
                      )}
                      <label className="text-sm font-medium sm:col-span-2">Observação
                        <textarea value={configuracao.observacao || ""} onChange={(e) => setConfiguracoes((anteriores) => ({ ...anteriores, [idItem]: { ...anteriores[idItem], observacao: e.target.value, observacaoEditada: true } }))} placeholder="Opcional" className="mt-1 min-h-[88px] w-full rounded border p-3" />
                      </label>
                    </div>
                    {atual && <button type="button" onClick={() => abrirEscolhaTroca(item)} className="rounded border px-3 py-2 text-sm text-blue-700">Trocar patrimônio</button>}
                  </div>
                );
              })}
            </div>
            <button type="button" disabled={salvando || itens.length === 0} onClick={salvarCadastros} className="mt-4 w-full rounded bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{salvando ? "Salvando..." : contexto?.fluxoIndividual ? "Salvar Conferência" : "Salvar conferência da obra"}</button>
            {contexto?.fluxoIndividual && navegacaoConferencia && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={!navegacaoConferencia.temAnterior || salvando} onClick={navegacaoConferencia.anterior} className="flex items-center justify-center rounded border px-3 py-3 text-sm font-semibold text-blue-700 disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Equipamento anterior</button><button type="button" disabled={!navegacaoConferencia.temProximo || salvando} onClick={navegacaoConferencia.proximo} className="flex items-center justify-center rounded border px-3 py-3 text-sm font-semibold text-blue-700 disabled:opacity-40">Próximo equipamento<ChevronRight className="h-4 w-4" /></button></div>}
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
