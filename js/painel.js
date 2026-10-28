// Painel do Instrutor: lê os resultados da prova no App da Web (com senha) e mostra no visual do site.
(function () {
  var API = window.PROVA && window.PROVA.api;
  var CHAVE_SENHA = "cavalaria-painel-senha";
  var CHAVE_DADOS = "cavalaria-painel-dados";
  var CHAVE_ABA = "cavalaria-painel-aba";
  var CHAVE_AUTOR = "cavalaria-painel-autor";
  var CHAVE_PROVA = "cavalaria-painel-prova";
  var ROTULO_ORAL = { completa: "Completa", parcial: "Parcial", nao: "Não soube" };
  var dados = null;
  var bancoVisto = null; // banco com gabarito, só quando o instrutor pede
  var editandoAplicacao = null; // { linha, inicio } da aplicação em edição na aba Agenda
  var aberto = null; // linha do oficial expandida
  var ordem = { campo: "quando", desc: true };

  var $ = function (id) { return document.getElementById(id); };
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }
  // Compara nomes e IDs sem diferença de maiúsculas, acentos e espaços.
  function chave(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function ehTeste(r) { return /\bteste\b/.test(chave(r.nome + " " + r.patente)); }
  function idOficial(r) { return chave(r.id) || chave(r.nome); }

  // ---------- Prova escolhida no topo (Resumo, Oficiais e avaliações seguem esta prova) ----------
  function provaPorId(id) { return (dados.provas || []).filter(function (x) { return x.id === id; })[0] || dados.provas[0]; }
  function provaAtual() {
    var id = "";
    try { id = sessionStorage.getItem(CHAVE_PROVA) || ""; } catch (e) {}
    return provaPorId(id);
  }
  function paginaDoTopico(prova, topico) { return prova.links[prova.topicos.indexOf(topico)] || "index.html"; }

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
  function avaliacaoDe(r, idProva) {
    var id = chave(r.id), prova = idProva || r.prova || provaAtual().id;
    return (dados.avaliacoes || []).filter(function (a) { return id && chave(a.id) === id && a.prova === prova; })[0] || null;
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
        if (r.banco) { bancoVisto = r.banco; delete r.banco; }
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

  // Envios considerados: só os da prova escolhida no topo (sem os de teste, se a opção estiver marcada).
  function provas() {
    var ocultar = $("ocultar-testes").checked, prova = provaAtual().id;
    return dados.resultados.filter(function (r) { return r.prova === prova && (!ocultar || !ehTeste(r)); });
  }

  function desenhar() {
    if (!dados.provas) return; // dados guardados de uma versão antiga do painel: espera os novos
    desenharSeletorProva();
    var res = provas();
    var tentativas = {};
    res.forEach(function (r) { var k = idOficial(r); tentativas[k] = (tentativas[k] || 0) + 1; });

    mostrarAba(abaAtual());
    desenharAgenda();
    desenharResumo(res);
    desenharDivulgacao();
    desenharOficiais(res, tentativas);
    desenharAusencias(dados.resultados);
    desenharPresenca();
    desenharRecuperacao(res);
    desenharEfetivo();
    desenharAplicacoes();
    desenharRegistro();
  }

  function desenharSeletorProva() {
    var atual = provaAtual().id;
    var opcoes = dados.provas.map(function (x) {
      var n = dados.resultados.filter(function (r) { return r.prova === x.id; }).length;
      return '<option value="' + esc(x.id) + '"' + (x.id === atual ? " selected" : "") + ">" + esc(x.curto) + " (" + n + ")</option>";
    }).join("");
    if ($("prova-sel").innerHTML !== opcoes) $("prova-sel").innerHTML = opcoes;
    $("prova-sel").value = atual;
  }
  function nomeDaProva(id) { var x = provaPorId(id); return x ? x.curto : ""; }

  // ---------- Presença: quem foi chamado em uma aplicação × quem fez × quem justificou ----------
  function dataCurta(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }) +
      " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function aplicacoesPassadas() {
    return (dados.agenda.janelas || []).filter(function (j) { return j.inicio <= Date.now(); })
      .sort(function (a, b) { return b.inicio - a.inicio; });
  }
  function desenharPresenca() {
    var efetivo = dados.efetivo || [];
    var aus = dados.ausencias || [];
    var lista = aplicacoesPassadas();
    var sel = $("presenca-aplicacao");
    var escolhida = sel.value;
    sel.innerHTML = lista.map(function (j) {
      return '<option value="' + j.linha + "|" + j.inicio + '">' + esc(nomeDaProva(j.prova) + " · " + quando(j.inicio) + (j.ids && j.ids.length ? " · " + j.ids.length + " convocado(s)" : "")) + "</option>";
    }).join("");
    if (escolhida && [].some.call(sel.options, function (o) { return o.value === escolhida; })) sel.value = escolhida;
    var j = lista.filter(function (x) { return x.linha + "|" + x.inicio === sel.value; })[0] || lista[0];
    if (!j) {
      $("presenca-ajuda").innerHTML = "Nenhuma aplicação aconteceu ainda. A presença aparece aqui depois da primeira.";
      $("presenca").innerHTML = ""; $("n-faltosos").textContent = "";
      return;
    }
    // Chamados: os IDs liberados, ou todo o Efetivo se a aplicação foi aberta a todos.
    var chamados = j.ids && j.ids.length
      ? j.ids.map(function (id) { return efetivo.filter(function (o) { return chave(o.id) === id; })[0] || { nome: "(fora do Efetivo)", id: id, patente: "" }; })
      : efetivo;
    var ocultar = $("ocultar-testes").checked;
    var envios = dados.resultados.filter(function (r) {
      return r.prova === j.prova && r.quando >= j.inicio && r.quando <= j.fim + 15 * 6e4 && (!ocultar || !ehTeste(r));
    });
    var m = melhores(envios);
    var rotulo = dataCurta(j.inicio);
    function provaDe(o) { return m[chave(o.id)] || envios.filter(function (r) { return chave(r.nome) === chave(o.nome); })[0] || null; }
    function ausenciaDe(o) {
      return aus.filter(function (a) {
        return String(a.aplicacao).indexOf(rotulo) === 0 && ((chave(o.id) && chave(a.id) === chave(o.id)) || chave(a.nome) === chave(o.nome));
      })[0] || null;
    }
    var fez = [], justificou = [], faltou = [];
    chamados.forEach(function (o) {
      var p = provaDe(o), a = ausenciaDe(o);
      if (p) fez.push({ o: o, p: p });
      else if (a) justificou.push({ o: o, a: a });
      else faltou.push({ o: o });
    });
    var chamadoId = {};
    chamados.forEach(function (o) { chamadoId[chave(o.id)] = 1; chamadoId[chave(o.nome)] = 1; });
    var fora = Object.keys(m).map(function (k) { return m[k]; })
      .filter(function (r) { return !chamadoId[chave(r.id)] && !chamadoId[chave(r.nome)]; });
    var ultima = lista[0] === j;
    $("n-faltosos").textContent = ultima && faltou.length ? faltou.length : "";
    $("n-faltosos").classList.toggle("alerta", ultima && faltou.length > 0);
    $("presenca-ajuda").innerHTML = "<strong>" + esc(provaPorId(j.prova).nome) + "</strong>, " + quando(j.inicio) + " até " + quando(j.fim) + ". " +
      (j.ids && j.ids.length ? "Aplicação só para <strong>" + j.ids.length + "</strong> convocado(s)." :
        "Aberta a todos: conferida contra o Efetivo, com <strong>" + efetivo.length + "</strong> oficiais.") +
      (!efetivo.length && !(j.ids && j.ids.length) ? " O Efetivo está vazio; ele se preenche sozinho com quem envia prova ou justificativa, e você completa na aba Efetivo." : "");
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
      (fora.length ? grupo("Fez a prova sem estar na lista", "fora", fora, function (r) {
        return "<li>" + nome(r) + " · " + r.nota + "%</li>";
      }) : "");
    window.__faltosos = "⚠️ **Faltaram à " + provaPorId(j.prova).nome + " (" + quando(j.inicio) + ") sem justificativa**\n\n" +
      faltou.map(function (x) { return "• " + (x.o.patente ? x.o.patente + " " : "") + x.o.nome + (x.o.id ? " (ID " + x.o.id + ")" : ""); }).join("\n");
  }

  // ---------- Efetivo: relação de oficiais, com a situação em cada prova ----------
  function desenharEfetivo() {
    var efetivo = dados.efetivo || [];
    var busca = chave($("efetivo-busca").value), pat = $("efetivo-patente").value;
    var patentes = [];
    efetivo.forEach(function (o) { if (o.patente && patentes.indexOf(o.patente) < 0) patentes.push(o.patente); });
    patentes.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    var opcoes = '<option value="">Todas as patentes</option>' + patentes.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("");
    if ($("efetivo-patente").innerHTML !== opcoes) { $("efetivo-patente").innerHTML = opcoes; $("efetivo-patente").value = pat; }
    $("patentes").innerHTML = patentes.map(function (x) { return '<option value="' + esc(x) + '">'; }).join("");
    $("n-efetivo").textContent = efetivo.length || "";
    $("efetivo-ajuda").innerHTML = "<strong>" + efetivo.length + "</strong> oficiais na aba Efetivo da planilha." +
      (dados.efetivoIncluidos ? " <strong>" + dados.efetivoIncluidos + "</strong> entraram agora, a partir das provas e ausências enviadas." : "") +
      " Quem envia prova ou justificativa entra sozinho; inclua aqui quem nunca enviou nada e corrija o que vier errado.";
    var ocultar = $("ocultar-testes").checked;
    var porProva = dados.provas.map(function (x) {
      return melhores(dados.resultados.filter(function (r) { return r.prova === x.id && (!ocultar || !ehTeste(r)); }));
    });
    $("efetivo-cabecalho").innerHTML = "<th>Oficial</th><th>ID</th><th>Patente</th>" +
      dados.provas.map(function (x) { return "<th>" + esc(x.curto) + "</th>"; }).join("") + "<th>Observação</th><th></th>";
    var lista = efetivo.filter(function (o) {
      return (!pat || o.patente === pat) && (!busca || chave(o.nome + " " + o.id + " " + o.patente).indexOf(busca) >= 0);
    }).sort(function (a, b) { return (a.patente + a.nome).localeCompare(b.patente + b.nome, "pt-BR"); });
    var colunas = 5 + dados.provas.length;
    $("efetivo").innerHTML = lista.length ? lista.map(function (o) {
      if (editandoEfetivo === o.linha) {
        return '<tr class="editando"><td colspan="' + colunas + '"><form class="efetivo-form" data-linha="' + o.linha + '" data-antes="' + esc(o.nome) + '">' +
          '<label>Nome<input name="nome" maxlength="80" value="' + esc(o.nome) + '" required></label>' +
          '<label>ID fixo<input name="id" maxlength="30" value="' + esc(o.id) + '" required></label>' +
          '<label>Patente<input name="patente" maxlength="40" list="patentes" value="' + esc(o.patente) + '"></label>' +
          '<label class="largo">Observação<input name="obs" maxlength="200" value="' + esc(o.obs) + '"></label>' +
          '<span class="corrigir-botoes"><button type="submit" class="btn-sec">Salvar</button>' +
          '<button type="button" class="btn-sec" data-efetivo-cancelar>Cancelar</button>' +
          '<button type="button" class="btn-sec perigo" data-efetivo-remover>Retirar do Efetivo</button></span></form></td></tr>';
      }
      var celulas = dados.provas.map(function (x, i) {
        var r = porProva[i][chave(o.id)] || null, av = avaliacaoDe(o, x.id);
        if (!r && !av) return '<td class="cinza">—</td>';
        return "<td>" + (r ? '<span class="stamp ' + (r.aprovado ? "ok" : "") + '">' + r.nota + "%</span>" : "") +
          (av ? '<span class="situacao-final">' + esc(av.situacao) + "</span>" : "") + "</td>";
      }).join("");
      return "<tr><td><strong>" + esc(o.nome) + "</strong></td><td>" + esc(o.id) + "</td><td>" + esc(o.patente) + "</td>" + celulas +
        '<td class="cinza">' + esc(o.obs) + '</td><td><button type="button" class="btn-sec" data-efetivo-editar="' + o.linha + '">Editar</button></td></tr>';
    }).join("") : '<tr><td colspan="' + colunas + '" class="cinza">Ninguém neste filtro.</td></tr>';
  }
  var editandoEfetivo = null;

  // ---------- Agenda: aplicações marcadas e nova aplicação ----------
  function iso(x) { return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); }
  function nomeDoId(id) {
    var o = (dados.efetivo || []).filter(function (x) { return chave(x.id) === chave(id); })[0] ||
      dados.resultados.filter(function (x) { return chave(x.id) === chave(id); }).slice(-1)[0];
    return o ? o.nome + " (" + id + ")" : "ID " + id;
  }
  function desenharAplicacoes() {
    var opcoes = dados.provas.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.nome) + "</option>"; }).join("");
    if ($("ag-prova").innerHTML !== opcoes) { $("ag-prova").innerHTML = opcoes; $("ag-prova").value = provaAtual().id; }
    if (!$("ag-inicio").value) {
      var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0);
      $("ag-inicio").value = iso(d); $("ag-fim").value = iso(new Date(d.getTime() + 36e5));
    }
    var patentes = {};
    (dados.efetivo || []).forEach(function (o) { if (o.patente && o.id) (patentes[o.patente] = patentes[o.patente] || []).push(o.id); });
    $("ag-patentes").innerHTML = Object.keys(patentes).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); }).map(function (k) {
      var alvo = (provaPorId($("ag-prova").value).patentes || []).indexOf(k) >= 0;
      return '<button type="button" class="chip' + (alvo ? " alvo" : "") + '" data-patente="' + esc(k) + '"' +
        (alvo ? ' title="Patente que faz esta prova"' : "") + ">" + esc(k) + " (" + patentes[k].length + ")</button>";
    }).join("") || '<span class="cinza">Sem patentes no Efetivo ainda.</span>';
    var agora = Date.now();
    var lista = (dados.agenda.janelas || []).slice().sort(function (a, b) { return b.inicio - a.inicio; });
    var futuras = lista.filter(function (j) { return j.inicio > agora; }).length;
    $("n-agenda").textContent = futuras || "";
    $("banco-info").textContent = dados.provas.map(function (x) { return x.curto + ": " + x.questoes + " questões"; }).join(" · ");
    $("aplicacoes").innerHTML = lista.length ? lista.map(function (j) {
      var estado = j.fim <= agora ? "encerrada" : j.inicio <= agora ? "aberta" : "marcada";
      return '<li class="aplicacao ' + estado + '"><div><strong>' + esc(provaPorId(j.prova).nome) + "</strong> · " + quando(j.inicio) + " até " + quando(j.fim) +
        ' <span class="stamp ' + (estado === "aberta" ? "ok" : estado === "marcada" ? "pendente" : "") + '">' + estado.toUpperCase() + "</span>" +
        '<p class="cinza">' + (j.ids && j.ids.length ? "Só " + j.ids.length + " convocado(s): " + esc(j.ids.map(nomeDoId).join(", ")) : "Aberta a todos") +
        (j.obs ? " · " + esc(j.obs) : "") + "</p></div>" +
        '<span class="aplicacao-botoes">' +
        (estado !== "encerrada" ? '<button type="button" class="btn-sec" data-editar-aplicacao="' + j.linha + '" data-inicio="' + j.inicio + '">Editar</button>' : "") +
        (estado === "marcada" ? '<button type="button" class="btn-sec" data-cancelar="' + j.linha + '" data-inicio="' + j.inicio + '">Cancelar</button>' : "") + "</span></li>";
    }).join("") : '<li class="cinza">Nenhuma aplicação na Agenda.</li>';
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
    $("rec-prova").textContent = provaAtual().nome;
    $("n-recuperacao").textContent = pend.length ? "· " + pend.length + " oficial(is) sem aprovação" : "· todos aprovados";
    if (!$("rec-ids").dataset.editado) $("rec-ids").value = pend.map(function (r) { return r.id; }).filter(String).join(", ");
    if (!$("rec-inicio").value) {
      var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0);
      var f = new Date(d.getTime() + 36e5);
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
    var prova = provaPorId(r.prova);
    var ag = (dados.agenda.janelas || []).filter(function (j) {
      return j.fim > Date.now() && j.prova === r.prova && (!j.ids || !j.ids.length || j.ids.indexOf(chave(r.id)) >= 0);
    }).sort(function (a, b) { return a.inicio - b.inicio; })[0];
    return "📘 **Plano de estudo — " + r.patente + " " + r.nome + "**\n\n" +
      "Na " + prova.nome + " você acertou " + r.acertos + " de " + r.recebidas + " (" + r.nota + "%). " +
      (r.aprovado ? "Você foi aprovado, mas vale reforçar:" : "A nota mínima é " + prova.notaMinima + "%. Para a recuperação, reforce:") + "\n" +
      (fracos.length ? fracos.map(function (x) {
        return "• **" + x.nome + "** — acertou " + x.c + " de " + x.t + " → " + urlSite(paginaDoTopico(prova, x.nome));
      }).join("\n") : "• Nenhum tópico com erro. Parabéns!") + "\n\n" +
      "Treine no simulado (não conta nota): " + urlSite("simulado.html") + "\n" +
      "Consulta rápida: " + urlSite("consulta.html") + "\n" +
      (ag ? "\nPróxima aplicação: " + quando(ag.inicio) + "." : "\nA data da recuperação será informada pelos instrutores.") +
      "\n\nQualquer dúvida, procure um instrutor. Disciplina, preparo e compromisso com o dever.";
  }

  // ---------- Avaliação individual (formulário dentro da ficha) ----------
  function formAvaliacao(r) {
    var prova = provaPorId(r.prova), SITUACOES = prova.situacoes;
    var av = avaliacaoDe(r) || { orais: {}, situacao: SITUACOES[0], obs: "" };
    var orais = prova.pratica ? prova.orais || [] : [];
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
    return '<details class="avaliacao"><summary>' + (prova.pratica ? "Prova prática" : "Situação final") + ' · <strong>' + esc(av.situacao || SITUACOES[0]) + "</strong>" +
      (av.instrutor ? ' <span class="cinza">— ' + esc(av.instrutor) + ", " + quando(av.quando) + "</span>" : "") + "</summary>" +
      '<form class="avaliacao-form" data-id="' + esc(r.id) + '" data-nome="' + esc(r.nome) + '" data-prova="' + esc(r.prova) + '">' +
      (orais.length ? '<p class="cinza">Escolha de 3 a 5 perguntas e uma situação prática. Deixe "—" nas que não foram feitas.</p>' +
        '<ol class="orais">' + itens + "</ol>" : '<p class="cinza">Esta prova é só escrita. Registre aqui a decisão final sobre o oficial.</p>') +
      '<div class="avaliacao-final"><label>Situação final<select name="situacao">' + SITUACOES.map(function (s) {
        return '<option' + (s === av.situacao ? " selected" : "") + ">" + esc(s) + "</option>";
      }).join("") + '</select></label><label class="largo">Observações<textarea name="obs" rows="2" maxlength="1000">' + esc(av.obs) + "</textarea></label></div>" +
      '<p><button type="submit" class="btn-sec">Salvar avaliação</button></p></form></details>';
  }

  function historico(r) {
    var k = idOficial(r);
    var tentativas = dados.resultados.filter(function (x) { return idOficial(x) === k; }).sort(function (a, b) { return a.quando - b.quando; });
    var aus = (dados.ausencias || []).filter(function (a) { return (chave(a.id) && chave(a.id) === chave(r.id)) || chave(a.nome) === chave(r.nome); });
    var itens = tentativas.map(function (x) { return "<li>" + esc(nomeDaProva(x.prova)) + " em " + quando(x.quando) + ": <strong>" + x.nota + "%</strong> (" + (x.aprovado ? "aprovado" : "reprovado") + ")</li>"; })
      .concat(aus.map(function (a) { return "<li>Justificativa de ausência em " + quando(a.quando) + " (" + esc(a.aplicacao) + "): " + esc(a.situacao) + "</li>"; }));
    return '<div class="historico"><h4>Histórico</h4><ul>' + itens.join("") + "</ul></div>";
  }

  function desenharAgenda() {
    var ag = dados.agenda;
    var proximas = (ag.janelas || []).filter(function (j) { return j.fim > Date.now(); })
      .sort(function (a, b) { return a.inicio - b.inicio; });
    $("agenda").innerHTML = Agenda.descrever(ag) +
      (proximas.length > 1 ? "<br>Aplicações marcadas: " + proximas.map(function (j) { return esc(nomeDaProva(j.prova)) + " " + quando(j.inicio); }).join(" · ") : "");
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
    var prova = provaAtual();
    prova.topicos.forEach(function (t) { porTopico[t] = { certas: 0, total: 0 }; });
    res.forEach(function (r) {
      r.respostas.forEach(function (x) {
        var t = porTopico[x.topico];
        if (t) { t.total++; if (x.certo) t.certas++; }
        var q = porQuestao[x.q] = porQuestao[x.q] || { q: x.q, topico: x.topico, correta: x.correta, erros: 0, total: 0 };
        q.total++;
        if (!x.certo) q.erros++;
      });
    });
    $("topicos").innerHTML = prova.topicos.map(function (nome) {
      var t = porTopico[nome];
      var pct = t.total ? Math.round(t.certas / t.total * 100) : 0;
      var classe = !t.total ? "" : pct >= prova.notaMinima ? "ok" : "mal";
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
    var prova = provaAtual();
    var sim = (dados.divulgadas || []).indexOf(prova.id) >= 0;
    $("divulgacao-texto").innerHTML = sim
      ? 'Os aprovados da <strong>' + esc(prova.nome) + '</strong> estão <strong>publicados</strong> no <a href="resultados.html" target="_blank" rel="noopener">Quadro de Honra</a>.'
      : 'Os resultados da <strong>' + esc(prova.nome) + '</strong> <strong>ainda não foram divulgados</strong> no Quadro de Honra.';
    $("divulgar").textContent = sim ? "Ocultar resultados" : "Divulgar resultados";
    $("divulgar").setAttribute("data-valor", sim ? "0" : "1");
  }

  // Recuperação marcada (ainda por acontecer ou aberta) da prova escolhida que libera este oficial.
  function recuperacaoDe(r) {
    var id = chave(r.id), prova = provaAtual().id;
    return (dados.agenda.janelas || []).filter(function (j) {
      return j.fim > Date.now() && j.prova === prova && j.ids && j.ids.length && id && j.ids.indexOf(id) >= 0;
    }).sort(function (a, b) { return a.inicio - b.inicio; })[0] || null;
  }
  function seloSituacao(melhor) {
    if (melhor.aprovado) return '<span class="stamp ok">APROVADO</span>';
    var rec = recuperacaoDe(melhor);
    return rec ? '<span class="stamp pendente">RECUPERAÇÃO ' + esc(quando(rec.inicio)) + "</span>"
      : '<span class="stamp">AGUARDANDO RECUPERAÇÃO</span>';
  }

  // Visão por oficial: uma linha por pessoa, com todas as tentativas e a situação da recuperação.
  function desenharPorOficial(res) {
    var busca = chave($("busca").value), filtro = $("filtro").value;
    var grupos = {};
    res.forEach(function (r) { (grupos[idOficial(r)] = grupos[idOficial(r)] || []).push(r); });
    var lista = Object.keys(grupos).map(function (k) {
      var t = grupos[k].slice().sort(function (a, b) { return a.quando - b.quando; });
      var melhor = t.reduce(function (m, r) { return !m || r.nota > m.nota ? r : m; }, null);
      var ultima = t[t.length - 1];
      return { t: t, melhor: melhor, ultima: ultima, nome: ultima.nome, id: ultima.id, patente: ultima.patente, quando: ultima.quando, nota: melhor.nota };
    }).filter(function (o) {
      if (filtro === "aprovados" && !o.melhor.aprovado) return false;
      if ((filtro === "reprovados" || filtro === "recuperacao") && o.melhor.aprovado) return false;
      if (filtro === "repetidos" && o.t.length < 2) return false;
      return !busca || chave(o.nome + " " + o.id + " " + o.patente).indexOf(busca) >= 0;
    });
    lista.sort(function (a, b) {
      var c = ordem.campo, va = a[c], vb = b[c];
      var cmp = (c === "nota" || c === "quando") ? (va || 0) - (vb || 0) : String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
      return ordem.desc ? -cmp : cmp;
    });
    $("vazio").hidden = lista.length > 0;
    $("oficiais").innerHTML = lista.map(function (o) {
      var k = o.ultima.id + "|" + o.ultima.quando;
      var chips = o.t.map(function (r, i) {
        return '<span class="tentativa ' + (r.aprovado ? "ok" : "mal") + '" title="' + esc(quando(r.quando)) + '">' + (i + 1) + "ª " + r.nota + "% " + (r.aprovado ? "✔" : "✘") + "</span>";
      }).join(o.t.length > 1 ? '<span class="seta" aria-hidden="true">→</span>' : "");
      var av = avaliacaoDe(o.melhor);
      var linha = '<tr class="oficial' + (aberto === k ? " aberto" : "") + '" data-chave="' + esc(k) + '" tabindex="0">' +
        "<td><strong>" + esc(o.nome) + "</strong></td><td>" + esc(o.id) + "</td><td>" + esc(o.patente) + "</td>" +
        "<td>" + quando(o.quando) + '</td><td class="tentativas">' + chips + '</td><td class="cost">' + o.nota + "%</td>" +
        "<td>" + seloSituacao(o.melhor) + (av ? '<span class="situacao-final">' + esc(av.situacao) + "</span>" : "") + "</td></tr>";
      if (aberto === k) linha += '<tr class="ficha-oficial"><td colspan="7">' + ficha(o.ultima) + "</td></tr>";
      return linha;
    }).join("");
  }

  function desenharOficiais(res, tentativas) {
    var porOficial = $("visao").value === "oficial";
    var cab = document.querySelectorAll(".tabela-oficiais thead th");
    cab[3].firstChild.textContent = porOficial ? "Última tentativa" : "Enviado em";
    cab[4].textContent = porOficial ? "Tentativas" : "Acertos";
    cab[5].firstChild.textContent = porOficial ? "Melhor nota" : "Nota";
    cab[6].textContent = porOficial ? "Situação" : "Resultado";
    $("n-oficiais").textContent = res.length;
    if (porOficial) { desenharPorOficial(res); return; }
    var busca = chave($("busca").value);
    var filtro = $("filtro").value;
    var lista = res.filter(function (r) {
      if (filtro === "aprovados" && !r.aprovado) return false;
      if ((filtro === "reprovados" || filtro === "recuperacao") && r.aprovado) return false;
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
    provaPorId(r.prova).topicos.forEach(function (t) {
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
    return "⭐ **APROVADOS — " + provaAtual().nome.toUpperCase() + "**\n\n" +
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
      ? "Publicar os nomes dos aprovados da " + provaAtual().nome + " no Quadro de Honra do site?"
      : "Tirar os nomes dos aprovados da " + provaAtual().nome + " do Quadro de Honra?";
    if (window.confirm(msg)) carregar(lerSenha(), false, undefined, "&divulgar=" + valor + "&prova=" + encodeURIComponent(provaAtual().id));
  });
  $("ausencias").addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-linha]");
    if (!b) return;
    b.disabled = true;
    carregar(lerSenha(), false, undefined, "&ausencia=" + b.getAttribute("data-linha") + "&situacao=" + encodeURIComponent(b.getAttribute("data-situacao")));
  });
  try { $("visao").value = localStorage.getItem("cavalaria-painel-visao") || "oficial"; } catch (e) {}
  $("visao").addEventListener("change", function () {
    try { localStorage.setItem("cavalaria-painel-visao", this.value); } catch (e) {}
    aberto = null;
  });
  ["visao", "busca", "filtro", "ocultar-testes", "filtro-ausencias"].forEach(function (id) {
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
    if (!window.confirm("Agendar a recuperação da " + provaAtual().nome + " de " + quando(ini) + " até " + quando(fim) + " para os IDs: " + ids + "?")) return;
    $("rec-ids").dataset.editado = "";
    carregar(lerSenha(), false, undefined, "&recuperacao=1&prova=" + encodeURIComponent(provaAtual().id) + "&inicio=" + ini + "&fim=" + fim + "&ids=" + encodeURIComponent(ids));
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
    if (b) copiar(window.__faltosos || "", b, "Copiar lista");
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
      "&situacao_final=" + encodeURIComponent(f.elements.situacao.value) + "&obs=" + encodeURIComponent(f.elements.obs.value) +
      "&prova=" + encodeURIComponent(f.getAttribute("data-prova")));
  });

  // ---------- Prova escolhida, Efetivo, Agenda e Presença ----------
  $("prova-sel").addEventListener("change", function () {
    try { sessionStorage.setItem(CHAVE_PROVA, this.value); } catch (e) {}
    aberto = null;
    $("rec-ids").dataset.editado = "";
    desenhar();
  });
  ["efetivo-busca", "efetivo-patente", "presenca-aplicacao"].forEach(function (id) {
    $(id).addEventListener(id === "efetivo-busca" ? "input" : "change", function () { if (dados) desenhar(); });
  });
  function enviarEfetivo(f, tipo) {
    var v = function (n) { return encodeURIComponent(f.elements[n] ? f.elements[n].value.trim() : ""); };
    return "&efetivo=" + tipo + "&nome=" + v("nome") + "&id=" + v("id") + "&patente=" + v("patente") + "&obs=" + v("obs");
  }
  $("efetivo-novo").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var f = this;
    carregar(lerSenha(), false, undefined, enviarEfetivo(f, "novo")).then(function () { if (dados && /incluído/.test(dados.aviso || "")) f.reset(); });
  });
  $("efetivo").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-efetivo-editar]");
    if (b) { editandoEfetivo = Number(b.getAttribute("data-efetivo-editar")); desenharEfetivo(); return; }
    if (ev.target.closest("[data-efetivo-cancelar]")) { editandoEfetivo = null; desenharEfetivo(); return; }
    var r = ev.target.closest("[data-efetivo-remover]");
    if (r) {
      var f = r.closest("form");
      if (!window.confirm("Retirar " + f.getAttribute("data-antes") + " do Efetivo? As provas dele continuam guardadas.")) return;
      editandoEfetivo = null;
      carregar(lerSenha(), false, undefined, "&efetivo=remover&linha=" + f.getAttribute("data-linha") + "&antes=" + encodeURIComponent(f.getAttribute("data-antes")));
    }
  });
  $("efetivo").addEventListener("submit", function (ev) {
    var f = ev.target.closest(".efetivo-form");
    if (!f) return;
    ev.preventDefault();
    editandoEfetivo = null;
    carregar(lerSenha(), false, undefined, enviarEfetivo(f, "editar") + "&linha=" + f.getAttribute("data-linha") + "&antes=" + encodeURIComponent(f.getAttribute("data-antes")));
  });
  $("copiar-efetivo").addEventListener("click", function () {
    var lista = (dados.efetivo || []).slice().sort(function (a, b) { return (a.patente + a.nome).localeCompare(b.patente + b.nome, "pt-BR"); });
    copiar("📜 **Efetivo da Cavalaria (" + lista.length + ")**\n\n" + lista.map(function (o) {
      return "• " + (o.patente ? o.patente + " " : "") + o.nome + (o.id ? " (ID " + o.id + ")" : "");
    }).join("\n"), this, "Copiar lista");
  });
  $("ag-prova").addEventListener("change", function () { if (dados) desenharAplicacoes(); });
  $("ag-patentes").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-patente]");
    if (!b) return;
    var atuais = $("ag-ids").value.split(/[,;\s]+/).filter(String);
    (dados.efetivo || []).forEach(function (o) {
      if (o.patente === b.getAttribute("data-patente") && o.id && atuais.indexOf(o.id) < 0) atuais.push(o.id);
    });
    $("ag-ids").value = atuais.join(", ");
    b.classList.add("usado");
  });
  $("ag-agendar").addEventListener("click", function () {
    var ini = new Date($("ag-inicio").value).getTime(), fim = new Date($("ag-fim").value).getTime();
    var ids = $("ag-ids").value.trim(), prova = provaPorId($("ag-prova").value);
    if (!ini || !fim || fim <= ini) { carga("Confira o horário de início e fim."); return; }
    var n = ids ? ids.split(/[,;\s]+/).filter(String).length : 0;
    var editando = editandoAplicacao;
    if (!window.confirm((editando ? "Salvar a aplicação como " : "Agendar a ") + prova.nome + " de " + quando(ini) + " até " + quando(fim) + (n ? ", só para " + n + " oficial(is)?" : ", aberta a todos?"))) return;
    var acao = editando ? "&editar_aplicacao=" + editando.linha + "&inicio_antes=" + editando.inicio : "&agendar=1";
    carregar(lerSenha(), false, undefined, acao + "&prova=" + encodeURIComponent(prova.id) + "&inicio=" + ini + "&fim=" + fim +
      "&ids=" + encodeURIComponent(ids) + "&obs=" + encodeURIComponent($("ag-obs").value.trim())).then(function () {
      if (dados && /agendada|alterada/.test(dados.aviso || "")) {
        sairDaEdicao();
        $("ag-ids").value = ""; $("ag-obs").value = "";
        document.querySelectorAll("#ag-patentes .usado").forEach(function (x) { x.classList.remove("usado"); });
      }
    });
  });
  function desenharBanco() {
    if (!bancoVisto) return;
    var letras = "abcd";
    $("banco-lista").innerHTML = bancoVisto.map(function (b) {
      var x = provaPorId(b.id), n = 0;
      return '<details class="banco-prova"><summary><strong>' + esc(x.nome) + "</strong> · " + x.questoes + " questões</summary>" +
        b.modulos.map(function (m) {
          return "<h4>" + esc(m.nome) + " <span class=\"cinza\">(" + m.questoes.length + ")</span></h4><ol class=\"banco-questoes\">" +
            m.questoes.map(function (q) {
              n++;
              return "<li><p>" + esc(q.q) + "</p><ul>" + q.o.map(function (o, i) {
                return '<li class="' + (i === q.c ? "certa" : "") + '"><span class="letra">' + letras[i] + "</span>" + esc(o) + (i === q.c ? ' <span class="stamp ok">CORRETA</span>' : "") + "</li>";
              }).join("") + "</ul></li>";
            }).join("") + "</ol>";
        }).join("") + "</details>";
    }).join("");
    $("ver-banco").textContent = "Recarregar questões";
  }
  $("ver-banco").addEventListener("click", function () {
    var b = this;
    b.disabled = true;
    carregar(lerSenha(), false, undefined, "&banco=1").then(function () { b.disabled = false; desenharBanco(); });
  });

  // Troca da senha do painel (a senha nova passa a valer na hora, inclusive neste aparelho).
  $("trocar-senha").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var nova = $("senha-nova").value.trim(), conf = $("senha-confirma").value.trim();
    if (nova.length < 6) { carga("A senha nova precisa de pelo menos 6 caracteres."); return; }
    if (nova !== conf) { carga("As duas senhas não são iguais."); return; }
    if (!window.confirm("Trocar a senha do painel? Avise os outros instrutores da senha nova.")) return;
    var f = this;
    carregar(lerSenha(), false, undefined, "&nova_senha=" + encodeURIComponent(nova)).then(function () {
      if (dados && dados.aviso === "Senha trocada.") { guardar(nova, dados, lembrado()); f.reset(); }
    });
  });

  $("atualizar-banco").addEventListener("click", function () {
    if (!window.confirm("Reler o banco de questões do Drive e atualizar o formulário? Pode levar alguns minutos.")) return;
    this.disabled = true;
    var b = this;
    carregar(lerSenha(), true, undefined, "&atualizar_banco=1").then(function () { b.disabled = false; });
  });
  function sairDaEdicao() {
    editandoAplicacao = null;
    $("ag-agendar").textContent = "Agendar aplicação";
    $("ag-cancelar-edicao").hidden = true;
    $("nova-aplicacao").querySelector("summary").textContent = "Nova aplicação";
  }
  $("ag-cancelar-edicao").addEventListener("click", function () {
    sairDaEdicao();
    $("ag-ids").value = ""; $("ag-obs").value = "";
  });
  $("aplicacoes").addEventListener("click", function (ev) {
    var ed = ev.target.closest("[data-editar-aplicacao]");
    if (ed) {
      var linha = Number(ed.getAttribute("data-editar-aplicacao")), ini = Number(ed.getAttribute("data-inicio"));
      var j = (dados.agenda.janelas || []).filter(function (x) { return x.linha === linha && x.inicio === ini; })[0];
      if (!j) return;
      editandoAplicacao = { linha: linha, inicio: ini };
      $("ag-prova").value = j.prova;
      $("ag-inicio").value = iso(new Date(j.inicio));
      $("ag-fim").value = iso(new Date(j.fim));
      $("ag-ids").value = (j.ids || []).join(", ");
      $("ag-obs").value = j.obs || "";
      $("ag-agendar").textContent = "Salvar alterações";
      $("ag-cancelar-edicao").hidden = false;
      var caixa = $("nova-aplicacao");
      caixa.open = true;
      caixa.querySelector("summary").textContent = "Editando aplicação de " + quando(j.inicio);
      desenharAplicacoes();
      caixa.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    var b = ev.target.closest("[data-cancelar]");
    if (!b) return;
    if (!window.confirm("Cancelar esta aplicação? Ela sai da Agenda.")) return;
    b.disabled = true;
    carregar(lerSenha(), false, undefined, "&cancelar=" + b.getAttribute("data-cancelar") + "&inicio=" + b.getAttribute("data-inicio"));
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
