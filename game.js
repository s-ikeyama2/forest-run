const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;
const HUD_H = 126;
const LANE_COUNT = 6;
const PLAY_TOP = HUD_H + 54;
const PLAY_BOTTOM = H - 122;
const LANE_H = (PLAY_BOTTOM - PLAY_TOP) / LANE_COUNT;
const PLAYER_X = 190;
const SLOT_MAX = 8;
const INITIAL_SPEED = 345;
const SPEED_ACCELERATION = 19.00;
const SPEED_CAP_SECONDS = 48;
const MAX_SPEED = INITIAL_SPEED + SPEED_ACCELERATION * SPEED_CAP_SECONDS;

const cropMap = {
  angel: { x: 72, y: 602, w: 258, h: 238 },
  dragon: { x: 400, y: 600, w: 260, h: 238 },
  demon: { x: 738, y: 598, w: 236, h: 240 },
  fairy: { x: 1050, y: 598, w: 250, h: 242 },
};

const collectImagePaths = {
  boar: "assets/collect-boar.jpg",
  tiger: "assets/collect-tiger.jpg",
  unicorn: "assets/collect-unicorn.jpg",
};

const allTypes = [
  { id: "dragon", jp: "リーフドラゴン", color: "#9ee04d", points: 500 },
  { id: "demon", jp: "デーモン", color: "#ff5a54", points: 500 },
  { id: "fairy", jp: "フェアリー", color: "#ffd745", points: 500 },
  { id: "boar", jp: "森イノシシ", color: "#62d6ca", points: 500 },
  { id: "tiger", jp: "赤鎖タイガー", color: "#ff9b38", points: 500 },
  { id: "unicorn", jp: "花ユニコーン", color: "#ff9bc7", points: 500 },
];

const typeById = Object.fromEntries(allTypes.map((type) => [type.id, type]));
const allTypeIds = allTypes.map((type) => type.id);

let sprites = {};
let ready = false;
let keys = new Set();
let state;

