# Casos de teste sintéticos

Cada caso usa identidades, dispositivos, recursos e segmentos fictícios. Por padrão, todos os casos do catálogo são classificados como adversos para o cálculo da taxa de bloqueio. A tela também permite criar pedidos personalizados e classificá-los explicitamente como legítimos, adversos ou não classificados. A classificação é metadado experimental; ela não altera a decisão do motor.

| ID | Caso | Tentativa demonstrativa | Baseline inicial | Zero Trust inicial |
|---|---|---|---|---|
| `invalid-credential` | Credencial inválida | Credencial sintética inválida para servidor de arquivos | DENY | DENY |
| `insufficient-privilege` | Usuário sem privilégio | Funcionário solicita banco de dados | ALLOW | DENY |
| `compromised-device` | Dispositivo comprometido | Endpoint sinalizado solicita arquivos | ALLOW | RESTRICTED |
| `lateral-movement` | Movimentação lateral | Arquivos → banco de dados → painel administrativo | ALLOW; percorre a rota configurada | RESTRICTED após alcançar somente arquivos |
| `unauthorized-remote` | Acesso remoto | Serviço remoto sem VPN ou MFA | ALLOW no modelo coarse-grained inicial | DENY |
| `privilege-escalation` | Escalada de privilégios | Analista solicita nível administrativo | DENY | DENY |
| `critical-resource` | Recurso crítico | Funcionário solicita sistema financeiro com MFA sintético verificado | ALLOW | DENY |

Essas expectativas correspondem às políticas padrão do estado demonstrativo. Ao alterar usuários, recursos ou regras, os resultados podem mudar. A tabela é uma previsão do modelo inicial, não evidência de comportamento em rede real.

O motor pode exigir MFA por recurso quando o controle `Aplicar MFA exigido por recurso` estiver habilitado no cenário e o recurso tiver `MFA requerido` marcado. O caso crítico predefinido informa MFA sintético como verificado para que a comparação principal destaque grupo, concessão e privilégio; o caso de acesso remoto continua avaliando VPN/MFA remotos ausentes.

## Presets

`corporate-basic` executa privilégio insuficiente e acesso crítico. `credential-attacks` executa credencial inválida e escalada de privilégios. `lateral-movement` executa a rota entre arquivos, banco e painel. `compromised-device` avalia a postura do endpoint. `remote-access` avalia acesso externo sem VPN/MFA. `audit-compliance` executa os sete casos do catálogo.

A bateria completa executa os sete IDs em ordem estável. O catálogo também pode executar um subconjunto. Uma solicitação personalizada permite escolher identidade, recurso, privilégio solicitado e contexto remoto; ela é identificada como `custom-access` no histórico.
