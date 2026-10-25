// Painel do Instrutor: lê os resultados da prova no App da Web (com senha) e mostra no visual do site.
(function () {
  var API = window.PROVA && window.PROVA.api;
  var CHAVE_SENHA = "cavalaria-painel-senha";
  var CHAVE_DADOS = "cavalaria-painel-dados";
  var CHAVE_ABA = "cavalaria-painel-aba";
  var CHAVE_AUTOR = "cavalaria-painel-autor";
  var PAGINAS = {
    "Código de Conduta": "conduta.html", "MDT · Prancheta": "prancheta.html", "Patrulha e Abordagem": "patrulha.html",
    "Negociação": "negociacao.html", "Liderança de Patrulha": "lideranca.html"
  };
  var SITUACOES = ["Pendente de avaliação individual", "Cursos iniciais concluídos", "Em recuperação", "Reprovado"];
  var ROTULO_ORAL = { completa: "Completa", parcial: "Parcial", nao: "Não soube" };
  var dados = null;
  var aberto = null; // linha do oficial expandida
  var ordem = { campo: "quando", desc: true };

  var $ = function (id) { return document.getElementById(id); };
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }
  // Compara nomes e IDs sem diferença de maiúsculas, acentos e espaços.
  function chave(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function ehTeste(r) { return /\bteste\b/.test(chave(r.nome + " " + r.patente)); }
  function idOficial(r) { return chave(r.id) || chave(r.nome); }

  // Senha e últimos dados ficam na sessão; com "Lembrar neste aparelho", ficam guardados no navegador.
  function lembrado() { try { return !!localStorage.getItem(CHAVE_SENHA); } catch (e) { return false; } }
  function ler(c) { try { return localStorage.getItem(c) || sessionStorage.getItem(c) || ""; } catch (e) { return ""; } }
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
  function autor() { try { return localStorage.getItem(CHAVE_AUTOR) || ""; } catch (e) { return ""; } }
  function urlSite(pagina) { return new URL(pagina, location.href).href; }
  function copiar(texto, botao, rotulo) {
    function feito() { botao.textContent = "Copiado!"; setTimeout(function () { botao.textContent = rotulo; }, 1800); }
    function reserva() {
      var t = $("copia-reserva");
      t.value = texto; t.hidden = false; t.focus(); t.select();
      botao.textContent = "Selecione e copie";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(feito, reserva);
    else reserva();
  }
  // Melhor tentativa de cada oficial (pelo ID, ou pelo nome se faltar ID).
  function melhores(res) {
    var m = {};
    res.forEach(function (r) { var k = idOficial(r); if (!m[k] || r.nota > m[k].nota) m[k] = r; });
    return m;
  }
  function avaliacaoDe(r) {
    var id = chave(r.id);
    return (dados.avaliacoes || []).filter(function (a) { return chave(a.id) === id && id; })[0] || null;
  }
  function quando(ms) {
    if (!ms) return "—";
    var d = new Date(ms);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // acao: parâmetros extras para o servidor (divulgar resultados, avaliar ausência, corrigir dados).
  function carregar(senha, fresco, lembrar, acao) {
    var botao = document.querySelector("#entrar button");
    botao.disabled = true;
    botao.textContent = "Conferindo…";
    carga(acao ? "Salvando…" : fresco ? "Buscando dados novos…" : "Atualizando…");
    if (lembrar === undefined) lembrar = lembrado();
    var extra = acao ? acao + "&autor=" + encodeURIComponent(autor() || "Instrutor") : "";
    return fetch(API + "?painel=" + encodeURIComponent(senha) + (fresco ? "&fresco=1" : "") + extra + "&t=" + Date.now(), { cache: "no-store" })
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
        carga(r.aviso || "Atualizado às " + new Date(r.geradoEm || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
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

  // ---------- Abas ----------
  function abaAtual() { try { return sessionStorage.getItem(CHAVE_ABA) || "resumo"; } catch (e) { return "resumo"; } }
  function mostrarAba(nome) {
    try { sessionStorage.setItem(CHAVE_ABA, nome); } catch (e) {}
    document.querySelectorAll(".aba").forEach(function (b) {
      var ativa = b.getAttribute("data-aba") === nome;
      b.classList.toggle("ativa", ativa);
      b.setAttribute("aria-selected", ativa ? "true" : "false");
    });
    document.querySelectorAll(".painel-aba").forEach(function (p) { p.hidden = p.getAttribute("data-painel") !== nome; });
  }

  // Provas consideradas (sem as de teste, se a opção estiver marcada).
  function provas() {
    var ocultar = $("ocultar-testes").checked;
    return dados.resultados.filter(function (r) { return !ocultar || !ehTeste(r); });
  }

  function desenhar() {
    var res = provas();
    var tentativas = {};
    res.forEach(function (r) { var k = idOficial(r); tentativas[k] = (tentativas[k] || 0) + 1; });

    mostrarAba(abaAtual());
    desenharAgenda();
    desenharResumo(res);
    desenharDivulgacao();
    desenharOficiais(res, tentativas);
    desenharAusencias(res);
    desenharPresenca(res);
    desenharRecuperacao(res);
    desenharRegistro();
  }

  // ---------- Presença: efetivo × provas × ausências ----------
  function desenharPresenca(res) {
    var efetivo = dados.efetivo || [];
    var aus = dados.ausencias || [];
    var m = melhores(res);
    function provaDe(o) {
      return m[chave(o.id)] || res.filter(function (r) { return chave(r.nome) === chave(o.nome); })[0] || null;
    }
    function ausenciaDe(o) {
      return aus.filter(function (a) { return (chave(o.id) && chave(a.id) === chave(o.id)) || chave(a.nome) === chave(o.nome); })[0] || null;
    }
    if (!efetivo.length) {
      $("presenca-ajuda").innerHTML = "Para ver quem <strong>faltou sem justificativa</strong>, preencha a aba <strong>Efetivo</strong> da planilha com nome, ID fixo e patente de todos os oficiais. Depois clique em Atualizar.";
      $("presenca").innerHTML = "";
      $("n-faltosos").textContent = "";
      return;
    }
    var fez = [], justificou = [], faltou = [];
    efetivo.forEach(function (o) {
      var p = provaDe(o), a = ausenciaDe(o);
      if (p) fez.push({ o: o, p: p });
      else if (a) justificou.push({ o: o, a: a });
      else faltou.push({ o: o });
    });
    var noEfetivo = {};
    efetivo.forEach(function (o) { noEfetivo[chave(o.id)] = 1; noEfetivo[chave(o.nome)] = 1; });
    var fora = Object.keys(m).map(function (k) { return m[k]; })
      .filter(function (r) { return !noEfetivo[chave(r.id)] && !noEfetivo[chave(r.nome)]; });
    $("n-faltosos").textContent = faltou.length || "";
    $("n-faltosos").classList.toggle("alerta", faltou.length > 0);
    $("presenca-ajuda").innerHTML = "Efetivo com <strong>" + efetivo.length + "</strong> oficiais, conforme a aba Efetivo da planilha.";
    function nome(o) { return esc((o.patente ? o.patente + " " : "") + o.nome) + (o.id ? ' <span class="cinza">· ID ' + esc(o.id) + "</span>" : ""); }
    function grupo(titulo, classe, itens, linha, botao) {
      return '<section class="grupo ' + classe + '"><h4>' + titulo + " <span>(" + itens.length + ")</span>" + (botao || "") + "</h4>" +
        (itens.length ? "<ul>" + itens.map(linha).join("") + "</ul>" : '<p class="cinza">Ninguém.</p>') + "</section>";
    }
    $("presenca").innerHTML =
      grupo("Faltou sem justificativa", "faltou", faltou, function (x) { return "<li>" + nome(x.o) + "</li>"; },
        faltou.length ? ' <button type="button" class="btn-sec" id="copiar-faltosos">Copiar lista</button>' : "") +
      grupo("Justificou a ausência", "justificou", justificou, function (x) {
        return "<li>" + nome(x.o) + ' · <span class="stamp ' + (x.a.situacao === "Aceita" ? "ok" : x.a.situacao === "Recusada" ? "" : "pendente") + '">' + esc(x.a.situacao.toUpperCase()) + "</span></li>";
      }) +
      grupo("Fez a prova", "fez", fez, function (x) {
        return "<li>" + nome(x.o) + " · " + x.p.nota + '% <span class="stamp ' + (x.p.aprovado ? "ok" : "") + '">' + (x.p.aprovado ? "APROVADO" : "REPROVADO") + "</span></li>";
      }) +
      (fora.length ? grupo("Fez a prova, mas não está no Efetivo", "fora", fora, function (r) {
        return "<li>" + nome(r) + " · " + r.nota + "%</li>";
      }) : "");
    window.__faltosos = faltou.map(function (x) { return "• " + (x.o.patente ? x.o.patente + " " : "") + x.o.nome + (x.o.id ? " (ID " + x.o.id + ")" : ""); }).join("\n");
  }

  // ---------- Recuperação e padrinhos ----------
  function pendentesDeAprovacao(res) {
    var m = melhores(res);
    return Object.keys(m).map(function (k) { return m[k]; }).filter(function (r) { return !r.aprovado; });
  }
  function padrinhos(res) {
    var m = melhores(res);
    var aprovados = Object.keys(m).map(function (k) { return m[k]; }).filter(function (r) { return r.aprovado; })
      .sort(function (a, b) { return b.nota - a.nota; });
    var uso = {};
    return pendentesDeAprovacao(res).map(function (r) {
      var candidatos = aprovados.filter(function (a) { return chave(a.patente) === chave(r.patente); });
      if (!candidatos.length) candidatos = aprovados;
      candidatos = candidatos.slice().sort(function (a, b) { return (uso[idOficial(a)] || 0) - (uso[idOficial(b)] || 0) || b.nota - a.nota; });
      var p = candidatos[0] || null;
      if (p) uso[idOficial(p)] = (uso[idOficial(p)] || 0) + 1;
      return { aluno: r, padrinho: p };
    });
  }
  function desenharRecuperacao(res) {
    var pend = pendentesDeAprovacao(res);
    $("n-recuperacao").textContent = pend.length ? "· " + pend.length + " oficial(is) sem aprovação" : "· todos aprovados";
    if (!$("rec-ids").dataset.editado) $("rec-ids").value = pend.map(function (r) { return r.id; }).filter(String).join(", ");
    if (!$("rec-inicio").value) {
      var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0);
      var f = new Date(d.getTime() + 36e5);
      var iso = function (x) { return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
      $("rec-inicio").value = iso(d); $("rec-fim").value = iso(f);
    }
    var pares = padrinhos(res);
    $("padrinhos").innerHTML = pares.length ? pares.map(function (x) {
      return "<li><strong>" + esc(x.aluno.patente + " " + x.aluno.nome) + "</strong> (" + x.aluno.nota + "%) → " +
        (x.padrinho ? esc(x.padrinho.patente + " " + x.padrinho.nome) + " (" + x.padrinho.nota + "%)" : "sem aprovado disponível") + "</li>";
    }).join("") : '<li class="cinza">Ninguém precisa de padrinho: todos foram aprovados.</li>';
  }

  // ---------- Registro de ações ----------
  function desenharRegistro() {
    var lista = dados.registro || [];
    $("registro").innerHTML = lista.length ? lista.map(function (x) {
      return '<li><span class="cinza">' + quando(x.quando) + "</span> · <strong>" + esc(x.autor) + "</strong> · " + esc(x.acao) +
        (x.detalhe ? ' <span class="cinza">— ' + esc(x.detalhe) + "</span>" : "") + "</li>";
    }).join("") : '<li class="cinza">Nenhuma ação registrada ainda.</li>';
  }

  // ---------- Plano de estudo individual ----------
  function planoDeEstudo(r) {
    var porTopico = {};
    r.respostas.forEach(function (x) {
      var t = porTopico[x.topico] = porTopico[x.topico] || { certas: 0, total: 0 };
      t.total++; if (x.certo) t.certas++;
    });
    var fracos = Object.keys(porTopico).map(function (k) { return { nome: k, c: porTopico[k].certas, t: porTopico[k].total }; })
      .filter(function (x) { return x.c < x.t; })
      .sort(function (a, b) { return a.c / a.t - b.c / b.t; });
    var ag = (dados.agenda.janelas || []).filter(function (j) {
      return j.fim > Date.now() && (!j.ids || !j.ids.length || j.ids.indexOf(chave(r.id)) >= 0);
    }).sort(function (a, b) { return a.inicio - b.inicio; })[0];
    return "📘 **Plano de estudo — " + r.patente + " " + r.nome + "**\n\n" +
      "Na Prova de Conhecimento você acertou " + r.acertos + " de " + r.recebidas + " (" + r.nota + "%). " +
      (r.aprovado ? "Você foi aprovado, mas vale reforçar:" : "A nota mínima é " + dados.notaMinima + "%. Para a recuperação, reforce:") + "\n" +
      (fracos.length ? fracos.map(function (x) {
        return "• **" + x.nome + "** — acertou " + x.c + " de " + x.t + " → " + urlSite(PAGINAS[x.nome] || "index.html");
      }).join("\n") : "• Nenhum tópico com erro. Parabéns!") + "\n\n" +
      "Treine no simulado (não conta nota): " + urlSite("simulado.html") + "\n" +
      "Consulta rápida: " + urlSite("consulta.html") + "\n" +
      (ag ? "\nPróxima aplicação: " + quando(ag.inicio) + "." : "\nA data da recuperação será informada pelos instrutores.") +
      "\n\nQualquer dúvida, procure um instrutor. Disciplina, preparo e compromisso com o dever.";
  }

  // ---------- Avaliação individual (formulário dentro da ficha) ----------
  function formAvaliacao(r) {
    var av = avaliacaoDe(r) || { orais: {}, situacao: SITUACOES[0], obs: "" };
    var orais = dados.orais || [];
    var grupoAtual = null;
    var itens = orais.map(function (o, i) {
      var cab = o.m !== grupoAtual ? '<li class="oral-grupo">' + esc(o.m) + "</li>" : "";
      grupoAtual = o.m;
      var v = av.orais[i] || "";
      return cab + '<li class="oral"><div><p>' + esc(o.q) + '</p><details><summary>Resposta esperada</summary><p>' + esc(o.r) + "</p></details></div>" +
        '<select name="oral-' + i + '" aria-label="Resultado da pergunta">' +
        ['<option value="">—</option>'].concat(["completa", "parcial", "nao"].map(function (k) {
          return '<option value="' + k + '"' + (v === k ? " selected" : "") + ">" + ROTULO_ORAL[k] + "</option>";
        })).join("") + "</select></li>";
    }).join("");
    return '<details class="avaliacao"' + (avaliacaoDe(r) ? "" : "") + '><summary>Avaliação individual · <strong>' + esc(av.situacao || SITUACOES[0]) + "</strong>" +
      (av.instrutor ? ' <span class="cinza">— ' + esc(av.instrutor) + ", " + quando(av.quando) + "</span>" : "") + "</summary>" +
      '<form class="avaliacao-form" data-id="' + esc(r.id) + '" data-nome="' + esc(r.nome) + '">' +
      '<p class="cinza">Escolha de 3 a 5 perguntas e uma situação prática. Deixe "—" nas que não foram feitas.</p>' +
      '<ol class="orais">' + itens + "</ol>" +
      '<div class="avaliacao-final"><label>Situação final<select name="situacao">' + SITUACOES.map(function (s) {
        return '<option' + (s === av.situacao ? " selected" : "") + ">" + esc(s) + "</option>";
      }).join("") + '</select></label><label class="largo">Observações<textarea name="obs" rows="2" maxlength="1000">' + esc(av.obs) + "</textarea></label></div>" +
      '<p><button type="submit" class="btn-sec">Salvar avaliação</button></p></form></details>';
  }

  function historico(r) {
    var k = idOficial(r);
    var tentativas = dados.resultados.filter(function (x) { return idOficial(x) === k; }).sort(function (a, b) { return a.quando - b.quando; });
    var aus = (dados.ausencias || []).filter(function (a) { return (chave(a.id) && chave(a.id) === chave(r.id)) || chave(a.nome) === chave(r.nome); });
    var itens = tentativas.map(function (x) { return "<li>Prova em " + quando(x.quando) + ": <strong>" + x.nota + "%</strong> (" + (x.aprovado ? "aprovado" : "reprovado") + ")</li>"; })
      .concat(aus.map(function (a) { return "<li>Justificativa de ausência em " + quando(a.quando) + " (" + esc(a.aplicacao) + "): " + esc(a.situacao) + "</li>"; }));
    return '<div class="historico"><h4>Histórico</h4><ul>' + itens.join("") + "</ul></div>";
  }

  function desenharAgenda() {
    var ag = dados.agenda;
    var proximas = (ag.janelas || []).filter(function (j) { return j.fim > Date.now(); })
      .sort(function (a, b) { return a.inicio - b.inicio; });
    $("agenda").innerHTML = Agenda.descrever(ag) +
      (proximas.length > 1 ? "<br>Aplicações marcadas: " + proximas.map(function (j) { return quando(j.inicio); }).join(" · ") : "");
  }

  function desenharResumo(res) {
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

    // Acertos por tópico e erros por questão.
    var porTopico = {}, porQuestao = {};
    dados.topicos.forEach(function (t) { porTopico[t] = { certas: 0, total: 0 }; });
    res.forEach(function (r) {
      r.respostas.forEach(function (x) {
        var t = porTopico[x.topico];
        if (t) { t.total++; if (x.certo) t.certas++; }
        var q = porQuestao[x.q] = porQuestao[x.q] || { q: x.q, topico: x.topico, correta: x.correta, erros: 0, total: 0 };
        q.total++;
        if (!x.certo) q.erros++;
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

    var erradas = Object.keys(porQuestao).map(function (k) { return porQuestao[k]; })
      .filter(function (q) { return q.erros > 0; })
      .sort(function (a, b) { return b.erros / b.total - a.erros / a.total || b.erros - a.erros; })
      .slice(0, 5);
    $("mais-erradas").innerHTML = erradas.length ? erradas.map(function (q) {
      return '<li><p class="pergunta">' + esc(q.q) + "</p>" +
        '<p class="resp">' + esc(q.topico) + " · errada por <strong>" + q.erros + " de " + q.total + "</strong> (" +
        Math.round(q.erros / q.total * 100) + "%) · correta: " + esc(q.correta) + "</p></li>";
    }).join("") : '<li class="vazio">Ninguém errou nenhuma questão até agora.</li>';
  }

  // Divulgação: o Quadro de Honra público só mostra os aprovados depois deste botão.
  function desenharDivulgacao() {
    var sim = !!dados.divulgado;
    $("divulgacao-texto").innerHTML = sim
      ? 'Os aprovados estão <strong>publicados</strong> no <a href="resultados.html" target="_blank" rel="noopener">Quadro de Honra</a>.'
      : 'Os resultados <strong>ainda não foram divulgados</strong>. O Quadro de Honra mostra "resultado ainda não divulgado".';
    $("divulgar").textContent = sim ? "Ocultar resultados" : "Divulgar resultados";
    $("divulgar").setAttribute("data-valor", sim ? "0" : "1");
  }

  function desenharOficiais(res, tentativas) {
    var busca = chave($("busca").value);
    var filtro = $("filtro").value;
    var lista = res.filter(function (r) {
      if (filtro === "aprovados" && !r.aprovado) return false;
      if (filtro === "reprovados" && r.aprovado) return false;
      if (filtro === "repetidos" && tentativas[idOficial(r)] < 2) return false;
      return !busca || chave(r.nome + " " + r.id + " " + r.patente).indexOf(busca) >= 0;
    });
    lista.sort(function (a, b) {
      var c = ordem.campo, va = a[c], vb = b[c];
      var cmp = (c === "nota" || c === "quando") ? (va || 0) - (vb || 0) : String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
      return ordem.desc ? -cmp : cmp;
    });
    document.querySelectorAll(".ordenar").forEach(function (b) {
      var ativo = b.getAttribute("data-ordem") === ordem.campo;
      b.classList.toggle("ativo", ativo);
      b.setAttribute("data-seta", ativo ? (ordem.desc ? "▼" : "▲") : "");
    });
    $("n-oficiais").textContent = res.length;
    $("vazio").hidden = lista.length > 0;
    $("oficiais").innerHTML = lista.map(function (r) {
      var k = r.id + "|" + r.quando;
      var n = tentativas[idOficial(r)];
      var linha = '<tr class="oficial' + (aberto === k ? " aberto" : "") + '" data-chave="' + esc(k) + '" tabindex="0">' +
        "<td><strong>" + esc(r.nome) + "</strong>" + (n > 1 ? ' <span class="selo-alerta">' + n + " tentativas</span>" : "") + "</td>" +
        "<td>" + esc(r.id) + "</td><td>" + esc(r.patente) + "</td>" +
        "<td>" + quando(r.quando) + '</td><td class="cost">' + r.acertos + "/" + r.recebidas + '</td><td class="cost">' + r.nota + "%</td>" +
        '<td><span class="stamp ' + (r.aprovado ? "ok" : "") + '">' + (r.aprovado ? "APROVADO" : "REPROVADO") + "</span>" +
        (avaliacaoDe(r) ? '<span class="situacao-final">' + esc(avaliacaoDe(r).situacao) + "</span>" : "") + "</td></tr>";
      if (aberto === k) linha += '<tr class="ficha-oficial"><td colspan="7">' + ficha(r) + "</td></tr>";
      return linha;
    }).join("");
  }

  function desenharAusencias(res) {
    var todas = dados.ausencias || [];
    var filtro = $("filtro-ausencias").value;
    var lista = todas.filter(function (a) { return filtro === "todas" || a.situacao === filtro; });
    var pend = todas.filter(function (a) { return a.situacao === "Pendente"; }).length;
    $("n-ausencias").textContent = pend ? pend : "";
    $("n-ausencias").classList.toggle("alerta", pend > 0);
    $("ausencias-resumo").textContent = todas.length
      ? todas.length + " pedido(s) · " + pend + " pendente(s)"
      : "Nenhuma justificativa recebida.";
    $("ausencias").innerHTML = lista.map(function (a) {
      var classe = a.situacao === "Aceita" ? "ok" : a.situacao === "Recusada" ? "" : "pendente";
      // Quem pediu ausência mas também fez a prova (mesmo ID ou mesmo nome).
      var fez = res.filter(function (r) { return (chave(a.id) && chave(r.id) === chave(a.id)) || chave(r.nome) === chave(a.nome); });
      var aviso = fez.length ? '<p class="ausencia-aviso">⚠ Também fez a prova: ' + fez.map(function (r) {
        return "<strong>" + r.nota + "%</strong> (" + (r.aprovado ? "aprovado" : "reprovado") + ") em " + quando(r.quando);
      }).join(" · ") + ". Este pedido provavelmente não é mais necessário.</p>" : "";
      return '<li class="ausencia' + (fez.length ? " duplicada" : "") + '">' +
        '<div class="ausencia-topo"><strong>' + esc(a.patente + " " + a.nome) + "</strong> · ID " + esc(a.id) +
        (a.discord ? " · Discord " + esc(a.discord) : "") +
        '<span class="stamp ' + classe + '">' + esc(a.situacao.toUpperCase()) + "</span></div>" +
        '<p class="ausencia-meta">' + esc(a.aplicacao) + " · " + esc(a.motivo) + " · enviado em " + quando(a.quando) + "</p>" +
        aviso +
        '<p class="ausencia-texto">' + esc(a.justificativa) + "</p>" +
        '<p class="ausencia-acoes">' +
        (a.situacao !== "Aceita" ? '<button type="button" class="btn-sec" data-linha="' + a.linha + '" data-situacao="Aceita">Aceitar</button>' : "") +
        (a.situacao !== "Recusada" ? '<button type="button" class="btn-sec" data-linha="' + a.linha + '" data-situacao="Recusada">Recusar</button>' : "") +
        (a.situacao !== "Pendente" ? '<button type="button" class="btn-sec" data-linha="' + a.linha + '" data-situacao="Pendente">Voltar a pendente</button>' : "") +
        "</p></li>";
    }).join("") || '<li class="vazio">Nenhum pedido neste filtro.</li>';
  }

  function ficha(r) {
    var porTopico = {};
    r.respostas.forEach(function (x) { (porTopico[x.topico] = porTopico[x.topico] || []).push(x); });
    var html = '<div class="corrigir">' +
      (r.discord ? '<p class="ficha-discord">Discord: <strong>' + esc(r.discord) + "</strong></p>" : "<span></span>") +
      '<span class="ficha-botoes"><button type="button" class="btn-sec" data-plano="' + esc(r.id + "|" + r.quando) + '">Copiar plano de estudo</button>' +
      '<button type="button" class="btn-sec" data-corrigir="' + r.linha + '">Corrigir dados</button></span></div>' +
      '<form class="corrigir-form" data-linha="' + r.linha + '" data-antes="' + esc(r.nome) + '" hidden>' +
      '<label>Nome<input name="nome" maxlength="80" value="' + esc(r.nome) + '" required></label>' +
      '<label>ID fixo<input name="id" maxlength="30" value="' + esc(r.id) + '" required></label>' +
      '<label>Patente<input name="patente" maxlength="40" value="' + esc(r.patente) + '" required></label>' +
      '<span class="corrigir-botoes"><button type="submit" class="btn-sec">Salvar</button>' +
      '<button type="button" class="btn-sec" data-cancelar>Cancelar</button></span></form>' +
      historico(r) + formAvaliacao(r) + '<h4 class="respostas-titulo">Respostas da prova</h4>';
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

  // Lista de aprovados pronta para o Discord (melhor tentativa de cada um, sem testes).
  function textoAprovados() {
    var melhor = {};
    provas().forEach(function (r) {
      if (!r.aprovado) return;
      var k = idOficial(r);
      if (!melhor[k] || r.nota > melhor[k].nota) melhor[k] = r;
    });
    var lista = Object.keys(melhor).map(function (k) { return melhor[k]; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt-BR"); });
    return "⭐ **APROVADOS — PROVA DE CONHECIMENTO**\n\n" +
      lista.map(function (r) { return "• " + r.patente + " " + r.nome; }).join("\n") +
      "\n\nParabéns aos aprovados! Disciplina, preparo e compromisso com o dever.";
  }

  // ---------- Eventos ----------
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
  document.querySelector(".abas").addEventListener("click", function (ev) {
    var b = ev.target.closest(".aba");
    if (b) mostrarAba(b.getAttribute("data-aba"));
  });
  $("divulgar").addEventListener("click", function () {
    var valor = this.getAttribute("data-valor");
    var msg = valor === "1"
      ? "Publicar os nomes dos aprovados no Quadro de Honra do site?"
      : "Tirar os nomes dos aprovados do Quadro de Honra?";
    if (window.confirm(msg)) carregar(lerSenha(), false, undefined, "&divulgar=" + valor);
  });
  $("ausencias").addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-linha]");
    if (!b) return;
    b.disabled = true;
    carregar(lerSenha(), false, undefined, "&ausencia=" + b.getAttribute("data-linha") + "&situacao=" + encodeURIComponent(b.getAttribute("data-situacao")));
  });
  ["busca", "filtro", "ocultar-testes", "filtro-ausencias"].forEach(function (id) {
    $(id).addEventListener(id === "busca" ? "input" : "change", function () { if (dados) desenhar(); });
  });
  document.querySelector(".tabela-oficiais thead").addEventListener("click", function (ev) {
    var b = ev.target.closest(".ordenar");
    if (!b) return;
    var campo = b.getAttribute("data-ordem");
    ordem = { campo: campo, desc: ordem.campo === campo ? !ordem.desc : (campo === "nota" || campo === "quando") };
    desenhar();
  });
  $("copiar-aprovados").addEventListener("click", function () {
    var botao = this, texto = textoAprovados();
    function feito() { botao.textContent = "Copiado!"; setTimeout(function () { botao.textContent = "Copiar aprovados"; }, 1800); }
    function reserva() {
      var t = $("copia-reserva");
      t.value = texto;
      t.hidden = false;
      t.focus();
      t.select();
      botao.textContent = "Selecione e copie";
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(feito, reserva);
    else reserva();
  });
  function alternar(tr) {
    var k = tr.getAttribute("data-chave");
    aberto = aberto === k ? null : k;
    desenhar();
  }
  $("oficiais").addEventListener("click", function (ev) {
    var abrir = ev.target.closest("[data-corrigir]");
    if (abrir) {
      var form = abrir.closest("td").querySelector(".corrigir-form");
      form.hidden = false;
      abrir.hidden = true;
      form.querySelector("input").focus();
      return;
    }
    if (ev.target.closest("[data-cancelar]")) {
      var f = ev.target.closest(".corrigir-form");
      f.hidden = true;
      f.closest("td").querySelector("[data-corrigir]").hidden = false;
      return;
    }
    var tr = ev.target.closest("tr.oficial");
    if (tr) alternar(tr);
  });
  // Corrige nome, ID e patente na planilha (o servidor confere se a linha ainda é do mesmo oficial).
  $("oficiais").addEventListener("submit", function (ev) {
    var f = ev.target.closest(".corrigir-form");
    if (!f) return;
    ev.preventDefault();
    var v = function (n) { return f.elements[n].value.trim(); };
    if (!v("nome") || !v("id") || !v("patente")) { carga("Nome, ID e patente não podem ficar vazios."); return; }
    f.querySelector("button[type=submit]").disabled = true;
    aberto = null;
    carregar(lerSenha(), false, undefined, "&editar=" + f.getAttribute("data-linha") +
      "&antes=" + encodeURIComponent(f.getAttribute("data-antes")) + "&nome=" + encodeURIComponent(v("nome")) +
      "&id=" + encodeURIComponent(v("id")) + "&patente=" + encodeURIComponent(v("patente")));
  });
  $("oficiais").addEventListener("keydown", function (ev) {
    var tr = ev.target.closest("tr.oficial");
    if (tr && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); alternar(tr); }
  });

  // ---------- Gestão: autor, recuperação, padrinhos, presença, plano e avaliação ----------
  $("autor").value = autor();
  $("autor").addEventListener("input", function () { try { localStorage.setItem(CHAVE_AUTOR, this.value.trim()); } catch (e) {} });
  $("rec-ids").addEventListener("input", function () { this.dataset.editado = "1"; });
  $("rec-agendar").addEventListener("click", function () {
    var ini = new Date($("rec-inicio").value).getTime(), fim = new Date($("rec-fim").value).getTime();
    var ids = $("rec-ids").value.trim();
    if (!ini || !fim || fim <= ini) { carga("Confira o horário de início e fim da recuperação."); return; }
    if (!ids) { carga("Informe pelo menos um ID."); return; }
    if (!window.confirm("Agendar a recuperação de " + quando(ini) + " até " + quando(fim) + " para os IDs: " + ids + "?")) return;
    $("rec-ids").dataset.editado = "";
    carregar(lerSenha(), false, undefined, "&recuperacao=1&inicio=" + ini + "&fim=" + fim + "&ids=" + encodeURIComponent(ids));
  });
  $("rec-copiar-padrinhos").addEventListener("click", function () {
    var pares = padrinhos(provas());
    var texto = "🤝 **Padrinhos de estudo — recuperação**\n\n" + pares.map(function (x) {
      return "• " + x.aluno.patente + " " + x.aluno.nome + " → " + (x.padrinho ? x.padrinho.patente + " " + x.padrinho.nome : "a definir");
    }).join("\n") + "\n\nPadrinhos: façam uma patrulha guiada com seu afilhado antes da recuperação.";
    copiar(texto, this, "Copiar padrinhos");
  });
  $("presenca").addEventListener("click", function (ev) {
    var b = ev.target.closest("#copiar-faltosos");
    if (b) copiar("⚠️ **Faltaram à prova sem justificativa**\n\n" + (window.__faltosos || ""), b, "Copiar lista");
  });
  $("oficiais").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-plano]");
    if (!b) return;
    ev.stopPropagation();
    var r = dados.resultados.filter(function (x) { return x.id + "|" + x.quando === b.getAttribute("data-plano"); })[0];
    if (r) copiar(planoDeEstudo(r), b, "Copiar plano de estudo");
  }, true);
  $("oficiais").addEventListener("submit", function (ev) {
    var f = ev.target.closest(".avaliacao-form");
    if (!f) return;
    ev.preventDefault();
    var orais = {};
    [].forEach.call(f.querySelectorAll("select[name^=oral-]"), function (s) { if (s.value) orais[s.name.slice(5)] = s.value; });
    f.querySelector("button[type=submit]").disabled = true;
    carregar(lerSenha(), false, undefined, "&avaliar=" + encodeURIComponent(f.getAttribute("data-id")) +
      "&nome=" + encodeURIComponent(f.getAttribute("data-nome")) + "&orais=" + encodeURIComponent(JSON.stringify(orais)) +
      "&situacao_final=" + encodeURIComponent(f.elements.situacao.value) + "&obs=" + encodeURIComponent(f.elements.obs.value));
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
