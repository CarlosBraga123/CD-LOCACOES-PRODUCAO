# Arquitetura do projeto CD Locacoes

Este documento registra o estado atual do aplicativo local e orienta a migracao gradual para Supabase sem quebrar o uso existente em `localStorage`.

## Mapa das telas

As telas sao controladas em `src/App.jsx` por `selectedPage`.

| Chave interna | Tela | Componente | Observacao |
| --- | --- | --- | --- |
| `dashboard` | Painel de Controle | `Dashboard` | Tela inicial para admin/gestor. |
| `construtoras` | Construtoras | `Construtoras` | Cadastro base usado por obras, atividades e relatorios. |
| `obras` | Obras | `Obras` | Cadastro base usado por atividades, detalhes e relatorios. |
| `atividades` | Atividades | `Atividades` | Principal fluxo operacional. |
| `agenda` | Agenda | `Agenda` | Visualizacao das atividades por data. |
| `tarefas` | Lista de Tarefas | `ListaDeTarefas` | Tarefas por usuario/operacao. |
| `relatoriofinanceiro` | Relatorio Financeiro | `RelatorioFinanceiro` | Le atividades e valores configurados. |
| `relatorioservicos` | Relatorio de Servicos | `RelatorioServicos` | Le atividades, construtoras e obras. |
| `detalhesobra` | Detalhes da Obra | `DetalhesObra` | Consulta obra e atividades relacionadas. |
| `backup` | Backup | `BackupImportacao` | Exporta/importa JSON local. |
| `usuarios` | Usuarios | `Usuarios` | Cadastro local de usuarios. |
| `configuracoes` | Configuracoes | `Configuracoes` | Materiais, valores de servicos e ajustes. |

## Chaves do localStorage

Chaves principais encontradas no projeto:

| Chave | Tipo esperado | Uso atual |
| --- | --- | --- |
| `atividades` | Array | Atividades operacionais, agenda, relatorios, detalhes da obra e configuracoes. |
| `construtoras` | Array | Cadastro de construtoras e filtros/relacionamentos. |
| `obras` | Array | Cadastro de obras e relacionamento com atividades. |
| `tarefas` | Array | Lista de tarefas e painel. |
| `usuarios` | Array | Cadastro local de usuarios. |
| `usuarioLogado` | Objeto | Sessao local do usuario. |
| `pecasBalancinho` | Objeto | Textos padrao de materiais por tamanho de balancinho. |
| `pecasAncoragem` | Objeto | Textos padrao por tipo de ancoragem. |
| `valoresServicos` | Objeto | Valores configuraveis por equipamento/servico. |
| `valoresPadrao` | Objeto | Valores padrao usados pelo relatorio financeiro. |
| `empresaLogo` | String | Logo customizada da empresa. |
| `empresaNome` | String | Nome customizado da empresa. |
| `ultimoBackup` | String | Registro textual da ultima acao de backup/importacao. |

## Telas pouco usadas ou orfas

Itens que merecem validacao antes da migracao:

- `Login`: existe e usa Firebase, mas o `App` esta com usuario admin simulado e nao renderiza o fluxo de login.
- `EmpresaHeader`: le `empresaLogo` e `empresaNome`, mas nao aparece ligado diretamente ao menu principal em `App.jsx`.
- `testeSupabase.jsx` e botao "Testar Supabase": parecem ser apoio tecnico de validacao, nao uma tela de uso final.
- `firebase.jsx`: ainda existe porque o login usa Firebase, mas o plano atual aponta para Supabase.
- `Agenda`: aparece no menu e renderiza atividades, mas nao possui titulo proprio no `renderTitle`, entao pode cair no titulo padrao em mobile.

Esses pontos nao devem ser removidos automaticamente. Primeiro devem ser confirmados com uso real ou substituidos por telas equivalentes no Supabase.

## Compatibilidade do backup JSON

O backup JSON atual deve continuar compativel durante e depois da migracao.

Formato exportado atualmente:

```json
{
  "atividades": [],
  "construtoras": [],
  "obras": [],
  "pecasBalancinho": {},
  "pecasAncoragem": {},
  "tarefas": [],
  "usuarios": []
}
```

Regras para manter compatibilidade:

- Nao renomear essas chaves sem criar uma camada de conversao.
- Continuar aceitando arquivos antigos que tenham apenas parte das chaves.
- Preservar os campos internos atuais dos objetos ate validar a migracao completa.
- Se novas tabelas/campos surgirem no Supabase, exportar tambem no backup sem remover as chaves antigas.
- A importacao deve continuar preenchendo `localStorage` enquanto ele for usado como cache temporario.

