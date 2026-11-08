# Metodologia da simulação

## Propósito

O laboratório é uma ferramenta didática para comparar decisões de políticas sobre os mesmos pedidos fictícios. A referência conceitual é o NIST SP 800-207, que descreve uma arquitetura Zero Trust orientada à proteção de recursos e não concede confiança implícita a uma conta ou ativo apenas por sua localização de rede ou propriedade [1]. O SP 1800-35 apresenta exemplos práticos de arquiteturas de referência construídas no NCCoE; o simulador não replica esses ambientes [2].

## Cenários

A Baseline inicial representa um caso configurável de controle coarse-grained. Com credencial válida, pode permitir comunicação entre segmentos internos, excetuando a rede de convidados. Isso faz com que certos pedidos de baixo privilégio ou para recursos críticos sejam autorizados no exemplo. É uma decisão deliberada para demonstrar alcance amplo, não uma afirmação sobre toda arquitetura tradicional.

O exemplo Zero Trust aplica os sinais habilitados na sua política: postura do dispositivo; estado da identidade; contexto remoto, incluindo VPN e MFA; nível de privilégio; grupo autorizado; concessão explícita por recurso; MFA opcional por recurso; e regra de comunicação. Os critérios podem ser editados pelo usuário. Cada pedido é avaliado novamente no instante da simulação. Os valores e identidades não são enviados a um serviço de autenticação. A orientação Microsoft descreve “verify explicitly”, menor privilégio e pressuposição de violação; o laboratório representa alguns desses princípios em um modelo local, sem integrar Microsoft Entra ID ou outros serviços [3].

## Regras de comunicação

Uma tentativa tem origem e destino fictícios. O motor ordena suas regras didáticas por prioridade numérica crescente e procura a primeira regra que coincida com segmento de origem, segmento do recurso de destino e ID do recurso. `ALLOW` permite seguir para a decisão de autorização; `DENY` encerra o salto. Caso nenhuma regra corresponda, é usada a política padrão `allow` ou `deny` do cenário. No percurso lateral, cada recurso alcançado passa a ser a origem lógica do próximo salto. A simulação para no primeiro salto negado e registra somente os recursos anteriores que foram alcançados.

Essa ordenação é uma abstração própria do laboratório, não uma emulação do pfSense. A documentação Netgate descreve regras aplicadas por interface, no sentido inbound, com processamento e tabela de estados próprios; os controles interativos daqui não configuram nem alteram uma instância pfSense [4]. A exigência de MFA por recurso também é lógica local: um checkbox de verificação sintética representa o step-up, não uma transação real de autenticação.

A autenticação e a autorização são campos distintos no resultado. Credencial inválida ou conta inativa falha na etapa de autenticação. Privilégio, concessões, postura, contexto e política de segmento influenciam a decisão de acesso. Um dispositivo comprometido pode gerar `RESTRICTED`; uma entidade desconhecida gera `DENY`; um estado de dispositivo não comprovado pode gerar `REVIEW` quando o controle está ativado.

O material do FreeRADIUS diferencia autenticação e autorização dentro do processamento AAA [5]. A interface usa essa distinção conceitual, mas o projeto não implementa RADIUS, consulta diretórios ou armazena senhas: credenciais e MFA são valores booleanos fictícios.

## Reprodutibilidade e limites

O motor é determinístico para a mesma entrada e configuração. Não usa valores aleatórios. IDs de evento e timestamps identificam as ocorrências locais, mas não alteram as regras da decisão. O tempo de decisão é sintético e deriva de uma base e de um custo por verificação configurados no cenário. Não é duração de rede, benchmark, métrica de produto nem resultado empírico.

Todos os nomes, grupos, dispositivos, endereços privados, recursos e resultados são fictícios. Nenhum teste tenta autenticar contra um serviço real, escanear portas, explorar vulnerabilidades, enviar pacotes ou alterar infraestrutura. O projeto é um simulador executado no navegador, não uma ferramenta de segurança operacional.

## Referências

[1] [NIST SP 800-207 — Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final).

[2] [NIST SP 1800-35 — Implementing a Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/1800/35/final) e [página do projeto NCCoE](https://www.nccoe.nist.gov/projects/implementing-zero-trust-architecture).

[3] [Microsoft — Zero Trust as a security foundation](https://learn.microsoft.com/en-us/security/zero-trust/zero-trust-overview).

[4] [Netgate — pfSense Rule Methodology](https://docs.netgate.com/pfsense/en/latest/firewall/rule-methodology.html).

[5] [FreeRADIUS — Authentication concepts](https://freeradius.org/documentation/freeradius-server/3.2.11/concepts/aaa/authn.html).
