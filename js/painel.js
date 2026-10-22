// Painel do Instrutor: lê os resultados da prova no App da Web (com senha) e mostra no visual do site.
(function () {
  var API = window.PROVA && window.PROVA.api;
  var CHAVE_SENHA = "cavalaria-painel-senha";
  var CHAVE_DADOS = "cavalaria-painel-dados";
  var dados = null;
  var aberto = null; // linha do oficial expandida

  var $ = function (id) { return document.getElementById(id); };
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }
  // Senha e últimos dados ficam na sessão; com "Lembrar neste aparelho", ficam guardados no navegador.
  function lembrado() { try { return !!localStorage.getItem(CHAVE_SENHA); } catch (e) { return false; } }
  function ler(chave) { try { return localStorage.getItem(chave) || sessionStorage.getItem(chave) || ""; } catch (e) { return ""; } }
  function lerSenha() { return ler(CHAVE_SENHA); }
  function guardar(senha, dadosNovos, lembrar) {
    try {
      var alvo = lembrar ? localStorage : sessionStorage;
      var outro = lembrar ? sessionStorage : localStorage;
      [CHAVE_SENHA, CHAVE_DADOS].forEach(function (k) { outro.removeItem(k); });
      alvo.setItem(CHAVE_SENHA, senha);
      if (dadosNovos) alvo.setItem(CHAVE_DADOS, JSON.stringify(dadosNovos));
    } catch (e) {}
  }
  function esquecer() {
    try { [localStorage, sessionStorage].forEach(function (a) { a.removeItem(CHAVE_SENHA); a.removeItem(CHAVE_DADOS); }); } catch (e) {}
  }
  function carga(texto) { $("carga").textContent = texto || ""; }
  function quando(ms) {
    if (!ms) return "—";
    var d = new Date(ms);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function carregar(senha, fresco, lembrar) {
    var botao = document.querySelector("#entrar button");
    botao.disabled = true;
    botao.textContent = "Conferindo…";
    carga(fresco ? "Buscando dados novos…" : "Atualizando…");
    if (lembrar === undefined) lembrar = lembrado();
    return fetch(API + "?painel=" + encodeURIComponent(senha) + (fresco ? "&fresco=1" : "") + "&t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        botao.disabled = false;
        botao.textContent = "Entrar";
        if (!r.ok) {
          esquecer();
          carga("");
          $("entrar").hidden = false;
          $("painel").hidden = true;
          $("entrar-erro").hidden = false;
          $("entrar-erro").innerHTML = '<span class="label">Acesso negado</span>Senha incorreta.';
          return;
        }
        guardar(senha, r, lembrar);
        dados = r;
        carga("Atualizado às " + new Date(r.geradoEm || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
        $("entrar").hidden = true;
        $("painel").hidden = false;
        desenhar();
      })
      .catch(function () {
        botao.disabled = false;
        botao.textContent = "Entrar";
        carga(dados ? "Sem conexão: mostrando os últimos dados" : "");
        $("entrar-erro").hidden = false;
        $("entrar-erro").innerHTML = '<span class="label">Sem conexão</span>Não foi possível falar com o servidor da prova. Tente de novo.';
      });
  }

  function desenhar() {
    var res = dados.resultados.slice().sort(function (a, b) { return (b.quando || 0) - (a.quando || 0); });

    // Agenda
    var ag = dados.agenda;
    var proximas = (ag.janelas || []).filter(function (j) { return j.fim > Date.now(); })
      .sort(function (a, b) { return a.inicio - b.inicio; });
    $("agenda").innerHTML = Agenda.descrever(ag) +
      (proximas.length > 1 ? "<br>Aplicações marcadas: " + proximas.map(function (j) { return quando(j.inicio); }).join(" · ") : "");

    // Placar
    var aprov = res.filter(function (r) { return r.aprovado; }).length;
    var media = res.length ? Math.round(res.reduce(function (s, r) { return s + r.nota; }, 0) / res.length) : 0;
    $("placar").innerHTML = [
      ["Provas", res.length, ""],
      ["Aprovados", aprov, "ok"],
      ["Reprovados", res.length - aprov, "mal"],
      ["Média", media + "%", ""]
    ].map(function (c) {
      return '<div class="placa ' + c[2] + '"><span class="placa-num">' + c[1] + '</span><span class="placa-rot">' + c[0] + "</span></div>";
    }).join("");

    // Acertos por tópico
    var porTopico = {};
    dados.topicos.forEach(function (t) { porTopico[t] = { certas: 0, total: 0 }; });
    res.forEach(function (r) {
      r.respostas.forEach(function (x) {
        var t = porTopico[x.topico];
        if (!t) return;
        t.total++;
        if (x.certo) t.certas++;
      });
    });
    $("topicos").innerHTML = dados.topicos.map(function (nome) {
      var t = porTopico[nome];
      var pct = t.total ? Math.round(t.certas / t.total * 100) : 0;
      var classe = !t.total ? "" : pct >= dados.notaMinima ? "ok" : "mal";
      return '<div class="topico"><span class="topico-nome">' + esc(nome) + "</span>" +
        '<span class="topico-barra"><i class="' + classe + '" style="width:' + pct + '%"></i></span>' +
        '<span class="topico-pct">' + (t.total ? pct + "%" : "—") + "</span></div>";
    }).join("");

    // Lista de oficiais
    var busca = $("busca").value.trim().toLowerCase();
    var filtro = $("filtro").value;
    var lista = res.filter(function (r) {
      if (filtro === "aprovados" && !r.aprovado) return false;
      if (filtro === "reprovados" && r.aprovado) return false;
      return !busca || (r.nome + " " + r.id + " " + r.patente).toLowerCase().indexOf(busca) >= 0;
    });
    $("vazio").hidden = lista.length > 0;
    $("oficiais").innerHTML = lista.map(function (r, i) {
      var chave = r.id + "|" + r.quando;
      var linha = '<tr class="oficial' + (aberto === chave ? " aberto" : "") + '" data-chave="' + esc(chave) + '" tabindex="0">' +
        "<td><strong>" + esc(r.nome) + "</strong></td><td>" + esc(r.id) + "</td><td>" + esc(r.patente) + "</td>" +
        "<td>" + quando(r.quando) + '</td><td class="cost">' + r.acertos + "/" + r.recebidas + '</td><td class="cost">' + r.nota + "%</td>" +
        '<td><span class="stamp ' + (r.aprovado ? "ok" : "") + '">' + (r.aprovado ? "APROVADO" : "REPROVADO") + "</span></td></tr>";
      if (aberto === chave) linha += '<tr class="ficha-oficial"><td colspan="7">' + ficha(r) + "</td></tr>";
      return linha;
    }).join("");
  }

  function ficha(r) {
    var porTopico = {};
    r.respostas.forEach(function (x) { (porTopico[x.topico] = porTopico[x.topico] || []).push(x); });
    var html = r.discord ? '<p class="ficha-discord">Discord: <strong>' + esc(r.discord) + "</strong></p>" : "";
    dados.topicos.forEach(function (t) {
      var itens = porTopico[t];
      if (!itens) return;
      html += "<h4>" + esc(t) + "</h4><ol class=\"respostas\">" + itens.map(function (x) {
        return '<li class="' + (x.certo ? "certa" : "errada") + '"><span class="marca">' + (x.certo ? "✔" : "✘") + "</span>" +
          '<div><p class="pergunta">' + esc(x.q) + "</p>" +
          '<p class="resp">Respondeu: <strong>' + esc(x.marcada) + "</strong></p>" +
          (x.certo ? "" : '<p class="resp correta">Correta: <strong>' + esc(x.correta) + "</strong></p>") +
          "</div></li>";
      }).join("") + "</ol>";
    });
    return html;
  }

  // Eventos
  $("entrar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    $("entrar-erro").hidden = true;
    carregar($("senha").value, false, $("lembrar").checked);
  });
  $("atualizar").addEventListener("click", function () { carregar(lerSenha(), true); });
  $("sair").addEventListener("click", function () {
    esquecer();
    dados = null;
    $("senha").value = "";
    $("painel").hidden = true;
    $("entrar").hidden = false;
  });
  $("busca").addEventListener("input", function () { if (dados) desenhar(); });
  $("filtro").addEventListener("change", function () { if (dados) desenhar(); });
  function alternar(tr) {
    var chave = tr.getAttribute("data-chave");
    aberto = aberto === chave ? null : chave;
    desenhar();
  }
  $("oficiais").addEventListener("click", function (ev) {
    var tr = ev.target.closest("tr.oficial");
    if (tr) alternar(tr);
  });
  $("oficiais").addEventListener("keydown", function (ev) {
    var tr = ev.target.closest("tr.oficial");
    if (tr && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); alternar(tr); }
  });

  // Já entrou antes: mostra na hora os últimos dados guardados e atualiza por trás.
  if (lerSenha()) {
    try { dados = JSON.parse(ler(CHAVE_DADOS) || "null"); } catch (e) { dados = null; }
    if (dados) {
      $("entrar").hidden = true;
      $("painel").hidden = false;
      desenhar();
    }
    carregar(lerSenha());
  }
})();
