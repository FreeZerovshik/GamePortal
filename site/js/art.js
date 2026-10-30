(function () {
  "use strict";
  // Процедурные обложки игр (без картинок). Ключ — поле cover в каталоге.
  // Игры других авторов позже будут приходить с загруженной обложкой (cover как URL).
  const P = window.Portal || (window.Portal = {});

  const dawn = (hero) => `
<svg viewBox="0 0 ${hero ? "1440 580" : "400 250"}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
${hero ? `
<rect width="1440" height="580" fill="#160C1C"/><rect y="300" width="1440" height="280" fill="#2A1220"/>
<circle class="sun" cx="1040" cy="380" r="150" fill="#FF7A2F"/><circle cx="1040" cy="380" r="210" fill="#FF7A2F" opacity="0.14"/>
<path d="M560 580V360h50v-40h30v60h40V300h24v-30h20v120h60v-70h50v110h40V250h70v40h20v-30h40v110h60v-60h30v70h50V330h44v60h60v-90h40v120h40V300h60v280z" fill="#0D0811"/>
<g class="bob"><rect x="780" y="440" width="60" height="70" rx="12" fill="#1C1A24"/><rect x="788" y="404" width="44" height="36" rx="10" fill="#26232F"/><rect x="796" y="416" width="28" height="10" rx="5" fill="#C8FF2E"/><rect x="770" y="452" width="12" height="40" rx="6" fill="#1C1A24"/><rect x="838" y="452" width="12" height="40" rx="6" fill="#1C1A24"/><path d="M810 404v-18" stroke="#26232F" stroke-width="4"/><circle cx="810" cy="384" r="5" fill="#FF3D9A"/></g>
<rect y="510" width="1440" height="70" fill="#0A0A12" opacity="0.85"/>` : `
<rect width="400" height="250" fill="#160C1C"/><rect y="140" width="400" height="110" fill="#2A1220"/>
<circle class="sun" cx="250" cy="160" r="62" fill="#FF7A2F"/>
<path d="M60 250V160h20v-16h12v26h16V130h10v-12h8v52h24v-30h20v46h16V110h28v16h8v-12h16v46h24v-24h12v28h20V140h18v24h24v-36h16v50h16V130h24v120z" fill="#0D0811"/>
<g class="bob"><rect x="110" y="184" width="26" height="30" rx="6" fill="#1C1A24"/><rect x="113" y="168" width="20" height="16" rx="5" fill="#26232F"/><rect x="117" y="173" width="12" height="4" rx="2" fill="#C8FF2E"/></g>`}
</svg>`;

  const mars = (hero) => `
<svg viewBox="0 0 ${hero ? "1440 580" : "400 250"}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
${hero ? `
<rect width="1440" height="580" fill="#12081A"/>
<g fill="#fff"><circle cx="200" cy="80" r="2"/><circle cx="420" cy="140" r="1.5"/><circle cx="640" cy="60" r="2"/><circle cx="1300" cy="90" r="1.5"/><circle cx="880" cy="40" r="1.5"/><circle cx="1180" cy="200" r="2"/></g>
<circle class="sun" cx="1080" cy="230" r="170" fill="#E0552E"/>
<circle cx="1020" cy="190" r="28" fill="#C2441F"/><circle cx="1140" cy="290" r="40" fill="#C2441F"/><circle cx="1110" cy="160" r="14" fill="#C2441F"/>
<path d="M0 470c180-60 320-20 480-50s300-70 480-30 320 20 480-20v210H0z" fill="#8A2E1C"/>
<path d="M0 520c220-30 420 10 640-20s520-30 800 0v100H0z" fill="#5E1E14"/>
<g class="bob"><rect x="820" y="430" width="70" height="56" rx="10" fill="#D9DDE3"/><rect x="832" y="396" width="46" height="34" rx="8" fill="#EEF1F4"/><circle cx="846" cy="413" r="6" fill="#2EE6FF"/><circle cx="864" cy="413" r="6" fill="#2EE6FF"/><circle cx="832" cy="492" r="12" fill="#3A3A48"/><circle cx="878" cy="492" r="12" fill="#3A3A48"/><path d="M855 396v-16" stroke="#EEF1F4" stroke-width="4"/><circle cx="855" cy="378" r="5" fill="#C8FF2E"/></g>
<rect y="520" width="1440" height="60" fill="#0A0A12" opacity="0.7"/>` : `
<rect width="400" height="250" fill="#12081A"/>
<circle class="sun" cx="290" cy="80" r="70" fill="#E0552E"/><circle cx="270" cy="60" r="12" fill="#C2441F"/><circle cx="310" cy="100" r="18" fill="#C2441F"/>
<path d="M0 190c60-24 120-6 180-18s120-26 220-10v88H0z" fill="#8A2E1C"/>
<g class="bob"><rect x="110" y="168" width="34" height="28" rx="6" fill="#D9DDE3"/><rect x="116" y="150" width="22" height="18" rx="5" fill="#EEF1F4"/><circle cx="123" cy="159" r="3" fill="#2EE6FF"/><circle cx="131" cy="159" r="3" fill="#2EE6FF"/><circle cx="116" cy="200" r="6" fill="#3A3A48"/><circle cx="138" cy="200" r="6" fill="#3A3A48"/></g>`}
</svg>`;

  function cubeGrid(w, h, step) {
    let d = "";
    for (let y = step; y < h; y += step) d += `M0 ${y}H${w}`;
    for (let x = step; x < w; x += step) d += `M${x} 0V${h}`;
    return `<path d="${d}" stroke="#000" stroke-opacity="0.12" stroke-width="${step > 30 ? 2 : 1}"/>`;
  }

  const cube = (hero) => hero ? `
<svg viewBox="0 0 1440 580" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<rect width="1440" height="580" fill="#3E9F3C"/><rect width="420" height="580" fill="#2F86D9"/><rect x="420" width="60" height="580" fill="#E9D58A"/>
<rect x="1180" width="260" height="240" fill="#7D7D88"/><rect x="1240" y="60" width="60" height="60" fill="#3A3A44"/><rect x="1300" y="120" width="60" height="60" fill="#C9A06B"/>
<rect x="660" y="120" width="60" height="120" fill="#7A4E2A"/><rect x="600" width="180" height="140" fill="#2E7D32"/>
<rect x="960" y="300" width="60" height="120" fill="#7A4E2A"/><rect x="900" y="200" width="180" height="140" fill="#2E7D32"/>
${cubeGrid(1440, 580, 60)}
<g class="bob"><rect x="780" y="360" width="44" height="44" fill="#E2B48C"/><rect x="780" y="360" width="44" height="14" fill="#5A3A22"/><rect x="776" y="404" width="52" height="50" fill="#2BB3B3"/><rect x="780" y="454" width="20" height="30" fill="#3A3FA8"/><rect x="804" y="454" width="20" height="30" fill="#3A3FA8"/></g>
<rect width="1440" height="580" fill="#0A0A12" opacity="0.35"/>
</svg>` : `
<svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<rect width="400" height="250" fill="#3E9F3C"/><rect width="125" height="250" fill="#2F86D9"/><rect x="125" width="25" height="250" fill="#E9D58A"/>
<rect x="300" width="100" height="100" fill="#7D7D88"/><rect x="325" y="25" width="25" height="25" fill="#3A3A44"/>
<rect x="225" y="50" width="25" height="50" fill="#7A4E2A"/><rect x="200" width="75" height="60" fill="#2E7D32"/>
${cubeGrid(400, 250, 25)}
<g class="bob"><rect x="190" y="140" width="22" height="22" fill="#E2B48C"/><rect x="190" y="140" width="22" height="7" fill="#5A3A22"/><rect x="188" y="162" width="26" height="24" fill="#2BB3B3"/></g>
</svg>`;

  const soon = () => `<div class="soon-art"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7C5CFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="5"/></svg></div>`;

  const ART = { dawn, mars, cube, soon };

  // cover: имя процедурной обложки или URL картинки (для игр других авторов)
  P.cover = function (game, hero) {
    const fn = ART[game.cover];
    if (fn) return fn(hero);
    if (game.cover) return `<img src="${P.esc(game.cover)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`;
    return soon();
  };
})();
