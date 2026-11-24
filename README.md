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
3. Em `AVISAR`, deixe os e-mails que recebem aviso de candidatura nova (lista vazia = não avisa).
4. Abra [script.google.com](https://script.google.com), projeto novo, cole o arquivo inteiro.
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

Cada currículo em PDF recebe uma nota da IA, com justificativa, nas colunas **Nota IA** e
**Nota IA - Justificativa**. A nota é **só interna** — o candidato nunca vê. Na planilha ela vem
com escala de cor (vermelho → amarelo → verde), então dá para ordenar e varrer de cima.

**Modelo:** Claude Haiku 5.5, lendo o PDF direto. Custo medido: **~US$ 0,0005 por currículo**
(uns 5 centavos de dólar a cada 100 candidaturas).

**Para ligar**, em Apps Script > ⚙ Configurações do projeto > Propriedades do script:

| Nome | Valor |
| --- | --- |
| `ANTHROPIC_API_KEY` | sua chave `sk-ant-...` |

> A chave **nunca** vai no código — este repositório é público. Sem a chave, a candidatura é
> gravada normalmente e a nota fica em branco.

**Os critérios estão em `IA_CRITERIOS`**, no topo do `apps-script.gs`. É o que define o que conta
como currículo bom — reescreva conforme o time for calibrando. Hoje pesa: experiência em
vendas/prospecção, evidência de meta batida, uso de CRM, clareza da escrita, estabilidade e
formação na área.

Resultado dos testes com currículo real (escala conferida de ponta a ponta):

| Currículo | Nota |
| --- | --- |
| SDR com 3 anos, 21/24 metas batidas, HubSpot e Kommo | 8,0 |
| Auxiliar de depósito, sem experiência em vendas | 2,0 |
| Arquivo que não era currículo (lista de compras) | 0,0 |

Só PDF é avaliado — currículo em Word entra na planilha com a nota em branco e um aviso na
justificativa. Se a IA falhar ou recusar, a candidatura é gravada igual, com a nota vazia.

**A nota é um atalho de triagem, não um veredito.** Ela ordena a fila para o time olhar primeiro
quem tem mais chance; quem decide é a pessoa. Vale conferir as primeiras notas contra o seu
próprio julgamento antes de confiar na ordenação — e lembrar que currículo mal formatado pode
tirar nota baixa sendo um bom candidato.

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
- **Nota para currículo em Word.** A API lê PDF como documento, não `.docx`. Converter no
  servidor exigiria mais peça; o caso é minoria e cai na triagem manual.
- **E-mail automático para o candidato.** Hoje o aviso vai só para o time. Resposta ao candidato
  continua na mão, como as mensagens de cliente.
