#!/usr/bin/env bash
# Настройка VPS для игрового портала (Ubuntu 22.04/24.04).
# Запуск под root:   bash server-setup.sh мойдомен.ru   (или IP, пока домена нет)
# Повторный запуск безопасен: обновит конфиги, ключ и данные не трогает.
#
# Что получится (с доменом):
#   https://ДОМЕН/                 — портал (/srv/portal)
#   https://play.ДОМЕН/<игра>/     — игры (/srv/games/<игра>), отдельный поддомен = песочница
# Без домена (передан IP): http://IP/ — портал, http://IP:8080/<игра>/ — игры (другой origin).
#   Каждые 2 минуты сервер сам забирает свежий main из GitHub, собирает и выкладывает.
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Укажи домен: bash server-setup.sh мойдомен.ru" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Запусти под root (или через sudo)." >&2
  exit 1
fi

if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  IP_MODE=1; PORTAL_SITE=":80"; PLAY_SITE=":8080"; PORTAL_URL="http://$DOMAIN"; PLAY_URL="http://$DOMAIN:8080"
else
  IP_MODE=0; PORTAL_SITE="$DOMAIN"; PLAY_SITE="play.$DOMAIN"; PORTAL_URL="https://$DOMAIN"; PLAY_URL="https://play.$DOMAIN"
fi

DEPLOY_USER=deploy
CONF_DIR=/etc/gameportal
SRC_DIR=/var/lib/gameportal/src
SYNC_INTERVAL=2min

echo "==> Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git rsync ufw curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v caddy >/dev/null; then
  echo "==> Caddy (веб-сервер с автоматическим HTTPS)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]]; then
  echo "==> Node.js 22 (для сборки игр на Vite)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

echo "==> Пользователь $DEPLOY_USER и папки"
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
mkdir -p /srv/portal /srv/games "$SRC_DIR" "$CONF_DIR" "$DEPLOY_HOME/.ssh"
chown -R "$DEPLOY_USER:$DEPLOY_USER" /srv/portal /srv/games /var/lib/gameportal "$DEPLOY_HOME/.ssh"
chmod 700 "$DEPLOY_HOME/.ssh"

# Ключ, которым сервер читает приватные репозитории (deploy key, только чтение)
if [[ ! -f "$DEPLOY_HOME/.ssh/id_ed25519" ]]; then
  sudo -u "$DEPLOY_USER" ssh-keygen -q -t ed25519 -N "" -C "gameportal@$DOMAIN" -f "$DEPLOY_HOME/.ssh/id_ed25519"
fi
sudo -u "$DEPLOY_USER" bash -c "ssh-keyscan -t ed25519 github.com > ~/.ssh/known_hosts 2>/dev/null"

echo "==> Список игр ($CONF_DIR/games.conf)"
if [[ ! -f "$CONF_DIR/games.conf" ]]; then
  cat > "$CONF_DIR/games.conf" <<'EOF'
# имя | репозиторий | команда сборки (пусто = без сборки) | папка с результатом | куда (пусто = /srv/games/<имя>)
# Публичные репозитории — по https, приватные — по git@ (нужен deploy key).
portal      | https://github.com/FreeZerovshik/GamePortal.git |                    | site | /srv/portal
nucleardawn | git@github.com:FreeZerovshik/NuclearDawn.git | npm ci && npm run build | dist
mars        | https://github.com/FreeZerovshik/Mars.git    |                          | .
kubomir     | https://github.com/FreeZerovshik/Kubomir.git |                          | .
EOF
fi

echo "==> Скрипт выкладки /usr/local/bin/gameportal-sync"
cat > /usr/local/bin/gameportal-sync <<'EOF'
#!/usr/bin/env bash
# Забирает свежий main каждой игры из games.conf, собирает и выкладывает в /srv/games/<имя>.
# Ручной запуск: sudo -u deploy gameportal-sync [--force]
set -uo pipefail
CONF=/etc/gameportal/games.conf
SRC=/var/lib/gameportal/src
OUT=/srv/games
FORCE=${1:-}
exec 9>/var/lib/gameportal/sync.lock
flock -n 9 || exit 0