function makeSprite(img, crop) {
  const off = document.createElement("canvas");
  off.width = crop.w;
  off.height = crop.h;
  const octx = off.getContext("2d", { willReadFrequently: true });
  octx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  const data = octx.getImageData(0, 0, crop.w, crop.h);

  for (let i = 0; i < data.data.length; i += 4) {
    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const grayChecker = max - min < 10 && max > 165 && max < 245;
    const nearWhite = r > 238 && g > 238 && b > 238;
    if (grayChecker || nearWhite) data.data[i + 3] = 0;
  }
  octx.putImageData(data, 0, 0);
  return off;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function isPaperBackground(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (r > 226 && g > 220 && b > 205 && max - min < 48) || (r > 238 && g > 235 && b > 225);
}

function makePixelSprite(img) {
  const src = document.createElement("canvas");
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);

  const image = sctx.getImageData(0, 0, src.width, src.height);
  let minX = src.width;
  let minY = src.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < src.height; y += 2) {
    for (let x = 0; x < src.width; x += 2) {
      const i = (y * src.width + x) * 4;
      if (!isPaperBackground(image.data[i], image.data[i + 1], image.data[i + 2])) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const pad = 18;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(src.width, maxX + pad);
  maxY = Math.min(src.height, maxY + pad);
  const cropW = Math.max(1, maxX - minX);
  const cropH = Math.max(1, maxY - minY);

  const low = document.createElement("canvas");
  low.width = 48;
  low.height = 48;
  const lctx = low.getContext("2d", { willReadFrequently: true });
  const scale = Math.min(42 / cropW, 42 / cropH);
  const dw = Math.max(1, Math.round(cropW * scale));
  const dh = Math.max(1, Math.round(cropH * scale));
  const dx = Math.round((48 - dw) / 2);
  const dy = Math.round((48 - dh) / 2);
  lctx.imageSmoothingEnabled = true;
  lctx.drawImage(src, minX, minY, cropW, cropH, dx, dy, dw, dh);

  const px = lctx.getImageData(0, 0, 48, 48);
  for (let i = 0; i < px.data.length; i += 4) {
    const r = px.data[i];
    const g = px.data[i + 1];
    const b = px.data[i + 2];
    if (isPaperBackground(r, g, b)) {
      px.data[i + 3] = 0;
    } else {
      px.data[i] = Math.min(255, Math.round(r / 28) * 28);
      px.data[i + 1] = Math.min(255, Math.round(g / 28) * 28);
      px.data[i + 2] = Math.min(255, Math.round(b / 28) * 28);
      px.data[i + 3] = px.data[i + 3] > 80 ? 255 : 0;
    }
  }
  lctx.clearRect(0, 0, 48, 48);
  lctx.putImageData(px, 0, 0);
  return low;
}

async function init() {
  const [source, collectImages] = await Promise.all([
    loadImage("assets/sprites-source.png"),
    Promise.all(Object.entries(collectImagePaths).map(async ([id, path]) => [id, await loadImage(path)])),
  ]);

  sprites = Object.fromEntries(Object.entries(cropMap).map(([id, crop]) => [id, makeSprite(source, crop)]));
  for (const [id, img] of collectImages) sprites[id] = makePixelSprite(img);
  ready = true;
  resetGame();
  requestAnimationFrame(loop);
}

init().catch((error) => {
  console.error(error);
  ready = false;
});

function resetGame() {
  state = {
    mode: "title",
    lane: 2,
    lastInput: 0,
    time: 30,
    elapsed: 0,
    bonus: 0,
    combo: 0,
    speed: INITIAL_SPEED,
    spawnTimer: 0.75,
    bgOffset: 0,
    items: [],
    slots: [],
    lastType: null,
    streak: 0,
    candidateTypeIds: [],
    reserveTypeIds: [],
    popups: [],
    particles: [],
    gameOverReason: "",
  };
  startTargetRound();
}

function startGame() {
  resetGame();
  state.mode = "playing";
}

function laneY(lane) {
  return PLAY_TOP + lane * LANE_H + LANE_H / 2;
}

function rand(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function startTargetRound() {
  const shuffledIds = shuffle(allTypeIds);
  state.candidateTypeIds = shuffledIds.slice(0, 3);
  state.reserveTypeIds = shuffledIds.slice(3);
}

function candidateTypes() {
  return state.candidateTypeIds.map((id) => typeById[id]);
}

function replaceCompletedCandidate(completedType) {
  if (!state.candidateTypeIds.includes(completedType.id) || state.reserveTypeIds.length === 0) return;

  const reserveIndex = Math.floor(Math.random() * state.reserveTypeIds.length);
  const [nextId] = state.reserveTypeIds.splice(reserveIndex, 1);
  state.candidateTypeIds = state.candidateTypeIds.map((id) => (id === completedType.id ? nextId : id));
  state.reserveTypeIds.push(completedType.id);
  const nextType = typeById[nextId];
  state.popups.push({
    text: `${nextType.jp} 登場!`,
    x: PLAYER_X + 72,
    y: laneY(state.lane) + 18,
    life: 1.15,
    color: nextType.color,
  });
}

function columnChoices() {
  return candidateTypes();
}

function addItemColumn() {
  const x = W + 90;
  const choices = columnChoices();
  const columnTypes = [
    ...choices,
    ...Array.from({ length: LANE_COUNT - choices.length }, () => choices[Math.floor(Math.random() * choices.length)]),
  ];
  const shuffledColumnTypes = shuffle(columnTypes);

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const type = shuffledColumnTypes[lane];
    state.items.push({
      id: globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Math.random()),
      type,
      lane,
      x,
      wobble: Math.random() * Math.PI * 2,
    });
  }
}

function collect(item) {
  const wasSame = state.lastType?.id === item.type.id;
  state.streak = wasSame ? state.streak + 1 : 1;
  state.lastType = item.type;
  state.slots.push(item.type);

  const len = state.slots.length;
  if (
    len >= 3 &&
    state.slots[len - 1].id === item.type.id &&
    state.slots[len - 2].id === item.type.id &&
    state.slots[len - 3].id === item.type.id
  ) {
    state.slots.splice(len - 3, 3);
    const gain = item.type.points;
    state.bonus += gain;
    state.time += 5;
    state.combo += 1;
    state.streak = 0;
    replaceCompletedCandidate(item.type);
    state.popups.push({ text: `+${gain}  +5秒`, x: PLAYER_X + 72, y: laneY(item.lane) - 48, life: 0.9, color: item.type.color });
    burst(PLAYER_X + 70, laneY(item.lane), item.type.color);
  } else {
    state.popups.push({ text: item.type.jp, x: PLAYER_X + 62, y: laneY(item.lane) - 44, life: 0.55, color: item.type.color });
    burst(PLAYER_X + 68, laneY(item.lane), "#fff0a8");
  }

  if (state.slots.length >= SLOT_MAX) {
    state.mode = "gameover";
    state.gameOverReason = "スロットがいっぱいになりました";
  }
}

function burst(x, y, color) {
  for (let i = 0; i < 16; i += 1) {
    state.particles.push({
      x,
      y,
      vx: Math.cos((Math.PI * 2 * i) / 16) * (80 + Math.random() * 90),
      vy: Math.sin((Math.PI * 2 * i) / 16) * (80 + Math.random() * 90),
      life: 0.45,
      color,
    });
  }
}

