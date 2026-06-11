import os
import json

PROJECT_NAME = "game-bola-runner"

INDEX_HTML = '''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bola Runner</title>
  <link rel="stylesheet" href="style.css">
  <script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
  <script src="https://unpkg.com/three@0.160.0/examples/js/controls/OrbitControls.js"></script>
</head>
<body>
  <div id="ui">
    <div id="menu" class="overlay center">
      <h1>BOLA RUNNER</h1>
      <div class="row">
        <label for="mapSelect">Pilih Map:</label>
        <select id="mapSelect">
          <option value="stadium">Stadion Sepak Bola</option>
          <option value="city">Jalanan Kota</option>
        </select>
      </div>
      <div class="row">
        <button id="startBtn">Start Game</button>
        <button id="tutorialBtn">Tutorial</button>
      </div>
      <div class="row small">Tip: Gunakan ArrowLeft / ArrowRight untuk pindah jalur.</div>
    </div>

    <div id="hud" class="overlay top-left hidden">
      <div id="score">Score: 0</div>
      <div id="highscore">High: 0</div>
    </div>

    <div id="powerups" class="overlay top-right hidden"></div>

    <div id="tutorial" class="overlay center hidden">
      <div id="tutorialText">Tekan ArrowRight untuk pindah ke jalur kanan</div>
      <button id="skipTutorial">Skip</button>
    </div>

    <div id="gameover" class="overlay center hidden">
      <h2>Game Over</h2>
      <div id="finalScore">Score: 0</div>
      <button id="restartBtn">Restart</button>
    </div>
  </div>

  <canvas id="gameCanvas"></canvas>

  <script src="game.js"></script>
</body>
</html>
'''

STYLE_CSS = '''*{box-sizing:border-box;margin:0;padding:0;font-family:Inter,system-ui,Arial}
html,body,#gameCanvas{width:100%;height:100%;}
body{overflow:hidden;background:#000}
#gameCanvas{display:block}
.overlay{position:fixed;z-index:10;color:#fff}
.center{left:50%;top:50%;transform:translate(-50%,-50%);text-align:center}
.top-left{left:10px;top:10px}
.top-right{right:10px;top:10px}
.hidden{display:none}
#menu{background:rgba(0,0,0,0.6);padding:24px;border-radius:12px;width:min(420px,90vw)}
#menu h1{font-size:28px;margin-bottom:12px}
.row{margin:8px 0}
button{padding:10px 16px;border-radius:8px;border:none;background:#1e90ff;color:#fff;cursor:pointer}
select{padding:8px;border-radius:6px}
#hud{gap:8px;display:flex;flex-direction:column;background:rgba(0,0,0,0.3);padding:8px;border-radius:8px}
#powerups{display:flex;gap:8px}
#tutorial,#gameover{background:rgba(0,0,0,0.7);padding:18px;border-radius:10px}
#score,#highscore{font-weight:600}
.power-tag{background:rgba(255,255,255,0.08);padding:6px 10px;border-radius:8px}
@media(max-width:600px){#menu{width:92vw}}'''

