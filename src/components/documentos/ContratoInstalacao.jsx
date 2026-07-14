import { converterMoedaParaNumero } from "../../utils/moeda";
import { formatarValorContrato, limparTextoContrato, valorMonetarioPorExtenso } from "../../utils/contrato";
import "./contrato.css";

const meses = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const formatarDataLonga = (valor) => {
  if (!valor) return "";
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-");
  if (!ano || !mes || !dia) return "";
  return `${Number(dia)} de ${meses[Number(mes) - 1]} de ${ano}`;
};

const obterTextoDataPrevista = (valor) => {
  const data = formatarDataLonga(valor);
  return data
    ? `Contrato com início no primeiro dia de funcionamento dos equipamentos, previsto para o dia ${data}.`
    : "Data prevista de início a definir.";
};

const numeroComZero = (valor) => String(Number(valor || 1)).padStart(2, "0");

const obterPatrimonios = (atividade) =>
  (atividade?.numerosPatrimonio || [])
    .map((numero) => String(numero || "").trim())
    .filter(Boolean);

const obterDescricaoEquipamento = (atividade) => {
  const quantidade = Number(atividade?.quantidade) || 1;
  const unidade = quantidade === 1 ? "UNIDADE" : "UNIDADES";

  if (atividade?.equipamento === "Balancinho") {
    const tipo = atividade?.tipoBalancinho === "Manual" ? "MANUAL" : "ELÉTRICO";
    return `${numeroComZero(quantidade)} ${unidade} DE BALANCIM ${tipo}`;
  }

  if (atividade?.equipamento === "Mini Grua") {
    const tipo = atividade?.tipoMiniGrua === "1T" ? "1 T" : "500 KG";
    return `${numeroComZero(quantidade)} ${unidade} DE MINI GRUA ${tipo}`;
  }

  return `${numeroComZero(quantidade)} ${unidade} DE ${String(atividade?.equipamento || "EQUIPAMENTO").toUpperCase()}`;
};

const valorComExtenso = (valor) => {
  if (valor === null || valor === undefined) return "Valor a definir";
  return `${formatarValorContrato(valor)} (${valorMonetarioPorExtenso(valor)})`;
};

const valorOuIsento = (valor) => {
  const numero = converterMoedaParaNumero(valor) ?? 0;
  return numero > 0 ? valorComExtenso(numero) : "Isento";
};

const LinhaClausula = ({ children, tipo = "paragrafo" }) => (
  <p className={`contrato-${tipo}`}>{children}</p>
);

const TituloClausula = ({ children }) => (
  <h3 className="contrato-clausula-titulo">{children}</h3>
);

const CabecalhoPagina = ({ pagina }) => (
  <header className="contrato-cabecalho">
    <div className="contrato-detalhe-azul" />
    <div className="contrato-timbrado">
      <div className="contrato-empresa">CD Locações Ltda</div>
      <div className="contrato-dados-empresa">
        CNPJ: 11.381.064/0001-04 | Avenida Sete de Setembro, nº 773 | Costa Carvalho | Juiz de Fora - MG
      </div>
    </div>
    <div className="contrato-numero-pagina">Página {pagina}/3</div>
  </header>
);

const RodapePagina = () => (
  <footer className="contrato-rodape">
    CD LOCAÇÕES LTDA | CNPJ: 11.381.064/0001-04 | Avenida Sete de Setembro, nº 773, Costa Carvalho, Juiz de Fora - MG, CEP 36.070-000
    <br />
    E-mail: locacoescd@gmail.com | Contato: (32) 99860-9001
  </footer>
);

const PaginaContrato = ({ children, pageRefs, indice }) => (
  <section
    ref={(elemento) => {
      pageRefs.current[indice] = elemento;
    }}
    className="contrato-pagina"
  >
    <CabecalhoPagina pagina={indice + 1} />
    <main className="contrato-conteudo">{children}</main>
    <RodapePagina />
  </section>
);