## localStorage como cache temporario

Durante a migracao, o `localStorage` deve deixar de ser a fonte definitiva de dados e passar a funcionar como cache temporario.

Diretriz proposta:

1. Ler primeiro do Supabase quando a tela ja estiver migrada.
2. Usar `localStorage` como fallback enquanto a tela ainda nao estiver validada.
3. Ao salvar no Supabase com sucesso, atualizar tambem o `localStorage` para manter a interface atual estavel.
4. Em caso de falha de rede, nao apagar dados locais.
5. Registrar claramente quais telas ja usam Supabase como fonte principal.

## Regra de locacao de equipamentos

Servico cobrado e movimentacao de locacao sao coisas diferentes. Uma mesma atividade pode cobrar servico, movimentar locacao, fazer as duas coisas ou servir apenas como registro operacional.

Regras operacionais:

- `Instalacao`: cobra servico e inicia locacao.
- `Deslocamento`: cobra servico e nao altera locacao.
- `Manutencao`: cobra servico e nao altera locacao.
- `Ascensao`: cobra servico e nao altera locacao.
- `Remocao`: cobra servico e encerra locacao.
- `Somente aluguel` ou `Entrega de equipamento`: nao cobra servico e inicia locacao.
- `Recolhimento` ou `Devolucao de equipamento`: nao cobra servico e encerra locacao.
- Cada atividade precisa registrar a quantidade de equipamentos movimentados.
- A tela `Atividades` continua sendo a entrada principal dos movimentos operacionais.
- O relatorio de servicos e o relatorio de locacao devem ser separados.
- O relatorio de servicos deve considerar apenas atividades que cobram servico.
- O relatorio de locacao deve considerar atividades que iniciam ou encerram locacao.
- O relatorio mensal deve calcular aluguel proporcional pelos dias dentro do mes selecionado.
- Precos de servicos e precos de locacao poderao variar por construtora e por obra.
- Atividades antigas ja salvas em backup devem continuar compativeis e nao devem ser convertidas de forma destrutiva.

Modelo conceitual proposto:

- `atividades`: historico operacional de servicos executados ou agendados.
- `locacoes`: controle de periodos em que um equipamento ficou alugado em uma obra.
- `precosServicos`: tabela de precos para instalacao, remocao, manutencao, deslocamento e ascensao.
- `precosLocacao`: tabela de precos para aluguel por equipamento, tamanho, obra, construtora e periodicidade.

Regra de prioridade de precos:

1. Preco especifico da obra.
2. Preco especifico da construtora.
3. Preco padrao do equipamento/servico.

Compatibilidade:

- Registros antigos de `atividades` devem continuar sendo lidos como estao hoje.
- Se uma atividade antiga nao tiver campos novos, o app deve assumir comportamento legado.
- O backup deve continuar exportando e importando as chaves antigas.
- Novas chaves de locacao e precos podem ser adicionadas ao backup sem remover as antigas.

## Ordem de migracao para Supabase

Ordem recomendada para reduzir risco:

1. Preparar cliente Supabase e variaveis de ambiente.
2. Criar tabelas equivalentes para `construtoras`, `obras`, `atividades`, `tarefas`, `usuarios` e configuracoes.
3. Migrar `construtoras`, por ser cadastro base e ter baixo acoplamento.
4. Migrar `obras`, validando relacao com construtoras.
5. Migrar `atividades`, mantendo compatibilidade com agenda, dashboard, relatorios e detalhes da obra.
6. Migrar `tarefas`, validando painel e usuario responsavel.
7. Migrar `configuracoes`, incluindo materiais e valores de servicos.
8. Migrar `usuarios` e definir o fluxo final de autenticacao.
9. Atualizar backup/importacao para ler e gravar Supabase, mantendo exportacao JSON compativel.
10. Validar relatorios, agenda e detalhes da obra com dados reais.

## Regra importante: nao remover localStorage ainda

O `localStorage` nao deve ser removido ate validar tudo com dados reais.

Checklist minimo antes de remover ou reduzir o uso:

- Backup antigo importa corretamente.
- Backup novo exporta as chaves antigas.
- Construtoras, obras e atividades aparecem iguais antes e depois da migracao.
- Agenda, dashboard e relatorios batem com os dados do Supabase.
- Edicoes feitas offline ou com erro de rede nao causam perda silenciosa.
- Fluxo de usuarios/login foi decidido: Supabase Auth, tabela propria ou outro modelo.

Enquanto qualquer item acima estiver pendente, manter `localStorage` como apoio de compatibilidade e recuperacao.
