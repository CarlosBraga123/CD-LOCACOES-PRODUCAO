import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { QRCodeCanvas } from "qrcode.react";
import { normalizarTexto, obterObraDaAtividade } from "../utils/obras";
import {
  formatarDataOrdemServico,
  formatarEquipamentoOrdemServico,
  montarDescricaoOrdemServico,
  montarPayloadOrdemServico,
  obterStatusOrdemServico,
} from "../utils/ordemServico";

const servicosOS = [
  "Instalação",
  "Deslocamento",
  "Manutenção",
  "Remoção",
  "Ascensão",
  "Somente aluguel",
  "Somente recolhimento",
  "Outros serviços",
];

const obterPrimeiroCampo = (objeto, campos) => {
  for (const campo of campos) {
    if (objeto?.[campo]) return objeto[campo];
  }
  return "";
};

const normalizarServicoOS = (valor) =>
  normalizarTexto(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const formatarTamanhoDeslocamento = (valor) => {
  const texto = String(valor ?? "").trim();
  if (!texto) return "-";
  return /\bm\b/i.test(texto) ? texto : `${texto} m`;
};

const obterNumerosPatrimonioValidos = (atividade) =>
  (atividade?.numerosPatrimonio || [])
    .map((numero) => String(numero || "").trim())
    .filter(Boolean);

const icones = {
  Construtora: "▦",
  Obra: "▥",
  Endereço: "⌖",
  Responsável: "●",
  Telefone: "☎",
  "E-mail": "✉",
  "CPF/CNPJ": "▣",
  Equipamento: "⚒",
  Quantidade: "▥",
  Tamanho: "◆",
  Contrapeso: "▰",
  Ancoragem: "⚓",
  Capacidade: "▣",
  "Tipo específico": "▤",
};

const aguardarDoisFrames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const aguardarDecodeImagem = async (img) => {
  if (!img.decode) return;

  try {
    await img.decode();
  } catch {
    if (!img.complete || img.naturalWidth === 0) {
      throw new Error(`Imagem indisponivel para o PDF: ${img.getAttribute("src") || img.src}`);
    }
  }
};

const aguardarImagem = async (img) => {
  const origem = img.getAttribute("src") || img.src;

  if (img.complete && img.naturalWidth > 0) {
    await aguardarDecodeImagem(img);
    return;
  }

  if (img.complete && img.naturalWidth === 0) {
    throw new Error(`Imagem indisponivel para o PDF: ${origem}`);
  }

  await new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      limparEventos();
      reject(new Error(`Tempo esgotado ao carregar imagem para o PDF: ${origem}`));
    }, 8000);

    const limparEventos = () => {
      window.clearTimeout(timeout);
      img.removeEventListener("load", concluir);
      img.removeEventListener("error", falhar);
    };

    const concluir = () => {
      limparEventos();
      if (img.naturalWidth > 0) {
        resolve();
        return;
      }
      reject(new Error(`Imagem carregada sem conteudo para o PDF: ${origem}`));
    };

    const falhar = () => {
      limparEventos();
      reject(new Error(`Falha ao carregar imagem para o PDF: ${origem}`));
    };

    img.addEventListener("load", concluir, { once: true });
    img.addEventListener("error", falhar, { once: true });
  });

  await aguardarDecodeImagem(img);
};

const aguardarImagens = async (container) => {
  const imagens = Array.from(container.querySelectorAll("img"));
  await Promise.all(imagens.map(aguardarImagem));
};

const aguardarRenderizacao = async (elemento) => {
  await document.fonts?.ready;
  await aguardarImagens(elemento);
  await aguardarDoisFrames();
};

const capturarElemento = async (elemento) => {
  await aguardarRenderizacao(elemento);
  const canvas = await html2canvas(elemento, {
    scale: 2.5,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
  });
  return {
    altura: canvas.height,
    imagem: canvas.toDataURL("image/png"),
    largura: canvas.width,
  };
};

const adicionarImagemCentralizada = (pdf, captura, area) => {
  const escala = Math.min(area.largura / captura.largura, area.altura / captura.altura);
  const largura = captura.largura * escala;
  const altura = captura.altura * escala;
  const x = area.x + (area.largura - largura) / 2;
  const y = area.y + (area.altura - altura) / 2;

  pdf.addImage(captura.imagem, "PNG", x, y, largura, altura);
};

