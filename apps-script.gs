/**
 * Vagas V4 Mendes — recebe as candidaturas da página e grava na planilha.
 *
 * Como ligar (uma vez):
 *  1. Crie uma planilha nova no Drive e copie o id da URL
 *     (https://docs.google.com/spreadsheets/d/<ESTE_PEDACO>/edit).
 *  2. Cole esse id em PLANILHA_ID abaixo.
 *  3. Em script.google.com, cole este arquivo num projeto novo.
 *  4. Rode a função `configurar` uma vez (ela cria e formata o cabeçalho) e autorize o acesso.
 *  5. Implantar > Nova implantação > Tipo "App da Web":
 *       Executar como: eu
 *       Quem tem acesso: qualquer pessoa
 *     Copie a URL que termina em /exec e cole em CONFIG.endpoint no index.html.
 *
 * Se mudar o código depois, é preciso criar uma NOVA VERSÃO da implantação
 * (Implantar > Gerenciar implantações > editar > Versão: nova), senão a URL continua
 * servindo o código antigo.
 */

const PLANILHA_ID = "COLE_O_ID_DA_PLANILHA_AQUI";
const ABA = "Candidaturas";

// Pasta do Drive onde os currículos são salvos. Deixe "" para o script criar
// uma pasta "Currículos — Vagas V4" na raiz do Drive na primeira candidatura.
let PASTA_CURRICULOS_ID = "";

const MAX_MB = 8; // mesmo limite do formulário

// Recebe o aviso de cada candidatura nova. Deixe a lista vazia para não avisar ninguém.
const AVISAR = ["vinicius.mendes@v4company.com"];
// Em cópia (Cc).
const AVISAR_CC = ["ancila.ferreira@v4company.com"];

/**
 * Nota automática de 0 a 10 do currículo, feita por IA lendo o PDF.
 *
 * A chave da API fica nas Script Properties, NUNCA no código:
 *   Apps Script > ⚙ Configurações do projeto > Propriedades do script > Adicionar
 *   Nome: ANTHROPIC_API_KEY   Valor: sk-ant-...
 *
 * Sem a chave configurada, a nota fica em branco e a candidatura é gravada normalmente.
 * A nota é só interna: o candidato nunca vê.
 */
const IA_MODELO = "claude-haiku-5-5";
const IA_NOTA_ATIVA = true;

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
  "Experiência",
  "Por que essa vaga",
  "Currículo",
  "Nota IA",
  "Nota IA - Justificativa",
  "Status",
  "Origem",
];

