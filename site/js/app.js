(function () {
  "use strict";
  const P = window.Portal || (window.Portal = {});

  // --- Конфиг ---------------------------------------------------------------
  // Каталог: сейчас статичный JSON. Когда появится бэкенд для авторов,
  // меняем на "/api/games" — формат записи тот же.
  const CATALOG_URL = "games.json";
  const SLIDE_MS = 7000;
  const LOAD_MS = 1200;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TOUCH = matchMedia("(hover: none)").matches;

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
  const PLAY = (c, s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l14 8-14 8z" fill="${c}"/></svg>`;
  const ARROW = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#07070C" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>`;
  const playLabel = (g) => g.status === "Демо" ? "Играть демо" : "Играть";

  // Медиа игры: живое видео-превью (если есть) поверх постера, иначе процедурная обложка.
  function mediaHtml(g, hero, autoplay) {
    if (!g.preview) return P.cover(g, hero);
    const poster = g.poster ? `<img src="${P.esc(g.poster)}" alt="" loading="lazy">` : P.cover(g, hero);
    const ap = autoplay && !REDUCED ? " autoplay" : "";
    return `${poster}<video src="${P.esc(g.preview)}" muted loop playsinline preload="${autoplay ? "auto" : "none"}"${ap} aria-hidden="true"></video>`;
  }

  async function loadCatalog() {
    const r = await fetch(CATALOG_URL, { cache: "no-cache" });
    if (!r.ok) throw new Error("catalog " + r.status);
    return r.json();
  }

  // --- Общее: шапка прячется при скролле вниз, блоки появляются при прокрутке ---
  function initChrome() {
    const top = $("#top");
    let last = 0;
    addEventListener("scroll", () => {
      const y = scrollY;
      top.classList.toggle("hide", y > 200 && y > last);
      last = y;
    }, { passive: true });

    const els = document.querySelectorAll("[data-reveal]");
    if (REDUCED || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((list) => list.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }
  P.reveal = function (root) {
    root.querySelectorAll("[data-reveal]").forEach((e) => requestAnimationFrame(() => e.classList.add("in")));
  };

  // --- Главная: герой с видео ------------------------------------------------------
  function splitWords(text) {
    return P.esc(text).split(" ").map((w, i) => `<span class="w"><span style="animation-delay:${0.08 * i + 0.1}s">${w}</span></span>`).join(" ");
  }

  function renderHero(games) {
    const root = $("#hero");
    if (!root || !games.length) return;
    const media = root.querySelector(".hero-media"), copy = root.querySelector(".hero-copy"), thumbs = root.querySelector(".hero-thumbs");
    root.style.setProperty("--slide", SLIDE_MS + "ms");
    let i = -1, timer = 0;

    media.innerHTML = games.map((g) => `<div class="layer">${mediaHtml(g, true, false)}</div>`).join("");
    const layers = [...media.children];
    thumbs.innerHTML = games.map((g, k) => `<button class="thumb" type="button" data-k="${k}" aria-label="Показать: ${P.esc(g.title)}">${g.poster ? `<img src="${P.esc(g.poster)}" alt="">` : P.cover(g, false)}<span>${P.esc(g.title)}</span><i></i></button>`).join("");
    thumbs.addEventListener("click", (e) => {
      const b = e.target.closest(".thumb");
      if (b) { show(+b.dataset.k); restart(); }
    });

    function show(k) {
      if (k === i) return;
      i = k;
      const g = games[k];
      layers.forEach((l, n) => {
        l.classList.toggle("on", n === k);
        const v = l.querySelector("video");
        if (!v) return;
        if (n === k && !REDUCED) { v.preload = "auto"; v.currentTime = 0; v.play().catch(() => {}); }
        else v.pause();
      });
      copy.innerHTML = `
        <span class="eyebrow fadeup"><b></b>${P.esc(g.status)} · ${P.esc(g.genre)}</span>
        <h1>${splitWords(g.title)}</h1>
        <p class="fadeup" style="animation-delay:.35s">${P.esc(g.tagline)}</p>
        <div class="row fadeup" style="animation-delay:.5s">
          <a class="btn" href="game.html?id=${encodeURIComponent(g.id)}&play=1">${PLAY("#07070C")}${playLabel(g)}</a>
          <a class="btn ghost" href="game.html?id=${encodeURIComponent(g.id)}">Подробнее</a>
        </div>`;
      thumbs.querySelectorAll(".thumb").forEach((t, n) => {
        t.classList.toggle("on", n === k);
        const bar = t.querySelector("i");
        bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = "";
      });
    }
    function restart() {
      clearInterval(timer);
      if (!REDUCED) timer = setInterval(() => show((i + 1) % games.length), SLIDE_MS);
    }
    root.addEventListener("focusin", () => clearInterval(timer));
    root.addEventListener("focusout", restart);
    show(0);
    restart();
  }

  // --- Главная: каталог-бенто ---------------------------------------------------
  const SOON_CARD = { id: "soon", soon: true, title: "Твоя игра", genre: "Скоро", status: "Скоро", statusColor: "#B9A8FF", text: "Здесь появятся игры других авторов. Загрузи свою первым.", author: "Ты", cover: "soon", tags: [] };

  function cardHtml(g, k) {
    const href = g.soon ? "#authors" : `game.html?id=${encodeURIComponent(g.id)}`;
    return `
<a class="card${g.soon ? " soon" : ""}" href="${href}" data-reveal style="--d:${(k * 0.08).toFixed(2)}s">
  <div class="media">${mediaHtml(g, false, false)}</div>
  <span class="badge" style="background:${P.esc(g.statusColor)}">${P.esc(g.status)}</span>
  <span class="go">${ARROW}</span>
  <div class="info">
    <h3>${P.esc(g.title)}</h3>
    <p>${P.esc(g.text)}</p>
    <div class="meta"><span>${P.esc(g.genre)}</span>${g.devices ? `<span class="dev">·</span><span class="dev">${P.esc(g.devices)}</span>` : ""}<span>·</span><span>${P.esc(g.author)}</span></div>
  </div>
</a>`;
  }

  // Видео в карточке: на ПК играет при наведении, на тач-устройствах — когда карточка на экране.
  function wireCard(card) {
    const v = card.querySelector("video");
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
    if (!v || REDUCED) return;
    const play = () => { v.preload = "auto"; v.play().then(() => card.classList.add("playing")).catch(() => {}); };
    const stop = () => { v.pause(); card.classList.remove("playing"); };
    if (TOUCH && "IntersectionObserver" in window) {
      new IntersectionObserver(([en]) => en.intersectionRatio > 0.6 ? play() : stop(), { threshold: [0, 0.6] }).observe(card);
    } else {
      card.addEventListener("mouseenter", play);
      card.addEventListener("mouseleave", stop);
    }
  }

  function renderCatalog(games) {
    const grid = $("#grid"), chips = $("#chips"), search = $("#q");
    if (!grid) return;
    const state = { cat: "all", q: "" };
    const cats = [["all", "Все"], ...new Map(games.map((g) => [g.cat, g.genre]))];
    chips.innerHTML = cats.map(([id, label]) => `<button class="chip${id === "all" ? " on" : ""}" type="button" data-cat="${P.esc(id)}" aria-pressed="${id === "all"}">${P.esc(label)}</button>`).join("");
    chips.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      state.cat = b.dataset.cat;
      chips.querySelectorAll(".chip").forEach((c) => { c.classList.toggle("on", c === b); c.setAttribute("aria-pressed", String(c === b)); });
      draw();
    });
    search.addEventListener("input", () => { state.q = search.value.trim().toLowerCase(); draw(); });
    $("#searchbtn")?.addEventListener("click", () => {
      document.getElementById("catalog").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" });
      setTimeout(() => search.focus({ preventScroll: true }), 500);
    });

    function draw() {
      const list = games.filter((g) =>
        (state.cat === "all" || g.cat === state.cat) &&
        (!state.q || (g.title + " " + g.genre + " " + g.tags.join(" ")).toLowerCase().includes(state.q)));
      if (!state.q && state.cat === "all") list.push(SOON_CARD);
      grid.innerHTML = list.length ? list.map(cardHtml).join("") : `<div class="empty">Ничего не нашлось. Попробуй другое слово.</div>`;
      grid.querySelectorAll(".card").forEach(wireCard);
      P.reveal(grid);
    }
    draw();
  }

  function renderAuthors() {
    const b = $("#notify"), msg = $("#notify-msg");
    if (b) b.addEventListener("click", () => { msg.textContent = "Приём игр откроем совсем скоро!"; });
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
    document.title = `${g.title} — GAMEZAL`;
    const url = P.gameUrl(g);
    root.innerHTML = `
<div class="split">
  <div class="main" data-reveal>
    <div class="player" id="player">
      <div class="media">${mediaHtml(g, false, true)}</div>
      <div class="overlay dim"><button class="bigplay" id="bigplay" type="button" aria-label="Играть: ${P.esc(g.title)}">${PLAY("#07070C", 44)}</button></div>
    </div>
    <div class="row">
      <button class="btn" id="play" type="button">${PLAY("#07070C")}<span>${playLabel(g)}</span></button>
      <button class="btn ghost" id="fs" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4F4F8" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>На весь экран</button>
      <a class="btn ghost" href="${P.esc(url)}" target="_blank" rel="noopener">Открыть отдельно</a>
      <button class="btn ghost icon fav" id="fav" type="button" aria-label="В избранное" aria-pressed="false"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF4FA3" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg></button>
    </div>
  </div>
  <aside class="side" data-reveal style="--d:.1s">
    <span class="badge" style="background:${P.esc(g.statusColor)};align-self:flex-start">${P.esc(g.status)}</span>
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
  <section class="list" data-reveal><h2 class="h2s">Что внутри</h2>${(g.features || []).map((f) => `<div class="feat">${P.esc(f)}</div>`).join("")}</section>
  <section class="list" data-reveal style="--d:.1s"><h2 class="h2s">Управление</h2>
    <div class="facts">
      <div class="fact"><b>Планшет и телефон</b><span>${P.esc(g.controls?.touch)}</span></div>
      <div class="fact"><b>Клавиатура</b><span>${P.esc(g.controls?.keys)}</span></div>
    </div>
    <div class="note">Отзывы и рейтинг появятся, когда на портале заработают аккаунты.</div>
  </section>
</div>`;
    P.reveal(root);

    const player = $("#player");
    let started = false;
    function start() {
      if (started) { player.querySelector("iframe")?.setAttribute("src", url); return; }
      started = true;
      player.querySelector(".media video")?.pause();
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
      f.addEventListener("load", () => setTimeout(() => {
        f.style.opacity = "1";
        player.querySelector(".media")?.remove();
        player.querySelectorAll(".overlay").forEach((o) => o.remove());
        f.focus();
      }, LOAD_MS), { once: true });
      $("#play span").textContent = "Перезапустить";
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
  initChrome();
  loadCatalog().then((games) => {
    if (document.body.dataset.page === "game") renderGame(games);
    else { renderHero(games); renderCatalog(games); renderAuthors(); }
  }).catch(() => {
    const t = $("#grid") || $("#game");
    if (t) t.innerHTML = `<div class="note">Не получилось загрузить каталог. Обнови страницу.</div>`;
  });
})();
