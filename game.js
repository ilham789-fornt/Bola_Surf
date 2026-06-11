// Three.js Bola Runner - Vanilla JS
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();

let activeMap = 'stadium';

const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
camera.position.set(0,6,12);

const ambient = new THREE.HemisphereLight(0xffffff,0x444444,0.9);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff,0.6);
dir.position.set(5,10,7);
scene.add(dir);

const lanes = [-2.5,0,2.5];
let currentLane = 1;

let isJumping = false;
let jumpVelocity = 0;
const gravity = -50;
const jumpStrength = 17;

// Skins shop configuration
const skins = {
  classic: { name: 'Classic White', color: 0xffffff, metalness: 0.6, roughness: 0.2, emissive: 0x000000, price: 0 },
  neon: { name: 'Cyber Neon', color: 0x00ffff, metalness: 0.2, roughness: 0.1, emissive: 0x004444, price: 15 },
  lava: { name: 'Molten Lava', color: 0xff4500, metalness: 0.4, roughness: 0.3, emissive: 0x660000, price: 30 },
  gold: { name: 'Royal Gold', color: 0xffd700, metalness: 0.9, roughness: 0.1, emissive: 0x443300, price: 50 },
  matrix: { name: 'Dark Matrix', color: 0x00ff00, metalness: 0.8, roughness: 0.2, emissive: 0x003300, price: 100 }
};

let totalCoins = localStorage.getItem('bola_coins') ? Number(localStorage.getItem('bola_coins')) : 0;
let unlockedSkins = localStorage.getItem('bola_unlocked_skins') ? JSON.parse(localStorage.getItem('bola_unlocked_skins')) : ['classic'];
let activeSkin = localStorage.getItem('bola_active_skin') ? localStorage.getItem('bola_active_skin') : 'classic';

// Bola (player)
const ballGeo = new THREE.SphereGeometry(0.8, 32, 32);
const activeSkinConfig = skins[activeSkin];
const ballMat = new THREE.MeshStandardMaterial({
  color: activeSkinConfig.color,
  metalness: activeSkinConfig.metalness,
  roughness: activeSkinConfig.roughness,
  emissive: activeSkinConfig.emissive
});
// add wireframe pattern via second mesh
const ball = new THREE.Mesh(ballGeo, ballMat);
const wire = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({color:0x222222,wireframe:true,transparent:true,opacity:0.45}));
ball.add(wire);
ball.position.set(lanes[currentLane],0.9,0);
scene.add(ball);

// Shield visual
let shieldMesh = null;

// Ground / tracks
const ground = new THREE.Mesh(new THREE.BoxGeometry(8,0.1,200), new THREE.MeshStandardMaterial({color:0x333333}));
ground.position.z = -90;
ground.position.y = 0;
scene.add(ground);

let mapDecorations = [];
let environmentObjects = [];

