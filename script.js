const svg = document.getElementById("svg");
const groupsDiv = document.getElementById("groups");
const tabsDiv = document.getElementById("tabs");

const scale = 3;
const MAX_GROUPS = 10;
let activeGroupIndex = 0;

const CSV_FACTOR = 10;

// guarda o intervalo X de cada conjunto
let groupRanges = [];

// ─────────────────────────────
// CONJUNTOS (ABAS)
// ─────────────────────────────
function addGroup() {
  const count = groupsDiv.children.length;
  if (count >= MAX_GROUPS) {
    alert("Máximo de 10 conjuntos de furos.");
    return;
  }

  const index = count;

  const tab = document.createElement("div");
  tab.className = "tab";
  tab.textContent = `Conj. ${index + 1}`;
  tab.onclick = () => activateGroup(index);
  tabsDiv.appendChild(tab);

  const div = document.createElement("div");
  div.className = "group";
  div.innerHTML = `
    <label>Quantidade de furos</label>
    <input type="number" value="3">

    <label>Distância entre furos (mm)</label>
    <input type="number" value="20">

    <label>Distância até próximo conjunto (mm)</label>
    <input type="number" value="40">
  `;
  groupsDiv.appendChild(div);

  activateGroup(index);
  draw();
}

function activateGroup(index) {
  activeGroupIndex = index;

  [...groupsDiv.children].forEach((g, i) => {
    g.style.display = i === index ? "block" : "none";
  });

  [...tabsDiv.children].forEach((t, i) => {
    t.classList.toggle("active", i === index);
  });

  draw();
}

// ─────────────────────────────
// DESENHO
// ─────────────────────────────
function draw() {
  svg.innerHTML = "";
  groupRanges = [];

	const height = svg.clientHeight;



  const centerY = height / 2;
  const h = 40;
  const y = centerY - h / 2;

  let x = 120;
  const positions = [];

  const angIniRaw = +angIniInput.value;
  const angFimRaw = +angFimInput.value;

  const xIni = x;
  x += distIni.value * scale;

  // ─────────── calcula intervalos dos conjuntos
  [...groupsDiv.children].forEach(group => {
    const [q, s, n] = group.querySelectorAll("input");

    const startX = x;

    for (let i = 0; i < q.value; i++) {
      x += s.value * scale;
    }

    const endX = x;
    groupRanges.push({ startX, endX });

    x += n.value * scale;
  });

  x += distFim.value * scale;
  const xFim = x;

  // ─────────── agora SIM podemos limitar os ângulos
  const firstGroup = groupRanges[0];
  const lastGroup = groupRanges[groupRanges.length - 1];

  // limite físico do corte inicial:
  // - distância inicial
  // - primeiro furo
  // - comprimento total
  const distIniPx = distIni.value * scale;

  const maxDxIni = Math.min(
    distIniPx / 2,
    firstGroup ? (firstGroup.startX - xIni) / 2 : Infinity,
    (xFim - xIni) / 2
  );

  // limite físico do corte final (metade do espaço disponível)
  const maxDxFim = lastGroup
    ? (xFim - lastGroup.endX) / 2
    : (xFim - xIni) / 2;
  
  const ini = clampAngle(angIniRaw, h, maxDxIni);
  const fim = clampAngle(angFimRaw, h, maxDxFim);

  const dxIni = ini.dx;
  const dxFim = fim.dx;

  // pontos reais da peça considerando os ângulos
  const xInicioReal = xIni - dxIni;
  const xFimReal = xFim + dxFim;

	// ─────────── FIT TO PAGE (auto zoom)
	const paddingX = 80;
	const paddingY = 80;

	const contentWidth = (xFimReal - xInicioReal) + paddingX * 2;
	const contentHeight = h + paddingY * 2;

	svg.setAttribute(
	  "viewBox",
	  `${xInicioReal - paddingX} ${y - paddingY} ${contentWidth} ${contentHeight}`
	);


  // atualiza inputs (feedback ao usuário)
  angIniInput.value = ini.angle.toFixed(1);
  angFimInput.value = fim.angle.toFixed(1);

  // largura dinâmica do SVG (scroll)
  const minWidth = 1200;
  //svg.style.width = Math.max(minWidth, xFim + 300) + "px";

  // ─────────── TIRA
  drawStripPath(xIni, xFim, y, h, dxIni, dxFim);

  // régua do comprimento total REAL (ponta a ponta)
  drawTotalLength(
    xInicioReal,
    xFimReal,
    y - 25   // acima da tira
  );

  // ─────────── destaque do conjunto ativo
  const activeRange = groupRanges[activeGroupIndex];
  if (activeRange) {
    drawGroupHighlight(activeRange.startX, activeRange.endX, y, h);
  }

  // ─────────── ELEMENTOS
  x = xIni;
  positions.push({ x });

  drawCut(x, centerY, h, dxIni);
  drawAngleAnnotation(x, centerY, h, ini.angle, true);
  x += distIni.value * scale;
  positions.push({ x });

  [...groupsDiv.children].forEach(group => {
    const [q, s, n] = group.querySelectorAll("input");

    for (let i = 0; i < q.value; i++) {
      drawHole(x, centerY);
      x += s.value * scale;
    }

    positions.push({ x });
    x += n.value * scale;
    positions.push({ x });
  });

  x += distFim.value * scale;
  drawCut(x, centerY, h, dxFim);
  drawAngleAnnotation(x, centerY, h, fim.angle, false);
  positions.push({ x });

  drawDimensions(positions, y + h + 28);
}

