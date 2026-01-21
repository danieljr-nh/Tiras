const svg = document.getElementById("svg");
const groupsDiv = document.getElementById("groups");
const tabsDiv = document.getElementById("tabs");

const scale = 3;
const MAX_GROUPS = 10;
let activeGroupIndex = 0;

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

function importJSON() {
  const fileInput = document.getElementById("importFile");
  const file = fileInput.files[0];

  if (!file) {
    alert("Selecione um arquivo JSON.");
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // validação básica
      if (!data.conjuntos || !Array.isArray(data.conjuntos)) {
        throw new Error("Arquivo inválido.");
      }

      // preenche campos principais
      document.getElementById("projectName").value = data.nome || "";
      angIniInput.value = data.anguloInicial;
      angFimInput.value = data.anguloFinal;
      distIni.value = data.distanciaInicial;
      distFim.value = data.distanciaFinal;

      // limpa conjuntos atuais
      groupsDiv.innerHTML = "";
      tabsDiv.innerHTML = "";
      activeGroupIndex = 0;

      // recria conjuntos
      data.conjuntos.forEach((c, i) => {
        addGroup();

        const group = groupsDiv.children[i];
        const inputs = group.querySelectorAll("input");

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

function exportPDF() {
  window.print();
}

document.getElementById("importFile").addEventListener("change", function () {
  const label = document.getElementById("fileLabel");

  if (this.files.length) {
    label.textContent = this.files[0].name;

    // 🔴 IMPORTA AUTOMATICAMENTE AO SELECIONAR
    importJSON();
	this.value = "";
  } else {
    label.textContent = "Nenhum arquivo selecionado";
  }
});

const projectNameInput = document.getElementById("projectName");

projectNameInput.addEventListener("input", () => {
  // remove tudo que não for número
  let value = projectNameInput.value.replace(/\D/g, "");

  // limita a 15 dígitos
  value = value.slice(0, 15);

  projectNameInput.value = value;
});


// inputs
const angIniInput = document.getElementById("angIni");
const angFimInput = document.getElementById("angFim");

// inicialização
addGroup();
activateGroup(0);
draw();
