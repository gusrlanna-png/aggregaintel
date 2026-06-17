# Arquitetura de deploy / atualizações — AggregaIntel

App em produção: **https://aggrega.vertexgus.duckdns.org**
VPS (mesma do Vertex): LuraHosting `185.115.161.84`, Ubuntu 24.04, Node 20, nginx + Let's Encrypt.

## Visão geral

```
  [PC local]  --git push-->  [GitHub (repo privado)]  --git pull-->  [VPS]
   edição       (origin)         versão/histórico       deploy.sh    build+restart
```

- **Código local:** `C:\Users\gusta\dev\aggregaintel` (repo git, branch `main`).
- **GitHub:** repositório **privado** `aggregaintel` (origin). É a fonte de verdade versionada.
- **VPS:** `/home/vertex/aggregaintel` é um clone do mesmo repo; o `deploy.sh` puxa, builda e reinicia.
- **Segredos:** `.env.local` mora só na VPS (`chmod 600`), **fora do git** (`.gitignore`). Nunca é commitado.

## Fluxo de uma atualização

1. Editar os arquivos em `C:\Users\gusta\dev\aggregaintel`.
2. Commit + push:
   ```powershell
   cd C:\Users\gusta\dev\aggregaintel
   git add -A
   git commit -m "descrição da mudança"
   git push
   ```
3. Disparar o deploy na VPS (puxa, builda, reinicia):
   ```powershell
   ssh -i $env:USERPROFILE\.ssh\vertex_ed25519 root@185.115.161.84 "bash /home/vertex/aggregaintel/deploy.sh"
   ```

Pronto — a nova versão entra no ar. Mudanças de banco continuam via Supabase (migrations em `supabase/migrations/`).

## Rollback

Como tudo é versionado, voltar uma versão é trivial:
```powershell
git revert <hash>   # ou git reset --hard <hash> + push --force-with-lease
git push
ssh ... root@... "bash /home/vertex/aggregaintel/deploy.sh"
```
Ou direto na VPS: `sudo -u vertex git -C /home/vertex/aggregaintel checkout <hash>` e rodar o build/restart.

## Por que não rsync/tar da árvore inteira?

A trava de segurança do ambiente bloqueia transferir a árvore inteira do projeto para um host externo (proteção contra exfiltração). O git resolve isso: o push manda só os *diffs* para o GitHub, e a VPS *puxa* — nenhuma cópia em massa do PC direto pro servidor.

## PWA / Android

Após um deploy que mexa em `manifest.json`, service worker (`worker/`) ou layout, o usuário deve **reinstalar o PWA** ("Adicionar à tela inicial") para registrar a versão nova.
