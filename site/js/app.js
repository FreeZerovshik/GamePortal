(function () {
  "use strict";
  const P = window.Portal || (window.Portal = {});

  // --- Конфиг ---------------------------------------------------------------
  // Каталог: сейчас статичный JSON. Когда появится бэкенд для авторов,
  // меняем на "/api/games" — формат записи тот же.
  const CATALOG_URL = "games.json";
  const SLIDE_MS = 6000;
  const LOAD_MS = 1600;

  // Игры живут на ОТДЕЛЬНОМ origin (поддомен play. или порт 8080 на голом IP),
  // чтобы чужой код в iframe не видел куки и данные портала.
  P.playOrigin = function () {
    const { protocol, hostname, port } = location;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname === "localhost") {
      return `${protocol}//${hostname}:${port === "8080" ? "80" : "8080"}/`;
    }
    return `${protocol}//play.${hostname.replace(/^www\./, "")}/`;
  };
  P.gameUrl = (g) => /^https?:/.test(g.path) ? g.path : P.playOrigin() + g.path;

  P.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel) => document.querySelector(sel);
  const PLAY_ICON = (c) => `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l14 8-14 8z" fill="${c}"/></svg>`;

  async function loadCatalog() {
    const r = await fetch(CATALOG_URL, { cache: "no-cache" });
    if (!r.ok) throw new Error("catalog " + r.status);
    return r.json();
  }

  // --- Главная -----------------------------------------------------------------
  function renderHero(games) {
    const root = $("#hero");
    if (!root || !games.length) return;
    let i = 0, timer = 0;
    const art = root.querySelector(".hero-art"), copy = root.querySelector(".hero-copy"), dots = root.querySelector(".dots .wrap");

    dots.innerHTML = games.map((g, k) => `<button class="dot" type="button" data-k="${k}" aria-label="Показать: ${P.esc(g.title)}"><span></span></button>`).join("");
    dots.addEventListener("click", (e) => {
      const b = e.target.closest(".dot");
      if (b) { show(+b.dataset.k); restart(); }
    });

    function show(k) {
      i = k;
      const g = games[k];
      art.innerHTML = `<div class="slide" style="position:absolute;inset:0">${P.cover(g, true)}</div>`;
      copy.innerHTML = `
        <span class="badge" style="background:${P.esc(g.statusColor)}">${P.esc(g.status)}</span>
        <h1 class="glitch">${P.esc(g.title)}</h1>
        <p>${P.esc(g.tagline)}</p>
        <div class="tags">${g.tags.map((t) => `<span class="tag">${P.esc(t)}</span>`).join("")}</div>
        <div class="row" style="margin-top:8px">
          <a class="btn" href="game.html?id=${encodeURIComponent(g.id)}&play=1">${PLAY_ICON("#0A0A12")}${g.status === "Демо" ? "Играть демо" : "Играть"}</a>
          <a class="btn ghost" href="game.html?id=${encodeURIComponent(g.id)}">Подробнее</a>
        </div>`;
      copy.classList.remove("slide"); void copy.offsetWidth; copy.classList.add("slide");
      dots.querySelectorAll(".dot").forEach((d, n) => d.classList.toggle("on", n === k));
    }
    function restart() {
      clearInterval(timer);
      timer = setInterval(() => show((i + 1) % games.length), SLIDE_MS);
    }
    // автопрокрутка замирает, пока на баннер смотрят или жмут по нему
    root.addEventListener("mouseenter", () => clearInterval(timer));
    root.addEventListener("mouseleave", restart);
    root.addEventListener("focusin", () => clearInterval(timer));
    root.addEventListener("focusout", restart);
    show(0);
    restart();
  }

  function renderAuthors() {
    const b = $("#notify"), msg = $("#notify-msg");
    if (b) b.addEventListener("click", () => { msg.textContent = "Приём игр откроем совсем скоро. Следи за бегущей строкой!"; });
  }

  function cardHtml(g, k) {
    const href = g.soon ? "#authors" : `game.html?id=${encodeURIComponent(g.id)}`;
    return `
<a class="card" href="${href}" style="animation-delay:${k * 0.08}s">
  <div class="cov">
    <div class="art">${P.cover(g, false)}</div>
    <span class="badge" style="background:${P.esc(g.statusColor)}">${P.esc(g.status)}</span>
    <span class="playchip">${PLAY_ICON("#C8FF2E")}${g.soon ? "Подробнее" : (g.status === "Демо" ? "Демо" : "Играть")}</span>
  </div>
  <div class="card-body">
    <div class="card-title"><h3>${P.esc(g.title)}</h3><span class="genre">${P.esc(g.genre)}</span></div>
    <p>${P.esc(g.text)}</p>
    <div class="meta"><span>${P.esc(g.devices || "")}</span><span class="grow"></span><span>${P.esc(g.author)}</span></div>
  </div>
</a>`;
  }

  const SOON_CARD = { id: "soon", soon: true, title: "Твоя игра", genre: "Скоро", status: "Скоро", statusColor: "#B9A8FF", text: "Здесь появятся игры других авторов. Загрузи свою первым.", author: "Ты", cover: "soon", cat: "*" };

  function renderCatalog(games) {
    const grid = $("#grid"), chips = $("#chips"), search = $("#q");
    if (!grid) return;
    const state = { cat: "all", q: "" };
    const cats = [["all", "Все"], ...[...new Map(games.map((g) => [g.cat, g.genre])).entries()]];
    chips.innerHTML = cats.map(([id, label]) => `<button class="chip${id === "all" ? " on" : ""}" type="button" data-cat="${P.esc(id)}">${P.esc(label)}</button>`).join("");
    chips.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      state.cat = b.dataset.cat;
      chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
      draw();
    });
    if (search) search.addEventListener("input", () => { state.q = search.value.trim().toLowerCase(); draw(); document.getElementById("catalog").scrollIntoView(); });

    function draw() {
      const list = games.filter((g) =>
        (state.cat === "all" || g.cat === state.cat) &&
        (!state.q || (g.title + " " + g.genre + " " + g.tags.join(" ")).toLowerCase().includes(state.q)));
      if (!state.q) list.push(SOON_CARD);
      grid.innerHTML = list.length ? list.map(cardHtml).join("") : `<div class="empty">Ничего не нашлось. Попробуй другое слово.</div>`;
    }
    draw();
  }

  // --- Страница игры -------------------------------------------------------------
  function renderGame(games) {
    const params = new URLSearchParams(location.search);
    const g = games.find((x) => x.id === params.get("id"));
    const root = $("#game");
    if (!g) {
      root.innerHTML = `<div class="note">Такой игры нет. <a href="./">Вернуться в каталог</a></div>`;
      return;
    }
    document.title = `${g.title} — Игропорт`;
    const url = P.gameUrl(g);
    root.innerHTML = `
<div class="split">
  <div class="main">
    <div class="player" id="player">
      <div class="art">${P.cover(g, false)}</div>
      <div class="overlay dim"><button class="bigplay" id="bigplay" type="button" aria-label="Играть: ${P.esc(g.title)}"><svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l12 7-12 7z" fill="#0A0A12"/></svg></button></div>
    </div>
    <div class="row">
      <button class="btn" id="play" type="button">${PLAY_ICON("#0A0A12")}Играть</button>
      <button class="btn ghost" id="fs" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F2F2F7" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>На весь экран</button>
      <a class="btn ghost" href="${P.esc(url)}" target="_blank" rel="noopener">Открыть отдельно</a>
      <button class="btn ghost icon fav" id="fav" type="button" aria-label="В избранное" aria-pressed="false"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg></button>
    </div>
  </div>
  <aside class="side">
    <span class="badge" style="background:${P.esc(g.statusColor)}">${P.esc(g.status)}</span>
    <h1>${P.esc(g.title)}</h1>
    <p class="lead">${P.esc(g.tagline)}</p>
    <div class="tags">${g.tags.map((t) => `<span class="tag">${P.esc(t)}</span>`).join("")}</div>
    <div class="facts">
      <div class="fact"><span>Автор</span><b>${P.esc(g.author)}</b></div>
      <div class="fact"><span>Устройства</span><b>${P.esc(g.devices)}</b></div>
      <div class="fact"><span>Жанр</span><b>${P.esc(g.genre)}</b></div>
      <div class="fact"><span>Установка</span><b>Не нужна</b></div>
    </div>
  </aside>
</div>
<div class="split">
  <section class="list"><h2 class="h2s">Что внутри</h2>${(g.features || []).map((f) => `<div class="feat">${P.esc(f)}</div>`).join("")}</section>
  <section class="list"><h2 class="h2s">Управление</h2>
    <div class="facts">
      <div class="fact"><b>Планшет и телефон</b><span>${P.esc(g.controls?.touch)}</span></div>
      <div class="fact"><b>Клавиатура</b><span>${P.esc(g.controls?.keys)}</span></div>
    </div>
    <div class="note">Отзывы и рейтинг появятся, когда на портале заработают аккаунты.</div>
  </section>
</div>`;

    const player = $("#player");
    let started = false;
    function start() {
      if (started) { player.querySelector("iframe")?.setAttribute("src", url); return; }
      started = true;
      player.insertAdjacentHTML("beforeend", `<div class="overlay load" id="loading"><span style="font-family:var(--display);font-weight:700;font-size:18px">Загружаем: ${P.esc(g.title)}…</span><div class="bar"><i></i></div></div>`);
      // sandbox: без allow-top-navigation и allow-popups — игра не может увести портал.
      // allow-same-origin нужен игре для своих сохранений (localStorage на play-origin).
      const f = document.createElement("iframe");
      f.src = url;
      f.title = g.title;
      f.allow = "fullscreen; autoplay; gamepad; screen-wake-lock";
      f.setAttribute("allowfullscreen", "");
      f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-pointer-lock allow-forms");
      f.style.opacity = "0";
      player.appendChild(f);
      const reveal = () => setTimeout(() => {
        f.style.opacity = "1";
        player.querySelector(".art")?.remove();
        player.querySelectorAll(".overlay").forEach((o) => o.remove());
        f.focus();
      }, LOAD_MS);
      f.addEventListener("load", reveal, { once: true });
      $("#play").lastChild.textContent = "Перезапустить";
    }
    $("#bigplay").addEventListener("click", start);
    $("#play").addEventListener("click", start);
    $("#fs").addEventListener("click", () => {
      if (!started) start();
      const req = player.requestFullscreen || player.webkitRequestFullscreen;
      if (req) req.call(player); else window.open(url, "_blank", "noopener");
    });

    const favKey = "portal_fav_" + g.id;
    const fav = $("#fav");
    const setFav = (on) => { fav.classList.toggle("on", on); fav.setAttribute("aria-pressed", String(on)); };
    try { setFav(localStorage.getItem(favKey) === "1"); } catch (e) { /* приватный режим */ }
    fav.addEventListener("click", () => {
      const on = !fav.classList.contains("on");
      setFav(on);
      try { localStorage.setItem(favKey, on ? "1" : "0"); } catch (e) { /* приватный режим */ }
    });

    if (params.get("play") === "1") start();
  }

  // --- Старт ---------------------------------------------------------------------
  loadCatalog().then((games) => {
    if (document.body.dataset.page === "game") renderGame(games);
    else { renderHero(games); renderCatalog(games); renderAuthors(); }
  }).catch(() => {
    const t = $("#grid") || $("#game");
    if (t) t.innerHTML = `<div class="note">Не получилось загрузить каталог. Обнови страницу.</div>`;
  });
})();