function applyMapTheme(mapName) {
  activeMap = mapName;
  
  // 1. Clear existing map-specific objects
  mapDecorations.forEach(obj => scene.remove(obj));
  mapDecorations = [];
  environmentObjects.forEach(obj => scene.remove(obj));
  environmentObjects = [];
  
  // 2. Set theme parameters
  if (mapName === 'city') {
    // Synthwave / Neon theme
    scene.background = new THREE.Color(0x0a0216);
    
    // Ambient light - purple/pink tint
    ambient.color.setHex(0x5e2a84);
    ambient.groundColor.setHex(0x0a0216);
    ambient.intensity = 0.8;
    
    // Directional light - cyan highlights
    dir.color.setHex(0x00f0ff);
    dir.intensity = 0.8;
    
    // Ground - neon grid texture
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = 128;
    gridCanvas.height = 128;
    const ctx = gridCanvas.getContext('2d');
    ctx.fillStyle = '#0a0518';
    ctx.fillRect(0, 0, 128, 128);
    // Grid border
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 128, 128);
    
    const gridTex = new THREE.CanvasTexture(gridCanvas);
    gridTex.wrapS = THREE.RepeatWrapping;
    gridTex.wrapT = THREE.RepeatWrapping;
    gridTex.repeat.set(4, 100);
    
    ground.material = new THREE.MeshStandardMaterial({
      map: gridTex,
      roughness: 0.1,
      metalness: 0.1
    });
    
    // Sky Plane (city_bg.png photo background)
    const textureLoader = new THREE.TextureLoader();
    const cityBgTex = textureLoader.load('city_bg.png');
    const skyGeom = new THREE.PlaneGeometry(180, 100);
    const skyMat = new THREE.MeshBasicMaterial({map: cityBgTex, depthWrite: false});
    const sky = new THREE.Mesh(skyGeom, skyMat);
    sky.position.set(0, 32, -185);
    scene.add(sky);
    mapDecorations.push(sky);
    
    // Spawn Neon Light Poles
    for (let z = 0; z >= -180; z -= 30) {
      createNeonPole(-4.8, z, 0x00ffff); // Left: cyan
      createNeonPole(4.8, z, 0xff00ff);  // Right: pink
    }
    
  } else {
    // Stadium / Soccer theme
    scene.background = new THREE.Color(0x78c0e0); // Sky blue
    
    // Ambient light - warm white
    ambient.color.setHex(0xffffff);
    ambient.groundColor.setHex(0x444444);
    ambient.intensity = 0.9;
    
    // Directional light - bright sun
    dir.color.setHex(0xffffff);
    dir.intensity = 0.6;
    
    // Ground - Grass soccer field
    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = 128;
    grassCanvas.height = 256;
    const ctx = grassCanvas.getContext('2d');
    ctx.fillStyle = '#2b8a3e';
    ctx.fillRect(0, 0, 128, 256);
    ctx.fillStyle = '#227030';
    for (let y = 0; y < 256; y += 64) {
      ctx.fillRect(0, y, 128, 32);
    }
    // Lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 0, 120, 256);
    ctx.beginPath();
    ctx.moveTo(64, 0);
    ctx.lineTo(64, 256);
    ctx.stroke();
    
    const grassTex = new THREE.CanvasTexture(grassCanvas);
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(1, 15);
    
    ground.material = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.8,
      metalness: 0.1
    });
    
    // Stadium Sky Plane
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 256;
    const skyCtx = skyCanvas.getContext('2d');
    const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
    skyGrad.addColorStop(0, '#3a86c8');
    skyGrad.addColorStop(1, '#8bc6ec');
    skyCtx.fillStyle = skyGrad;
    skyCtx.fillRect(0, 0, 512, 256);
    // Clouds
    skyCtx.fillStyle = 'rgba(255,255,255,0.6)';
    function drawCloud(cx, cy, r) {
      skyCtx.beginPath();
      skyCtx.arc(cx, cy, r, 0, Math.PI * 2);
      skyCtx.arc(cx - r*0.6, cy + r*0.2, r*0.7, 0, Math.PI * 2);
      skyCtx.arc(cx + r*0.6, cy + r*0.2, r*0.7, 0, Math.PI * 2);
      skyCtx.fill();
    }
    drawCloud(100, 80, 25);
    drawCloud(280, 120, 30);
    drawCloud(420, 90, 22);
    
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const skyGeom = new THREE.PlaneGeometry(180, 100);
    const skyMat = new THREE.MeshBasicMaterial({map: skyTex, depthWrite: false});
    const sky = new THREE.Mesh(skyGeom, skyMat);
    sky.position.set(0, 32, -185);
    scene.add(sky);
    mapDecorations.push(sky);
    
    // Spawn Stadium Light Towers
    for (let z = 0; z >= -180; z -= 50) {
      const side = (z / 50) % 2 === 0 ? -6.5 : 6.5;
      createStadiumTower(side, z);
    }
  }
}

function createNeonPole(x, z, glowColor) {
  const poleGroup = new THREE.Group();
  
  const baseGeom = new THREE.CylinderGeometry(0.3, 0.4, 0.4, 8);
  const baseMat = new THREE.MeshStandardMaterial({color: 0x1a1a1a, roughness: 0.5});
  const base = new THREE.Mesh(baseGeom, baseMat);
  base.position.y = 0.2;
  poleGroup.add(base);
  
  const poleGeom = new THREE.CylinderGeometry(0.08, 0.12, 7.0, 8);
  const poleMat = new THREE.MeshStandardMaterial({color: 0x111111, metalness: 0.8});
  const pole = new THREE.Mesh(poleGeom, poleMat);
  pole.position.y = 3.5;
  poleGroup.add(pole);
  
  const armGeom = new THREE.BoxGeometry(1.2, 0.1, 0.1);
  const arm = new THREE.Mesh(armGeom, poleMat);
  const dirSign = x < 0 ? 1 : -1;
  arm.position.set(dirSign * 0.5, 7.0, 0);
  poleGroup.add(arm);
  
  const lightGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
  const lightMat = new THREE.MeshBasicMaterial({color: glowColor});
  const light = new THREE.Mesh(lightGeom, lightMat);
  light.rotation.x = Math.PI / 2;
  light.position.set(dirSign * 1.0, 6.8, 0);
  poleGroup.add(light);
  
  poleGroup.position.set(x, 0, z);
  scene.add(poleGroup);
  environmentObjects.push(poleGroup);
}