const estilosCapturaPdf = `
  .os-captura-pdf .os-codigo-os-texto {
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    padding-bottom: 0;
    padding-top: 0;
  }

  .os-captura-pdf .os-data-status-conteudo {
    display: flex;
    flex-direction: column;
    justify-content: center;
    line-height: 1.05;
    padding-bottom: 0;
    padding-top: 0;
  }

  .os-captura-pdf .os-data-status-conteudo br {
    display: none;
  }

  .os-captura-pdf .os-titulo-bloco-texto {
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    padding-bottom: 0;
    padding-top: 0;
  }
`;

const TituloBloco = ({ children, compacto }) => (
  <div
    className={`absolute -top-[1px] left-3 rounded-b-sm bg-black font-bold uppercase tracking-wide text-white ${
      compacto ? "px-2 py-[1px] text-[7.5px]" : "px-3 py-0.5 text-[9px]"
    }`}
  >
    <span className="os-titulo-bloco-texto">{children}</span>
  </div>
);

const BlocoOS = ({ titulo, compacto, children, className = "" }) => (
  <section
    className={`relative rounded border border-black bg-white ${
      compacto ? "mt-1.5 px-2.5 pb-1.5 pt-3" : "mt-3 px-3 pb-2.5 pt-4"
    } ${className}`}
  >
    <TituloBloco compacto={compacto}>{titulo}</TituloBloco>
    {children}
  </section>
);

const InfoItem = ({ label, valor, compacto }) => (
  <div className={`flex items-center ${compacto ? "gap-1" : "gap-2"}`}>
    <span className={`shrink-0 text-center ${compacto ? "w-3.5 text-[9px]" : "w-4 text-[12px]"}`}>
      {icones[label] || "▪"}
    </span>
    <span className="flex min-w-0 flex-col justify-center leading-[1.15]">
      <span className={`block font-bold uppercase ${compacto ? "text-[6.2px]" : "text-[7px]"}`}>{label}</span>
      <span className="break-words font-bold">{valor}</span>
    </span>
  </div>
);

const InfoGrid = ({ itens, compacto }) => (
  <div className={`grid grid-cols-2 ${compacto ? "gap-x-3 gap-y-1.5" : "gap-x-5 gap-y-2"}`}>
    {itens.map(([label, valor]) => (
      <InfoItem key={label} label={label} valor={valor} compacto={compacto} />
    ))}
  </div>
);

const IlustracaoEquipamento = ({ equipamento, compacto }) => (
  <div
    className={`flex items-center justify-center border border-black bg-white ${
      compacto ? "h-16 p-1" : "h-24 p-2"
    }`}
  >
    {(equipamento === "Mini Grua" || equipamento === "Balancinho") && (
      <img
        src={equipamento === "Mini Grua" ? "/os/OS_MINIGRUA_PB.png" : "/os/OS_BALANCINHO_PB.png"}
        alt={equipamento === "Mini Grua" ? "Mini Grua" : "Balancinho"}
        className="h-full w-full object-contain"
      />
    )}
  </div>
);

const AssinaturaCD = ({ assinaturaTipo, assinaturaManual, compacto }) => (
  <div className={`${compacto ? "h-9" : "h-12"} flex items-center justify-center leading-[1.15]`}>
    {assinaturaTipo === "fixa" && (
      <span className={`${compacto ? "text-xl" : "text-2xl"} font-serif italic`}>CD Locações</span>
    )}
    {assinaturaTipo === "manual" && assinaturaManual && (
      <img src={assinaturaManual} alt="Assinatura manual" className="mx-auto h-full object-contain" />
    )}
  </div>
);

const CampoAssinatura = ({ titulo, children, compacto }) => (
  <div className={`rounded border border-black text-center leading-[1.15] ${compacto ? "px-2 py-1" : "px-3 py-2"}`}>
    <div className={`flex items-center justify-center font-bold uppercase ${compacto ? "text-[7px]" : "text-[9px]"}`}>{titulo}</div>
    <div className={`${compacto ? "mt-1" : "mt-2"} flex items-center justify-center`}>{children}</div>
    <div className={compacto ? "mt-1 flex items-center justify-center border-t border-black pt-0.5 text-[6px]" : "mt-2 flex items-center justify-center border-t border-black pt-1 text-[8px]"}>
      Assinatura legível e carimbo
    </div>
  </div>
);