export default function ContratoInstalacao({ atividade, campos, dadosContrato, valoresContrato, pageRefs }) {
  const patrimonios = obterPatrimonios(atividade);
  const descricaoEquipamento = obterDescricaoEquipamento(atividade);
  const usoEquipamento =
    atividade?.equipamento === "Mini Grua"
      ? "MOVIMENTAÇÃO E ELEVAÇÃO DE CARGAS"
      : "ELEVAÇÃO DE PESSOAS E CARGAS LEVES";
  const frete = valorOuIsento(campos.frete);
  const valorReferencia = converterMoedaParaNumero(campos.valorReferenciaEquipamento) ?? 30000;
  const locataria = dadosContrato.razaoSocial || "LOCATÁRIA";
  const cnpjLocataria = dadosContrato.cnpj;
  const enderecoLocataria = dadosContrato.enderecoConstrutora;

  return (
    <>
      <PaginaContrato pageRefs={pageRefs} indice={0}>
        <h1 className="contrato-titulo">
          CONTRATO DE LOCAÇÃO - Nº {campos.numeroContrato || "2026/____"}
        </h1>

        <LinhaClausula>
          <strong>CD LOCAÇÕES LTDA</strong>, CNPJ nº <strong>11.381.064/0001-04</strong>, com sede na Avenida Sete de Setembro, nº 773,
          Bairro Costa Carvalho, Juiz de Fora - MG, CEP: 36.070-000, doravante denominado <strong>LOCADOR</strong>, e{" "}
          <strong>{locataria}</strong>{cnpjLocataria ? `, CNPJ nº ${cnpjLocataria}` : ""}{enderecoLocataria ? `, com endereço em ${enderecoLocataria}` : ""}, doravante denominada{" "}
          <strong>LOCATÁRIA</strong>, têm justo e contratado entre si a locação do equipamento abaixo discriminado, mediante as cláusulas e condições estipuladas a seguir.
        </LinhaClausula>

        <TituloClausula>1 - Objeto do Contrato</TituloClausula>
        <LinhaClausula>
          Pelo presente instrumento o LOCADOR aluga à LOCATÁRIA o(s) equipamento(s) abaixo discriminado(s), e se obriga a locá-lo nas condições estabelecidas neste contrato:
        </LinhaClausula>
        <LinhaClausula tipo="equipamento">
          - {descricaoEquipamento}{campos.marca ? `; MARCA ${String(campos.marca).toUpperCase()}` : ""}{campos.modelo ? `; MODELO ${String(campos.modelo).toUpperCase()}` : ""};
        </LinhaClausula>
        {patrimonios.length > 0 && (
          <LinhaClausula tipo="patrimonio">
            <strong>PATRIMÔNIOS:</strong> {patrimonios.join(", ")}.
          </LinhaClausula>
        )}
        <LinhaClausula>
          O(s) equipamento(s) ora locado(s) estão sendo entregues em perfeitas condições de uso e serão instalados pelo próprio LOCADOR para que a LOCATÁRIA possa exercer suas funções de {usoEquipamento}.
        </LinhaClausula>
        <LinhaClausula>
          Os equipamentos serão entregues e instalados pelo LOCADOR em {campos.enderecoEntrega || "endereço de entrega a definir"}.
        </LinhaClausula>

        <TituloClausula>2 - Valor do Contrato</TituloClausula>
        <LinhaClausula tipo="item">
          2.1 - Aluguel mensal: {valorComExtenso(valoresContrato.aluguel)}/unidade. {obterTextoDataPrevista(campos.dataPrevista)}
        </LinhaClausula>
        <LinhaClausula>
          O pagamento mensal será feito através de boleto bancário todo dia 10 de cada mês, sempre referente aos serviços prestados no mês anterior e caso haja atraso será cobrada multa de 2% (dois por cento) ao mês mais juros na base de 0,33% ao dia.
        </LinhaClausula>
      </PaginaContrato>

      <PaginaContrato pageRefs={pageRefs} indice={1}>
        <TituloClausula>2 - Valor do Contrato (continuação)</TituloClausula>
        <LinhaClausula tipo="item">2.2 - Montagem/instalação por unidade: {valorComExtenso(valoresContrato.instalacao)}.</LinhaClausula>
        <LinhaClausula tipo="item">2.3 - Desmontagem/remoção por unidade: {valorComExtenso(valoresContrato.remocao)}.</LinhaClausula>
        <LinhaClausula tipo="item">2.4 - Deslocamento por unidade: {valorComExtenso(valoresContrato.deslocamento)}.</LinhaClausula>
        <LinhaClausula tipo="item">2.5 - Taxa de Entrega: {frete}.</LinhaClausula>

        <TituloClausula>3 - Manutenção, Assistência Técnica e Seguro</TituloClausula>
        <LinhaClausula tipo="item">3.1 - A manutenção do equipamento objeto do presente contrato é de responsabilidade do LOCADOR.</LinhaClausula>
        <LinhaClausula tipo="item">3.2 - Cabe à LOCATÁRIA manter a integridade do equipamento alugado. Em caso de dano por mau uso, será cobrado o valor do conserto e/ou dano e, caso não possa ser consertado ou não compense o conserto, deverá a LOCATÁRIA indenizar o LOCADOR no valor constante da cláusula 7 no prazo de 30 (trinta) dias da ocorrência do dano.</LinhaClausula>
        <LinhaClausula tipo="item">3.3 - Cabe à LOCATÁRIA também deixar um ponto elétrico com 220v e emitir um Laudo de Aterramento emitido por um Engenheiro Eletricista.</LinhaClausula>
        <LinhaClausula tipo="item">3.4 - Cabe ao LOCADOR entregar o equipamento em perfeitas condições de uso e providenciar a emissão da ART para utilização do equipamento.</LinhaClausula>
        <LinhaClausula tipo="item">3.5 - Todas as benfeitorias e/ou modificações deverão ser solicitadas com 3 (três) dias úteis de antecedência e deverá a LOCATÁRIA estar em dia com todas as suas obrigações contratuais para serem executadas.</LinhaClausula>
        <LinhaClausula tipo="item">3.6 - O equipamento objeto deste contrato deverá ser utilizado exclusivamente no endereço indicado no objeto do presente contrato, sendo expressamente proibido o seu deslocamento, transferência, cessão, sublocação ou utilização em endereço diverso sem autorização prévia, expressa e por escrito do LOCADOR.</LinhaClausula>

        <TituloClausula>4 - Prazo de Vigência do Contrato</TituloClausula>
        <LinhaClausula>O presente contrato é estabelecido por prazo indeterminado.</LinhaClausula>
      </PaginaContrato>

      <PaginaContrato pageRefs={pageRefs} indice={2}>
        <TituloClausula>5 - Rescisão</TituloClausula>
        <LinhaClausula>Qualquer uma das partes poderá rescindir o presente contrato sem multa.</LinhaClausula>

        <TituloClausula>6 - Multa</TituloClausula>
        <LinhaClausula>A parte que descumprir quaisquer das cláusulas deste contrato fica sujeita a uma multa de valor equivalente ao de um mês de locação.</LinhaClausula>

        <TituloClausula>7 - Valor do Equipamento</TituloClausula>
        <LinhaClausula>Para os devidos fins de direito fica consignado o valor de referência de {valorComExtenso(valorReferencia)}/unidade.</LinhaClausula>
        <LinhaClausula>Fica eleito o Foro da cidade Juiz de Fora - MG, único competente, com renúncia a qualquer outro por mais privilegiado que seja, para dirimir as questões que surgirem na execução do presente contrato.</LinhaClausula>
        <LinhaClausula>E por estarem justos e contratados assinam o presente contrato em 2 (duas) vias de igual teor e forma, para os mesmos efeitos, com as testemunhas a seguir:</LinhaClausula>

        <p className="contrato-data">Juiz de Fora, {formatarDataLonga(campos.dataContrato)}.</p>

        <div className="contrato-assinaturas">
          <div>
            <div className="contrato-assinatura-linha">CD LOCAÇÕES LTDA</div>
            <div className="contrato-assinatura-cnpj">CNPJ: 11.381.064/0001-04</div>
          </div>
          <div>
            <div className="contrato-assinatura-linha">{limparTextoContrato(locataria) || "LOCATÁRIA"}</div>
            <div className="contrato-assinatura-cnpj">{cnpjLocataria ? `CNPJ: ${cnpjLocataria}` : "CNPJ:"}</div>
          </div>
        </div>
      </PaginaContrato>
    </>
  );
}
