# Игропорт — Project Rules

Веб-портал браузерных игр «аля Steam, но проще». Сейчас здесь игры Матвея (Ядерный рассвет, Марс, Кубомир), а дальше свои игры смогут загружать другие авторы. Отвечай пользователю по-русски, UI тоже на русском.

## Устройство

- `site/` — статичный портал без сборки: `index.html` (главная), `game.html?id=<id>` (страница игры с плеером), `css/style.css`, `js/art.js` (процедурные SVG-обложки), `js/app.js` (логика), `games.json` (каталог).
- `server/server-setup.sh` — настройка VPS одной командой (Caddy, Node 22, systemd-таймер `gameportal-sync`). Повторный запуск безопасен.
- Деплой — **pull с сервера**: каждые 2 минуты сервер берёт свежий `main` каждой записи из `/etc/gameportal/games.conf`, собирает её и кладёт в `/srv/games/<id>` (портал в `/srv/portal`). GitHub Actions не используем: в приватных репо они упираются в биллинг. Журнал: `journalctl -u gameportal-sync`.
- Пуш в `main` сразу без PR (правило Матвея), но сначала проверь страницы в браузере.

## Безопасность (важно для игр чужих авторов)

- Игры всегда открываются с **отдельного origin**: `play.<домен>`, а пока домена нет, `http://IP:8080`. Его вычисляет `Portal.playOrigin()`. Никогда не отдавай игры с origin портала: иначе их JS доберётся до кук и сессий.
- iframe игры: `sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"`, без `allow-top-navigation` и `allow-popups`. `allow-same-origin` безопасен только потому, что origin отдельный.
- Тексты из каталога выводятся только через `Portal.esc()`.

## Каталог и будущие авторы

- Запись `games.json`: `id, title, genre, cat, status, statusColor, tagline, text, tags[], features[], controls{touch,keys}, devices, author, path, cover`. `cover` — либо имя процедурной обложки из `art.js`, либо URL картинки (для загруженных игр).
- Для авторов `CATALOG_URL` в `app.js` поменяется на API (план: Directus в Docker на том же VPS — аккаунты, загрузка ZIP, модерация). Формат записи остаётся тем же, страницы не переписываем.

## Дизайн

Тёмный неон: фон `#0A0A12`, акцент лайм `#C8FF2E`, вторичный фиолетовый `#7C5CFF`. Шрифты: Unbounded (заголовки) и Manrope (текст). Макет: https://claude.ai/artifact/A99iL6DgoSJUNbv4E8i69X. Кнопки не меньше 44 px, контраст текста не ниже 4.5:1, при `prefers-reduced-motion` анимации отключаются. Подпись «Сделано Матвеем и Львом» не убирать.
