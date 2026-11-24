# Vagas V4 Mendes

Página pública com as vagas abertas da unidade. O candidato abre a vaga, se candidata e a
resposta cai numa planilha do Google.

Mesmo padrão do `formulario-diagnostico-v4`: página estática no GitHub Pages + Apps Script
gravando na planilha. Sem servidor, sem custo.

```
index.html      a página e o formulário
vagas.js        AS VAGAS — é só aqui que você mexe no dia a dia
apps-script.gs  recebe a candidatura e grava na planilha
```

## Abrir, fechar ou editar uma vaga

Mexa **só em `vagas.js`**, faça commit e o Pages atualiza em ~1 minuto.

- **Fechar uma vaga:** troque `aberta: true` por `aberta: false`. A vaga sai do ar, o texto fica
  guardado para a próxima vez.
- **Abrir uma vaga nova:** copie um bloco inteiro, troque o `id` (sem espaço e sem acento) e
  reescreva os campos.
- **Nenhuma vaga aberta:** a página mostra sozinha um aviso de que não há processo em andamento.

O `id` vira link direto: `...?vaga=sdr` abre a página já com aquela vaga expandida. Serve para
divulgar uma vaga só. Não mude o `id` depois de divulgar, senão o link antigo para de funcionar.

## Ligar a planilha (uma vez)

1. Crie uma planilha no Drive. Da URL
   `https://docs.google.com/spreadsheets/d/<ID>/edit`, copie o `<ID>`.
2. Em `apps-script.gs`, cole em `PLANILHA_ID`.
3. Quem recebe o aviso de candidatura nova já está configurado: `AVISAR` manda para o Vini
   (`vinicius.mendes@v4company.com`) e `AVISAR_CC` põe a Ancila em cópia
   (`ancila.ferreira@v4company.com`). Lista vazia = não avisa ninguém.
   **O e-mail sai da conta que publicar o Apps Script** — o remetente será essa conta.
4. Abra [script.google.com](https://script.google.com) **logado em leonardo.capella@v4company.com**,
   projeto novo, cole o arquivo inteiro.
5. Rode a função `configurar` uma vez e autorize o acesso.
6. **Implantar > Nova implantação > App da Web**
   - Executar como: **eu**
   - Quem tem acesso: **qualquer pessoa**
7. Copie a URL que termina em `/exec` e cole em `CONFIG.endpoint`, no `index.html`.

Enquanto o endpoint não estiver colado, o formulário valida tudo mas avisa na tela que ainda não
está conectado — ninguém envia candidatura no vazio.

> Ao mudar o `apps-script.gs` depois, crie uma **nova versão** da implantação
> (Implantar > Gerenciar implantações > editar > Versão: nova). Sem isso a URL continua
> rodando o código antigo.

## Currículo

O candidato anexa PDF, DOC ou DOCX (até 8 MB). O arquivo vai em base64 no mesmo envio, o Apps
Script salva numa pasta do Drive e grava o link na planilha.

A pasta é criada sozinha como **"Currículos — Vagas V4"** na raiz do seu Drive. Para usar outra,
cole o id dela em `PASTA_CURRICULOS_ID`.

Se o upload falhar, a candidatura **é gravada do mesmo jeito** e a coluna Currículo registra o
erro — os dados do candidato valem mais que o anexo.

## Nota automática de 0 a 10

A nota sai de regra fixa em `pontuar_`, a partir de `IA_CRITERIOS` e das respostas do formulário
(experiência, presencial, aceite de PJ). Sem API e sem chave. Colunas **Nota** e
**Justificativa**. A nota é **só interna** — o candidato nunca vê. Na planilha ela vem com
escala de cor (vermelho → amarelo → verde).

A regra casa palavras no texto que o candidato escreveu. Não lê o PDF. "Não fiz vendas" ainda
conta como experiência em vendas.

**A nota é um atalho de triagem, não um veredito.** Quem decide é a pessoa.

## Campo contra robô

O formulário manda um campo escondido (`website`, em `window.ARMADILHA`). Pessoa não preenche.
Se chegar preenchido, o Apps Script descarta o envio: não grava e não manda e-mail. O nome tem
que ser o mesmo em `vagas.js` e em `ARMADILHA` no `apps-script.gs`.

## Planilha

Uma linha por candidatura, com data/hora de Brasília e a coluna **Status** como lista suspensa
(`Novo`, `Em análise`, `Entrevista`, `Aprovado`, `Reprovado`) para o time mover o candidato pelo
funil na mão.

## Publicar

```bash
git add -A && git commit -m "mensagem" && git push
```

GitHub Pages serve do branch `main`, raiz.

## O que ficou de fora de propósito

- **Login / área do candidato.** Não tem para quem logar.
- **Integração com o Kommo.** O Kommo é o CRM dos clientes, não da unidade
  (regra do vault). Candidatura de vaga fica na planilha.
- **Leitura do currículo.** A nota olha o que o candidato escreveu, não o PDF. Ler o arquivo
  exigiria outra peça.
- **E-mail automático para o candidato.** Hoje o aviso vai só para o time. Resposta ao candidato
  continua na mão, como as mensagens de cliente.