GAME_JS = '''// Three.js Bola Runner - Vanilla JS
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();

let bgColors = {stadium:0x2b8a3e, city:0x999999};
scene.background = new THREE.Color(bgColors.stadium);

const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
camera.position.set(0,6,12);

const ambient = new THREE.HemisphereLight(0xffffff,0x444444,0.9);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff,0.6);
dir.position.set(5,10,7);
scene.add(dir);

const lanes = [-2.5,0,2.5];
let currentLane = 1;

// Bola (player)
const ballGeo = new THREE.SphereGeometry(0.8, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({color:0xffffff,metalness:0.6,roughness:0.2});
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

// Obstacles and items
let obstacles = [];
let items = [];

// Gameplay params
let speed = 0.2; // base speed (world moves toward player)
let baseSpeed = 0.2;
let distance = 0;
let score = 0;
let highscore = localStorage.getItem('bola_high') ? Number(localStorage.getItem('bola_high')):0;

// Powerup state
let powerState = {speedBoost:false,doubleScore:false,shield:false};

// UI refs
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const powerupsDiv = document.getElementById('powerups');
const startBtn = document.getElementById('startBtn');
const tutorialBtn = document.getElementById('tutorialBtn');
const mapSelect = document.getElementById('mapSelect');
const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highscore');
const tutorialEl = document.getElementById('tutorial');
const tutorialText = document.getElementById('tutorialText');
const skipTutorial = document.getElementById('skipTutorial');
const gameoverEl = document.getElementById('gameover');
const finalScore = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

highEl.innerText = 'High: '+highscore;

let running = false;
let tutorialMode = false;

function onResize(){
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// Input
window.addEventListener('keydown', (e)=>{
  if(!running && e.key==='ArrowLeft') return;
  if(e.key==='ArrowLeft') moveLeft();
  if(e.key==='ArrowRight') moveRight();
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

function gsMoveBallToLane(){
  const targetX = lanes[currentLane];
  // simple smooth
  ball.position.x += (targetX - ball.position.x) * 0.4;
}

// Procedural generation
function spawnObstacle(){
  const laneIdx = Math.floor(Math.random()*3);
  const geom = new THREE.BoxGeometry(1.6,1.6,1.6);
  const mat = new THREE.MeshStandardMaterial({color:0x8b0000});
  const obs = new THREE.Mesh(geom,mat);
  obs.position.set(lanes[laneIdx],0.8,-80);
  obs.userData = {lane:laneIdx};
  scene.add(obs);
  obstacles.push(obs);
}

function spawnItem(){
  const laneIdx = Math.floor(Math.random()*3);
  const t = Math.random();
  const kind = t<0.33? 'speed' : (t<0.66? 'double':'shield');
  const color = kind==='speed'?0xffd700:(kind==='double'?0x9b59b6:0x3498db);
  const geom = new THREE.SphereGeometry(0.5,16,16);
  const mat = new THREE.MeshStandardMaterial({color,emissive:color,transparent:true,opacity:0.95});
  const item = new THREE.Mesh(geom,mat);
  item.position.set(lanes[laneIdx],0.7,-80);
  item.userData = {kind};
  scene.add(item);
  items.push(item);
}

let spawnTimer = 0;

function updateSpawn(dt){
  spawnTimer += dt;
  if(spawnTimer>1.0){
    spawnTimer = 0;
    if(Math.random()<0.7) spawnObstacle();
    if(Math.random()<0.25) spawnItem();
  }
}

function checkCollision(){
  const p = new THREE.Vector3();
  ball.getWorldPosition(p);
  const remove = [];
  for(const obs of obstacles){
    const d = obs.position.distanceTo(p);
    if(d<1.4){
      if(powerState.shield){
        // consume shield
        deactivateShield(true, obs);
        remove.push(obs);
      } else {
        gameOver();
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
}

function deactivateShield(clearObs, obs){
  powerState.shield = false;
  if(shieldMesh){
    ball.remove(shieldMesh);
    shieldMesh = null;
  }
  if(clearObs && obs){
    removeObstacle(obs);
  }
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

function showPowerText(txt){
  powerupsDiv.innerHTML = `<div class='power-tag'>${txt}</div>`;
  powerupsDiv.classList.remove('hidden');
  setTimeout(()=>{powerupsDiv.classList.add('hidden');powerupsDiv.innerHTML='';},1500);
}

function applyItem(kind, it){
  if(kind==='speed'){
    powerState.speedBoost = true;
    speed = baseSpeed*2;
    showPowerText('SPEED BOOST');
    setTimeout(()=>{powerState.speedBoost=false; speed=baseSpeed;},5000);
  } else if(kind==='double'){
    powerState.doubleScore = true;
    showPowerText('2X SCORE');
    const blink = setInterval(()=>{scoreEl.style.visibility = scoreEl.style.visibility==='hidden'?'visible':'hidden';},300);
    setTimeout(()=>{powerState.doubleScore=false; clearInterval(blink); scoreEl.style.visibility='visible';},5000);
  } else if(kind==='shield'){
    activateShield();
  }
  removeItem(it);
}

function update(dt){
  if(!running) return;
  // move world toward player
  const move = speed * dt * 60;
  distance += move;
  score = Math.floor(distance*10);
  if(powerState.doubleScore) score *= 2;
  scoreEl.innerText = 'Score: '+score;
  if(score>highscore) { highscore=score; localStorage.setItem('bola_high', highscore); highEl.innerText='High: '+highscore }

  for(const obs of obstacles){
    obs.position.z += move;
  }
  for(const it of items){
    it.position.z += move;
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
}

function animate(){
  requestAnimationFrame(animate);
  update(0.016);
  renderer.render(scene,camera);
}

// Simple start/stop
startBtn.addEventListener('click', ()=>{ startGame(false); });
tutorialBtn.addEventListener('click', ()=>{ startGame(true); });
mapSelect.addEventListener('change', ()=>{ scene.background.set(bgColors[mapSelect.value]); });
restartBtn.addEventListener('click', ()=>{ resetGame(); startGame(false); });
skipTutorial.addEventListener('click', ()=>{ endTutorial(true); });

function startGame(isTutorial){
  menu.classList.add('hidden');
  hud.classList.remove('hidden');
  running = true; tutorialMode = !!isTutorial;
  if(tutorialMode){
    tutorialEl.classList.remove('hidden');
    // slow motion
    speed = baseSpeed * 0.15;
    tutorialText.innerText = 'Tekan ArrowRight atau ArrowLeft untuk pindah jalur.';
  } else { tutorialEl.classList.add('hidden'); speed = baseSpeed }
  animate();
}

function endTutorial(skip=false){
  tutorialMode=false; tutorialEl.classList.add('hidden');
  speed = baseSpeed; // resume normal
}

function gameOver(){
  running = false; gameoverEl.classList.remove('hidden'); finalScore.innerText = 'Score: '+score;
}

function resetGame(){
  // cleanup
  obstacles.forEach(o=>scene.remove(o)); obstacles=[];
  items.forEach(i=>scene.remove(i)); items=[];
  distance=0; score=0; highscore = Number(localStorage.getItem('bola_high')||0);
  scoreEl.innerText='Score: 0'; highEl.innerText='High: '+highscore;
  ball.position.set(0,0.9,0); currentLane=1;
  if(shieldMesh){ ball.remove(shieldMesh); shieldMesh=null; powerState.shield=false }
  gameoverEl.classList.add('hidden'); menu.classList.remove('hidden'); hud.classList.add('hidden');
}

// Initial spawn loop via time
setInterval(()=>{ if(running) {
  if(Math.random()<0.6) spawnObstacle(); if(Math.random()<0.25) spawnItem(); } },900);

animate();

// touch / click for mobile: left/right halves
window.addEventListener('touchstart',(e)=>{
  const x = e.touches[0].clientX;
  if(x < innerWidth/2) moveLeft(); else moveRight();
});

// simple pointer controls for desktops
window.addEventListener('mousedown',(e)=>{ if(e.clientX < innerWidth/2) moveLeft(); else moveRight(); });

'''

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def main():
    root = os.path.join(os.getcwd(), PROJECT_NAME)
    print(f"Creating project at: {root}")
    os.makedirs(root, exist_ok=True)
    files = {
        'index.html': INDEX_HTML,
        'style.css': STYLE_CSS,
        'game.js': GAME_JS
    }
    for name, content in files.items():
        p = os.path.join(root, name)
        write_file(p, content)
        print(f"Wrote {p}")
    print('Done. Run: open the folder and open index.html in a browser.')

if __name__ == '__main__':
    main()
