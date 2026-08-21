# EVOLVE Produtividade — MVP

Versão baseada no repositório atual do projeto. Inclui checklist de Matrícula e checklist de Cancelamento com pendências persistentes.

## Executar

Node.js 20+

```bash
node server.js
```

Abra http://localhost:3000

## Cancelamentos

O botão Cancelamentos abre um checklist condicional. Se houver pendências, elas são persistidas em `data/db.json`, aparecem como ⚠ e podem ser resolvidas posteriormente. O +1 em Cancelamentos só é registrado quando todas as pendências daquele cancelamento forem concluídas.
