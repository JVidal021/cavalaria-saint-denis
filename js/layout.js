// Cabeçalho, navegação e rodapé compartilhados por todas as páginas.
(function () {
  var PAGES = [
    { id: "inicio", href: "index.html", label: "Início" },
    { id: "cursos", href: "cursos.html", label: "Grade de Cursos" },
    { id: "conduta", href: "conduta.html", label: "Conduta" },
    { id: "prancheta", href: "prancheta.html", label: "Prancheta" },
    { id: "patrulha", href: "patrulha.html", label: "Patrulha & Abordagem" },
    { id: "lideranca", href: "lideranca.html", label: "Liderança" },
    { id: "negociacao", href: "negociacao.html", label: "Negociação" },
    { id: "prova", href: "prova.html", label: "Prova" }
  ];

  var BADGE =
    '<svg class="badge" viewBox="0 0 100 100" aria-hidden="true">' +
    '<defs><radialGradient id="g" cx="40%" cy="35%" r="70%">' +
    '<stop offset="0" stop-color="#f3d791"/><stop offset=".55" stop-color="#b88a35"/><stop offset="1" stop-color="#6b4a16"/>' +
    '</radialGradient></defs>' +
    star(50, 50, 46, 22, 6) +
    tips(50, 50, 46, 6) +
    '<circle cx="50" cy="50" r="19" fill="#7a5420" opacity=".25"/>' +
    '<circle cx="50" cy="50" r="17" fill="none" stroke="#3a2610" stroke-width="1.2"/>' +
    '<text x="50" y="57" text-anchor="middle" font-family="Caladea, serif" font-weight="700" font-size="18" fill="#2b1d12">SD</text>' +
    '</svg>';

  function star(cx, cy, R, r, n) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var rad = i % 2 === 0 ? R - 6 : r;
      var a = (Math.PI / n) * i - Math.PI / 2;
      pts.push((cx + rad * Math.cos(a)).toFixed(1) + "," + (cy + rad * Math.sin(a)).toFixed(1));
    }
    return '<polygon points="' + pts.join(" ") + '" fill="url(#g)" stroke="#3a2610" stroke-width="1.5" stroke-linejoin="round"/>';
  }

  function tips(cx, cy, R, n) {
    var out = "";
    for (var i = 0; i < n; i++) {
      var a = ((Math.PI * 2) / n) * i - Math.PI / 2;
      out += '<circle cx="' + (cx + (R - 4) * Math.cos(a)).toFixed(1) + '" cy="' + (cy + (R - 4) * Math.sin(a)).toFixed(1) +
        '" r="4.2" fill="url(#g)" stroke="#3a2610" stroke-width="1.2"/>';
    }
    return out;
  }

  var ORNAMENT =
    '<svg class="ornament" viewBox="0 0 340 22" aria-hidden="true" fill="none" stroke="currentColor">' +
    '<path d="M4 11 H130" stroke-width="1"/><path d="M210 11 H336" stroke-width="1"/>' +
    '<path d="M20 7 H118 M222 15 H320" stroke-width=".6" opacity=".6"/>' +
    '<path d="M130 11 C140 2, 150 2, 156 11 C150 20, 140 20, 130 11 Z" stroke-width="1"/>' +
    '<path d="M210 11 C200 2, 190 2, 184 11 C190 20, 200 20, 210 11 Z" stroke-width="1"/>' +
    '<path d="M170 2 L174 9 L182 11 L174 13 L170 20 L166 13 L158 11 L166 9 Z" fill="currentColor"/>' +
    "</svg>";

  var current = document.body.getAttribute("data-page");

  var nav = PAGES.map(function (p) {
    return '<a href="' + p.href + '"' + (p.id === current ? ' aria-current="page"' : "") + ">" + p.label + "</a>";
  }).join("");

  var header =
    '<header class="masthead">' +
    '<div class="edition"><span>Condado de Saint Denis</span><span>Edição Oficial · Anno 1899</span><span>Denver RP</span></div>' +
    '<a class="brand" href="index.html">' + BADGE +
    "<div><h1>Cavalaria de Saint Denis</h1><div class=\"sub\">Livro da Cavalaria · S.D.</div></div>" +
    "</a>" +
    '<p class="motto">“Disciplina, preparo e compromisso com o dever.”</p>' +
    "</header>" +
    '<hr class="double-rule">' +
    '<nav class="nav" aria-label="Navegação principal">' + nav + "</nav>";

  var footer =
    '<footer class="foot">' +
    '<div class="seal">Cavalaria de Saint Denis · SD</div>' +
    "<div>Denver RP · Material de treinamento interno · Uso exclusivo do efetivo</div>" +
    "</footer>";

  var sheet = document.querySelector(".sheet");
  sheet.insertAdjacentHTML("afterbegin", header);
  sheet.insertAdjacentHTML("beforeend", footer);

  document.querySelectorAll("[data-ornament]").forEach(function (el) {
    el.outerHTML = ORNAMENT;
  });
})();
