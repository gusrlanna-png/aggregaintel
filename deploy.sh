#!/usr/bin/env bash
# Deploy do AggregaIntel na VPS.
# Roda como ROOT: `ssh root@VPS 'bash /home/vertex/aggregaintel/deploy.sh'`.
# Faz git pull (como vertex), instala deps se mudaram, builda em pasta SEPARADA
# (.next-new) e só então troca (swap) pelo .next ativo + reinicia o serviço.
# Assim o processo antigo nunca serve um .next pela metade durante o build; se o
# build falhar (set -e), nada é trocado e o app segue no ar na versão anterior.
set -euo pipefail

REPO=/home/vertex/aggregaintel
SERVICE=aggregaintel
RUNAS=vertex

echo "==> [1/6] git pull (origin/main)"
sudo -u "$RUNAS" git -C "$REPO" pull --ff-only

echo "==> [2/6] dependências (npm ci só se package-lock mudou)"
if sudo -u "$RUNAS" git -C "$REPO" diff --name-only ORIG_HEAD HEAD 2>/dev/null | grep -q "package-lock.json"; then
  sudo -u "$RUNAS" bash -lc "cd $REPO && npm ci"
else
  echo "    (package-lock.json inalterado — pulando npm ci)"
fi

echo "==> [3/6] build em .next-new (não toca no .next ativo)"
sudo -u "$RUNAS" bash -lc "cd $REPO && rm -rf .next-new && NEXT_DIST_DIR=.next-new npm run build && test -d .next-new"

echo "==> [4/6] swap .next-new -> .next"
rm -rf "$REPO/.next-old"
if [ -d "$REPO/.next" ]; then mv "$REPO/.next" "$REPO/.next-old"; fi
mv "$REPO/.next-new" "$REPO/.next"

echo "==> [5/6] reiniciando serviço $SERVICE"
systemctl restart "$SERVICE"

echo "==> [6/6] verificando"
sleep 4
systemctl is-active "$SERVICE"
echo "==> Deploy concluído com sucesso ✅"
