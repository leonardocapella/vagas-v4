/**
 * Vagas V4 Mendes — recebe as candidaturas da página e grava na planilha.
 *
 * Como ligar (uma vez):
 *  1. PLANILHA_ID abaixo já aponta para "Vagas V4 Mendes - Candidaturas".
 *  2. Em script.google.com, cole este arquivo num projeto novo (conta leonardo.capella@v4company.com).
 *  3. Rode a função `configurar` uma vez (ela cria e formata o cabeçalho) e autorize o acesso.
 *  4. Implantar > Nova implantação > Tipo "App da Web":
 *       Executar como: eu
 *       Quem tem acesso: qualquer pessoa
 *     Copie a URL que termina em /exec e cole em CONFIG.endpoint no index.html.
 *
 * Se mudar o código depois, é preciso criar uma NOVA VERSÃO da implantação
 * (Implantar > Gerenciar implantações > editar > Versão: nova), senão a URL continua
 * servindo o código antigo.
 */

const PLANILHA_ID = "15luA7XxTGrWFCnwJbXJPOih4rX5smT5M6zeG7WL7-bw";
const ABA = "Candidaturas";

// Pasta do Drive onde os currículos são salvos. Deixe "" para o script criar
// uma pasta "Currículos — Vagas V4" na raiz do Drive na primeira candidatura.
let PASTA_CURRICULOS_ID = "";

const MAX_MB = 8; // mesmo limite do formulário

// Recebe o aviso de cada candidatura nova. Deixe a lista vazia para não avisar ninguém.
const AVISAR = ["vinicius.mendes@v4company.com"];
// Em cópia (Cc).
const AVISAR_CC = ["ancila.ferreira@v4company.com"];

// Nota de 0 a 10 por regra fixa (pontuar_). Sem API. O candidato nunca vê.
// Mesmo nome do input escondido em vagas.js (window.ARMADILHA). Preenchido = robô.
const ARMADILHA = "website";

const COLUNAS = [
  "Data/Hora",
  "Vaga",
  "Vaga (id)",
  "Nome",
  "E-mail",
  "WhatsApp",
  "LinkedIn",
  "Cidade",
  "Pretensão salarial",
  "Presencial",
  "Regime",
  "Experiência",
  "Por que essa vaga",
  "Currículo",
  "Nota",
  "Justificativa",
  "Status",
  "Origem",
];

// O que a nota procura, na ordem do peso. Vale para SDR e BDR.
// pontuar_ transforma cada linha em pontos; reescreva os dois juntos.
const IA_CRITERIOS = [
  "Experiência em vendas, pré-vendas, prospecção, telemarketing, atendimento ou varejo — quanto mais próxima de outbound/inside sales, melhor.",
  "Evidência de trabalho com meta, comissão ou indicador de desempenho.",
  "Experiência com CRM ou ferramenta de cadência (Kommo, RD, HubSpot, Pipedrive, Apollo, Meetime).",
  "Comunicação escrita: currículo claro, organizado, sem erro grosseiro.",
  "Estabilidade razoável nos empregos anteriores (trocar de emprego a cada 3 meses pesa contra).",
  "Formação ou curso ligado a vendas, marketing, comunicação ou administração conta a favor, mas não é obrigatório.",
];

// Cor de cada bloco no cabeçalho (vermelho V4 e tons escuros)
const BLOCOS = [
  { ate: 1, cor: "#171717" },  // Data/Hora
  { ate: 3, cor: "#E50914" },  // Vaga
  { ate: 8, cor: "#262626" },  // Contato
  { ate: 14, cor: "#404040" }, // Respostas e currículo
  { ate: 16, cor: "#a50e10" }, // Nota
  { ate: 18, cor: "#171717" }, // Controle interno
];