function createStadiumTower(x, z) {
  const tower = new THREE.Group();
  
  const poleGeom = new THREE.CylinderGeometry(0.18, 0.3, 11, 8);
  const poleMat = new THREE.MeshStandardMaterial({color: 0x666666, metalness: 0.7});
  const pole = new THREE.Mesh(poleGeom, poleMat);
  pole.position.y = 5.5;
  tower.add(pole);
  
  const headGeom = new THREE.BoxGeometry(2.4, 1.4, 0.3);
  const headMat = new THREE.MeshStandardMaterial({color: 0x1c2833});
  const head = new THREE.Mesh(headGeom, headMat);
  head.position.set(0, 11, 0);
  tower.add(head);
  
  const bulbGeom = new THREE.SphereGeometry(0.22, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({color: 0xffffff});
  for (let r = -0.35; r <= 0.35; r += 0.7) {
    for (let c = -0.8; c <= 0.8; c += 0.5) {
      const bulb = new THREE.Mesh(bulbGeom, bulbMat);
      bulb.position.set(c, 11 + r, 0.2);
      tower.add(bulb);
    }
  }
  
  tower.position.set(x, 0, z);
  scene.add(tower);
  environmentObjects.push(tower);
}

// Apply initial map theme
applyMapTheme(activeMap);

// Obstacles and items
let obstacles = [];
let items = [];

// Difficulty levels config
const difficultySettings = {
  '1': {
    startSpeed: 0.10,
    maxSpeed: 0.25,
    speedFactor: 0.003,
    spawnRate: 1.4,
    name: 'Level 1 - Easy',
    desc: 'Cocok untuk pemula. Rintangan lambat dan jarang.'
  },
  '2': {
    startSpeed: 0.15,
    maxSpeed: 0.40,
    speedFactor: 0.005,
    spawnRate: 1.0,
    name: 'Level 2 - Normal',
    desc: 'Tantangan seimbang. Kecepatan standar.'
  },
  '3': {
    startSpeed: 0.20,
    maxSpeed: 0.55,
    speedFactor: 0.008,
    spawnRate: 0.75,
    name: 'Level 3 - Hard',
    desc: 'Kecepatan awal lebih cepat dan rintangan lebih sering!'
  },
  '4': {
    startSpeed: 0.25,
    maxSpeed: 0.70,
    speedFactor: 0.012,
    spawnRate: 0.6,
    name: 'Level 4 - Expert',
    desc: 'Sangat cepat! Refleks kilat sangat dibutuhkan.'
  },
  '5': {
    startSpeed: 0.30,
    maxSpeed: 0.90,
    speedFactor: 0.018,
    spawnRate: 0.45,
    name: 'Level 5 - Nightmare',
    desc: 'Kecepatan ekstrem! Mimpi buruk bagi pemain kasual.'
  }
};
let currentLevel = '2';

// Gameplay params
let speed = 0.15; // base speed (world moves toward player)
let baseSpeed = 0.15;
let maxSpeed = 0.45;
let distance = 0;
let score = 0;
let playTime = 0;
let runCoins = 0;
let highscore = localStorage.getItem('bola_high') ? Number(localStorage.getItem('bola_high')):0;

// Finish line variables
let finishLineMesh = null;
let finishSpawned = false;

// Powerup state
let powerState = {speedBoost:false,doubleScore:false,shield:false};
let speedBoostTimer = null;
let doubleScoreTimer = null;
let doubleScoreBlink = null;
let shieldTimer = null;

// UI refs
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const powerupsDiv = document.getElementById('powerups');
const startBtn = document.getElementById('startBtn');
const tutorialBtn = document.getElementById('tutorialBtn');
const mapSelect = document.getElementById('mapSelect');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highscore');
const speedLevelEl = document.getElementById('speedLevel');
const tutorialEl = document.getElementById('tutorial');
const tutorialText = document.getElementById('tutorialText');
const skipTutorial = document.getElementById('skipTutorial');
const gameoverEl = document.getElementById('gameover');
const finalScore = document.getElementById('finalScore');
const gameoverTitle = document.getElementById('gameoverTitle');
const restartBtn = document.getElementById('restartBtn');
const levelSelect = document.getElementById('levelSelect');
const levelDesc = document.getElementById('levelDesc');
const coinCountEl = document.getElementById('coinCount');
const shopBtn = document.getElementById('shopBtn');
const shopPanel = document.getElementById('shopPanel');
const closeShopBtn = document.getElementById('closeShopBtn');
const shopCoinCountEl = document.getElementById('shopCoinCount');
const skinListEl = document.getElementById('skinList');
const menuBtn = document.getElementById('menuBtn');
const exitGameBtn = document.getElementById('exitGameBtn');

highEl.innerText = 'High: '+highscore;

let running = false;
let tutorialMode = false;

// Shop & Skin logic
function updateShopUI() {
  if (shopCoinCountEl) {
    shopCoinCountEl.innerText = totalCoins;
  }
  if (skinListEl) {
    skinListEl.innerHTML = '';
    for (const key in skins) {
      const skin = skins[key];
      const isUnlocked = unlockedSkins.includes(key);
      const isActive = activeSkin === key;
      
      const card = document.createElement('div');
      card.className = 'skin-card' + (isActive ? ' selected' : '');
      
      const info = document.createElement('div');
      info.className = 'skin-info';
      
      const preview = document.createElement('span');
      preview.className = 'skin-preview';
      preview.style.color = '#' + skin.color.toString(16).padStart(6, '0');
      
      const name = document.createElement('span');
      name.innerText = skin.name;
      
      info.appendChild(preview);
      info.appendChild(name);
      card.appendChild(info);
      
      const actionBtn = document.createElement('button');
      if (isActive) {
        actionBtn.className = 'skin-btn active';
        actionBtn.innerText = 'Aktif';
      } else if (isUnlocked) {
        actionBtn.className = 'skin-btn select';
        actionBtn.innerText = 'Pilih';
        actionBtn.addEventListener('click', () => {
          activeSkin = key;
          localStorage.setItem('bola_active_skin', key);
          applyActiveSkin();
          updateShopUI();
        });
      } else {
        actionBtn.className = 'skin-btn buy';
        actionBtn.innerText = 'Beli: ' + skin.price;
        if (totalCoins < skin.price) {
          actionBtn.style.opacity = '0.5';
          actionBtn.style.cursor = 'not-allowed';
        } else {
          actionBtn.addEventListener('click', () => {
            totalCoins -= skin.price;
            unlockedSkins.push(key);
            activeSkin = key;
            localStorage.setItem('bola_coins', totalCoins);
            localStorage.setItem('bola_unlocked_skins', JSON.stringify(unlockedSkins));
            localStorage.setItem('bola_active_skin', key);
            applyActiveSkin();
            updateShopUI();
          });
        }
      }
      card.appendChild(actionBtn);
      skinListEl.appendChild(card);
    }
  }
}

function applyActiveSkin() {
  const skin = skins[activeSkin];
  if (ball && ball.material) {
    ball.material.color.setHex(skin.color);
    ball.material.metalness = skin.metalness;
    ball.material.roughness = skin.roughness;
    if (ball.material.emissive) {
      ball.material.emissive.setHex(skin.emissive);
    }
  }
}

// Toggle Shop Panel
if (shopBtn) {
  shopBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    shopPanel.classList.remove('hidden');
    updateShopUI();
  });
}
if (closeShopBtn) {
  closeShopBtn.addEventListener('click', () => {
    shopPanel.classList.add('hidden');
    menu.classList.remove('hidden');
  });
}