// ─────────────────────────────
// PRIMITIVAS
// ─────────────────────────────
function drawStripPath(xI, xF, y, h, dxI, dxF) {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", `
    M ${xI - dxI} ${y}
    L ${xF - dxF} ${y}
    L ${xF + dxF} ${y + h}
    L ${xI + dxI} ${y + h}
    Z
  `);
  p.setAttribute("fill", "var(--strip)");
  p.setAttribute("stroke", "var(--strip-border)");
  svg.appendChild(p);
}

function drawGroupHighlight(x1, x2, y, h) {
  const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  r.setAttribute("x", x1);
  r.setAttribute("y", y);
  r.setAttribute("width", x2 - x1);
  r.setAttribute("height", h);
  r.setAttribute("fill", "rgba(255, 209, 102, 0.25)");
  r.setAttribute("stroke", "rgba(255, 209, 102, 0.6)");
  r.setAttribute("stroke-dasharray", "4 3");
  svg.appendChild(r);
}

function drawCut(x, y, h, dx) {
  const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
  l.setAttribute("x1", x - dx);
  l.setAttribute("y1", y - h / 2);
  l.setAttribute("x2", x + dx);
  l.setAttribute("y2", y + h / 2);
  l.setAttribute("stroke", "var(--cut)");
  l.setAttribute("stroke-width", 3);
  svg.appendChild(l);
}

function drawAngleAnnotation(x, y, h, ang, left) {
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("x", x + (left ? -26 : 26));
  t.setAttribute("y", y - h / 2 - 6);
  t.setAttribute("fill", "var(--cut)");
  t.setAttribute("font-size", "13");
  t.setAttribute("font-weight", "600");
  t.setAttribute("text-anchor", "middle");
  t.textContent = `∠ ${ang}°`;
  svg.appendChild(t);
}

function drawHole(x, y) {
  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("cx", x);
  c.setAttribute("cy", y);
  c.setAttribute("r", 7);
  c.setAttribute("fill", "var(--hole)");
  c.setAttribute("stroke", "#fff");
  svg.appendChild(c);
}

// ─────────────────────────────
// COTAS
// ─────────────────────────────
function drawDimensions(points, y) {
  for (let i = 0; i < points.length - 1; i++) {
    const x1 = points[i].x;
    const x2 = points[i + 1].x;
    drawDimLine(x1, x2, y, `${Math.round((x2 - x1) / scale)} mm`);
  }
}

function drawDimLine(x1, x2, y, text) {
  const l = (a, b, c, d) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", a);
    line.setAttribute("y1", b);
    line.setAttribute("x2", c);
    line.setAttribute("y2", d);
    line.setAttribute("stroke", "#aaa");
    return line;
  };

  svg.appendChild(l(x1, y - 5, x1, y + 5));
  svg.appendChild(l(x2, y - 5, x2, y + 5));
  svg.appendChild(l(x1, y, x2, y));

  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("x", (x1 + x2) / 2);
  t.setAttribute("y", y - 8);
  t.setAttribute("fill", "#ccc");
  t.setAttribute("text-anchor", "middle");
  t.textContent = text;
  svg.appendChild(t);
}

function clampAngle(angleDeg, h, maxDx) {
  const MIN_ANGLE = 5; // limite físico mínimo (graus)

  // evita ângulo muito pequeno
  let angle = Math.max(angleDeg, MIN_ANGLE);

  // calcula dx correspondente
  let dx = h / Math.tan(angle * Math.PI / 180);

  // se ultrapassar o espaço disponível, ajusta o ângulo
  if (dx > maxDx) {
    dx = maxDx;
    angle = Math.atan(h / dx) * 180 / Math.PI;
  }

  return { angle, dx };
}

function drawTotalLength(x1, x2, y) {
  const totalMm = Math.round((x2 - x1) / scale);

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const line = (a, b, c, d) => {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", a);
    l.setAttribute("y1", b);
    l.setAttribute("x2", c);
    l.setAttribute("y2", d);
    l.setAttribute("stroke", "#fff");
    l.setAttribute("stroke-width", 1.5);
    return l;
  };

  // hastes
  g.appendChild(line(x1, y - 6, x1, y + 6));
  g.appendChild(line(x2, y - 6, x2, y + 6));

  // linha principal
  g.appendChild(line(x1, y, x2, y));

  // texto
  const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
  t.setAttribute("x", (x1 + x2) / 2);
  t.setAttribute("y", y - 10);
  t.setAttribute("fill", "#fff");
  t.setAttribute("font-size", "13");
  t.setAttribute("font-weight", "600");
  t.setAttribute("text-anchor", "middle");
  t.textContent = `${totalMm} mm`;

  g.appendChild(t);
  svg.appendChild(g);
}

function exportJSON() {
  const projectNameInput = document.getElementById("projectName");
  const nome = projectNameInput.value;

  // 🔒 VALIDAÇÃO: exatamente 15 dígitos numéricos
  if (!/^\d{15}$/.test(nome)) {
    alert("O nome da tira deve conter exatamente 15 algarismos numéricos (0–9).");
    projectNameInput.focus();
    return; // interrompe a exportação
  }

  const angIni = parseFloat(angIniInput.value);
  const angFim = parseFloat(angFimInput.value);
  const distIniMm = parseFloat(distIni.value);
  const distFimMm = parseFloat(distFim.value);

  const conjuntos = [];
  let comprimentoUtil = 0;

  [...groupsDiv.children].forEach((group, index) => {
    const inputs = group.querySelectorAll("input");

    const qtd = parseInt(inputs[0].value, 10);
    const espacamento = parseFloat(inputs[1].value);
    const distanciaAteProximo = parseFloat(inputs[2].value);

    const comprimentoConjunto = qtd > 1
      ? (qtd - 1) * espacamento
      : 0;

    comprimentoUtil += comprimentoConjunto;

    conjuntos.push({
      id: index + 1,
      quantidadeFuros: qtd,
      distanciaEntreFuros: espacamento,
      distanciaAteProximo,
      comprimentoConjunto
    });
  });

  let comprimentoTotal = distIniMm + distFimMm;

  conjuntos.forEach(c => {
    comprimentoTotal += c.comprimentoConjunto;
    comprimentoTotal += c.distanciaAteProximo;
  });

  const data = {
    nome,
    dataCriacao: new Date().toISOString(),
    anguloInicial: angIni,
    anguloFinal: angFim,
    distanciaInicial: distIniMm,
    distanciaFinal: distFimMm,
    comprimentoTotal,
    conjuntos
  };

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

function importJSONFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!Array.isArray(data.conjuntos)) {
        throw new Error("Arquivo inválido.");
      }

      document.getElementById("projectName").value = data.nome || "";
	  atualizarTituloProjeto(data.nome || "");
      angIniInput.value = data.anguloInicial;
      angFimInput.value = data.anguloFinal;
      distIni.value = data.distanciaInicial;
      distFim.value = data.distanciaFinal;

      resetGrupos();

      data.conjuntos.forEach((c, i) => {
        addGroup();
        const inputs = groupsDiv.children[i].querySelectorAll("input");

        inputs[0].value = c.quantidadeFuros;
        inputs[1].value = c.distanciaEntreFuros;
        inputs[2].value = c.distanciaAteProximo ?? 0;
      });

      activateGroup(0);
      draw();

    } catch (err) {
      alert("Erro ao importar JSON: " + err.message);
    }
  };

  reader.readAsText(file);
}

function resetGrupos() {
  groupsDiv.innerHTML = "";
  tabsDiv.innerHTML = "";
  activeGroupIndex = 0;
}

function exportPDF() {
  window.print();
}

function gerarProgramaInterpretador() {
  const linhas = [];

  // 🔒 LIMITE DE CONJUNTOS PARA ESTA MODALIDADE
  const MAX_CJ = 5;

  const tradutor = "TR1005";

  const angIni = parseFloat(angIniInput.value);
  const angFim = parseFloat(angFimInput.value);
  const distIniMm = parseFloat(distIni.value);
  const distFimMm = parseFloat(distFim.value);

  // INÍCIO
  linhas.push(`INI ${tradutor}`);

  // DISTÂNCIAS INICIAIS
  //linhas.push(`DST DI1 ${distIniMm}`);
  linhas.push(`DST DI1 ${distIniMm * CSV_FACTOR}`);
  //linhas.push(`DST DI2 ${distIniMm}`);
  linhas.push(`DST DI2 ${distIniMm * CSV_FACTOR}`);

  // CONJUNTOS
  [...groupsDiv.children].slice(0, MAX_CJ).forEach((group, i) => {
    const inputs = group.querySelectorAll("input");

    const qtd = parseInt(inputs[0].value, 10) || 0;
    const espacamento = parseFloat(inputs[1].value) || 0;

    //linhas.push(`CJT CJ${i + 1} ${qtd} ${espacamento}`);
	linhas.push(`CJT CJ${i + 1} ${qtd} ${espacamento * CSV_FACTOR}`);
  });

  // COMPLETA CONJUNTOS FALTANTES (se houver menos de 5)
  for (let i = groupsDiv.children.length; i < MAX_CJ; i++) {
    linhas.push(`CJT CJ${i + 1} 0 0`);
  }

  // DISTÂNCIAS ENTRE CONJUNTOS
  const d = [];

  [...groupsDiv.children].slice(0, MAX_CJ).forEach(group => {
    const inputs = group.querySelectorAll("input");
    d.push(parseFloat(inputs[2].value) || 0);
  });

  //linhas.push(`DST D12 ${d[0] || 0}`);
  //linhas.push(`DST D23 ${d[1] || 0}`);
  //linhas.push(`DST D34 ${d[2] || 0}`);
  //linhas.push(`DST D45 ${d[3] || 0}`);
  linhas.push(`DST D12 ${(d[0] || 0) * CSV_FACTOR}`);
  linhas.push(`DST D23 ${(d[1] || 0) * CSV_FACTOR}`);
  linhas.push(`DST D34 ${(d[2] || 0) * CSV_FACTOR}`);
  linhas.push(`DST D45 ${(d[3] || 0) * CSV_FACTOR}`);

  // DISTÂNCIAS FINAIS
  //linhas.push(`DST DF1 ${distFimMm}`);
  //linhas.push(`DST DF2 ${distFimMm}`);
  linhas.push(`DST DF1 ${distFimMm * CSV_FACTOR}`);
  linhas.push(`DST DF2 ${distFimMm * CSV_FACTOR}`);

  // RECORTE (fixo)
  linhas.push(`DST RF1 0`);
  linhas.push(`DST RF2 0`);

  // COMPRIMENTO (fixo)
  linhas.push(`DST CP1 0`);
  linhas.push(`DST CP2 0`);

  // ÂNGULOS
  linhas.push(`ANG ANI ${angIni}`);
  linhas.push(`ANG ANF ${angFim}`);

  // FINALIZAÇÃO
  linhas.push(`FIM FIM`);
  linhas.push(`REF REF`);
  linhas.push(`CRT CRT`);

  return linhas;
}

function exportCSV() {
  const projectNameInput = document.getElementById("projectName");
  const nome = projectNameInput.value;

  // 🔒 VALIDAÇÃO: exatamente 15 dígitos
  if (!/^\d{15}$/.test(nome)) {
    alert("O nome da tira deve conter exatamente 15 algarismos numéricos.");
    projectNameInput.focus();
    return;
  }

  const linhas = gerarProgramaInterpretador();

  // CSV simples (1 linha por comando)
  const conteudo = linhas.join("\r\n");

  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.CSV`; // 👈 extensão pedida
  a.click();

  URL.revokeObjectURL(url);
}

