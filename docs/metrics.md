# Métricas e interpretação

Todas as métricas são calculadas no navegador a partir de eventos persistidos em `localStorage`. Os cenários Baseline e Zero Trust têm contagens próprias. A interface não preenche gráficos com resultados inventados.

- **Tentativas**: quantidade de eventos do cenário. Cada caso pareado produz um evento por cenário.
- **ALLOW**: decisões que autorizaram o recurso solicitado.
- **DENY**: decisões que negaram o acesso no ponto avaliado.
- **RESTRICTED**: decisão de contenção ou alcance parcial; não é sucesso total nem é agregado a ALLOW.
- **REVIEW**: decisão pendente de revisão por sinal de confiança não comprovado; exibida separadamente.
- **Bloqueio de tentativa adversa (%)**: `(eventos adversos com DENY ou RESTRICTED ÷ eventos adversos classificados) × 100`.
- **Sucesso de pedido legítimo (%)**: `(eventos legítimos com ALLOW ÷ eventos legítimos classificados) × 100`.
- **Contenção lateral**: número de eventos de `lateral-movement` com `DENY` ou `RESTRICTED`, sobre o total de eventos laterais daquele cenário. Eventos `REVIEW` são mostrados à parte e não contam como bloqueio confirmado.
- **Tempo sintético médio**: média dos tempos retornados pelo motor para as decisões filtradas. É calculado pela fórmula de verificações do modelo, não por cronômetro de execução.
- **Recursos alcançados**: conjunto distinto de IDs presentes em `reachableResources` no escopo selecionado.
- **Recursos alcançados por identidade**: para cada usuário e cenário, união dos IDs que aparecem em `reachableResources` nos eventos filtrados. Um usuário com tentativa registrada, mas sem recurso alcançado, aparece com contagem zero. O relatório apresenta os nomes dos recursos quando disponíveis.

Os denominadores das taxas usam a classificação registrada na tentativa. Casos do catálogo são adversos por padrão. Pedidos personalizados não entram nas taxas até serem classificados como legítimos ou adversos. Se não houver tentativas classificadas de uma categoria, a taxa correspondente é `null` e a interface mostra “Sem dados”; não se apresenta 0% como se houvesse observação.

A média, os percentuais e os recursos por identidade descrevem somente o conjunto de eventos selecionado. `REVIEW` é contabilizado separadamente e não conta como acesso bloqueado na taxa adversa. A diferença entre duas taxas não demonstra causalidade nem eficácia geral. Alterações nas regras e nos dados influenciam os resultados das execuções futuras. Os eventos históricos retêm um snapshot da política utilizada no momento.