// Initialize Shop UI
updateShopUI();

function onResize(){
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// Input
window.addEventListener('keydown', (e)=>{
  if(!running) return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  if(e.key==='ArrowLeft') moveLeft();
  if(e.key==='ArrowRight') moveRight();
  if(e.key==='ArrowUp' || e.key===' ') jump();
  if(e.key==='ArrowDown') slamDown();
});

function moveLeft(){
  currentLane = Math.max(0, currentLane-1);
  gsMoveBallToLane();
  if(tutorialMode) endTutorial();
}
function moveRight(){
  currentLane = Math.min(2, currentLane+1);
  gsMoveBallToLane();
  if(tutorialMode) endTutorial();
}

function jump(){
  if(!running) return;
  if(!isJumping){
    isJumping = true;
    jumpVelocity = jumpStrength;
  }
  if(tutorialMode) endTutorial();
}

function slamDown(){
  if(running && isJumping){
    jumpVelocity = -35;
  }
}

function gsMoveBallToLane(){
  const targetX = lanes[currentLane];
  // simple smooth
  ball.position.x += (targetX - ball.position.x) * 0.4;
}

// Procedural generation
function spawnObstacle(){
  const laneIdx = Math.floor(Math.random()*3);
  const geom = new THREE.ConeGeometry(0.8, 1.6, 16);
  let mat;
  if (activeMap === 'city') {
    mat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      roughness: 0.1,
      metalness: 0.5
    });
  } else {
    mat = new THREE.MeshStandardMaterial({color:0x8b0000});
  }
  const obs = new THREE.Mesh(geom,mat);
  obs.position.set(lanes[laneIdx],0.8,-80);
  obs.userData = {lane:laneIdx};
  scene.add(obs);
  obstacles.push(obs);
}

function spawnBarrier(){
  const laneIdx = Math.floor(Math.random()*3);
  const group = new THREE.Group();
  
  // Horizontal bar
  const barGeom = new THREE.BoxGeometry(2.4, 0.3, 0.3);
  let barMat, stripeMat;
  if (activeMap === 'city') {
    barMat = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.2});
    stripeMat = new THREE.MeshBasicMaterial({color: 0x00ffff}); // glowing cyan
  } else {
    barMat = new THREE.MeshStandardMaterial({color: 0xd35400, roughness: 0.4}); // Dark Orange
    stripeMat = new THREE.MeshBasicMaterial({color: 0x111111}); // black stripes
  }
  const bar = new THREE.Mesh(barGeom, barMat);
  bar.position.y = 0.8;
  group.add(bar);
  
  // Add stripe meshes for warning visual
  const stripeGeom = new THREE.BoxGeometry(0.3, 0.32, 0.32);
  for(let i = -0.8; i <= 0.8; i += 0.8) {
    const stripe = new THREE.Mesh(stripeGeom, stripeMat);
    stripe.position.set(i, 0.8, 0);
    group.add(stripe);
  }
  
  // Metal legs
  const legGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8);
  const legMat = new THREE.MeshStandardMaterial({color: 0x7f8c8d, metalness: 0.8});
  
  const leftLeg = new THREE.Mesh(legGeom, legMat);
  leftLeg.position.set(-1.1, 0.4, 0);
  group.add(leftLeg);
  
  const rightLeg = new THREE.Mesh(legGeom, legMat);
  rightLeg.position.set(1.1, 0.4, 0);
  group.add(rightLeg);
  
  group.position.set(lanes[laneIdx], 0, -80);
  group.userData = {lane: laneIdx, type: 'barrier'};
  scene.add(group);
  obstacles.push(group);
}

