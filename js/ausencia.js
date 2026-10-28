// Justificativa de ausência: envia o pedido ao App da Web, que grava na aba "Ausências" da planilha.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var form = $("ausencia");
  var erro = $("erro");

  function dataCurta(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }) +
      " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // Datas da Agenda: aplicações recentes e próximas. O rótulo começa pela data (o painel casa por ela).
  Agenda.consultar(false).then(function (e) {
    var opcoes = (e.aplicacoes || []).map(function (j) {
      var rotulo = dataCurta(j.inicio) + (j.prova ? " · " + j.prova.curto : "");
      return '<option value="' + rotulo + '">' + rotulo + (j.fim < Date.now() ? " (já aplicada)" : "") + "</option>";
    });
    $("a-aplicacao").innerHTML = '<option value="">Escolha…</option>' + opcoes.join("") +
      '<option value="Outra data">Outra data (explique na justificativa)</option>';
    var proxima = (e.aplicacoes || []).filter(function (j) { return j.fim > Date.now(); })[0];
    if (proxima) $("a-aplicacao").value = dataCurta(proxima.inicio) + (proxima.prova ? " · " + proxima.prova.curto : "");
  }).catch(function () {
    $("a-aplicacao").innerHTML = '<option value="">Escolha…</option><option value="Outra data">Data informada na justificativa</option>';
  });

  $("a-justificativa").addEventListener("input", function () {
    $("contagem").textContent = this.value.length + "/1000";
  });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var campos = ["a-nome", "a-id", "a-patente", "a-aplicacao", "a-motivo", "a-justificativa"];
    var faltando = campos.filter(function (id) {
      var vazio = !$(id).value.trim() || (id === "a-justificativa" && $(id).value.trim().length < 10);
      $(id).classList.toggle("faltando", vazio);
      return vazio;
    });
    if (faltando.length) {
      erro.hidden = false;
      erro.innerHTML = '<span class="label">Requerimento incompleto</span>Preencha os campos marcados em vermelho. A justificativa precisa de pelo menos 10 caracteres.';
      $(faltando[0]).focus();
      return;
    }
    erro.hidden = true;
    var botao = $("btn-enviar");
    botao.disabled = true;
    botao.textContent = "Enviando…";
    var dados = {
      tipo: "ausencia", nome: $("a-nome").value, id: $("a-id").value, patente: $("a-patente").value,
      discord: $("a-discord").value, aplicacao: $("a-aplicacao").value, motivo: $("a-motivo").value,
      justificativa: $("a-justificativa").value
    };
    // text/plain evita a checagem extra de CORS; o Apps Script lê o corpo como texto.
    fetch(window.PROVA.api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(dados) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.erro || "falha");
        form.hidden = true;
        $("enviada").hidden = false;
        $("enviada-texto").innerHTML = "Justificativa de <strong>" + escapar(dados.patente + " " + dados.nome) +
          "</strong> recebida pela Cavalaria.<br>Os instrutores vão avaliar o pedido. Acompanhe o canal da Cavalaria.";
        window.scrollTo(0, 0);
      })
      .catch(function (e) {
        botao.disabled = false;
        botao.textContent = "Enviar justificativa";
        erro.hidden = false;
        erro.innerHTML = '<span class="label">Falha no envio</span>' +
          (e && e.message && e.message !== "falha" && e.message.indexOf("JSON") < 0 ? escapar(e.message) : "Não foi possível enviar agora. Verifique sua internet e tente de novo.");
      });
  });

  function escapar(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
})();