function doPost(e) {
  let dados;
  try {
    dados = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // robô preenche o campo escondido: descarta, sem planilha e sem e-mail
  if (String(dados[ARMADILHA] || "").trim()) {
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  delete dados[ARMADILHA];

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const aba = pegarAba_();
    if (aba.getLastRow() === 0) { configurar(); }

    dados["Data/Hora"] = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
    if (!dados["Status"]) dados["Status"] = "Novo";

    try {
      const nota = pontuar_(dados);
      dados["Nota"] = nota.nota;
      dados["Justificativa"] = nota.justificativa;
    } catch (err) {
      console.error("nota falhou: " + err);
    }

    // currículo: chega em base64 e vai para uma pasta do Drive; na planilha fica o link
    if (dados.__arquivo && dados.__arquivo.base64) {
      dados["Currículo"] = salvarCurriculo_(dados.__arquivo, dados);
    }

    // garante coluna para toda chave recebida (se o formulário ganhar pergunta nova)
    let cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
    Object.keys(dados).forEach(function (k) {
      if (k.indexOf("__") === 0) return;
      if (cab.indexOf(k) === -1) { aba.getRange(1, cab.length + 1).setValue(k); cab.push(k); }
    });

    const linha = cab.map(function (k) { return dados[k] !== undefined ? dados[k] : ""; });
    aba.appendRow(linha);

    const n = aba.getLastRow();
    aba.getRange(n, 1, 1, cab.length).setVerticalAlignment("top").setWrap(true);
    if (n % 2 === 0) aba.getRange(n, 1, 1, cab.length).setBackground("#fafafa");

    avisar_(dados);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  // abrir a URL do app uma vez já cria e formata as colunas
  const aba = pegarAba_();
  if (aba.getLastRow() === 0 || aba.getRange(1, 1).getValue() !== COLUNAS[0]) configurar();
  return ContentService.createTextOutput("Vagas V4 Mendes ativo. Planilha pronta para receber candidaturas.");
}

function configurar() {
  const aba = pegarAba_();
  aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]);
  formatar_(aba);
}

function pegarAba_() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  let aba = ss.getSheetByName(ABA);
  if (!aba) {
    // reaproveita a primeira aba se ela estiver vazia
    const primeira = ss.getSheets()[0];
    if (primeira.getLastRow() === 0) { primeira.setName(ABA); aba = primeira; }
    else aba = ss.insertSheet(ABA);
  }
  return aba;
}

/**
 * Grava o currículo no Drive e devolve o link. Se o upload falhar, devolve o texto do erro
 * em vez de derrubar a candidatura — os dados do candidato valem mais que o anexo.
 */
function salvarCurriculo_(arq, dados) {
  try {
    const bytes = Utilities.base64Decode(arq.base64);
    if (bytes.length > MAX_MB * 1024 * 1024) return "(arquivo acima de " + MAX_MB + " MB, não salvo)";

    const ext = (String(arq.nome).match(/\.(pdf|docx?)$/i) || [""])[0].toLowerCase();
    if (!ext) return "(formato não aceito, não salvo)";

    // nome legível na pasta: 2026-11-24 — Nome do candidato — sdr.pdf
    const limpo = String(dados["Nome"] || "sem nome").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 60);
    const nome = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd") +
                 " - " + limpo + " - " + (dados["Vaga (id)"] || "vaga") + ext;

    const blob = Utilities.newBlob(bytes, arq.tipo || "application/octet-stream", nome);
    const arquivo = pastaCurriculos_().createFile(blob);
    return arquivo.getUrl();
  } catch (err) {
    console.error("upload do currículo falhou: " + err);
    return "(falha ao salvar: " + err + ")";
  }
}

function semAcento_(s) {
  return String(s || "").toLowerCase()
    .replace(/[áàâã]/g, "a").replace(/[éê]/g, "e").replace(/í/g, "i")
    .replace(/[óôõ]/g, "o").replace(/[úü]/g, "u").replace(/ç/g, "c");
}

function tem_(texto, palavras) {
  return palavras.some(function (p) { return texto.indexOf(p) !== -1; });
}

/**
 * Nota de 0 a 10 a partir do formulário. Devolve { nota, justificativa }.
 * ponytail: casa palavra no texto, não lê o currículo. "não fiz vendas" ainda pontua.
 * Trocar por leitura do PDF se a triagem manual não der conta.
 * Pesos (somam 10): experiência 3, meta 1.5, CRM 1.5, texto 1.5, tempo 0.5,
 * formação 0.5, presencial 1, aceita PJ 0.5.
 */