function update(dt) {
  if (state.mode !== "playing") return;

  state.elapsed += dt;
  state.time -= dt;
  state.speed = Math.min(MAX_SPEED, state.speed + dt * SPEED_ACCELERATION);
  state.bgOffset += state.speed * dt;
  state.spawnTimer -= dt;

  if (state.time <= 0) {
    state.time = 0;
    state.mode = "gameover";
    state.gameOverReason = "時間切れ";
  }

  if (state.spawnTimer <= 0) {
    addItemColumn();
    state.spawnTimer = Math.max(1.32, 2.76 - state.elapsed * 0.024);
  }

  for (const item of state.items) item.x -= state.speed * dt;
  const collectDistance = state.speed * dt + 24;
  for (const item of state.items) {
    if (!item.hit && item.lane === state.lane && item.x < PLAYER_X + collectDistance && item.x > PLAYER_X - 46) {
      item.hit = true;
      collect(item);
    }
  }
  state.items = state.items.filter((item) => !item.hit && item.x > -120);

  state.popups.forEach((p) => {
    p.life -= dt;
    p.y -= dt * 54;
  });
  state.popups = state.popups.filter((p) => p.life > 0);

  state.particles.forEach((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 180 * dt;
  });
  state.particles = state.particles.filter((p) => p.life > 0);
}

