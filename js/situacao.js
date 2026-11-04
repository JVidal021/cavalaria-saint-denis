// "Minha situação": o oficial consulta pelo ID fixo a patente, a região, a próxima prova e os resultados divulgados.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var CHAVE_ID = "cavalaria-meu-id";
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }
  function data(ms) { return ms ? new Date(ms).toLocaleDateString("pt-BR") : "—"; }

  function selo(resultado) {
    var classe = resultado === "Aprovado" ? "ok" : resultado === "Não aprovado" ? "" : "pendente";
    return '<span class="stamp ' + classe + '">' + esc(resultado.toUpperCase()) + "</span>";
  }

  function mostrar(s) {
    var botao = document.querySelector("#consultar button");
    botao.disabled = false;
    botao.textContent = "Consultar";
    if (!s.encontrado) {
      $("ficha").hidden = true;
      $("s-erro").hidden = false;
      $("s-erro").innerHTML = s.pendente
        ? '<span class="label">Cadastro aguardando aprovação</span>O pedido de cadastro deste ID está com os instrutores' +
          (s.regiao ? " de <strong>" + esc(s.regiao) + "</strong>" : "") + ". Assim que for aprovado, a sua ficha aparece aqui."
        : '<span class="label">ID não encontrado</span>Este ID não está no Efetivo. Confira o número ou <a href="cadastro.html?id=' +
          encodeURIComponent($("s-id").value.trim()) + '">peça o seu cadastro</a>.';
      return;
    }
    $("s-erro").hidden = true;
    // A região do oficial passa a ser a do site neste aparelho.
    if (s.regiao && window.Cavalaria && window.Cavalaria.regiao !== s.regiao) window.Cavalaria.definirRegiao(s.regiao);
    var proxima = s.aplicacoes && s.aplicacoes[0];
    var sobreProva = !s.suaProva
      ? "A sua patente não tem prova na carreira. Acompanhe os cursos com o seu padrinho e os instrutores."
      : proxima
        ? "Sua prova é a <strong>" + esc(s.suaProva.nome) + "</strong>. " + (proxima.inicio <= Date.now()
          ? "Ela está <strong>aberta agora</strong>, até " + Agenda.hora(proxima.fim) + '. <a href="prova.html">Fazer a prova</a>.'
          : "Próxima aplicação: <strong>" + esc(Agenda.formatar(proxima.inicio)) + "</strong>, até " + Agenda.hora(proxima.fim) + ".")
        : "Sua prova é a <strong>" + esc(s.suaProva.nome) + "</strong>. Ainda não há aplicação marcada para você; aguarde o comunicado dos instrutores.";
    $("ficha").innerHTML =
      '<div class="ficha-oficial-publica">' +
      "<h3>" + esc(s.nome) + "</h3>" +
      '<dl class="dados"><div><dt>Patente</dt><dd>' + esc(s.patente || "—") + "</dd></div>" +
      "<div><dt>Região</dt><dd>" + esc(s.regiao || "Sem região definida") + "</dd></div>" +
      "<div><dt>Padrinho</dt><dd>" + esc(s.padrinho || "Nenhum") + "</dd></div></dl></div>" +
      '<div class="telegram" data-label="SUA PRÓXIMA PROVA"><p>' + sobreProva + "</p></div>" +
      '<h3 class="section">Provas feitas</h3>' +
      (s.provas.length ? '<ul class="situacao-lista">' + s.provas.map(function (p) {
        return "<li><strong>" + esc(p.prova.nome) + "</strong> · última em " + data(p.quando) +
          (p.tentativas > 1 ? " · " + p.tentativas + " tentativas" : "") + " " + selo(p.resultado) + "</li>";
      }).join("") + "</ul>" : '<p class="cinza">Nenhuma prova enviada com este ID.</p>') +
      (s.ausencias.length ? '<h3 class="section">Justificativas de ausência</h3><ul class="situacao-lista">' + s.ausencias.map(function (a) {
        return "<li>" + esc(a.aplicacao) + " · enviada em " + data(a.quando) + ' <span class="stamp ' +
          (a.situacao === "Aceita" ? "ok" : a.situacao === "Recusada" ? "" : "pendente") + '">' + esc(a.situacao.toUpperCase()) + "</span></li>";
      }).join("") + "</ul>" : "") +
      '<p class="cinza">Algum dado errado? Procure um instrutor da sua região.</p>';
    $("ficha").hidden = false;
  }

  function consultar(id) {
    var botao = document.querySelector("#consultar button");
    botao.disabled = true;
    botao.textContent = "Consultando…";
    fetch(window.PROVA.api + "?situacao=" + encodeURIComponent(id) + "&t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(mostrar)
      .catch(function () {
        botao.disabled = false;
        botao.textContent = "Consultar";
        $("s-erro").hidden = false;
        $("s-erro").innerHTML = '<span class="label">Sem conexão</span>Não foi possível consultar agora. Tente de novo em instantes.';
      });
  }

  $("consultar").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var id = $("s-id").value.trim();
    if (!id) return;
    try { localStorage.setItem(CHAVE_ID, id); } catch (e) {}
    consultar(id);
  });
  var salvo = "";
  try { salvo = localStorage.getItem(CHAVE_ID) || ""; } catch (e) {}
  if (salvo) { $("s-id").value = salvo; consultar(salvo); }
})();