const ViaOrdemServico = ({
  atividade,
  dadosObra,
  dadosEquipamento,
  descricao,
  observacoesOS,
  payloadOffline,
  qrDataUrl,
  assinaturaTipo,
  assinaturaManual,
  status,
  viaTitulo,
  compacto = false,
}) => {
  const qrSize = compacto ? 88 : 112;
  const numeroOS = atividade.numeroOS || "";

  return (
    <article
      className={`box-border bg-white text-black [&_*]:box-border ${
        compacto ? "h-[142mm] p-[4mm] text-[9.2px]" : "min-h-[282mm] p-[10mm] text-xs"
      }`}
    >
      {viaTitulo && <p className="mb-1 text-center text-[10px] font-bold">{viaTitulo}</p>}

      <header
        className={`grid rounded border border-black ${
          compacto ? "grid-cols-[86px_1fr_106px] gap-2 p-1.5" : "grid-cols-[120px_1fr_138px] gap-4 p-3"
        }`}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div
            className={`flex items-center justify-center rounded border border-black p-1 ${
              compacto ? "h-16 w-[84px]" : "h-24 w-[116px]"
            }`}
          >
            <img
              src="/os/LOGO_CD_LOCACOES.png"
              alt="CD Locações"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center text-center leading-tight">
          <h1 className={`${compacto ? "text-xl" : "text-3xl"} font-extrabold tracking-tight`}>ORDEM DE SERVIÇO</h1>
          <p className={`${compacto ? "mx-auto mt-1 w-fit rounded bg-black px-4 py-0.5 text-[11px] text-white" : "mx-auto mt-3 w-fit rounded bg-black px-5 py-1 text-sm text-white"}`}>
            <span className="os-codigo-os-texto">OS: <strong>{numeroOS}</strong></span>
          </p>
          <div className={`${compacto ? "mx-auto mt-1 grid max-w-[190px] grid-cols-2 gap-1 text-[8px]" : "mx-auto mt-2 grid max-w-[260px] grid-cols-2 gap-2 text-xs"}`}>
            <div className="flex flex-col justify-center rounded border border-black px-1 py-[2px] text-left leading-[1.15]">
              <span className="os-data-status-conteudo">
                <strong>DATA:</strong><br />{formatarDataOrdemServico(new Date().toISOString().slice(0, 10))}
              </span>
            </div>
            <div className="flex flex-col justify-center rounded border border-black px-1 py-[2px] text-left leading-[1.15]">
              <span className="os-data-status-conteudo">
                <strong>STATUS:</strong><br />{status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center text-center leading-tight">
          <div className="flex items-center justify-center border border-black bg-white p-1">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code da Ordem de Serviço"
                className="block bg-white object-contain"
                style={{ width: `${qrSize}px`, height: `${qrSize}px` }}
              />
            ) : (
              <div className="bg-white" style={{ width: `${qrSize}px`, height: `${qrSize}px` }} />
            )}
          </div>
          <p className={`${compacto ? "mt-1 text-[7px]" : "mt-1 text-[9px]"} leading-tight`}>
            Escaneie para visualizar os dados desta Ordem de Serviço
          </p>
        </div>
      </header>

      <BlocoOS titulo="Dados da obra" compacto={compacto}>
        <div>
          <InfoGrid itens={dadosObra} compacto={compacto} />
        </div>
      </BlocoOS>

      <BlocoOS titulo="Equipamento" compacto={compacto}>
        <div className={`grid ${compacto ? "grid-cols-[118px_1fr] gap-2.5" : "grid-cols-[230px_1fr] gap-4"}`}>
          <IlustracaoEquipamento equipamento={atividade.equipamento} compacto={compacto} />
          <InfoGrid itens={dadosEquipamento} compacto={compacto} />
        </div>
      </BlocoOS>

      <BlocoOS titulo="Tipo de serviço" compacto={compacto}>
        <div className={`grid ${compacto ? "grid-cols-4 gap-0.5" : "grid-cols-3 gap-x-8 gap-y-1"}`}>
          {servicosOS.map((servico) => (
            <span key={servico} className="flex items-center font-semibold leading-[1.15]">[{atividade.servico === servico ? "x" : " "}] {servico}</span>
          ))}
        </div>
      </BlocoOS>

      <div className={`grid ${compacto ? "grid-cols-[1.2fr_1fr_0.75fr] gap-2" : "grid-cols-[1.1fr_1fr_0.75fr] gap-3"}`}>
        <BlocoOS titulo="Descrição dos serviços" compacto={compacto}>
          <p className={`${compacto ? "min-h-[28px] py-[2px]" : "min-h-[58px] py-[5px]"} whitespace-pre-wrap font-semibold leading-[1.15]`}>
            {descricao}
          </p>
        </BlocoOS>

        <BlocoOS titulo="Observações" compacto={compacto}>
          <p className={`${compacto ? "min-h-[28px] py-[2px]" : "min-h-[58px] py-[5px]"} whitespace-pre-wrap font-semibold leading-[1.15]`}>
            {observacoesOS || " "}
          </p>
        </BlocoOS>

        <BlocoOS titulo="Equipe responsável" compacto={compacto}>
          <p className={`${compacto ? "flex min-h-[28px] items-center py-[2px]" : "flex min-h-[58px] items-center py-[5px]"} font-semibold leading-[1.15]`}>
            {atividade.equipeResponsavel || "Equipe CD Locações"}
          </p>
        </BlocoOS>
      </div>

      <section className={`${compacto ? "mt-2" : "mt-3"} grid grid-cols-2 gap-3`}>
        <CampoAssinatura titulo="Responsável da obra / cliente" compacto={compacto}>
          <div className={compacto ? "h-9" : "h-12"} />
        </CampoAssinatura>
        <CampoAssinatura titulo="CD Locações" compacto={compacto}>
          <AssinaturaCD assinaturaTipo={assinaturaTipo} assinaturaManual={assinaturaManual} compacto={compacto} />
        </CampoAssinatura>
      </section>

      <footer className={`${compacto ? "mt-2 text-[6.5px]" : "mt-3 text-[10px]"} flex items-center justify-center gap-3 border-t border-black pt-1 font-semibold`}>
        <span>☎ (32) 99860-9001</span>
        <span>|</span>
        <span>✉ locacoescd@gmail.com</span>
        <span>|</span>
        <span>⌖ Avenida Sete de Setembro, 773 - Costa Carvalho - Juiz de Fora - MG - CEP: 36070-000</span>
      </footer>
    </article>
  );
};

