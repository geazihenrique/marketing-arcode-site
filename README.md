# Site Marketing Arcode

Base estatica pronta para publicar no GitHub Pages.

## Estrutura

- `index.html`: visao geral
- `calendario.html`: calendario e detalhes
- `agenda.html`: lista agrupada por data
- `anotacoes.html`: anotacoes manuais
- `assets/config.js`: configuracao da planilha
- `assets/data.js`: leitura e filtro do Google Sheets
- `assets/notes.js`: anotacoes locais via navegador
- `assets/ui.js`: renderizacao das paginas

## Como publicar no GitHub Pages

1. Crie um repositorio no GitHub.
2. Envie todo o conteudo da pasta `site`.
3. Ative o GitHub Pages nas configuracoes do repositorio.
4. Escolha a branch principal e a pasta raiz.

## Como funciona hoje

- Os dados operacionais sao lidos da planilha publicada em CSV.
- As anotacoes manuais ficam em `localStorage`, ou seja, salvas no navegador atual.

## Importante

Se voce quiser que as anotacoes manuais sejam compartilhadas entre todo o time, o proximo passo e conectar um backend simples. O caminho menos complicado depois desta base e:

- manter o frontend no GitHub Pages
- usar Supabase ou Firebase para salvar as anotacoes compartilhadas

Esta base ja deixa o site pronto para essa evolucao.
