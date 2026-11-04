// Pedir cadastro: o oficial envia a ficha; o pedido fica pendente até um instrutor da região aprovar no painel.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var CHAVE_ID = "cavalaria-meu-id";
  var form = $("cadastro"), erro = $("erro");
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }

  $("c-patente").innerHTML = '<option value="">Selecione</option>' + window.PROVA.patentes.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("");
  $("c-regiao").innerHTML = '<option value="">Selecione</option>' + (window.PROVA.regioes || []).map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("");
  if (window.Cavalaria && window.Cavalaria.regiao) $("c-regiao").value = window.Cavalaria.regiao;
  // ID vindo da prova ou de "Minha situação" (?id=), ou o último consultado neste aparelho.
  var idInicial = new URLSearchParams(location.search).get("id") || "";
  if (!idInicial) { try { idInicial = localStorage.getItem(CHAVE_ID) || ""; } catch (e) {} }
  $("c-id").value = idInicial.replace(/\D/g, "").slice(0, 8);

  function falha(msg) {
    erro.hidden = false;
    erro.innerHTML = '<span class="label">Pedido não enviado</span>' + msg;
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var campos = ["c-nome", "c-id", "c-patente", "c-regiao"];
    var faltando = campos.filter(function (id) {
      var vazio = !$(id).value.trim() || (id === "c-id" && !/^\d{1,8}$/.test($(id).value.trim()));
      $(id).classList.toggle("faltando", vazio);
      return vazio;
    });
    if (faltando.length) {
      falha("Preencha os campos marcados em vermelho. O ID fixo tem só números.");
      $(faltando[0]).focus();
      return;
    }
    erro.hidden = true;
    var botao = $("btn-enviar");
    botao.disabled = true;
    botao.textContent = "Enviando…";
    var dados = { tipo: "cadastro", nome: $("c-nome").value, id: $("c-id").value.trim(), patente: $("c-patente").value,
      regiao: $("c-regiao").value, discord: $("c-discord").value };
    // text/plain evita a checagem extra de CORS; o Apps Script lê o corpo como texto.
    fetch(window.PROVA.api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(dados) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.erro || "falha");
        try { localStorage.setItem(CHAVE_ID, dados.id); } catch (e) {}
        if (window.Cavalaria && window.Cavalaria.regiao !== dados.regiao) window.Cavalaria.definirRegiao(dados.regiao);
        form.hidden = true;
        $("enviada").hidden = false;
        $("enviada-texto").innerHTML = "Pedido de cadastro de <strong>" + esc(dados.patente + " " + dados.nome) + "</strong> (ID " + esc(dados.id) +
          ") recebido.<br>Agora ele aguarda a aprovação de um instrutor de <strong>" + esc(dados.regiao) +
          '</strong>. Acompanhe em <a href="situacao.html">Minha situação</a>.';
        window.scrollTo(0, 0);
      })
      .catch(function (e) {
        botao.disabled = false;
        botao.textContent = "Pedir cadastro";
        falha(e && e.message && e.message !== "falha" && e.message.indexOf("JSON") < 0 ? esc(e.message)
          : "Não foi possível enviar agora. Verifique sua internet e tente de novo.");
      });
  });
})();