export default function OrdemServico({ atividade, obras, construtoras, onClose }) {
  // Fluxos: previewRef exibe a tela; pdfUmaViaRef alimenta PDF 1 via e WhatsApp; pdfPrimeiraViaRef/pdfSegundaViaRef alimentam PDF 2 vias.
  // O PDF captura duplicacoes compactas de ViaOrdemServico renderizadas fora da tela, sem clone manual nem prop paraPdf/modoImpressao.
  // O WhatsApp chama gerarPdf(1, false), portanto nao recebe a classe temporaria os-captura-pdf.
  const previewRef = useRef(null);
  const pdfUmaViaRef = useRef(null);
  const pdfPrimeiraViaRef = useRef(null);
  const pdfSegundaViaRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const assinaturaCanvasRef = useRef(null);
  const [assinaturaTipo, setAssinaturaTipo] = useState("fixa");
  const [assinaturaManual, setAssinaturaManual] = useState("");
  const [assinando, setAssinando] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const obra = useMemo(() => obterObraDaAtividade(atividade, obras), [atividade, obras]);
  const numeroOS = atividade.numeroOS || "";
  const construtora = useMemo(() => {
    const nome = obra?.construtora || atividade?.construtora;
    return construtoras.find((item) => item.nome === nome) || {};
  }, [atividade, construtoras, obra]);

  const descricaoInicial = useMemo(
    () => montarDescricaoOrdemServico(atividade, obra),
    [atividade, obra]
  );
  const [descricao, setDescricao] = useState(descricaoInicial);
  const [observacoesOS, setObservacoesOS] = useState(atividade?.observacoes || "");

  const status = obterStatusOrdemServico(atividade);
  const equipamento = formatarEquipamentoOrdemServico(atividade);
  const payloadOffline = montarPayloadOrdemServico({ atividade, obra, construtora });
  const isDeslocamento = normalizarServicoOS(atividade?.servico) === "deslocamento";
  const numerosPatrimonioValidos = obterNumerosPatrimonioValidos(atividade);

  useEffect(() => {
    setQrDataUrl("");
    const timer = setTimeout(() => {
      const canvas = qrCanvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL("image/png");
      const img = new Image();
      img.onload = () => setQrDataUrl(dataUrl);
      img.onerror = () => setQrDataUrl(dataUrl);
      img.src = dataUrl;
    }, 50);

    return () => clearTimeout(timer);
  }, [payloadOffline]);

  const dadosObra = [
    ["Construtora", construtora.nome || obra?.construtora || atividade?.construtora],
    ["Obra", obra?.nome || atividade?.obra],
    ["Endereço", obterPrimeiroCampo(obra, ["endereco", "endereço", "localizacao", "localização"])],
    ["Responsável", obterPrimeiroCampo(obra, ["responsavel", "responsável", "responsavelObra"])],
    ["Telefone", obterPrimeiroCampo(obra, ["telefone", "celular"]) || obterPrimeiroCampo(construtora, ["telefone", "celular"])],
    ["E-mail", obterPrimeiroCampo(obra, ["email", "e-mail"]) || obterPrimeiroCampo(construtora, ["email", "e-mail"])],
    ["CPF/CNPJ", obterPrimeiroCampo(obra, ["cpfCnpj", "cpf/cnpj", "cnpj", "cpf"]) || obterPrimeiroCampo(construtora, ["cpfCnpj", "cpf/cnpj", "cnpj", "cpf"])],
  ].filter(([, valor]) => valor);

  const dadosEquipamento = [
    ["Equipamento", equipamento],
    ["Quantidade", atividade?.quantidade || 1],
    ...(isDeslocamento
      ? [
          ["Tamanho anterior", formatarTamanhoDeslocamento(atividade?.tamanhoAnterior)],
          ["Tamanho novo", formatarTamanhoDeslocamento(atividade?.tamanhoNovo)],
        ]
      : [["Tamanho", atividade?.tamanho ? `${atividade.tamanho} m` : ""]]),
    ["Contrapeso", atividade?.usaContrapeso ? "Sim" : ""],
    ["Ancoragem", atividade?.ancoragem],
    ["Capacidade", atividade?.tipoMiniGrua],
    ["Tipo específico", atividade?.tipoBalancinho || atividade?.tipoMiniGrua],
    ...(numerosPatrimonioValidos.length > 0
      ? [
          [
            numerosPatrimonioValidos.length === 1 ? "Patrimônio" : "Patrimônios",
            numerosPatrimonioValidos.join(", "),
          ],
        ]
      : []),
  ].filter(([, valor]) => valor);

  const propsVia = {
    atividade,
    dadosObra,
    dadosEquipamento,
    descricao,
    observacoesOS,
    payloadOffline,
    qrDataUrl,
    assinaturaTipo,
    assinaturaManual,
    status,
  };

  const gerarPdf = async (vias = 1, baixar = true) => {
    const elementos =
      vias === 2
        ? [pdfPrimeiraViaRef.current, pdfSegundaViaRef.current]
        : [pdfUmaViaRef.current];

    if (elementos.some((elemento) => !elemento)) return null;
    if (!qrDataUrl) {
      alert("Aguarde o QR Code terminar de carregar antes de gerar o PDF.");
      return null;
    }

    const usarAjusteExclusivoPdf = baixar;
    if (usarAjusteExclusivoPdf) {
      elementos.forEach((elemento) => elemento.classList.add("os-captura-pdf"));
    }

    try {
      const capturas = await Promise.all(elementos.map(capturarElemento));
      const pdf = new jsPDF("p", "mm", "a4");

      if (vias === 2) {
        adicionarImagemCentralizada(pdf, capturas[0], { x: 0, y: 0, largura: 210, altura: 148.5 });
        adicionarImagemCentralizada(pdf, capturas[1], { x: 0, y: 148.5, largura: 210, altura: 148.5 });
      } else {
        adicionarImagemCentralizada(pdf, capturas[0], { x: 0, y: 0, largura: 210, altura: 297 });
      }

      const nome = `ordem-servico-${numeroOS || atividade.id}-${vias}via.pdf`;
      if (baixar) pdf.save(nome);
      return pdf.output("blob");
    } catch (erro) {
      alert(erro?.message || "Não foi possível gerar o PDF da Ordem de Serviço.");
      return null;
    } finally {
      if (usarAjusteExclusivoPdf) {
        elementos.forEach((elemento) => elemento.classList.remove("os-captura-pdf"));
      }
    }
  };

  const imprimir = async () => {
    await gerarPdf(2, true);
    alert("PDF com 2 vias gerado. Abra o arquivo baixado para imprimir.");
  };

  const enviarWhatsApp = async () => {
    const blob = await gerarPdf(1, false);
    if (!blob) return;
    const arquivo = new File([blob], `ordem-servico-${numeroOS || atividade.id}.pdf`, {
      type: "application/pdf",
    });
    const texto = `Ordem de Serviço ${numeroOS} - ${obra?.nome || atividade.obra || ""}`;

    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: "Ordem de Serviço", text: texto });
      return;
    }

    const pdfDownload = document.createElement("a");
    pdfDownload.href = URL.createObjectURL(blob);
    pdfDownload.download = arquivo.name;
    pdfDownload.click();
    URL.revokeObjectURL(pdfDownload.href);
    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}\nAnexe o PDF baixado.`)}`, "_blank");
    alert("O PDF foi baixado. Se o WhatsApp não anexar automaticamente, anexe o arquivo baixado manualmente.");
  };

  const iniciarAssinatura = (event) => {
    if (assinaturaTipo !== "manual") return;
    const canvas = assinaturaCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    setAssinando(true);
  };

  const desenharAssinatura = (event) => {
    if (!assinando || assinaturaTipo !== "manual") return;
    const canvas = assinaturaCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    ctx.stroke();
  };

  const finalizarAssinatura = () => {
    if (!assinando) return;
    setAssinando(false);
    setAssinaturaManual(assinaturaCanvasRef.current.toDataURL("image/png"));
  };

  const limparAssinatura = () => {
    const canvas = assinaturaCanvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setAssinaturaManual("");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3">
      <style>{estilosCapturaPdf}</style>
      <div className="mx-auto max-w-5xl rounded bg-white p-4 shadow-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Ordem de Serviço</h2>
          <button onClick={onClose} className="rounded border px-3 py-1 text-sm">Fechar</button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium">
            Descrição dos serviços
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="mt-1 min-h-[110px] w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium">
            Observações da O.S.
            <textarea
              value={observacoesOS}
              onChange={(e) => setObservacoesOS(e.target.value)}
              className="mt-1 min-h-[110px] w-full rounded border px-3 py-2"
            />
          </label>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">Assinatura CD:</span>
          {["sem", "fixa", "manual"].map((tipo) => (
            <label key={tipo} className="flex items-center gap-1">
              <input
                type="radio"
                checked={assinaturaTipo === tipo}
                onChange={() => setAssinaturaTipo(tipo)}
              />
              {tipo === "sem" ? "Sem assinatura" : tipo === "fixa" ? "Assinatura fixa" : "Assinatura manual"}
            </label>
          ))}
        </div>

        {assinaturaTipo === "manual" && (
          <div className="mb-4 rounded border p-3">
            <canvas
              ref={assinaturaCanvasRef}
              width="420"
              height="120"
              className="max-w-full touch-none rounded border bg-white"
              onPointerDown={iniciarAssinatura}
              onPointerMove={desenharAssinatura}
              onPointerUp={finalizarAssinatura}
              onPointerLeave={finalizarAssinatura}
            />
            <button onClick={limparAssinatura} className="mt-2 rounded border px-3 py-1 text-sm">
              Limpar assinatura
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={enviarWhatsApp} className="rounded bg-green-600 px-4 py-2 text-white">
            WhatsApp - 1 via
          </button>
          <button onClick={imprimir} className="rounded border px-4 py-2">
            Imprimir - 2 vias
          </button>
          <button onClick={() => gerarPdf(1, true)} className="rounded border px-4 py-2">
            Baixar PDF - 1 via
          </button>
          <button onClick={() => gerarPdf(2, true)} className="rounded border px-4 py-2">
            Baixar PDF - 2 vias
          </button>
        </div>

        <div ref={previewRef} className="mx-auto max-w-[794px] border border-black bg-white text-black">
          <ViaOrdemServico {...propsVia} compacto />
        </div>

        <div className="pointer-events-none fixed -left-[10000px] top-0 opacity-0">
          <QRCodeCanvas
            ref={qrCanvasRef}
            value={payloadOffline}
            size={176}
            level="M"
            includeMargin
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>

        <div className="fixed -left-[10000px] top-0 bg-white">
          <div className="w-[210mm] bg-white p-[2mm]">
            <div ref={pdfUmaViaRef} className="w-full bg-white">
              <ViaOrdemServico {...propsVia} compacto />
            </div>
          </div>
          <div className="h-[297mm] w-[210mm] bg-white p-[2mm] text-black">
            <div ref={pdfPrimeiraViaRef} className="w-full bg-white">
              <ViaOrdemServico {...propsVia} compacto viaTitulo="1ª VIA — EMPRESA" />
            </div>
            <div className="my-[1.5mm] border-t border-dashed border-black text-center text-[7px]">
              linha de corte
            </div>
            <div ref={pdfSegundaViaRef} className="w-full bg-white">
              <ViaOrdemServico {...propsVia} compacto viaTitulo="2ª VIA — CLIENTE" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