function spawnTripleSpikes(){
  const geom = new THREE.ConeGeometry(0.7, 1.8, 4); // 4-sided cone is a pyramid spike!
  let mat;
  if (activeMap === 'city') {
    mat = new THREE.MeshStandardMaterial({
      color: 0xff0055, 
      emissive: 0x660022, 
      metalness: 0.8, 
      roughness: 0.2
    });
  } else {
    mat = new THREE.MeshStandardMaterial({color: 0xcd3c3c, metalness: 0.8, roughness: 0.3}); // metallic shiny red
  }
  
  for(let i=0; i<3; i++){
    const spike = new THREE.Mesh(geom, mat);
    spike.position.set(lanes[i], 0.9, -80);
    spike.userData = {lane: i, type: 'spike'};
    scene.add(spike);
    obstacles.push(spike);
  }
}

function spawnItem(){
  const laneIdx = Math.floor(Math.random()*3);
  const kind = Math.random() < 0.5 ? 'double' : 'shield';
  const color = kind==='double'?0x9b59b6:0x3498db;
  const geom = new THREE.SphereGeometry(0.5,16,16);
  const mat = new THREE.MeshStandardMaterial({color,emissive:color,transparent:true,opacity:0.95});
  const item = new THREE.Mesh(geom,mat);
  item.position.set(lanes[laneIdx],0.7,-80);
  item.userData = {kind};
  scene.add(item);
  items.push(item);
}

function spawnCoin(){
  const laneIdx = Math.floor(Math.random()*3);
  const count = Math.random() < 0.4 ? 1 : 3;
  const geom = new THREE.TorusGeometry(0.3, 0.08, 8, 24);
  let mat;
  if (activeMap === 'city') {
    mat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      metalness: 0.5,
      roughness: 0.1,
      emissive: 0x008888
    });
  } else {
    mat = new THREE.MeshStandardMaterial({color:0xffd700, metalness: 0.9, roughness: 0.1, emissive: 0x554400});
  }
  
  for(let i=0; i<count; i++){
    const coin = new THREE.Mesh(geom, mat);
    coin.rotation.y = Math.PI / 2;
    coin.position.set(lanes[laneIdx], 0.6, -80 - (i * 3));
    coin.userData = {kind: 'coin'};
    scene.add(coin);
    items.push(coin);
  }
}

function spawnFinishLine(){
  if (finishLineMesh) return;
  
  const group = new THREE.Group();
  
  // 1. Checkered Ground Line
  const finishCanvas = document.createElement('canvas');
  finishCanvas.width = 256;
  finishCanvas.height = 64;
  const ctx = finishCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,256,64);
  ctx.fillStyle = '#000000';
  for(let y=0; y<8; y++){
    for(let x=0; x<32; x++){
      if((x+y)%2 === 0){
        ctx.fillRect(x*8, y*8, 8, 8);
      }
    }
  }
  const finishTex = new THREE.CanvasTexture(finishCanvas);
  const finishGeom = new THREE.PlaneGeometry(8.0, 3.0);
  const finishMat = new THREE.MeshBasicMaterial({map: finishTex, side: THREE.DoubleSide});
  const checker = new THREE.Mesh(finishGeom, finishMat);
  checker.rotation.x = -Math.PI / 2;
  checker.position.y = 0.02;
  group.add(checker);
  
  // 2. Arch Posts
  const postGeom = new THREE.CylinderGeometry(0.12, 0.12, 5.0, 16);
  const postMat = new THREE.MeshStandardMaterial({color: 0xcccccc, metalness: 0.8, roughness: 0.2});
  
  const leftPost = new THREE.Mesh(postGeom, postMat);
  leftPost.position.set(-4.0, 2.5, 0);
  group.add(leftPost);
  
  const rightPost = new THREE.Mesh(postGeom, postMat);
  rightPost.position.set(4.0, 2.5, 0);
  group.add(rightPost);
  
  // 3. Banner Board
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 512;
  bannerCanvas.height = 128;
  const bCtx = bannerCanvas.getContext('2d');
  
  // Yellow background with black borders
  bCtx.fillStyle = '#ffcc00';
  bCtx.fillRect(0, 0, 512, 128);
  bCtx.strokeStyle = '#000000';
  bCtx.lineWidth = 12;
  bCtx.strokeRect(6, 6, 500, 116);
  
  // Text
  bCtx.fillStyle = '#000000';
  bCtx.font = 'bold 72px Impact, Arial, sans-serif';
  bCtx.textAlign = 'center';
  bCtx.textBaseline = 'middle';
  bCtx.fillText('FINISH', 256, 64);
  
  const bannerTex = new THREE.CanvasTexture(bannerCanvas);
  const bannerGeom = new THREE.BoxGeometry(8.0, 1.4, 0.1);
  const bannerMat = new THREE.MeshStandardMaterial({map: bannerTex, roughness: 0.5});
  const banner = new THREE.Mesh(bannerGeom, bannerMat);
  banner.position.set(0, 4.3, 0);
  group.add(banner);
  
  group.position.set(0, 0, -120); // Spawn in the far distance
  scene.add(group);
  finishLineMesh = group;
}

