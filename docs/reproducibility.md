# Execução e reprodução

## Requisitos

Node.js 20 ou superior e npm são necessários para executar os testes e o servidor local. Não é necessário `npm install`: o núcleo e os testes usam recursos nativos do Node. Chart.js 4.6.1 é carregado de jsDelivr para desenhar os gráficos; com a rede indisponível, os outros módulos continuam operacionais.

## Iniciar localmente

Na raiz do repositório:

```sh
npm test
npm run serve
```

Abra `http://127.0.0.1:4173/`. O servidor local serve exclusivamente `site/`, escuta apenas em loopback e não oferece API. Use um servidor HTTP local em vez de abrir `index.html` por `file://`, pois a aplicação usa módulos ES.

## Repetir um experimento

Na interface, selecione um dos seis presets ou marque casos específicos e escolha, se desejado, identidade/recurso alternativos. “Executar bateria completa” avalia os sete casos do catálogo nos dois cenários. Durante uma bateria, a interface registra cada par e atualiza os painéis e a trilha local progressivamente. Para medir sucesso legítimo, execute uma solicitação personalizada e selecione a classificação correspondente. Antes de comparar métricas, registre quais políticas estavam ativas; o evento guarda um snapshot delas. Repetir a mesma tentativa com o mesmo estado produz as mesmas decisões e tempos sintéticos.

## Armazenamento e exportação

A configuração e os eventos ficam no `localStorage` do perfil de navegador atual. Exportar CSV/JSON gera arquivos locais. “Limpar histórico” preserva identidades, recursos e políticas; “Restaurar dados demonstrativos” substitui todo o estado local, após confirmação. Uma atualização incompatível de schema recupera o estado demonstrativo e avisa o usuário; exporte dados que queira conservar antes de atualizar. Não insira credenciais reais ou dados pessoais.

## GitHub Pages

O workflow `.github/workflows/pages.yml` valida o projeto e publica apenas o diretório `site/` quando executado após a integração na branch principal. Os caminhos de assets são relativos para permitir hospedagem em um subdiretório do projeto. No GitHub, habilite Pages por GitHub Actions se ainda não estiver configurado. Um workflow verde confirma upload do artefato; a URL deve ser testada no navegador antes de declarar a publicação pública disponível.
