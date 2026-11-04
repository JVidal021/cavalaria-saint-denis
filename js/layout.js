// Cabeçalho, navegação e rodapé compartilhados por todas as páginas.
(function () {
  // Menu agrupado: links soltos e grupos que abrem uma lista.
  var MENU = [
    { id: "inicio", href: "index.html", label: "Início" },
    { label: "Material", itens: [
      { id: "cursos", href: "cursos.html", label: "Grade de Cursos" },
      { id: "conduta", href: "conduta.html", label: "Código de Conduta" },
      { id: "prancheta", href: "prancheta.html", label: "Prancheta" },
      { id: "patrulha", href: "patrulha.html", label: "Patrulha & Abordagem" },
      { id: "lideranca", href: "lideranca.html", label: "Liderança" },
      { id: "negociacao", href: "negociacao.html", label: "Negociação" }
    ] },
    { id: "consulta", href: "consulta.html", label: "Consulta" },
    { label: "Provas", itens: [
      { id: "avaliacao", href: "avaliacao.html", label: "Provas e agenda" },
      { id: "simulado", href: "simulado.html", label: "Simulado de treino" },
      { id: "resultados", href: "resultados.html", label: "Quadro de Honra" },
      { id: "ausencia", href: "ausencia.html", label: "Justificar ausência" }
    ] },
    { id: "situacao", href: "situacao.html", label: "Minha situação" }
  ];

  // Região de quem está lendo (escolhida no topo ou em "Minha situação"); muda o nome no cabeçalho.
  var CHAVE_REGIAO = "cavalaria-regiao";
  var REGIOES = (window.PROVA && window.PROVA.regioes) || ["Lemoyne", "New Hanover", "West Elizabeth", "Ambarino", "New Austin"];
  var SIGLAS = { "Lemoyne": "LM", "New Hanover": "NH", "West Elizabeth": "WE", "Ambarino": "AM", "New Austin": "NA" };
  function regiaoAtual() {
    var r = "";
    try { r = localStorage.getItem(CHAVE_REGIAO) || ""; } catch (e) {}
    return REGIOES.indexOf(r) >= 0 ? r : "";
  }
  var regiao = regiaoAtual();

  var BADGE =
    '<svg class="badge" viewBox="0 0 100 100" aria-hidden="true">' +
    '<defs><radialGradient id="g" cx="40%" cy="35%" r="70%">' +
    '<stop offset="0" stop-color="#f3d791"/><stop offset=".55" stop-color="#b88a35"/><stop offset="1" stop-color="#6b4a16"/>' +
    '</radialGradient></defs>' +
    star(50, 50, 46, 22, 6) +
    tips(50, 50, 46, 6) +
    '<circle cx="50" cy="50" r="19" fill="#7a5420" opacity=".25"/>' +
    '<circle cx="50" cy="50" r="17" fill="none" stroke="#3a2610" stroke-width="1.2"/>' +
    '<text x="50" y="57" text-anchor="middle" font-family="Caladea, serif" font-weight="700" font-size="18" fill="#2b1d12">' + (SIGLAS[regiao] || "C") + "</text>" +
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
  // Páginas isoladas (como a prova) não mostram o menu nem levam ao restante do site.
  var isolada = document.body.hasAttribute("data-isolada");

  function link(p) {
    return '<a href="' + p.href + '"' + (p.id === current ? ' aria-current="page"' : "") + ">" + p.label + "</a>";
  }
  var nav = MENU.map(function (g) {
    if (!g.itens) return link(g);
    var ativo = g.itens.some(function (p) { return p.id === current; });
    return '<details class="nav-grupo"><summary' + (ativo ? ' class="ativo"' : "") + ">" + g.label + "</summary>" +
      '<div class="nav-menu">' + g.itens.map(link).join("") + "</div></details>";
  }).join("");

  var brandInner = BADGE +
    "<div><h1>Cavalaria</h1><div class=\"sub\">" + (regiao ? "Estado de " + regiao : "Livro da Cavalaria") + "</div></div>";

  // Seletor de região no topo (fora das páginas isoladas, que só mostram o nome).
  var seletor = isolada ? "<span>" + (regiao || "Denver RP") + "</span>" :
    '<label class="regiao-topo">Região <select id="regiao-topo"><option value="">Todas</option>' +
    REGIOES.map(function (r) { return "<option" + (r === regiao ? " selected" : "") + ">" + r + "</option>"; }).join("") + "</select></label>";

  var header =
    '<header class="masthead">' +
    '<div class="edition">' + seletor + "<span>Edição Oficial · Anno 1899</span><span>Denver RP</span></div>" +
    (isolada ? '<div class="brand">' + brandInner + "</div>" : '<a class="brand" href="index.html">' + brandInner + "</a>") +
    '<p class="motto">“Disciplina, preparo e compromisso com o dever.”</p>' +
    "</header>" +
    '<hr class="double-rule">' +
    (isolada ? "" : '<nav class="nav" aria-label="Navegação principal">' + nav + "</nav>");

  var footer =
    '<footer class="foot">' +
    '<div class="seal">Cavalaria · ' + (regiao || "Denver RP") + "</div>" +
    "<div>Denver RP · Material de treinamento interno · Uso exclusivo do efetivo</div>" +
    "</footer>";

  var sheet = document.querySelector(".sheet");
  sheet.insertAdjacentHTML("afterbegin", header);
  sheet.insertAdjacentHTML("beforeend", footer);

  // Post-it marcador de página que leva ao Painel do Instrutor (fora das páginas isoladas, como a prova).
  if (!isolada) {
    sheet.insertAdjacentHTML("beforeend",
      '<a class="postit" href="painel.html" title="Painel do Instrutor (pede senha)">' +
      '<span class="postit-fita" aria-hidden="true"></span><span class="postit-texto">Instrutores</span></a>');
  }

  document.querySelectorAll("[data-ornament]").forEach(function (el) {
    el.outerHTML = ORNAMENT;
  });

  // Um grupo do menu aberto por vez; clicar fora fecha.
  var grupos = document.querySelectorAll(".nav-grupo");
  grupos.forEach(function (g) {
    g.addEventListener("toggle", function () {
      if (g.open) grupos.forEach(function (o) { if (o !== g) o.open = false; });
    });
  });
  document.addEventListener("click", function (ev) {
    if (!ev.target.closest(".nav-grupo")) grupos.forEach(function (g) { g.open = false; });
  });

  function definirRegiao(r) {
    try { if (r) localStorage.setItem(CHAVE_REGIAO, r); else localStorage.removeItem(CHAVE_REGIAO); } catch (e) {}
  }
  var sel = document.getElementById("regiao-topo");
  if (sel) sel.addEventListener("change", function () { definirRegiao(this.value); location.reload(); });
  window.Cavalaria = { regiao: regiao, regioes: REGIOES, definirRegiao: definirRegiao };
})();
