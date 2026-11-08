# Arquitetura do ZERO TRUST LAB

O ZERO TRUST LAB é uma aplicação estática, executada no navegador. O módulo `site/js/data/default-state.js` fornece uma nova cópia do estado fictício inicial. `site/js/core/test-catalog.js` define sete casos determinísticos e seis presets. `policy-engine.js` avalia identidade, dispositivo, contexto, privilégios, regra de segmento e recurso. `simulator.js` executa a mesma entrada na Baseline e no Zero Trust. `audit.js` registra dois eventos com a decisão e um snapshot da política em vigor. `metrics.js` calcula contagens e taxas a partir dos eventos; `exporters.js` serializa CSV e JSON. Os módulos de `site/js/ui/` conectam esses contratos aos painéis.

## Fluxo e contratos

`createDefaultState()` retorna um estado isolado contendo `schemaVersion`, revisão, identidades, grupos, dispositivos, segmentos, recursos, cenários, eventos e metadados. O schema atual é a versão 3; estruturas aninhadas malformadas ou versões incompatíveis são substituídas pelo estado demonstrativo com aviso. Recursos possuem um sinal sintético `requiresMfa`; o controle de cenário `enforceResourceMfa` decide se a solicitação exige step-up. `buildScenarioConfig(state, scenarioId)` combina a política escolhida às entidades e rejeita cenários inexistentes. `evaluateAttempt(attempt, scenarioConfig)` devolve decisão, status de autenticação e autorização, justificativas, regra, recursos alcançados, saltos, trilha de decisão, quantidade de verificações e tempo sintético. `runPairedTest(attempt, state)` preserva as entradas e calcula os dois cenários. `runTestSuite(state, testIds?)` executa os casos na ordem selecionada.

`outcome` é `ALLOW`, `DENY`, `RESTRICTED` ou `REVIEW`. Entidades desconhecidas falham fechadas. Regras de rede são ordenadas por prioridade crescente; a primeira regra que corresponde à origem, destino e recurso determina o resultado de rede. Sem correspondência, aplica-se `defaultNetworkPolicy`.

`appendPairedAuditEvents(state, pair, { timestamp })` retorna outro estado, sem mutar o original. Cada evento inclui origem/destino, usuário e dispositivo fictícios, motivo, regra, trilha, resultado, versão da configuração e cópia da política. Uma atualização posterior não reescreve os snapshots históricos. A persistência usa `localStorage`, valida o schema e apresenta aviso quando recupera um valor inválido ou incompatível.

## Modelos comparados

A Baseline demonstrativa é intencionalmente coarse-grained: após autenticação válida, sua regra libera comunicação entre redes internas, exceto a zona de convidados, e não aplica as listas finas por grupo/recurso do cenário Zero Trust. O cenário Zero Trust demonstrativo pode exigir dispositivo confiável, MFA/VPN remoto, MFA por recurso, autorização por grupo, concessão explícita, privilégio mínimo e regras de rede por recurso. Esses exemplos permitem observar como configurações diferentes alteram decisões; não caracterizam todas as redes tradicionais nem equivalem a uma implantação real. Microsoft Zero Trust Guidance informa os princípios de verificação explícita, privilégio mínimo e pressuposição de violação [4].

Na arquitetura NIST, Policy Engine (PE) e Policy Administrator (PA) são funções que, em conjunto, formam o Policy Decision Point (PDP); o Policy Enforcement Point (PEP) é o local onde a decisão é aplicada. O motor local representa essas funções conceitualmente, sem instanciar componentes distribuídos de produção [1]. O NIST SP 1800-35 é um guia prático de implementações de referência; este laboratório não reproduz seus 19 exemplos tecnológicos [2].

As regras por prioridade e o sinal de MFA são simplificações próprias, não uma implementação das regras inbound/stateful do pfSense [5] nem um serviço AAA do FreeRADIUS. A documentação FreeRADIUS é referencial para a distinção conceitual de autenticação, não para uma integração executável [6].

## Privacidade e dependências

O estado e as decisões permanecem no navegador. Os gráficos usam Chart.js 4.6.1, obtido de jsDelivr com versão fixada; o CDN recebe a solicitação da biblioteca, não os dados de `localStorage`. Se o CDN estiver indisponível, a lógica, os formulários, a persistência, as tabelas e as exportações continuam disponíveis, mas os gráficos podem não ser desenhados. Não há API de backend, telemetria, autenticação real, varredura, alteração de firewall ou tráfego contra hosts.

## Referências

[1] [NIST SP 800-207 — Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final). Publicado em agosto de 2020.

[2] [NIST SP 1800-35 — Implementing a Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/1800/35/final). Guia final publicado em junho de 2025.

[3] [Chart.js — Installation](https://www.chartjs.org/docs/latest/getting-started/installation.html) e [release 4.6.1](https://github.com/chartjs/Chart.js/releases/tag/v4.6.1).

[4] [Microsoft — Zero Trust as a security foundation](https://learn.microsoft.com/en-us/security/zero-trust/zero-trust-overview).

[5] [Netgate — pfSense Rule Methodology](https://docs.netgate.com/pfsense/en/latest/firewall/rule-methodology.html).

[6] [FreeRADIUS — Authentication concepts](https://freeradius.org/documentation/freeradius-server/3.2.11/concepts/aaa/authn.html).
