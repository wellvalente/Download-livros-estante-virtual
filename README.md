# Estante SENAI — Download de Livros em PDF

Ferramentas para baixar o **PDF completo** de livros da [Estante de Livros SENAI](https://estantedelivros.senai.br) (versão web).

O visualizador da plataforma usa **PDF.js** e só renderiza as páginas visíveis na tela (carregamento sob demanda). Por isso, imprimir ou usar "Salvar como PDF" do navegador captura apenas parte do livro. Estas ferramentas baixam o arquivo inteiro chamando o **mesmo endpoint de download que o próprio site utiliza**.

## Como funciona

Ao abrir um livro (`/view/{driveId}`), o app autentica via Identidade SENAI (token JWT Bearer) e busca o PDF em:

```
https://api.recursosdidaticos.senai.br/api/estante/livros/{driveId}/download
```

Ambas as ferramentas reaproveitam esse fluxo: capturam o token da sessão já autenticada e baixam o arquivo completo.

## Conteúdo do repositório

| Caminho | Descrição |
|---------|-----------|
| `chrome-extension/` | Extensão para Chrome com botão e menu de contexto **"Download livro"** |
| `download_livro.py` | Script Python (CLI) para baixar via token ou login automatizado com Playwright |
| `extrair_token_console.js` | Snippet para o Console do DevTools que extrai `driveId` e token |
| `requirements.txt` | Dependências do script Python |

---

## Opção 1 — Extensão do Chrome (recomendada)

A forma mais simples: instala uma vez e baixa com um clique.

### Instalação

1. Abra `chrome://extensions/`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `chrome-extension`

### Uso

1. Acesse [estantedelivros.senai.br](https://estantedelivros.senai.br) e faça login
2. Abra um livro (URL com `/view/...`) e deixe carregar algumas páginas
3. Baixe o PDF completo de uma destas formas:
   - **Botão direito do mouse** sobre o livro → **Download livro (PDF completo)**
   - Botão azul **Download livro** no canto inferior direito
   - Clique no ícone da extensão na barra do Chrome

Há um **painel de debug** que mostra cada passo (token, endpoint, status, tamanho do arquivo) para facilitar a identificação de erros.

> Detalhes técnicos da extensão em [`chrome-extension/README.md`](chrome-extension/README.md).

---

## Opção 2 — Script Python

Útil para automação ou download em lote.

### Instalação

```bash
pip install -r requirements.txt
playwright install chromium   # apenas se for usar o login automatizado
```

### Uso

```bash
# Com login manual no navegador (abre o Chromium)
python download_livro.py --url "https://estantedelivros.senai.br/view/SEU_DRIVE_ID"

# Com token copiado do DevTools (sem abrir navegador)
python download_livro.py --drive-id SEU_DRIVE_ID --token "eyJhbG..."
```

Para obter o token manualmente, cole o conteúdo de `extrair_token_console.js` no Console do DevTools (F12) com o livro aberto.

---

## Endpoints da API

| Endpoint | Função |
|----------|--------|
| `/estante/livros/{driveId}/download` | PDF completo |
| `/estante/livros/{driveId}/sample` | Amostra (parcial) |
| `/estante/livros/{driveId}/details` | Metadados do livro |

O `driveId` aparece na URL ao abrir o livro: `estantedelivros.senai.br/view/{driveId}`.

---

## Aviso legal

Este projeto é destinado **exclusivamente a estudo pessoal**, permitindo o acesso offline a conteúdos aos quais o usuário já tem acesso legítimo através de sua conta SENAI. Respeite os **termos de uso** da plataforma e os **direitos autorais** dos materiais. Não redistribua os arquivos baixados. O uso é de responsabilidade do usuário.

## Licença

MIT.
