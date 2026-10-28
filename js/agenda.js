// Consulta a agenda das provas (App da Web do Google). Fora do horário, a prova fica fechada.
(function () {
  function formatar(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) +
      " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function hora(ms) { return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }
  function nomeProva(p) { return p && p.nome ? p.nome : "prova"; }

  // id: ID fixo do oficial, exigido nas aplicações restritas a alguns IDs (recuperação, promoção).
  function consultar(comQuestoes, id) {
    var api = window.PROVA && window.PROVA.api;
    if (!api) return Promise.resolve({ aberta: false, proxima: null });
    var url = api + "?t=" + Date.now() + (comQuestoes ? "&questoes=1" : "") + (id ? "&id=" + encodeURIComponent(id) : "");
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // Texto para o oficial: qual prova está aberta e até quando, a próxima aplicação, ou nada agendado.
  function descrever(e) {
    if (e.aberta) return "A <strong>" + esc(nomeProva(e.prova)) + "</strong> está <strong>aberta</strong> até " + formatar(e.fim) + "." +
      (e.restrita ? " Esta aplicação é <strong>só para os oficiais convocados</strong>." : "");
    if (e.proxima) return "Nenhuma prova aberta agora. Próxima aplicação: <strong>" + esc(nomeProva(e.proxima.prova)) + "</strong>, " +
      formatar(e.proxima.inicio) + ", até " + hora(e.proxima.fim) + "." +
      (e.proxima.restrita ? " Só para os oficiais convocados." : "");
    return "Nenhuma prova aberta agora e nenhuma aplicação agendada; aguarde o comunicado dos instrutores.";
  }

  window.Agenda = { consultar: consultar, descrever: descrever, formatar: formatar, hora: hora };
})();