let spawnTimer = 0;

function updateSpawn(dt){
  if(finishSpawned) return; // Stop spawning obstacles in victory lap
  
  spawnTimer += dt;
  const currentSpawnRate = difficultySettings[currentLevel].spawnRate;
  if(spawnTimer > currentSpawnRate){
    spawnTimer = 0;
    const rand = Math.random();
    if(rand < 0.65) {
      const obstacleRand = Math.random();
      const isHardOrAbove = Number(currentLevel) >= 3;
      if (isHardOrAbove) {
        if(obstacleRand < 0.3) {
          spawnBarrier();
        } else if(obstacleRand < 0.6) {
          spawnTripleSpikes();
        } else {
          spawnObstacle();
        }
      } else {
        // Below Level 3 (Easy/Normal): No triple spikes
        if(obstacleRand < 0.4) {
          spawnBarrier();
        } else {
          spawnObstacle();
        }
      }
    } else if(rand < 0.85) {
      spawnCoin();
    } else {
      spawnItem();
    }
  }
}

function checkCollision(){
  const p = new THREE.Vector3();
  ball.getWorldPosition(p);
  const remove = [];
  for(const obs of obstacles){
    const isBarrier = obs.userData && obs.userData.type === 'barrier';
    const isSpike = obs.userData && obs.userData.type === 'spike';
    if(isBarrier){
      if(obs.userData.lane === currentLane){
        const distZ = Math.abs(p.z - obs.position.z);
        if(distZ < 1.5){
          if(p.y < 1.9){
            if(powerState.shield){
              deactivateShield(true, obs);
              remove.push(obs);
            } else {
              gameOver();
            }
          }
        }
      }
    } else if(isSpike){
      if(obs.userData.lane === currentLane){
        const distZ = Math.abs(p.z - obs.position.z);
        if(distZ < 1.2){
          if(p.y < 2.0){
            if(powerState.shield){
              deactivateShield(true, obs);
              // Clean up all three spikes in this row so the player doesn't trigger multiple hits
              const zVal = obs.position.z;
              obstacles.filter(o => o.userData && o.userData.type === 'spike' && Math.abs(o.position.z - zVal) < 0.5)
                       .forEach(o => remove.push(o));
            } else {
              gameOver();
            }
          }
        }
      }
    } else {
      // Normal cone collision
      const d = obs.position.distanceTo(p);
      if(d<1.4){
        if(powerState.shield){
          deactivateShield(true, obs);
          remove.push(obs);
        } else {
          gameOver();
        }
      }
    }
  }
  for(const r of remove) removeObstacle(r);
}

function removeObstacle(o){
  scene.remove(o);
  obstacles = obstacles.filter(x=>x!==o);
}

function removeItem(it){
  scene.remove(it);
  items = items.filter(x=>x!==it);
}

function activateShield(){
  powerState.shield = true;
  // visual
  if(!shieldMesh){
    const g = new THREE.SphereGeometry(1.2,32,32);
    const m = new THREE.MeshBasicMaterial({color:0x66ccff,transparent:true,opacity:0.18});
    shieldMesh = new THREE.Mesh(g,m);
    ball.add(shieldMesh);
  }
  showPowerText('SHIELD ACTIVE');
  
  if(shieldTimer) clearTimeout(shieldTimer);
  shieldTimer = setTimeout(()=>{
    deactivateShield(false);
  }, 6000);
}

function deactivateShield(clearObs, obs){
  powerState.shield = false;
  if(shieldMesh){
    ball.remove(shieldMesh);
    shieldMesh = null;
  }
  if(shieldTimer){
    clearTimeout(shieldTimer);
    shieldTimer = null;
  }
  if(clearObs && obs){
    removeObstacle(obs);
    // brief invulnerability visual
    let t=0; const dur=1.2;
    const id = setInterval(()=>{
      t+=0.1;
      ball.visible = !ball.visible;
      if(t>dur){
        clearInterval(id);
        ball.visible=true;
      }
    },100);
  }
}

function showPowerText(txt){
  powerupsDiv.innerHTML = `<div class='power-tag'>${txt}</div>`;
  powerupsDiv.classList.remove('hidden');
  setTimeout(()=>{powerupsDiv.classList.add('hidden');powerupsDiv.innerHTML='';},1500);
}