// Critérios que a IA usa para dar a nota. Reescreva à vontade — é isto que define o que
// conta como currículo bom para a vaga. Vale para SDR e BDR; se as vagas ficarem muito
// diferentes, dá para trocar por um texto por vaga (chave = id da vaga).
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
  { ate: 12, cor: "#404040" }, // Respostas e currículo
  { ate: 14, cor: "#a50e10" }, // Nota da IA
  { ate: 16, cor: "#171717" }, // Controle interno
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const dados = JSON.parse(e.postData.contents);
    const aba = pegarAba_();
    if (aba.getLastRow() === 0) { configurar(); }

    dados["Data/Hora"] = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
    if (!dados["Status"]) dados["Status"] = "Novo";

    // currículo: chega em base64 e vai para uma pasta do Drive; na planilha fica o link
    if (dados.__arquivo && dados.__arquivo.base64) {
      dados["Currículo"] = salvarCurriculo_(dados.__arquivo, dados);

      // nota da IA antes de gravar, para cair na mesma linha da candidatura
      const nota = avaliarCurriculo_(dados.__arquivo, dados);
      if (nota) {
        dados["Nota IA"] = nota.nota;
        dados["Nota IA - Justificativa"] = nota.justificativa;
      }
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

/**
 * Manda o PDF para a Claude API e devolve { nota, justificativa }.
 * Devolve null (sem nota) em qualquer falha — a candidatura nunca se perde por causa da IA.
 * Só PDF é avaliado: a API não lê .doc/.docx como documento.
 */
function avaliarCurriculo_(arq, dados) {
  if (!IA_NOTA_ATIVA) return null;

  const chave = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!chave) {
    console.warn("ANTHROPIC_API_KEY não configurada — candidatura gravada sem nota");
    return null;
  }
  if (!/\.pdf$/i.test(String(arq.nome))) {
    return { nota: "", justificativa: "(nota automática só para PDF; este currículo veio em Word)" };
  }

  const esquema = {
    type: "object",
    properties: {
      nota: {
        type: "number",
        description: "Nota de 0 a 10 para a aderência do currículo à vaga. Pode ter uma casa decimal.",
      },
      justificativa: {
        type: "string",
        description: "2 a 4 frases, em português do Brasil, dizendo o que sustenta a nota e o que falta. Citar o que está escrito no currículo, não supor.",
      },
    },
    required: ["nota", "justificativa"],
    additionalProperties: false,
  };

  const prompt =
    "Você avalia currículos para uma vaga de " + (dados["Vaga"] || "vendas") +
    " numa agência de marketing (V4 Company), em Porto Alegre.\n\n" +
    "Critérios, em ordem de peso:\n" +
    IA_CRITERIOS.map(function (c, i) { return (i + 1) + ". " + c; }).join("\n") +
    "\n\nO candidato também respondeu no formulário:\n" +
    "- Experiência declarada: " + (dados["Experiência"] || "(não respondeu)") + "\n" +
    "- Pretensão salarial: " + (dados["Pretensão salarial"] || "(não informou)") + "\n" +
    "- Cidade: " + (dados["Cidade"] || "(não informou)") + "\n\n" +
    "Dê uma nota de 0 a 10 para a aderência do currículo anexo a essa vaga. " +
    "Seja criterioso e use a escala toda: 5 é um candidato mediano, 8 ou mais é raro e " +
    "precisa de evidência clara no currículo. Não invente experiência que não está escrita. " +
    "Se o currículo estiver vazio, ilegível ou não for um currículo, dê 0 e diga isso.";

  try {
    const resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      headers: { "x-api-key": chave, "anthropic-version": "2026-10-21" },
      payload: JSON.stringify({
        model: IA_MODELO,
        max_tokens: 1024,
        output_config: { format: { type: "json_schema", schema: esquema } },
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: arq.base64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    const codigo = resp.getResponseCode();
    if (codigo !== 200) {
      console.error("Claude API devolveu " + codigo + ": " + resp.getContentText().slice(0, 500));
      return { nota: "", justificativa: "(falha na avaliação automática: HTTP " + codigo + ")" };
    }

    const corpo = JSON.parse(resp.getContentText());

    // classificador de segurança pode recusar; nunca é erro HTTP
    if (corpo.stop_reason === "refusal") {
      return { nota: "", justificativa: "(a IA recusou avaliar este arquivo)" };
    }

    const texto = (corpo.content || [])
      .filter(function (b) { return b.type === "text"; })
      .map(function (b) { return b.text; }).join("");

    const json = JSON.parse(texto);
    const n = Number(json.nota);
    if (!isFinite(n) || n < 0 || n > 10) throw new Error("nota fora de 0–10: " + json.nota);

    return { nota: Math.round(n * 10) / 10, justificativa: String(json.justificativa || "") };
  } catch (err) {
    console.error("avaliação do currículo falhou: " + err);
    return { nota: "", justificativa: "(falha na avaliação automática)" };
  }
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
                    "Experiência": 420, "Por que essa vaga": 360, "Currículo": 220,
                    "Nota IA": 80, "Nota IA - Justificativa": 400,
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

  // Nota da IA: centralizada, em negrito e com escala de cor (vermelho -> amarelo -> verde)
  const cNota = COLUNAS.indexOf("Nota IA") + 1;
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
               (dados["Nota IA"] !== undefined && dados["Nota IA"] !== ""
                 ? " — nota " + dados["Nota IA"] : ""),
      htmlBody:
        "<p><b>" + escapar_(dados["Nome"]) + "</b> se candidatou para <b>" +
        escapar_(dados["Vaga"]) + "</b>.</p>" +
        (dados["Nota IA"] !== undefined && dados["Nota IA"] !== ""
          ? "<p style='font-size:15px'><b>Nota da IA: " + escapar_(dados["Nota IA"]) + "/10</b><br>" +
            "<span style='color:#555'>" + escapar_(dados["Nota IA - Justificativa"]) + "</span></p>"
          : "") +
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