trim() { local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; echo "${s%"${s##*[![:space:]]}"}"; }

sync_game() {
  local name="$1" repo="$2" build="$3" dir="$4" target="${5:-$OUT/$1}"
  local src="$SRC/$name" stamp="$SRC/.$name.deployed"
  if [[ ! -d "$src/.git" ]]; then
    git clone -q "$repo" "$src" || { echo "[$name] не удалось склонировать $repo"; return 1; }
  fi
  git -C "$src" fetch -q origin || { echo "[$name] fetch не прошёл"; return 1; }
  local head; head=$(git -C "$src" rev-parse origin/HEAD)
  if [[ "$FORCE" != "--force" && -f "$stamp" && "$(cat "$stamp")" == "$head" ]]; then
    return 0
  fi
  echo "[$name] новая версия ${head:0:7}, выкладываю"
  git -C "$src" reset -q --hard "$head"
  if [[ -n "$build" ]]; then
    (cd "$src" && bash -c "$build") || { echo "[$name] сборка упала, на сайте остаётся прошлая версия"; return 1; }
  fi
  mkdir -p "$target"
  rsync -a --delete --delay-updates \
    --exclude '.git' --exclude '.github' --exclude '.claude' --exclude 'node_modules' \
    --exclude 'CLAUDE.md' --exclude '*.sh' \
    "$src/$dir/" "$target/" || { echo "[$name] rsync упал"; return 1; }
  echo "$head" > "$stamp"
  echo "[$name] готово"
}

while IFS='|' read -r name repo build dir target; do
  name=$(trim "$name")
  [[ -z "$name" || "$name" == \#* ]] && continue
  dir=$(trim "${dir:-}"); target=$(trim "${target:-}")
  sync_game "$name" "$(trim "$repo")" "$(trim "$build")" "${dir:-.}" "$target"
done < "$CONF"
exit 0
EOF
chmod 755 /usr/local/bin/gameportal-sync

cat > /etc/systemd/system/gameportal-sync.service <<EOF
[Unit]
Description=Выкладка игр из GitHub
After=network-online.target

[Service]
Type=oneshot
User=$DEPLOY_USER
ExecStart=/usr/local/bin/gameportal-sync
EOF

cat > /etc/systemd/system/gameportal-sync.timer <<EOF
[Unit]
Description=Проверять обновления игр каждые $SYNC_INTERVAL

[Timer]
OnBootSec=1min
OnUnitActiveSec=$SYNC_INTERVAL

[Install]
WantedBy=timers.target
EOF

echo "==> Caddy: $PORTAL_URL и $PLAY_URL"
cat > /etc/caddy/Caddyfile <<EOF
$PORTAL_SITE {
	root * /srv/portal
	encode zstd gzip
	file_server
}

$PLAY_SITE {
	root * /srv/games
	encode zstd gzip
	@hashed path_regexp ^/[^/]+/assets/
	header @hashed Cache-Control "public, max-age=31536000, immutable"
	@fresh path_regexp (/|\.html|sw\.js|\.webmanifest|\.json)$
	header @fresh Cache-Control "no-cache"
	file_server
}
EOF

if [[ ! -f /srv/portal/index.html ]]; then
  cat > /srv/portal/index.html <<EOF
<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Игропорт</title>
<style>body{margin:0;min-height:100vh;background:#0A0A12;color:#F2F2F7;font:18px system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
a{display:block;min-width:260px;padding:16px 24px;border-radius:16px;background:#C8FF2E;color:#0A0A12;text-decoration:none;font-weight:800;text-align:center}</style></head>
<body><h1>ИГРОПОРТ</h1>
<a href="$PLAY_URL/nucleardawn/">Ядерный рассвет</a>
<a href="$PLAY_URL/mars/">Марс</a>
<a href="$PLAY_URL/kubomir/">Кубомир</a>
</body></html>
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" /srv/portal/index.html
fi

caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy || systemctl restart caddy

echo "==> Файрвол: SSH, HTTP, HTTPS"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
[[ $IP_MODE == 1 ]] && ufw allow 8080/tcp >/dev/null
ufw --force enable >/dev/null

systemctl daemon-reload
systemctl enable --now gameportal-sync.timer >/dev/null

echo
echo "================================================================"
echo "Готово. Последний шаг — дать серверу доступ к приватной игре."
echo "Открой github.com/FreeZerovshik/NuclearDawn → Settings → Deploy keys"
echo "→ Add deploy key, галочку «Allow write access» НЕ ставь, вставь строку:"
echo
cat "$DEPLOY_HOME/.ssh/id_ed25519.pub"
echo
echo "Первая выкладка сразу: sudo -u $DEPLOY_USER gameportal-sync --force"
echo "Журнал выкладок:       journalctl -u gameportal-sync -n 50"
echo "Портал: $PORTAL_URL    Игры: $PLAY_URL/<игра>/"
echo "================================================================"