function applyItem(kind, it){
  if (kind === 'coin') {
    runCoins += 1;
    totalCoins += 1;
    localStorage.setItem('bola_coins', totalCoins);
    if(coinCountEl) {
      coinCountEl.innerText = 'Coins: ' + runCoins + ' coin';
      coinCountEl.style.transform = 'scale(1.2)';
      setTimeout(() => { coinCountEl.style.transform = 'scale(1)'; }, 100);
    }
  } else if(kind==='speed'){
    powerState.speedBoost = true;
    speed = baseSpeed*2;
    showPowerText('SPEED BOOST');
    if(speedBoostTimer) clearTimeout(speedBoostTimer);
    speedBoostTimer = setTimeout(()=>{powerState.speedBoost=false; speed=baseSpeed; speedBoostTimer=null;},5000);
  } else if(kind==='double'){
    powerState.doubleScore = true;
    showPowerText('2X SCORE');
    if(doubleScoreBlink) clearInterval(doubleScoreBlink);
    doubleScoreBlink = setInterval(()=>{scoreEl.style.visibility = scoreEl.style.visibility==='hidden'?'visible':'hidden';},300);
    if(doubleScoreTimer) clearTimeout(doubleScoreTimer);
    doubleScoreTimer = setTimeout(()=>{powerState.doubleScore=false; clearInterval(doubleScoreBlink); doubleScoreBlink=null; scoreEl.style.visibility='visible'; doubleScoreTimer=null;},5000);
  } else if(kind==='shield'){
    activateShield();
  }
  removeItem(it);
}

function update(dt){
  if(!running) return;

  const settings = difficultySettings[currentLevel];
  // Increment play time and gradually increase baseSpeed based on playTime (the longer you play, the faster the speed)
  if (!tutorialMode) {
    playTime += dt;
    baseSpeed = Math.min(settings.startSpeed + playTime * settings.speedFactor, settings.maxSpeed);
    speed = powerState.speedBoost ? baseSpeed * 1.8 : baseSpeed;
  } else {
    speed = baseSpeed * 0.15;
  }

  // Update speed level display in HUD
  const speedMultiplier = (speed / settings.startSpeed).toFixed(1);
  if(speedLevelEl){
    speedLevelEl.innerText = 'Speed: ' + speedMultiplier + 'x';
    if(powerState.speedBoost){
      speedLevelEl.style.color = '#ffd700'; // Gold
    } else {
      speedLevelEl.style.color = '#00d2ff'; // Cyan
    }
  }

  // move world toward player
  const move = speed * dt * 60;
  distance += move;
  
  // Move environment objects
  for (const env of environmentObjects) {
    env.position.z += move;
    if (env.position.z > 20) {
      env.position.z -= 200; // loop back to the far distance
    }
  }

  // Scroll ground texture
  if (ground.material && ground.material.map) {
    const repeatY = activeMap === 'city' ? 100 : 15;
    ground.material.map.offset.y += (move / 200) * repeatY;
    ground.material.map.offset.y %= 1;
  }

  if (finishSpawned) {
    score = 7000;
  } else {
    score = Math.floor(distance);
    if(powerState.doubleScore) score *= 2;
    if(score >= 7000){
      score = 7000;
      finishSpawned = true;
      spawnFinishLine();
    }
  }
  scoreEl.innerText = 'Score: '+score;
  if(score>highscore) { highscore=score; localStorage.setItem('bola_high', highscore); highEl.innerText='High: '+highscore }

  for(const obs of obstacles){
    obs.position.z += move;
  }
  for(const it of items){
    it.position.z += move;
    if (it.userData && it.userData.kind === 'coin') {
      it.rotation.z += 0.05; // Spin the coin torus!
    }
  }
  // remove past obstacles
  obstacles.filter(o=>o.position.z>20).forEach(o=>removeObstacle(o));
  items.filter(i=>i.position.z>20).forEach(i=>removeItem(i));

  // collision checks
  checkCollision();

  // pickup items
  for(const it of [...items]){
    if(it.position.distanceTo(ball.position)<1.2){
      applyItem(it.userData.kind, it);
    }
  }

  updateSpawn( dt );

  // subtle ball rotation
  ball.rotation.x += 0.12 + (powerState.speedBoost?0.14:0);
  gsMoveBallToLane();

  if(isJumping){
    jumpVelocity += gravity * dt;
    ball.position.y += jumpVelocity * dt;
    if(ball.position.y <= 0.9){
      ball.position.y = 0.9;
      isJumping = false;
      jumpVelocity = 0;
    }
  }
  if(finishLineMesh){
    finishLineMesh.position.z += move;
    if(finishLineMesh.position.z >= ball.position.z){
      triggerWin();
    }
  }
}

let lastTime = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if(dt > 0.1) dt = 0.1; // cap dt to avoid huge jumps on lag
  update(dt);
  renderer.render(scene,camera);
}

// Simple start/stop
startBtn.addEventListener('click', ()=>{ startGame(false); });
tutorialBtn.addEventListener('click', ()=>{ startGame(true); });
mapSelect.addEventListener('change', ()=>{ applyMapTheme(mapSelect.value); });
restartBtn.addEventListener('click', ()=>{ resetGame(); startGame(false); });
skipTutorial.addEventListener('click', ()=>{ endTutorial(true); });
if(menuBtn) {
  menuBtn.addEventListener('click', ()=>{ resetGame(); });
}
if(exitGameBtn) {
  exitGameBtn.addEventListener('click', ()=>{ resetGame(); });
}