function importCSV(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const linhas = e.target.result
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length);

      // ───── limpa interface
      groupsDiv.innerHTML = "";
      tabsDiv.innerHTML = "";
      activeGroupIndex = 0;

      let distIniMm = 0;
      let distFimMm = 0;
      let angIni = 90;
      let angFim = 90;

      const conjuntos = [];
      const distEntre = [];

      linhas.forEach(linha => {
        const p = linha.split(/\s+/);

        // DST
        if (p[0] === "DST") {
          switch (p[1]) {
            //case "DI1": distIniMm = +p[2]; break;
            //case "DF1": distFimMm = +p[2]; break;
            //case "D12": distEntre[0] = +p[2]; break;
            //case "D23": distEntre[1] = +p[2]; break;
            //case "D34": distEntre[2] = +p[2]; break;
            //case "D45": distEntre[3] = +p[2]; break;
			case "DI1": distIniMm = +p[2] / CSV_FACTOR; break;
			case "DF1": distFimMm = +p[2] / CSV_FACTOR; break;
			case "D12": distEntre[0] = +p[2] / CSV_FACTOR; break;
			case "D23": distEntre[1] = +p[2] / CSV_FACTOR; break;
			case "D34": distEntre[2] = +p[2] / CSV_FACTOR; break;
			case "D45": distEntre[3] = +p[2] / CSV_FACTOR; break;
          }
        }

        // ANG
        if (p[0] === "ANG") {
          if (p[1] === "ANI") angIni = +p[2];
          if (p[1] === "ANF") angFim = +p[2];
        }

        // CJT (ordem: pontos depois distância)
        if (p[0] === "CJT") {
          const id = parseInt(p[1].replace("CJ", ""), 10);
          conjuntos[id - 1] = {
            quantidadeFuros: +p[2],
            //distanciaEntreFuros: +p[3]
			distanciaEntreFuros: +p[3] / CSV_FACTOR
          };
        }
      });

      // ───── preenche campos principais
      distIni.value = distIniMm;
      distFim.value = distFimMm;
      angIniInput.value = angIni;
      angFimInput.value = angFim;

      // ───── recria conjuntos (máx. 5)
      conjuntos.slice(0, 5).forEach((c, i) => {
        addGroup();

        const group = groupsDiv.children[i];
        const inputs = group.querySelectorAll("input");

        inputs[0].value = c.quantidadeFuros || 0;
        inputs[1].value = c.distanciaEntreFuros || 0;
        inputs[2].value = distEntre[i] || 0;
      });

      activateGroup(0);
      draw();
	  
      const nomeProjeto = file.name.replace(/\.csv$/i, "");
      atualizarTituloProjeto(nomeProjeto);	  

    } catch (err) {
      alert("Erro ao importar CSV: " + err.message);
    }
  };

  reader.readAsText(file);
}

function atualizarTituloProjeto(nome) {
  const title = document.getElementById("projectTitle");

  if (nome && nome.trim()) {
    title.textContent = `PROJETO: ${nome}`;
  } else {
    title.textContent = "PROJETO: —";
  }
}

document.getElementById("btnImport").addEventListener("click", () => {
  document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;

  const label = document.getElementById("fileLabel");
  label.textContent = file.name;

  const name = file.name.toLowerCase();

  if (name.endsWith(".json")) {
    importJSONFile(file);
  } 
  else if (name.endsWith(".csv")) {
    importCSV(file);
  } 
  else {
    alert("Formato não suportado. Use .json ou .csv");
  }

  // permite importar o mesmo arquivo novamente
  this.value = "";
});


const projectNameInput = document.getElementById("projectName");

projectNameInput.addEventListener("input", () => {
  // remove tudo que não for número
  let value = projectNameInput.value.replace(/\D/g, "");

  // limita a 15 dígitos
  value = value.slice(0, 15);

  projectNameInput.value = value;
  atualizarTituloProjeto(value);
});


// inputs
const angIniInput = document.getElementById("angIni");
const angFimInput = document.getElementById("angFim");

// inicialização
addGroup();
activateGroup(0);
draw();
atualizarTituloProjeto("");