# ZERO TRUST LAB — Hybrid Network Security Simulator

**Laboratório educacional para comparar decisões de acesso em redes híbridas simuladas.**

O ZERO TRUST LAB complementa o artigo científico *“Implementação e Avaliação de uma Arquitetura Zero Trust em Ambiente Híbrido Utilizando Microsoft Azure, Active Directory e pfSense”*. A aplicação permite configurar dados fictícios, executar os mesmos casos em Baseline e Zero Trust e consultar decisões, eventos e métricas reproduzíveis. Não mede nem comprova eficácia em infraestrutura real.

![Captura do marco visual v0 do dashboard, anterior à implementação funcional completa](site/assets/images/v0-dashboard-desktop.png)

> **Importante:** a imagem acima documenta o marco visual v0. Para abrir a versão funcional, use o servidor local ou o GitHub Pages quando o deploy estiver publicado. A visualização de um arquivo HTML no GitHub, em `file://` ou em um preview que não sirva os arquivos adjacentes pode exibir a página sem CSS, JavaScript ou imagens.

## Funcionalidades

O laboratório contém um motor determinístico, sete casos sintéticos e seis presets. A mesma solicitação é avaliada nos dois cenários. O usuário pode gerenciar identidades, dispositivos e recursos, configurar postura de dispositivo, VPN/MFA, privilégio mínimo, grupos, concessões explícitas e requisitos de MFA por recurso. Regras de comunicação por prioridade configuram o modelo simplificado de microssegmentação.

A interface apresenta um dashboard com indicadores e cinco gráficos, uma topologia conceitual, o resultado visual do último percurso lateral, auditoria pesquisável e filtrável, detalhes de decisão, métricas comparativas e relatório. Durante a bateria, os pares de eventos e painéis são atualizados progressivamente. CSV e JSON podem ser exportados; o relatório também pode ser impresso ou salvo em PDF pelo navegador. Os dados ficam no `localStorage` deste navegador.

## Executar localmente

Requisito: Node.js 20 ou superior. Na raiz do repositório, execute:

```sh
npm test
npm run serve
```

Acesse `http://127.0.0.1:4173/`. Não é necessário instalar dependências npm. O servidor de desenvolvimento escuta somente em `127.0.0.1` e serve apenas `site/`. Não abra `site/index.html` diretamente: os módulos ES precisam de HTTP para funcionar corretamente.

Para reproduzir um experimento, escolha um preset ou selecione casos, execute a bateria completa e examine os resultados, a trilha de eventos e as métricas. Solicitações personalizadas podem ser classificadas como legítimas, adversas ou não classificadas. O histórico e os dados de configuração podem ser limpos na interface após confirmação.

## Privacidade e limites

Todos os usuários, grupos, IPs privados, dispositivos, recursos, políticas, eventos e resultados são fictícios. A aplicação não autentica contra Microsoft Entra ID, Active Directory, FreeRADIUS, pfSense, Rocky Linux ou Azure. Ela não envia tráfego de rede, executa varreduras, explora vulnerabilidades, captura pacotes nem altera infraestrutura. O simulador não armazena credenciais reais.

Os tempos são valores sintéticos determinados pelas verificações do modelo. `DENY` e `RESTRICTED` contam como contenção de tentativas classificadas como adversas; `REVIEW` aparece separadamente. Uma diferença entre os cenários descreve apenas os casos e as políticas selecionados e não demonstra causalidade nem eficácia geral. As regras de segmento são uma abstração didática e não reproduzem a semântica completa de processamento do pfSense.

Chart.js 4.6.1 é carregado do jsDelivr para desenhar gráficos. O navegador solicita a biblioteca ao CDN, mas os dados locais do experimento não são enviados. Sem conexão externa, a lógica, os formulários, a persistência, as tabelas e as exportações continuam disponíveis; os gráficos podem não carregar.

## Estrutura

`site/` contém somente os arquivos estáticos publicados. `site/js/core/` implementa estado, políticas, simulação, persistência, auditoria, métricas e exportadores; `site/js/ui/` conecta esses contratos à interface. `tests/` contém testes do Node nativo. `docs/` documenta arquitetura, metodologia, casos, fórmulas e reprodução. O workflow valida o repositório e publica somente `site/` após passar pelos testes.

## Tecnologias

HTML5 semântico, CSS3 responsivo e JavaScript ES modules; `localStorage` para persistência no navegador; Chart.js 4.6.1 para gráficos; Node.js 20+ e `node:test` para teste e servidor local; GitHub Actions para CI e GitHub Pages para hospedagem. Não há backend, banco remoto, pacote npm ou chave de API obrigatórios.

## Arquitetura

O núcleo puro de `site/js/core/` avalia pedidos determinísticos e retorna decisões com justificativas e trilhas. A interface chama o mesmo pedido nos cenários Baseline e Zero Trust, registra eventos pareados com snapshots de política e recalcula tabelas e gráficos a partir do histórico local. O `localStorage` conserva a configuração e as execuções neste perfil de navegador; o servidor de desenvolvimento não oferece API e serve somente arquivos estáticos.

## Publicação

O repositório atual usado é [`jadirrod/Projeto_Integrador`](https://github.com/jadirrod/Projeto_Integrador). O workflow `.github/workflows/pages.yml` valida a branch `main` e publica o diretório `site/` no GitHub Pages. A URL pública esperada para este nome de repositório é `https://jadirrod.github.io/Projeto_Integrador/`; ela só deve ser considerada disponível depois que o deploy terminar e a URL for confirmada nas configurações do Pages.

## Referências

- [NIST SP 800-207 — Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final).
- [NIST SP 1800-35 — Implementing a Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/1800/35/final).
- [NIST NCCoE — Implementing a Zero Trust Architecture](https://www.nccoe.nist.gov/projects/implementing-zero-trust-architecture).
- [Microsoft — Zero Trust as a security foundation](https://learn.microsoft.com/en-us/security/zero-trust/zero-trust-overview).
- [Netgate — pfSense Rule Methodology](https://docs.netgate.com/pfsense/en/latest/firewall/rule-methodology.html).
- [FreeRADIUS — Authentication concepts](https://freeradius.org/documentation/freeradius-server/3.2.11/concepts/aaa/authn.html).
- [Chart.js — Installation](https://www.chartjs.org/docs/latest/getting-started/installation.html).

## Autoria e licença

**Autor do artigo:** Jadir Gonçalves Rodrigues. **Instituição :** Centro Universitário Senac-RS — Campus Pelotas. O laboratório é um complemento tecnológico independente e não reproduz experimentos de infraestrutura do reais. A licença do software ainda não foi definida pelo responsável; nenhum arquivo `LICENSE` foi criado.
