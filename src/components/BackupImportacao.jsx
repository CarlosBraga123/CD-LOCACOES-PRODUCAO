import { useRef, useState, useEffect } from "react";

export default function BackupImportacao() {
  const inputRef = useRef();
  const [ultimaAcao, setUltimaAcao] = useState("");

  useEffect(() => {
    const ultima = localStorage.getItem("ultimoBackup");
    if (ultima) setUltimaAcao(ultima);
  }, []);

  const salvarUltimaAcao = (tipo) => {
    const agora = new Date().toLocaleString();
    const texto = `${tipo} em ${agora}`;
    localStorage.setItem("ultimoBackup", texto);
    setUltimaAcao(texto);
  };

  const obterDadosBackupAtuais = () => {
    return {
      atividades: JSON.parse(localStorage.getItem("atividades") || "[]"),
      construtoras: JSON.parse(localStorage.getItem("construtoras") || "[]"),
      obras: JSON.parse(localStorage.getItem("obras") || "[]"),
      pecasBalancinho: JSON.parse(localStorage.getItem("pecasBalancinho") || "{}"),
      pecasAncoragem: JSON.parse(localStorage.getItem("pecasAncoragem") || "{}"),
      tarefas: JSON.parse(localStorage.getItem("tarefas") || "[]"),
      usuarios: JSON.parse(localStorage.getItem("usuarios") || "[]"),
      valoresServicos: JSON.parse(localStorage.getItem("valoresServicos") || "{}"),
      valoresPadrao: JSON.parse(localStorage.getItem("valoresPadrao") || "{}"),
      tabelaComercialPadrao: JSON.parse(localStorage.getItem("tabelaComercialPadrao") || "{}"),
      empresaLogo: localStorage.getItem("empresaLogo") || "",
      empresaNome: localStorage.getItem("empresaNome") || ""
    };
  };

  const baixarBackup = (dados, nomeArquivo) => {
    const blob = new Blob([JSON.stringify(dados, null, 2)], {
      type: "application/json"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportarBackup = () => {
    baixarBackup(obterDadosBackupAtuais(), `backup-cd-locacoes-${Date.now()}.json`);

    salvarUltimaAcao("Backup exportado");
  };

  const validarBackup = (conteudo) => {
    const chavesArray = ["atividades", "construtoras", "obras", "tarefas", "usuarios"];

    for (const chave of chavesArray) {
      if (conteudo[chave] !== undefined && !Array.isArray(conteudo[chave])) {
        throw new Error(`O campo "${chave}" deve ser uma lista.`);
      }
    }

    const chavesMateriais = ["pecasBalancinho", "pecasAncoragem"];

    for (const chave of chavesMateriais) {
      if (
        conteudo[chave] !== undefined &&
        typeof conteudo[chave] !== "object"
      ) {
        throw new Error(`O campo "${chave}" deve ser uma estrutura de materiais válida.`);
      }
    }
  };

  const gerarBackupAntesDaImportacao = () => {
    const data = new Date().toISOString().replace(/[:.]/g, "-");
    baixarBackup(
      obterDadosBackupAtuais(),
      `backup-antes-importacao-cd-locacoes-${data}.json`
    );
  };

  const importarBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const conteudo = JSON.parse(e.target.result);
        validarBackup(conteudo);

        const confirmarImportacao = window.confirm(
          "Atenção: importar este backup vai substituir os dados atuais do app. Antes de continuar, será gerado automaticamente um backup dos dados atuais. Deseja continuar?"
        );

        if (!confirmarImportacao) return;

        gerarBackupAntesDaImportacao();

        if (conteudo.atividades) localStorage.setItem("atividades", JSON.stringify(conteudo.atividades));
        if (conteudo.construtoras) localStorage.setItem("construtoras", JSON.stringify(conteudo.construtoras));
        if (conteudo.obras) localStorage.setItem("obras", JSON.stringify(conteudo.obras));
        if (conteudo.pecasBalancinho) localStorage.setItem("pecasBalancinho", JSON.stringify(conteudo.pecasBalancinho));
        if (conteudo.pecasAncoragem) localStorage.setItem("pecasAncoragem", JSON.stringify(conteudo.pecasAncoragem));
        if (conteudo.tarefas) localStorage.setItem("tarefas", JSON.stringify(conteudo.tarefas));
        if (conteudo.usuarios) localStorage.setItem("usuarios", JSON.stringify(conteudo.usuarios));
        if (conteudo.valoresServicos) localStorage.setItem("valoresServicos", JSON.stringify(conteudo.valoresServicos));
        if (conteudo.valoresPadrao) localStorage.setItem("valoresPadrao", JSON.stringify(conteudo.valoresPadrao));
        if (conteudo.tabelaComercialPadrao) localStorage.setItem("tabelaComercialPadrao", JSON.stringify(conteudo.tabelaComercialPadrao));
        if (conteudo.empresaLogo) localStorage.setItem("empresaLogo", conteudo.empresaLogo);
        if (conteudo.empresaNome) localStorage.setItem("empresaNome", conteudo.empresaNome);

        alert("✅ Backup importado com sucesso!");
        salvarUltimaAcao("Backup importado");
      } catch (err) {
        alert(`❌ Erro ao importar backup. ${err.message || "Verifique o arquivo."}`);
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">💾 Backup e Restauração</h2>

      {ultimaAcao && (
        <p className="text-sm text-gray-600 border p-2 rounded bg-gray-50">
          🕒 Última ação: {ultimaAcao}
        </p>
      )}

      <button
        onClick={exportarBackup}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        ⬇️ Exportar Backup Local
      </button>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={importarBackup}
        />
        <button
          onClick={() => inputRef.current.click()}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          ⬆️ Importar Backup Local
        </button>
      </div>
    </div>
  );
}
