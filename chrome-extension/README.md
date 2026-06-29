# Extensão Chrome — Download Livro (Estante SENAI)

Botão flutuante **"Download livro"** na página do visualizador. Baixa o PDF completo via API oficial (mesmo endpoint que o site usa).

## Instalação

1. Abra o Chrome e vá em `chrome://extensions/`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `chrome-extension` deste projeto

## Uso

1. Acesse [estantedelivros.senai.br](https://estantedelivros.senai.br) e faça login
2. Abra um livro (URL com `/view/...`)
3. Baixe o PDF completo de uma destas formas:
   - **Botão direito do mouse** sobre o livro → **Download livro (PDF completo)**
   - Botão azul **Download livro** no canto inferior direito
   - Clique no ícone da extensão na barra do Chrome
4. O PDF completo será salvo na pasta de downloads do Chrome

> Após editar a extensão, vá em `chrome://extensions/` e clique no ícone de **recarregar** no card da extensão.

## Observações

- O botão só aparece em páginas de leitura (`/view/{id}`)
- Se a sessão expirar, faça login novamente
- Use apenas para estudo pessoal, conforme os termos da plataforma SENAI