// Handle level change to update description
if(levelSelect){
  levelSelect.addEventListener('change', () => {
    currentLevel = levelSelect.value;
    if(levelDesc) {
      levelDesc.innerText = difficultySettings[currentLevel].desc;
    }
  });
}

function startGame(isTutorial){
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  
  // Set initial speed based on level settings
  const settings = difficultySettings[currentLevel];
  baseSpeed = settings.startSpeed;
  maxSpeed = settings.maxSpeed;
  
  running = true; tutorialMode = !!isTutorial;
  if(tutorialMode){
    tutorialEl.classList.remove('hidden');
    // slow motion
    speed = baseSpeed * 0.15;
    tutorialText.innerText = 'Tekan ArrowRight/ArrowLeft pindah jalur. ArrowUp untuk lompat.';
  } else { tutorialEl.classList.add('hidden'); speed = baseSpeed }
  // Reset lastTime to prevent lag spike jump on start
  lastTime = performance.now();
}

function endTutorial(skip=false){
  tutorialMode=false; tutorialEl.classList.add('hidden');
  speed = baseSpeed; // resume normal
}

function gameOver(){
  running = false;
  if(gameoverTitle){
    gameoverTitle.innerText = 'Game Over';
    gameoverTitle.style.color = '#ff4a4a';
    gameoverTitle.style.textShadow = '0 0 10px #ff4a4a';
  }
  if(finalScore){
    finalScore.innerHTML = `Score Akhir: <strong>${score}</strong>`;
  }
  gameoverEl.classList.remove('hidden');
}

function triggerWin(){
  running = false;
  if(gameoverTitle){
    gameoverTitle.innerText = 'VICTORY!';
    gameoverTitle.style.color = '#ffd700';
    gameoverTitle.style.textShadow = '0 0 15px #ffd700';
  }
  if(finalScore){
    finalScore.innerHTML = `Selamat! Anda berhasil mencapai garis FINISH!<br>Score Akhir: <strong>${score}</strong>`;
  }
  if(score > highscore){
    highscore = score;
    localStorage.setItem('bola_high', highscore);
    if(highEl) highEl.innerText = 'High: ' + highscore;
  }
  gameoverEl.classList.remove('hidden');
}

function resetGame(){
  running = false;
  // cleanup
  obstacles.forEach(o=>scene.remove(o)); obstacles=[];
  items.forEach(i=>scene.remove(i)); items=[];
  if(finishLineMesh){
    scene.remove(finishLineMesh);
    finishLineMesh = null;
  }
  finishSpawned = false;
  
  distance=0; score=0; highscore = Number(localStorage.getItem('bola_high')||0);
  scoreEl.innerText='Score: 0'; highEl.innerText='High: '+highscore;
  ball.position.set(0,0.9,0); currentLane=1;
  applyActiveSkin();
  if(shieldMesh){ ball.remove(shieldMesh); shieldMesh=null; }
  
  // Reset power states, speed, coins and play time
  powerState = {speedBoost:false,doubleScore:false,shield:false};
  const settings = difficultySettings[currentLevel];
  baseSpeed = settings.startSpeed;
  maxSpeed = settings.maxSpeed;
  speed = settings.startSpeed;
  playTime = 0;
  runCoins = 0;
  if(coinCountEl) {
    coinCountEl.innerText = 'Coins: 0 coin';
  }
  if(speedLevelEl){
    speedLevelEl.innerText = 'Speed: 1.0x';
    speedLevelEl.style.color = '#fff';
  }
  
  // Clear any active powerup timers
  if(speedBoostTimer) { clearTimeout(speedBoostTimer); speedBoostTimer = null; }
  if(doubleScoreTimer) { clearTimeout(doubleScoreTimer); doubleScoreTimer = null; }
  if(doubleScoreBlink) { clearInterval(doubleScoreBlink); doubleScoreBlink = null; }
  if(shieldTimer) { clearTimeout(shieldTimer); shieldTimer = null; }
  scoreEl.style.visibility = 'visible';

  // Reset environment elements to starting positions
  applyMapTheme(activeMap);

  gameoverEl.classList.add('hidden'); menu.classList.remove('hidden'); hud.classList.add('hidden');
}

animate();

// touch / click for mobile: left/right halves
window.addEventListener('touchstart',(e)=>{
  if(!running) return;
  const x = e.touches[0].clientX;
  const y = e.touches[0].clientY;
  if(y < innerHeight/2) jump();
  else if(x < innerWidth/2) moveLeft(); else moveRight();
});

// simple pointer controls for desktops
window.addEventListener('mousedown',(e)=>{ 
  if(!running) return;
  if(e.clientY < innerHeight/2) jump();
  else if(e.clientX < innerWidth/2) moveLeft(); else moveRight(); 
});

