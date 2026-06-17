#!/usr/bin/env bash
# Deploy do AggregaIntel na VPS.
# Roda como ROOT: `ssh root@VPS 'bash /home/vertex/aggregaintel/deploy.sh'`.
# Faz git pull (como vertex), instala deps se mudaram, builda e reinicia o serviço.
set -euo pipefail

REPO=/home/vertex/aggregaintel
SERVICE=aggregaintel
RUNAS=vertex

echo "==> [1/5] git pull (origin/main)"
sudo -u "$RUNAS" git -C "$REPO" pull --ff-only

echo "==> [2/5] dependências (npm ci só se package-lock mudou)"
if sudo -u "$RUNAS" git -C "$REPO" diff --name-only ORIG_HEAD HEAD 2>/dev/null | grep -q "package-lock.json"; then
  sudo -u "$RUNAS" bash -lc "cd $REPO && npm ci"
else
  echo "    (package-lock.json inalterado — pulando npm ci)"
fi

echo "==> [3/5] build (next build)"
sudo -u "$RUNAS" bash -lc "cd $REPO && npm run build"

echo "==> [4/5] reiniciando serviço $SERVICE"
systemctl restart "$SERVICE"

echo "==> [5/5] verificando"
sleep 3
systemctl is-active "$SERVICE"
echo "==> Deploy concluído com sucesso ✅"
