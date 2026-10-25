// Consulta a agenda da prova (App da Web do Google). Fora do horário, a prova fica fechada.
(function () {
  function formatar(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) +
      " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // id: ID fixo do oficial, exigido nas aplicações de recuperação (restritas a alguns IDs).
  function consultar(comQuestoes, id) {
    var api = window.PROVA && window.PROVA.api;
    if (!api) return Promise.resolve({ aberta: false, proxima: null });
    var url = api + "?t=" + Date.now() + (comQuestoes ? "&questoes=1" : "") + (id ? "&id=" + encodeURIComponent(id) : "");
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // Texto para o oficial: aberta até..., próxima aplicação..., ou nada agendado.
  function descrever(e) {
    if (e.aberta) return "A prova está <strong>aberta</strong> até " + formatar(e.fim) + "." +
      (e.restrita ? " Esta é uma <strong>aplicação de recuperação</strong>, só para os oficiais convocados." : "");
    if (e.proxima) return "A prova está <strong>fechada</strong>. Próxima aplicação: " + formatar(e.proxima.inicio) +
      ", até " + new Date(e.proxima.fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + ".";
    return "A prova está <strong>fechada</strong>. Nenhuma aplicação agendada no momento; aguarde o comunicado do instrutor.";
  }

  window.Agenda = { consultar: consultar, descrever: descrever, formatar: formatar };
})();