function pontuar_(dados) {
  const exp = String(dados["Experiência"] || "").trim();
  const texto = semAcento_(exp + " " + (dados["Por que essa vaga"] || ""));
  const ok = [];
  const falta = [];
  let pontos = 0;

  if (tem_(texto, ["prospeccao", "outbound", "inside sales", "pre-venda", "pre venda", "sdr", "bdr", "cold call", "cold mail"])) {
    pontos += 3; ok.push("experiência em outbound ou inside sales");
  } else if (tem_(texto, ["venda", "vendas", "telemarketing", "atendimento", "varejo", "comercial"])) {
    pontos += 2; ok.push("experiência em vendas, atendimento ou varejo");
  } else if (texto.length >= 40) {
    pontos += 0.5; falta.push("experiência ligada a vendas");
  } else {
    falta.push("experiência em vendas");
  }

  if (tem_(texto, ["meta", "comissao", "indicador", "kpi"])) {
    pontos += 1.5; ok.push("cita meta ou comissão");
  } else falta.push("meta ou comissão");

  if (tem_(texto, ["kommo", "hubspot", "pipedrive", "rd station", "apollo", "meetime", "salesforce", "crm", "reev", "sellbird"])) {
    pontos += 1.5; ok.push("já usou CRM ou cadência");
  } else falta.push("CRM");

  if (exp.length >= 80) { pontos += 1.5; ok.push("texto claro"); }
  else if (exp.length >= 40) { pontos += 1; ok.push("texto curto"); }
  else if (exp.length >= 15) { pontos += 0.5; }
  else falta.push("texto da experiência");

  if (/\b\d+\s*anos?\b/.test(texto)) {
    pontos += 0.5; ok.push("informa tempo de casa");
  }

  if (tem_(texto, ["administracao", "marketing", "comunicacao", "faculdade", "graduacao", "tecnologo", "curso"])) {
    pontos += 0.5; ok.push("formação na área");
  }

  if (semAcento_(dados["Presencial"]).indexOf("sim") === 0) {
    pontos += 1; ok.push("disponível presencial");
  } else falta.push("presencial em Porto Alegre");

  const regime = semAcento_(dados["Regime"]);
  if (regime.indexOf("pj") !== -1 || regime.indexOf("tanto") !== -1) {
    pontos += 0.5; ok.push("aceita PJ");
  } else falta.push("aceite de PJ");

  const nota = Math.round(Math.min(10, Math.max(0, pontos)) * 10) / 10;
  const justificativa =
    (ok.length ? ok.join(", ") + "." : "Nenhum requisito atendido.") +
    (falta.length ? " Falta: " + falta.join(", ") + "." : "");
  return { nota: nota, justificativa: justificativa };
}

function pastaCurriculos_() {
  if (PASTA_CURRICULOS_ID) return DriveApp.getFolderById(PASTA_CURRICULOS_ID);

  // sem id configurado: reusa a pasta pelo nome ou cria uma, e guarda o id nas propriedades
  const props = PropertiesService.getScriptProperties();
  const salvo = props.getProperty("PASTA_CURRICULOS_ID");
  if (salvo) { PASTA_CURRICULOS_ID = salvo; return DriveApp.getFolderById(salvo); }

  const NOME = "Currículos — Vagas V4";
  const achadas = DriveApp.getFoldersByName(NOME);
  const pasta = achadas.hasNext() ? achadas.next() : DriveApp.createFolder(NOME);
  props.setProperty("PASTA_CURRICULOS_ID", pasta.getId());
  PASTA_CURRICULOS_ID = pasta.getId();
  return pasta;
}