function drawText(text, x, y, size, color = "#fff", align = "left") {
  ctx.save();
  ctx.font = `700 ${size}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.lineWidth = Math.max(3, size / 8);
  ctx.strokeStyle = "#081008";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawForest() {
  const g = ctx.createLinearGradient(0, HUD_H, 0, H);
  g.addColorStop(0, "#1e5b38");
  g.addColorStop(0.42, "#69a722");
  g.addColorStop(1, "#173b18");
  ctx.fillStyle = g;
  ctx.fillRect(0, HUD_H, W, H - HUD_H);

  for (let layer = 0; layer < 3; layer += 1) {
    const spacing = [86, 122, 168][layer];
    const scroll = (state.bgOffset * [0.25, 0.18, 0.11][layer]) % spacing;
    for (let x = -spacing; x < W + spacing; x += spacing) {
      const px = x - scroll;
      const h = [310, 255, 205][layer] + rand(x + layer) * 48;
      ctx.fillStyle = ["#1a3a22", "#24552a", "#326d32"][layer];
      ctx.fillRect(px + 22, HUD_H + 10, 28, h);
      ctx.fillStyle = ["#12361e", "#1b4a28", "#2e6430"][layer];
      ctx.beginPath();
      ctx.ellipse(px + 38, HUD_H + 52, 62, 80, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 0; i <= LANE_COUNT; i += 1) {
    const y = PLAY_TOP + i * LANE_H;
    ctx.fillStyle = "rgba(242, 225, 75, 0.78)";
    ctx.fillRect(84, y - 3, W - 128, 5);
    ctx.fillStyle = "rgba(29, 72, 24, 0.62)";
    ctx.fillRect(84, y + 3, W - 128, 4);
  }

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    const y = laneY(lane);
    const selected = lane === state.lane;
    ctx.fillStyle = selected ? "#151a14" : "rgba(5, 9, 8, 0.78)";
    ctx.strokeStyle = selected ? "#ffe339" : "#f4f4f4";
    ctx.lineWidth = 4;
    roundRect(18, y - 31, 64, 62, 6, true, true);
    drawText(String(lane + 1), 50, y - 22, 38, selected ? "#ffe339" : "#fff", "center");
  }

  ctx.fillStyle = "rgba(17, 56, 21, 0.75)";
  ctx.fillRect(0, PLAY_BOTTOM, W, H - PLAY_BOTTOM);
  scatterFlowers();
}

function scatterFlowers() {
  const scroll = state.bgOffset % 360;
  for (let i = 0; i < 52; i += 1) {
    const x = ((i * 137 - scroll) % (W + 80)) - 40;
    const y = PLAY_TOP + 14 + rand(i) * (PLAY_BOTTOM - PLAY_TOP - 28);
    ctx.fillStyle = i % 3 === 0 ? "#ffd7e6" : i % 3 === 1 ? "#ffe66d" : "#d6f7ff";
    ctx.fillRect(x, y, 5, 5);
    ctx.fillRect(x - 4, y, 5, 5);
    ctx.fillRect(x, y - 4, 5, 5);
    ctx.fillRect(x, y + 4, 5, 5);
  }
}

function drawHud() {
  ctx.fillStyle = "#090d0b";
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.strokeStyle = "#8fd41a";
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, W - 12, HUD_H - 12);

  drawText("TIME", 68, 22, 30);
  drawText(state.time.toFixed(1).padStart(4, "0"), 52, 58, 48, "#ffd52c");
  divider(198);
  drawText("SCORE", 260, 22, 30);
  drawText(String(score()).padStart(7, "0"), 226, 62, 42);
  divider(432);

  drawText("SLOT", 454, 20, 30);
  for (let i = 0; i < SLOT_MAX; i += 1) {
    const x = 456 + i * 61;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.strokeRect(x, 54, 43, 43);
    if (state.slots[i]) drawSprite(state.slots[i].id, x + 3, 49, 38, 38);
  }
  drawText(`${state.slots.length}/${SLOT_MAX}`, 1002, 64, 32);
  divider(1130);

  drawText("LAST", 1156, 22, 30);
  if (state.lastType) drawSprite(state.lastType.id, 1196, 36, 64, 64);
  else drawText("--", 1234, 66, 32);
  divider(1340);
  drawText("COMBO", 1382, 22, 30);
  drawText(String(state.streak), 1436, 62, 50, "#ffd52c", "center");
}

function divider(x) {
  ctx.fillStyle = "#a8a8a8";
  ctx.fillRect(x, 18, 4, 88);
}

function score() {
  return Math.floor(state.elapsed * 100) + state.bonus;
}

function drawSprite(id, x, y, w, h) {
  const sprite = sprites[id];
  if (!sprite) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, x, y, w, h);
  ctx.restore();
}

function drawPlayer() {
  const y = laneY(state.lane);
  const bob = Math.sin(performance.now() / 120) * 5;
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  for (let i = 0; i < 4; i += 1) ctx.fillRect(128 - i * 22, y - 16 + i * 8, 52 - i * 5, 5);
  drawSprite("angel", PLAYER_X - 35, y - 50 + bob, 105, 98);
}

function drawItems() {
  for (const item of state.items) {
    const y = laneY(item.lane) + Math.sin(performance.now() / 180 + item.wobble) * 4;
    drawSprite(item.type.id, item.x - 44, y - 55, 96, 96);
  }
}

function drawFx() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.45);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 8, 8);
  }
  ctx.globalAlpha = 1;
  for (const p of state.popups) {
    ctx.globalAlpha = Math.max(0, p.life);
    drawText(p.text, p.x, p.y, 24, p.color);
  }
  ctx.globalAlpha = 1;
}

function drawFooter() {
  ctx.fillStyle = "rgba(3, 6, 5, 0.88)";
  ctx.strokeStyle = "#e7e7e7";
  ctx.lineWidth = 3;
  roundRect(18, H - 74, 680, 58, 4, true, true);
  drawText("↑↓: LANE CHANGE", 62, H - 58, 28);
  drawText("P: PAUSE", 498, H - 58, 28);

  roundRect(960, H - 74, 558, 58, 4, true, true);
  drawText("3つそろえると", 1008, H - 58, 28);
  drawText("+500点 & +5秒", 1216, H - 58, 28, "#ffbd3c");
}

function drawOverlay() {
  if (state.mode === "playing") return;
  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, HUD_H, W, H - HUD_H);
  const title = state.mode === "title" ? "ふわふわエンジェル" : state.mode === "paused" ? "PAUSE" : "GAME OVER";
  const sub =
    state.mode === "title"
      ? "森の精霊を3体連続で集めよう"
      : state.mode === "paused"
        ? "Pで再開"
        : `${state.gameOverReason}  SCORE ${String(score()).padStart(7, "0")}`;
  drawText(title, W / 2, 354, 62, "#fff7b8", "center");
  drawText(sub, W / 2, 430, 30, "#ffffff", "center");
  drawText("ENTER / SPACE / CLICK", W / 2, 498, 30, "#ffd52c", "center");
}

function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawForest();
  drawItems();
  drawPlayer();
  drawFx();
  drawHud();
  drawFooter();
  drawOverlay();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function changeLane(delta) {
  if (state.mode !== "playing") return;
  const now = performance.now();
  if (now - state.lastInput < 90) return;
  state.lastInput = now;
  state.lane = Math.max(0, Math.min(LANE_COUNT - 1, state.lane + delta));
}

window.addEventListener("keydown", (event) => {
  if (keys.has(event.code)) return;
  keys.add(event.code);
  if (event.code === "ArrowUp") {
    event.preventDefault();
    changeLane(-1);
  }
  if (event.code === "ArrowDown") {
    event.preventDefault();
    changeLane(1);
  }
  if (event.code === "KeyP" && state.mode !== "title" && state.mode !== "gameover") {
    state.mode = state.mode === "paused" ? "playing" : "paused";
  }
  if (event.code === "Enter" || event.code === "Space") {
    event.preventDefault();
    if (state.mode === "title" || state.mode === "gameover") startGame();
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
canvas.addEventListener("pointerdown", () => {
  if (state.mode === "title" || state.mode === "gameover") startGame();
});
