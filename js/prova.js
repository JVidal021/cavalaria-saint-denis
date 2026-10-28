// Prova da Cavalaria: mostra as questões da prova aberta no visual do site e envia as respostas
// ao Formulário Google da Cavalaria, que corrige e registra na planilha do instrutor.
(function () {
  var P = window.PROVA;
  var ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  var LETRAS = "abcd";
  // Rascunho, sorteio e comprovante ficam guardados por aplicação (prova + horário de início).
  var CHAVE_RASCUNHO = "cavalaria-prova-rascunho";
  var CHAVE_ENVIO = "cavalaria-prova-enviada";
  var CHAVE_SORTEIO = "cavalaria-prova-sorteio";
  var APLICACAO = null; // dados da aplicação aberta (prova, campo da prova, páginas do formulário)

  var form = document.getElementById("prova");
  var status = document.getElementById("prova-status");
  var statusTexto = document.getElementById("prova-status-texto");
  var MODULOS = [];
  var total = 0;

  function guardar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) {} }
  function ler(chave) { try { return JSON.parse(localStorage.getItem(chave)); } catch (e) { return null; } }
  function apagar(chave) { try { localStorage.removeItem(chave); } catch (e) {} }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
  function embaralhar(lista) {
    var a = lista.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Sorteia N questões por tópico e embaralha as alternativas de cada uma.
  // O sorteio fica guardado: recarregar a página não troca as questões do oficial.
  function sortear(banco, n) {
    banco = banco.map(function (m) {
      return { nome: m.nome, questoes: m.questoes.filter(function (q) { return q.entry; }) };
    });
    var porEntry = {};
    banco.forEach(function (m) { m.questoes.forEach(function (q) { porEntry[q.entry] = q; }); });

    function montarSelecao(sel) {
      return sel.map(function (lista, mi) {
        return {
          nome: banco[mi].nome,
          questoes: lista.map(function (s) {
            var q = porEntry[s.entry];
            if (!q) throw new Error("questão fora do banco");
            return { entry: q.entry, q: q.q, o: s.ordem.map(function (k) { return q.o[k]; }) };
          })
        };
      });
    }

    var salvo = ler(CHAVE_SORTEIO);
    if (salvo && salvo.length === banco.length) {
      try { return montarSelecao(salvo); } catch (e) { /* banco mudou: sorteia de novo */ }
    }
    var sel = banco.map(function (m) {
      return embaralhar(m.questoes).slice(0, n).map(function (q) {
        return { entry: q.entry, ordem: embaralhar(q.o.map(function (_, i) { return i; })) };
      });
    });
    guardar(CHAVE_SORTEIO, sel);
    return montarSelecao(sel);
  }

  // As questões só chegam se a prova estiver aberta na agenda (e, na recuperação, se o ID foi convocado).
  var idRecuperacao = "";
  function buscar(id) {
    return Agenda.consultar(true, id).then(function (e) {
      if (!e.aberta) { fechada(Agenda.descrever(e)); return; }
      if (e.restrita && !e.permitido) { pedirId(e, !!id); return; }
      if (!e.modulos) { fechada(Agenda.descrever(e)); return; }
      idRecuperacao = id || "";
      $("recuperacao-id").hidden = true;
      APLICACAO = e;
      var sufixo = "-" + (e.prova ? e.prova.id : "prova") + "-" + (e.inicio || "");
      CHAVE_RASCUNHO += sufixo; CHAVE_ENVIO += sufixo; CHAVE_SORTEIO += sufixo;
      apresentar(e.prova, e);
      // Já enviou esta aplicação neste navegador: mostra só o comprovante.
      var envio = ler(CHAVE_ENVIO);
      if (envio) { mostrarEnviada(envio); return; }
      MODULOS = sortear(e.modulos, e.sorteio || 4);
      total = MODULOS.reduce(function (n, m) { return n + m.questoes.length; }, 0);
      statusTexto.innerHTML = Agenda.descrever(e);
      montar();
    }).catch(function () {
      fechada("Não foi possível consultar a agenda da prova. Verifique sua internet e recarregue a página.");
    });
  }
  // Recuperação: pede o ID fixo antes de entregar as questões.
  function pedirId(e, recusado) {
    statusTexto.innerHTML = Agenda.descrever(e);
    var caixa = $("recuperacao-id");
    caixa.hidden = false;
    $("recuperacao-erro").hidden = !recusado;
    var botao = caixa.querySelector("button");
    botao.disabled = false;
    botao.textContent = "Continuar";
  }
  $("recuperacao-id").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var id = $("rec-id").value.trim();
    if (!id) return;
    var botao = this.querySelector("button");
    botao.disabled = true;
    botao.textContent = "Conferindo…";
    buscar(id);
  });
  function $(id) { return document.getElementById(id); }
  // Título da página com o nome da prova aberta.
  function apresentar(prova, e) {
    if (!prova) return;
    var info = (P.provas || []).filter(function (x) { return x.id === prova.id; })[0] || {};
    $("prova-titulo").textContent = prova.nome;
    document.title = prova.nome + " · Cavalaria SD";
    var n = e.modulos ? e.modulos.length * (e.sorteio || info.sorteio || 4) : info.totalQuestoes;
    $("prova-lead").textContent = (n ? n + " questões objetivas, " + (e.sorteio || info.sorteio) + " de cada tópico, sorteadas para você. " : "") +
      "Nota mínima: " + (e.notaMinima || info.notaMinima) + "%.";
  }
  buscar();

  function fechada(msg) {
    status.setAttribute("data-label", "AVISO DA CENTRAL · PROVA FECHADA");
    statusTexto.innerHTML = msg;
    form.hidden = true;
    document.getElementById("contador").hidden = true;
  }

  function montar() {
  form.hidden = false;
  document.getElementById("contador").hidden = false;
  // ---------- Montagem ----------
  var ident = document.getElementById("identificacao");
  P.identificacao.forEach(function (c) {
    var id = "f-" + c.entry;
    var campo = el("div", { "class": "ficha-campo" });
    campo.appendChild(el("label", { "for": id }, esc(c.rotulo) + (c.obrigatorio ? "" : ' <span class="opc">(opcional)</span>')));
    var input = el("input", { type: "text", id: id, name: "entry." + c.entry, autocomplete: "off" });
    if (c.obrigatorio) input.required = true;
    if (c.rotulo === "ID fixo" && idRecuperacao) { input.value = idRecuperacao; input.readOnly = true; }
    campo.appendChild(input);
    ident.appendChild(campo);
  });

  var area = document.getElementById("questoes");
  var n = 0;
  MODULOS.forEach(function (m, mi) {
    var sec = el("section", { "class": "modulo" });
    sec.appendChild(el("h3", { "class": "section" }, '<span class="num">' + ROMANOS[mi] + "</span>" + esc(m.nome)));
    m.questoes.forEach(function (q) {
      n++;
      var fs = el("fieldset", { "class": "q", id: "q" + n });
      fs.appendChild(el("legend", {}, '<span class="q-num">Questão ' + n + "</span>" + esc(q.q)));
      var ops = el("div", { "class": "q-opcoes" });
      q.o.forEach(function (texto, i) {
        var lab = el("label", { "class": "opcao" });
        var r = el("input", { type: "radio", name: "entry." + q.entry, value: texto });
        lab.appendChild(r);
        lab.appendChild(el("span", { "class": "letra", "aria-hidden": "true" }, LETRAS[i]));
        lab.appendChild(el("span", { "class": "texto" }, esc(texto)));
        ops.appendChild(lab);
      });
      fs.appendChild(ops);
      sec.appendChild(fs);
    });
    area.appendChild(sec);
  });

  // ---------- Rascunho (sobrevive a recarregar a página) ----------
  var rascunho = ler(CHAVE_RASCUNHO) || {};
  Object.keys(rascunho).forEach(function (nome) {
    var campos = form.elements[nome];
    if (!campos) return;
    if (campos.length && campos[0] && campos[0].type === "radio") {
      [].forEach.call(campos, function (r) { r.checked = r.value === rascunho[nome]; });
    } else if (campos.type === "text") {
      campos.value = rascunho[nome];
    }
  });

  function respostas() {
    var dados = {};
    [].forEach.call(form.elements, function (e) {
      if (!e.name) return;
      if (e.type === "radio") { if (e.checked) dados[e.name] = e.value; }
      else if (e.type === "text") dados[e.name] = e.value.trim();
    });
    return dados;
  }

  var contador = document.getElementById("contador");
  function atualizar() {
    var d = respostas();
    guardar(CHAVE_RASCUNHO, d);
    var feitas = 0;
    MODULOS.forEach(function (m) { m.questoes.forEach(function (q) { if (d["entry." + q.entry]) feitas++; }); });
    contador.innerHTML = '<span class="contador-num">' + feitas + "/" + total + "</span> respondidas" +
      '<span class="contador-barra"><i style="width:' + (feitas / total * 100) + '%"></i></span>';
    [].forEach.call(document.querySelectorAll(".q"), function (fs) {
      if (fs.querySelector("input:checked")) fs.classList.remove("faltando");
    });
  }
  form.addEventListener("input", atualizar);
  form.addEventListener("change", atualizar);
  atualizar();

  // ---------- Envio ----------
  var aviso = document.getElementById("aviso-faltando");
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var d = respostas();
    var faltas = [];

    P.identificacao.forEach(function (c) {
      var input = document.getElementById("f-" + c.entry);
      var vazio = c.obrigatorio && !d["entry." + c.entry];
      input.classList.toggle("faltando", vazio);
      if (vazio) faltas.push(input);
    });
    var k = 0;
    MODULOS.forEach(function (m) {
      m.questoes.forEach(function (q) {
        k++;
        var fs = document.getElementById("q" + k);
        var vazio = !d["entry." + q.entry];
        fs.classList.toggle("faltando", vazio);
        if (vazio) faltas.push(fs);
      });
    });

    if (faltas.length) {
      var nq = document.querySelectorAll(".q.faltando").length;
      aviso.hidden = false;
      aviso.innerHTML = '<span class="label">Prova incompleta</span>' +
        (nq ? "Faltam " + nq + " questão(ões) sem resposta. " : "") +
        (document.querySelector(".ficha .faltando") ? "Preencha a ficha do oficial. " : "") +
        "Os itens pendentes estão marcados em vermelho.";
      faltas[0].scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    aviso.hidden = true;

    if (!window.confirm("Enviar a prova agora? Depois do envio não é possível alterar as respostas.")) return;

    var botao = document.getElementById("btn-enviar");
    botao.disabled = true;
    botao.textContent = "Enviando…";
    Agenda.consultar(false).then(function (e) {
      if (!e.aberta) {
        botao.textContent = "Prova encerrada";
        aviso.hidden = false;
        aviso.innerHTML = '<span class="label">Horário encerrado</span>O horário de aplicação terminou e a prova não pode mais ser enviada. Procure o instrutor.';
        return;
      }
      enviar(d, botao);
    }).catch(function () {
      botao.disabled = false;
      botao.textContent = "Enviar a prova";
      aviso.hidden = false;
      aviso.innerHTML = '<span class="label">Falha no envio</span>Não foi possível confirmar o horário da prova. Verifique sua internet e tente de novo; suas respostas continuam salvas.';
    });
  });

  function enviar(d, botao) {

    // Formulário oculto que posta direto no Google Forms (todas as páginas de uma vez).
    var envioForm = el("form", { action: P.acao, method: "POST", target: "prova-destino", hidden: "" });
    Object.keys(d).forEach(function (nome) {
      if (d[nome]) envioForm.appendChild(el("input", { type: "hidden", name: nome, value: d[nome] }));
    });
    // Campo "Prova" do formulário: diz ao corretor qual prova o oficial fez.
    if (APLICACAO.campoProva && APLICACAO.prova) {
      envioForm.appendChild(el("input", { type: "hidden", name: "entry." + APLICACAO.campoProva, value: APLICACAO.prova.curto }));
    }
    var paginas = [];
    for (var i = 0; i < (APLICACAO.paginas || P.paginas); i++) paginas.push(i);
    envioForm.appendChild(el("input", { type: "hidden", name: "pageHistory", value: paginas.join(",") }));
    document.body.appendChild(envioForm);

    var destino = document.getElementById("prova-destino");
    var concluido = false;
    var falha = setTimeout(function () {
      if (concluido) return;
      botao.disabled = false;
      botao.textContent = "Enviar a prova";
      aviso.hidden = false;
      aviso.innerHTML = '<span class="label">Falha no envio</span>Não foi possível confirmar o envio. Verifique sua internet e tente de novo; suas respostas continuam salvas.';
    }, 20000);
    destino.onload = function () {
      concluido = true;
      clearTimeout(falha);
      var registro = {
        nome: d["entry." + P.identificacao[0].entry],
        patente: d["entry." + P.identificacao[2].entry],
        prova: APLICACAO.prova ? APLICACAO.prova.nome : "",
        quando: new Date().toLocaleString("pt-BR")
      };
      guardar(CHAVE_ENVIO, registro);
      apagar(CHAVE_RASCUNHO);
      apagar(CHAVE_SORTEIO);
      mostrarEnviada(registro);
    };
    envioForm.submit();
  }
  } // fim de montar()

  function mostrarEnviada(r) {
    form.hidden = true;
    var c = document.getElementById("contador");
    if (c) c.hidden = true;
    document.getElementById("prova-status").hidden = true;
    document.getElementById("prova-enviada").hidden = false;
    document.getElementById("prova-enviada-texto").innerHTML =
      (r.prova ? esc(r.prova) + " de <strong>" : "Prova de <strong>") + esc(r.patente || "") + " " + esc(r.nome || "") + "</strong> recebida pela Cavalaria em " +
      esc(r.quando || "") + ".<br>O resultado será divulgado pelo instrutor. Bom serviço, oficial.";
    window.scrollTo(0, 0);
  }
})();