function formatar_(aba) {
  const n = COLUNAS.length;
  const cab = aba.getRange(1, 1, 1, n);

  cab.setFontColor("#ffffff").setFontWeight("bold").setFontSize(11)
     .setVerticalAlignment("middle").setWrap(true);
  aba.setRowHeight(1, 46);

  // pinta o cabeçalho por bloco
  let de = 1;
  BLOCOS.forEach(function (b) {
    const ate = Math.min(b.ate, n);
    if (ate >= de) aba.getRange(1, de, 1, ate - de + 1).setBackground(b.cor);
    de = ate + 1;
  });

  aba.setFrozenRows(1);
  const largura = { "Data/Hora": 140, "Vaga": 250, "Vaga (id)": 90, "Nome": 200, "E-mail": 220,
                    "WhatsApp": 140, "LinkedIn": 260, "Cidade": 150, "Pretensão salarial": 160,
                    "Presencial": 220, "Regime": 110,
                    "Experiência": 420, "Por que essa vaga": 360, "Currículo": 220,
                    "Nota": 80, "Justificativa": 400,
                    "Status": 120, "Origem": 240 };
  COLUNAS.forEach(function (nome, i) { if (largura[nome]) aba.setColumnWidth(i + 1, largura[nome]); });

  // Status como lista suspensa, para o time mover o candidato pelo funil
  const col = COLUNAS.indexOf("Status") + 1;
  if (col > 0) {
    const regra = SpreadsheetApp.newDataValidation()
      .requireValueInList(["Novo", "Em análise", "Entrevista", "Aprovado", "Reprovado"], true)
      .setAllowInvalid(false).build();
    aba.getRange(2, col, Math.max(aba.getMaxRows() - 1, 1), 1).setDataValidation(regra);
  }

  // Nota: centralizada, em negrito e com escala de cor (vermelho -> amarelo -> verde)
  const cNota = COLUNAS.indexOf("Nota") + 1;
  if (cNota > 0) {
    const faixa = aba.getRange(2, cNota, Math.max(aba.getMaxRows() - 1, 1), 1);
    faixa.setHorizontalAlignment("center").setFontWeight("bold").setNumberFormat("0.0");
    const regra = SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpointWithValue("#f4c7c3", SpreadsheetApp.InterpolationType.NUMBER, "0")
      .setGradientMidpointWithValue("#fce8b2", SpreadsheetApp.InterpolationType.NUMBER, "5")
      .setGradientMaxpointWithValue("#b7e1cd", SpreadsheetApp.InterpolationType.NUMBER, "10")
      .setRanges([faixa]).build();
    aba.setConditionalFormatRules(aba.getConditionalFormatRules().concat([regra]));
  }

  aba.getRange(1, 1, aba.getMaxRows(), n).setFontFamily("Inter");
}

function avisar_(dados) {
  if (!AVISAR.length) return;
  try {
    MailApp.sendEmail({
      to: AVISAR.join(","),
      cc: (AVISAR_CC || []).join(","),
      subject: "Nova candidatura — " + (dados["Vaga"] || "vaga V4") +
               (dados["Nota"] !== undefined && dados["Nota"] !== ""
                 ? " — nota " + dados["Nota"] : ""),
      htmlBody:
        "<p><b>" + escapar_(dados["Nome"]) + "</b> se candidatou para <b>" +
        escapar_(dados["Vaga"]) + "</b>.</p>" +
        (dados["Nota"] !== undefined && dados["Nota"] !== ""
          ? "<p style='font-size:15px'><b>Nota: " + escapar_(dados["Nota"]) + "/10</b><br>" +
            "<span style='color:#555'>" + escapar_(dados["Justificativa"]) + "</span></p>"
          : "") +
        "<p>Presencial: " + escapar_(dados["Presencial"]) + "<br>" +
        "Regime: " + escapar_(dados["Regime"]) + "</p>" +
        "<p>WhatsApp: " + escapar_(dados["WhatsApp"]) + "<br>" +
        "E-mail: " + escapar_(dados["E-mail"]) + "<br>" +
        "LinkedIn: " + escapar_(dados["LinkedIn"]) + "<br>" +
        "Cidade: " + escapar_(dados["Cidade"]) + "<br>" +
        "Pretensão: " + escapar_(dados["Pretensão salarial"]) + "</p>" +
        (dados["Currículo"] && dados["Currículo"].indexOf("http") === 0
          ? "<p><a href='" + escapar_(dados["Currículo"]) + "'>Abrir o currículo</a></p>"
          : "") +
        "<p><b>Experiência</b><br>" + escapar_(dados["Experiência"]) + "</p>" +
        "<p><a href='https://docs.google.com/spreadsheets/d/" + PLANILHA_ID + "/edit'>Abrir a planilha</a></p>",
    });
  } catch (err) {
    // e-mail é extra: se a cota do MailApp estourar, a candidatura já está gravada
    console.error("aviso por e-mail falhou: " + err);
  }
}

function escapar_(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
