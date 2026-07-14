import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  formatarValorContrato,
  obterDadosContrato,
  obterTipoContrato,
  obterValoresContratoInstalacao,
} from "../../utils/contrato";
import ContratoInstalacao from "./ContratoInstalacao";
import ContratoSomenteAluguel from "./ContratoSomenteAluguel";

const titulosContrato = {
  instalacao: "CONTRATO DE INSTALAÇÃO",
  "somente-aluguel": "CONTRATO DE SOMENTE ALUGUEL",
};

const aguardarDoisFrames = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const aguardarImagens = async (container) => {
  const imagens = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    imagens.map(async (img) => {
      if (img.complete && img.naturalWidth > 0) {
        if (img.decode) await img.decode().catch(() => {});
        return;
      }

      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error(`Imagem não carregada: ${img.src}`)), 8000);
        img.addEventListener("load", () => {
          window.clearTimeout(timeout);
          resolve();
        }, { once: true });
        img.addEventListener("error", () => {
          window.clearTimeout(timeout);
          reject(new Error(`Falha ao carregar imagem: ${img.src}`));
        }, { once: true });
      });
    })
  );
};

const capturarPagina = async (pagina) => {
  await document.fonts?.ready;
  await aguardarImagens(pagina);
  await aguardarDoisFrames();

  const canvas = await html2canvas(pagina, {
    scale: 2.4,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
  });

  return {
    imagem: canvas.toDataURL("image/png"),
    largura: canvas.width,
    altura: canvas.height,
  };
};

const adicionarPaginaAoPdf = (pdf, captura, indice) => {
  if (indice > 0) pdf.addPage();
  const escala = Math.min(210 / captura.largura, 297 / captura.altura);
  const largura = captura.largura * escala;
  const altura = captura.altura * escala;
  pdf.addImage(captura.imagem, "PNG", (210 - largura) / 2, (297 - altura) / 2, largura, altura);
};

const dataParaInput = (valor) => {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor).slice(0, 10);
  return data.toISOString().slice(0, 10);
};

const hojeInput = () => new Date().toISOString().slice(0, 10);

export default function Contrato({ atividade, obras = [], construtoras = [], onClose }) {
  const tipoContrato = obterTipoContrato(atividade);
  const titulo = titulosContrato[tipoContrato] || "CONTRATO";
  const pageRefs = useRef([]);
  const dadosContrato = useMemo(
    () => obterDadosContrato(atividade, obras, construtoras),
    [atividade, obras, construtoras]
  );
  const valoresContrato = useMemo(
    () => obterValoresContratoInstalacao(atividade, dadosContrato),
    [atividade, dadosContrato]
  );
  const [campos, setCampos] = useState(() => ({
    numeroContrato: `${new Date().getFullYear()}/____`,
    enderecoEntrega: dadosContrato.enderecoObra || "",
    dataPrevista: dataParaInput(atividade?.dataAgendamento),
    frete: "",
    marca: atividade?.equipamento === "Balancinho" ? "Menegotti" : "",
    modelo: atividade?.equipamento === "Balancinho"
      ? "BALANCIM PRO 90CM PISO DE AÇO, PAINEL TRIFÁSICO"
      : "",
    valorReferenciaEquipamento: "30000",
    dataContrato: hojeInput(),
  }));

  const atualizarCampo = (campo, valor) => {
    setCampos((atuais) => ({ ...atuais, [campo]: valor }));
  };

  const gerarPdf = async (baixar = true) => {
    if (tipoContrato === "instalacao" && !campos.enderecoEntrega.trim()) {
      alert("Informe o endereço de entrega antes de gerar o contrato.");
      return null;
    }

    const paginas = pageRefs.current.filter(Boolean);
    if (!paginas.length) return null;

    const capturas = [];
    for (const pagina of paginas) {
      capturas.push(await capturarPagina(pagina));
    }

    const pdf = new jsPDF("p", "mm", "a4");
    capturas.forEach((captura, indice) => adicionarPaginaAoPdf(pdf, captura, indice));

    const blob = pdf.output("blob");
    if (baixar) pdf.save(`contrato-${atividade?.id || Date.now()}.pdf`);
    return blob;
  };

  const enviarWhatsApp = async () => {
    const blob = await gerarPdf(false);
    if (!blob) return;

    const arquivo = new File([blob], `contrato-${atividade?.id || Date.now()}.pdf`, {
      type: "application/pdf",
    });
    const texto = `${titulo} - ${dadosContrato.nomeObra || atividade?.obra || ""}`;

    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: "Contrato", text: texto });
      return;
    }

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = arquivo.name;
    link.click();
    URL.revokeObjectURL(link.href);
    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}\nAnexe o PDF baixado.`)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3">
      <div className="mx-auto max-w-6xl rounded bg-white p-4 shadow-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Contrato</h2>
          <button onClick={onClose} className="rounded border px-3 py-1 text-sm">Fechar</button>
        </div>

        {tipoContrato === "instalacao" && (
          <div className="mb-4 grid gap-3 rounded border bg-gray-50 p-3 md:grid-cols-3">
            <label className="text-sm font-medium">Número do contrato
              <input value={campos.numeroContrato} onChange={(e) => atualizarCampo("numeroContrato", e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <label className="text-sm font-medium md:col-span-2">Endereço de entrega
              <input value={campos.enderecoEntrega} onChange={(e) => atualizarCampo("enderecoEntrega", e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Data prevista
              <input type="date" value={campos.dataPrevista} onChange={(e) => atualizarCampo("dataPrevista", e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Frete
              <input value={campos.frete} onChange={(e) => atualizarCampo("frete", e.target.value)} placeholder={formatarValorContrato(0)} className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Marca do equipamento
              <input value={campos.marca} onChange={(e) => atualizarCampo("marca", e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <label className="text-sm font-medium md:col-span-2">Modelo/descrição complementar
              <input value={campos.modelo} onChange={(e) => atualizarCampo("modelo", e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Valor de referência do equipamento
              <input value={campos.valorReferenciaEquipamento} onChange={(e) => atualizarCampo("valorReferenciaEquipamento", e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            <label className="text-sm font-medium">Data do contrato
              <input type="date" value={campos.dataContrato} onChange={(e) => atualizarCampo("dataContrato", e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            </label>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={enviarWhatsApp} className="rounded bg-green-600 px-4 py-2 text-white">
            WhatsApp
          </button>
          <button onClick={() => gerarPdf(true)} className="rounded border px-4 py-2">
            Baixar PDF
          </button>
        </div>

        <div className="space-y-4 bg-gray-200 p-3">
          {tipoContrato === "instalacao" && (
            <ContratoInstalacao
              atividade={atividade}
              campos={campos}
              dadosContrato={dadosContrato}
              valoresContrato={valoresContrato}
              pageRefs={pageRefs}
            />
          )}
          {tipoContrato === "somente-aluguel" && <ContratoSomenteAluguel />}
        </div>
      </div>
    </div>
  );
}
