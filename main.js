// =========================================================
// TEMPEST — Gesture-Controlled 3D Challenge
// SATTVA '27 · TECHNICALS
// Core Game Engine: Three.js WebGL & MediaPipe Hands
// =========================================================

const G = { playing: false, speed: 0, base: 0.48, score: 0, coins: 0, combo: 0, bestCombo: 0, dist: 0 };
const LANES = [-6, 0, 6];
let targetLane = 1, isJump = false, isSlide = false, jumpV = 0, handOn = false;
let playerModel = null, mixer = null, runAction = null, idleAction = null, clock = new THREE.Clock();

// SCENE
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x121d3a, 0.016);
scene.background = new THREE.Color(0x121d3a);

// CAMERA
const cam = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1000);
cam.position.set(0, 5, -10);
cam.lookAt(0, 2, 10);

// RENDERER (AAA settings)
const ren = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
ren.setSize(innerWidth, innerHeight);
ren.setPixelRatio(Math.min(devicePixelRatio, 2));
ren.shadowMap.enabled = true;
ren.shadowMap.type = THREE.PCFSoftShadowMap;
ren.outputEncoding = THREE.sRGBEncoding;
ren.toneMapping = THREE.ACESFilmicToneMapping;
ren.toneMappingExposure = 0.95;
ren.physicallyCorrectLights = true;
document.getElementById('game-container').appendChild(ren.domElement);

// LIGHTS
scene.add(new THREE.AmbientLight(0x283854, 3.5));
const torch = new THREE.SpotLight(0xffaa44, 28, 120, Math.PI / 6.5, 1.0, 1.2);
torch.position.set(0, 3.5, 1.5);
torch.castShadow = true;
torch.shadow.mapSize.set(1024, 1024);
torch.shadow.bias = -0.001;
const torchTarget = new THREE.Object3D();
torchTarget.position.set(0, 0, 30);
torch.target = torchTarget;

const moon = new THREE.DirectionalLight(0x6080dd, 2.5);
moon.position.set(-20, 40, -30);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
scene.add(moon);

const chaseLight = new THREE.PointLight(0xff0000, 5, 50);
chaseLight.position.set(0, 5, 40);
scene.add(chaseLight);

// TORCHES WITH ACTIVE DYNAMIC FLAME PARTICLES & STANDS
const torchGroups = [];
const flameMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4500,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
});
const flameGeo = new THREE.SphereGeometry(0.18, 4, 4);

for (let i = 0; i < 12; i++) {
    const tg = new THREE.Group();
    const x = i % 2 === 0 ? -10.8 : 10.8;
    const z = -i * 70;
    tg.position.set(x, 0.5, z);
    
    // Wood Torch stand cylinder mesh
    const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 4, 6),
        new THREE.MeshStandardMaterial({ color: 0x1f1107, roughness: 0.9 })
    );
    stand.position.y = 2;
    tg.add(stand);
    
    // Point light inside flame center
    const pl = new THREE.PointLight(0xff7700, 5, 30);
    pl.position.y = 4.2;
    tg.add(pl);
    
    // Active flame sparks particle meshes
    const parts = [];
    for (let p = 0; p < 6; p++) {
        const mesh = new THREE.Mesh(flameGeo, flameMaterial);
        mesh.position.set(
            (Math.random() - 0.5) * 0.15,
            4.2 + Math.random() * 0.8,
            (Math.random() - 0.5) * 0.15
        );
        mesh.userData.speedY = 0.05 + Math.random() * 0.05;
        mesh.userData.baseY = 4.2;
        tg.add(mesh);
        parts.push(mesh);
    }
    tg.userData = { pl, parts, baseIntensity: 5 };
    
    scene.add(tg);
    torchGroups.push(tg);
}

// Backlit Spooky Moon Aura Ring
const moonAuraGeo = new THREE.RingGeometry(8, 12, 32);
const moonAuraMat = new THREE.MeshBasicMaterial({
    color: 0x4466ff,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
});
const moonAura = new THREE.Mesh(moonAuraGeo, moonAuraMat);
moonAura.position.set(-20, 40, -120);
moonAura.lookAt(0, 0, 0);
scene.add(moonAura);

// GROUND & TEXTURES
const textureLoader = new THREE.TextureLoader();
const groundTex = textureLoader.load('assets/ground_texture.png');
groundTex.wrapS = THREE.RepeatWrapping;
groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(2, 120);
groundTex.anisotropy = ren.capabilities.getMaxAnisotropy();

const forestTex = textureLoader.load('assets/ground_texture.png');
forestTex.wrapS = THREE.RepeatWrapping;
forestTex.wrapT = THREE.RepeatWrapping;
forestTex.repeat.set(30, 120);
forestTex.anisotropy = ren.capabilities.getMaxAnisotropy();

const gnd = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 1200),
    new THREE.MeshStandardMaterial({ map: forestTex, color: 0x331100, emissive: 0xff2200, emissiveIntensity: 0.35, roughness: 0.95 })
);
gnd.rotation.x = -Math.PI / 2;
gnd.position.set(0, 0, 400);
gnd.receiveShadow = true;
scene.add(gnd);

// PATH
const pth = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 1200),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.6, metalness: 0.2 })
);
pth.rotation.x = -Math.PI / 2;
pth.position.set(0, 0.06, 400);
pth.receiveShadow = true;
scene.add(pth);

// Path edges (Glowing Red Ancient Runes)
const edgeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.5 });
[-10, 10].forEach(x => {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1200), edgeMat);
    e.rotation.x = -Math.PI / 2;
    e.position.set(x, 0.08, 400);
    scene.add(e);
});

// TREES
const trees = [];
function mkTree(x, z) {
    const g = new THREE.Group();
    const tk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.9, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x1a0e08, roughness: 0.9 })
    );
    tk.position.y = 4;
    tk.castShadow = true;
    g.add(tk);
    for (let i = 0; i < 3; i++) {
        const s = 3.5 - i * 0.9;
        const lv = new THREE.Mesh(
            new THREE.ConeGeometry(s, 6, 7),
            new THREE.MeshStandardMaterial({ color: 0x041a04 + i * 0x010100, roughness: 0.8 })
        );
        lv.position.y = 10 + i * 3.5;
        lv.castShadow = true;
        g.add(lv);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    trees.push(g);
}
for (let i = 0; i < 10; i++) {
    const s = Math.random() > 0.5 ? 1 : -1;
    mkTree(s * (13 + Math.random() * 60), Math.random() * 900);
}

// ANCIENT RUINED STONE ARCHES (BACKGROUND ARCHITECTURE)
const arches = [];
const archMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.95, metalness: 0.05 });
function createArch(z) {
    const group = new THREE.Group();
    group.position.set(0, 0, z);
    
    // Left Pillar
    const pL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 15, 1.6), archMat);
    pL.position.set(-11, 7.5, 0);
    pL.castShadow = true; pL.receiveShadow = true;
    group.add(pL);
    
    // Right Pillar
    const pR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 15, 1.6), archMat);
    pR.position.set(11, 7.5, 0);
    pR.castShadow = true; pR.receiveShadow = true;
    group.add(pR);
    
    // Top Arch Beam spanning over the runway
    const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 1.8, 1.8), archMat);
    beam.position.set(0, 15, 0);
    beam.castShadow = true; beam.receiveShadow = true;
    group.add(beam);
    
    scene.add(group);
    arches.push(group);
}
for (let i = 0; i < 6; i++) {
    createArch(-i * 150 - 100);
}

// Mossy Foreground Shrubs along path borders
const foregroundShrubs = [];
const shrubGeo = new THREE.DodecahedronGeometry(0.6, 1);
const shrubMat = new THREE.MeshStandardMaterial({ color: 0x091e09, roughness: 0.95 });
for (let i = 0; i < 15; i++) {
    const s = new THREE.Mesh(shrubGeo, shrubMat);
    const side = Math.random() > 0.5 ? 1 : -1;
    s.position.set(side * (10.5 + Math.random() * 2), 0.2, -i * 50);
    s.scale.set(1 + Math.random(), 0.5 + Math.random(), 1 + Math.random());
    s.castShadow = true; s.receiveShadow = true;
    scene.add(s);
    foregroundShrubs.push(s);
}

// OBSTACLES
const obs = [];
const obsMats = [
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.8, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ map: groundTex, color: 0x8b5a2b, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: groundTex, color: 0xff8888, roughness: 0.6, emissive: 0x441111, emissiveIntensity: 0.6 })
];
function mkObs(z) {
    const type = Math.floor(Math.random() * 3);
    const group = new THREE.Group();
    
    if (type === 0) {
        // Gnarled Tree Root Obstacle (Jump over!)
        const root1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 5, 8), obsMats[1]);
        root1.rotation.z = Math.PI / 2;
        root1.position.set(0, 0.5, 0);
        root1.castShadow = true; root1.receiveShadow = true;
        group.add(root1);
        
        const root2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 8), obsMats[1]);
        root2.rotation.set(0.3, 0.5, Math.PI / 4);
        root2.position.set(1.6, 0.8, -0.5);
        root2.castShadow = true; root2.receiveShadow = true;
        group.add(root2);
    } else if (type === 1) {
        // Creepy Tree Branch Obstacle (Slide under!)
        const mainBranch = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 6, 8), obsMats[1]);
        mainBranch.rotation.z = Math.PI / 2 - 0.2;
        mainBranch.position.set(0, 4.2, 0);
        mainBranch.castShadow = true; mainBranch.receiveShadow = true;
        group.add(mainBranch);
        
        const twig1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 6), obsMats[1]);
        twig1.rotation.set(0.5, 0, 0.4);
        twig1.position.set(-1.8, 3.2, 0.5);
        twig1.castShadow = true; twig1.receiveShadow = true;
        group.add(twig1);

        const twig2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.8, 6), obsMats[1]);
        twig2.rotation.set(-0.3, 0, -0.6);
        twig2.position.set(1.8, 3.0, -0.4);
        twig2.castShadow = true; twig2.receiveShadow = true;
        group.add(twig2);
    } else {
        // Gnarled Tree Stump with Glowing Spikes (Lane Switch!)
        const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 5, 8), obsMats[2]);
        stump.position.set(0, 2.5, 0);
        stump.castShadow = true; stump.receiveShadow = true;
        group.add(stump);
        
        const branchOut1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 6), obsMats[2]);
        branchOut1.rotation.set(0.8, 0, 1.2);
        branchOut1.position.set(1.2, 3.5, 0);
        branchOut1.castShadow = true; branchOut1.receiveShadow = true;
        group.add(branchOut1);

        const branchOut2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.5, 6), obsMats[2]);
        branchOut2.rotation.set(-0.8, 0.5, -1.2);
        branchOut2.position.set(-1.2, 2.8, 0);
        branchOut2.castShadow = true; branchOut2.receiveShadow = true;
        group.add(branchOut2);

        const fl = new THREE.PointLight(0xff4400, 3, 15);
        fl.position.set(0, 3, 0);
        group.add(fl);
    }
    group.userData = { type, lane: Math.floor(Math.random() * 3), nm: false };
    group.position.set(LANES[group.userData.lane], 0, z);
    scene.add(group);
    obs.push(group);
}
for (let i = 0; i < 20; i++) mkObs(80 + i * 50 + Math.random() * 30);

// COINS / RELICS
const coins = [];
const coinGeo = new THREE.TorusGeometry(0.6, 0.2, 8, 16);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x554400, metalness: 0.9, roughness: 0.2 });
function mkCoin(z) {
    const c = new THREE.Mesh(coinGeo, coinMat);
    c.userData.lane = Math.floor(Math.random() * 3);
    c.position.set(LANES[c.userData.lane], 3, z);
    scene.add(c);
    coins.push(c);
}
for (let i = 0; i < 30; i++) mkCoin(60 + i * 35 + Math.random() * 20);

// CHASE MONSTER
const monG = new THREE.Group();
const monBody = new THREE.Mesh(
    new THREE.SphereGeometry(3, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0x220000, emissiveIntensity: 1, roughness: 0.3 })
);
monBody.position.y = 4;
monG.add(monBody);
[[-1.2, 5, 2.5], [1.2, 5, 2.5]].forEach(p => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    eye.position.set(...p);
    monG.add(eye);
    const gl = new THREE.PointLight(0xff0000, 2, 12);
    gl.position.set(...p);
    monG.add(gl);
});
monG.position.set(0, 0, -15);
scene.add(monG);

// PARTICLES (Hot Blazing Lava Embers)
const pCnt = 400;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(pCnt * 3);
for (let i = 0; i < pCnt; i++) {
    pPos[i * 3] = Math.random() * 80 - 40;
    pPos[i * 3 + 1] = Math.random() * 25 + 1;
    pPos[i * 3 + 2] = Math.random() * 100;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xff3a00, size: 0.25, transparent: true, opacity: 0.65 }));
scene.add(parts);

// CELESTIAL SKY STARS (Atmospheric high-altitude starry sky)
const starCnt = 500;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(starCnt * 3);
for (let i = 0; i < starCnt; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 500;
    starPos[i * 3 + 1] = 18 + Math.random() * 90;
    starPos[i * 3 + 2] = Math.random() * 450 - 50;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaaccff, size: 0.6, transparent: true, opacity: 0.65 }));
scene.add(stars);

// LOAD REALISTIC CHARACTER (Local first with fallback)
const gltfLoader = new THREE.GLTFLoader();
const playerGroup = new THREE.Group();
playerGroup.position.set(0, 0, 5);
scene.add(playerGroup);
playerGroup.add(torch);
playerGroup.add(torchTarget);

// Fallback geometric adventurer while model loads
const phBody = new THREE.Mesh(
    THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.5, 1.5, 4, 8) : new THREE.CylinderGeometry(0.5, 0.5, 2.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.6 })
);
phBody.position.y = 2;
phBody.castShadow = true;
playerGroup.add(phBody);

const phHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xddaa88, roughness: 0.5 })
);
phHead.position.y = 3.8;
phHead.castShadow = true;
playerGroup.add(phHead);

function loadAdventurerModel() {
    const modelSources = ['assets/Soldier.glb', 'https://threejs.org/examples/models/gltf/Soldier.glb'];
    let sourceIdx = 0;
    function tryLoadNext() {
        if (sourceIdx >= modelSources.length) {
            console.warn('All 3D character sources failed, using geometric runner');
            return;
        }
        const src = modelSources[sourceIdx++];
        gltfLoader.load(src,
            (gltf) => {
                playerModel = gltf.scene;
                playerModel.scale.set(2.5, 2.5, 2.5);
                playerModel.rotation.y = Math.PI; // Face forward along runway
                playerModel.traverse(c => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        c.receiveShadow = true;
                        if (c.material) {
                            c.material.color.setHex(0xd2b48c); // Khaki adventurer tint
                            c.material.roughness = 0.8;
                        }
                    }
                });
                playerGroup.remove(phBody);
                playerGroup.remove(phHead);
                playerGroup.add(playerModel);
                mixer = new THREE.AnimationMixer(playerModel);
                gltf.animations.forEach(clip => {
                    if (clip.name.toLowerCase().includes('run') || clip.name.toLowerCase().includes('walk')) {
                        runAction = mixer.clipAction(clip);
                        runAction.play();
                    } else if (clip.name.toLowerCase().includes('idle')) {
                        idleAction = mixer.clipAction(clip);
                    }
                });
                if (!runAction && gltf.animations.length > 0) {
                    runAction = mixer.clipAction(gltf.animations[0]);
                    runAction.play();
                }
                console.log('Character model loaded successfully from:', src);
            },
            undefined,
            (err) => {
                console.warn(`Failed loading model from ${src}, trying fallback...`, err);
                tryLoadNext();
            }
        );
    }
    tryLoadNext();
}
loadAdventurerModel();

// UI REFS
const scoreEl = document.getElementById('score');
const coinsEl = document.getElementById('coins');
const bestScoreEl = document.getElementById('best-score');
const comboEl = document.getElementById('combo-container');
const comboTxt = document.getElementById('combo-text');
const speedBar = document.getElementById('speed-bar');
const gestInd = document.getElementById('gesture-indicator');
const gestTxt = document.getElementById('gesture-text');
const gestIcon = document.getElementById('gesture-icon');
const hud = document.getElementById('hud');
const warnFlash = document.getElementById('warning-flash');
const nearMissEl = document.getElementById('near-miss');
const startScr = document.getElementById('start-screen');
const goScr = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const nextPlayerBtn = document.getElementById('next-player-btn');
const restartBtn = document.getElementById('restart-btn');
const introOvr = document.getElementById('intro-overlay');
const introTxt = document.getElementById('intro-text');
const loadScr = document.getElementById('loading-screen');
const webcamSt = document.getElementById('webcam-status');
const fScore = document.getElementById('final-score');
const fCoins = document.getElementById('final-coins');
const fDist = document.getElementById('final-distance');
const fCombo = document.getElementById('final-best-combo');
const finalBestScoreEl = document.getElementById('final-best-score');

// Leaderboard Elements
const playerNameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const saveStatusMsg = document.getElementById('save-status-msg');
const resultsLbList = document.getElementById('results-leaderboard-list');

// Standalone Modal Elements
const viewLbBtn = document.getElementById('view-leaderboard-btn');
const lbModal = document.getElementById('leaderboard-modal');
const closeLbBtn = document.getElementById('close-leaderboard-btn');
const modalCloseActionBtn = document.getElementById('modal-close-action-btn');
const modalLbList = document.getElementById('modal-leaderboard-list');
const lbModalBackdrop = document.getElementById('leaderboard-modal-backdrop');

// Countdown Elements
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
let isCountingDown = false;

// =========================================================
// LOCAL LEADERBOARD SYSTEM (localStorage)
// =========================================================
const LEADERBOARD_KEY = 'tempest_leaderboard';
const BEST_SCORE_KEY = 'tempest_best_score';

// Purge any previously stored dummy data
try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            const DUMMY_NAMES = ['KABIR', 'AARAV', 'DIYA', 'ROHAN', 'ANANYA', 'VIKRAM', 'MEERA', 'ISHAN', 'NEHA', 'ADITYA'];
            const cleaned = parsed.filter(item => item && item.name && !DUMMY_NAMES.includes(item.name.toUpperCase()));
            localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(cleaned));
        }
    }
    const bestRaw = localStorage.getItem(BEST_SCORE_KEY);
    if (bestRaw === '2840' || bestRaw === 2840) {
        localStorage.removeItem(BEST_SCORE_KEY);
    }
} catch (e) {}

function getLeaderboard() {
    try {
        const raw = localStorage.getItem(LEADERBOARD_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        // Keep only legitimate entries
        const DUMMY_NAMES = ['KABIR', 'AARAV', 'DIYA', 'ROHAN', 'ANANYA', 'VIKRAM', 'MEERA', 'ISHAN', 'NEHA', 'ADITYA'];
        return parsed.filter(item => item && item.name && !DUMMY_NAMES.includes(item.name.toUpperCase()));
    } catch (e) {
        return [];
    }
}

function saveLeaderboard(list) {
    try {
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list || []));
    } catch (e) {}
}

function getBestScore() {
    try {
        const lb = getLeaderboard();
        if (lb && lb.length > 0) return lb[0].score;
        const stored = parseInt(localStorage.getItem(BEST_SCORE_KEY), 10);
        if (!isNaN(stored) && stored > 0 && stored !== 2840) return stored;
        return 0;
    } catch (e) {
        return 0;
    }
}

function updateBestScore(newScore) {
    try {
        const cur = getBestScore();
        if (newScore > cur) {
            localStorage.setItem(BEST_SCORE_KEY, newScore);
            return newScore;
        }
        return cur;
    } catch (e) {
        return newScore;
    }
}

function addScoreToLeaderboard(name, score) {
    const lb = getLeaderboard();
    const cleanName = (name && name.trim()) ? name.trim().toUpperCase() : 'CHALLENGER';
    const entry = {
        name: cleanName.slice(0, 15),
        score: parseInt(score, 10) || 0,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    const top10 = lb.slice(0, 10);
    saveLeaderboard(top10);
    updateBestScore(entry.score);
    return top10;
}

function escapeHTML(str) {
    return String(str || '').replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}

function renderLeaderboardList(containerEl, maxCount = 10) {
    if (!containerEl) return;
    const lb = getLeaderboard();
    const items = lb.slice(0, maxCount);
    containerEl.innerHTML = '';
    
    if (items.length === 0) {
        const emptyBox = document.createElement('div');
        emptyBox.className = 'lb-empty-box';
        emptyBox.innerHTML = `
            <div class="lb-empty-icon">🏆</div>
            <div class="lb-empty-text">NO RUNS RECORDED YET</div>
            <div class="lb-empty-sub">BE THE FIRST CHALLENGER TO SET A RECORD!</div>
        `;
        containerEl.appendChild(emptyBox);
        return;
    }
    
    items.forEach((item, index) => {
        const rank = index + 1;
        const row = document.createElement('div');
        row.className = `lb-row rank-${rank <= 3 ? rank : 'other'}`;
        
        let medal = `${rank}.`;
        if (rank === 1) medal = '🥇';
        else if (rank === 2) medal = '🥈';
        else if (rank === 3) medal = '🥉';
        
        row.innerHTML = `
            <div class="lb-player">
                <span>${medal}</span>
                <span>${escapeHTML(item.name)}</span>
            </div>
            <div class="lb-score">${item.score}</div>
        `;
        containerEl.appendChild(row);
    });
}

function handleSaveScore() {
    if (!saveScoreBtn || saveScoreBtn.disabled) return;
    const name = playerNameInput ? playerNameInput.value : '';
    const finalScore = Math.floor(G.score);
    addScoreToLeaderboard(name, finalScore);
    
    saveScoreBtn.disabled = true;
    saveScoreBtn.textContent = 'SAVED ✓';
    if (playerNameInput) playerNameInput.disabled = true;
    if (saveStatusMsg) saveStatusMsg.classList.remove('hidden');
    
    // Refresh embedded leaderboard
    renderLeaderboardList(resultsLbList, 5);
    
    // Refresh best score displays
    const best = getBestScore();
    if (bestScoreEl) bestScoreEl.textContent = best;
    if (finalBestScoreEl) finalBestScoreEl.textContent = best;
}

if (saveScoreBtn) {
    saveScoreBtn.addEventListener('click', handleSaveScore);
}
if (playerNameInput) {
    playerNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSaveScore();
    });
}

// Modal open/close handlers (Made globally accessible)
function openLeaderboardModal() {
    const modal = document.getElementById('leaderboard-modal');
    const list = document.getElementById('modal-leaderboard-list');
    if (!modal) return;
    renderLeaderboardList(list, 10);
    modal.classList.remove('hidden');
}

function closeLeaderboardModal() {
    const modal = document.getElementById('leaderboard-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

window.openLeaderboardModal = openLeaderboardModal;
window.closeLeaderboardModal = closeLeaderboardModal;

if (viewLbBtn) viewLbBtn.addEventListener('click', (e) => { e.stopPropagation(); openLeaderboardModal(); });
if (closeLbBtn) closeLbBtn.addEventListener('click', (e) => { e.stopPropagation(); closeLeaderboardModal(); });
if (modalCloseActionBtn) modalCloseActionBtn.addEventListener('click', (e) => { e.stopPropagation(); closeLeaderboardModal(); });
if (lbModalBackdrop) lbModalBackdrop.addEventListener('click', (e) => { e.stopPropagation(); closeLeaderboardModal(); });

// Close modal with Escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeLeaderboardModal();
    }
});

// =========================================================
// COUNTDOWN ENGINE (3, 2, 1, RUN)
// =========================================================
function runCountdown(onComplete) {
    if (isCountingDown) return;
    isCountingDown = true;
    countdownOverlay.classList.remove('hidden');
    
    const steps = [
        { text: '3', sound: 'countdown', duration: 750 },
        { text: '2', sound: 'countdown', duration: 750 },
        { text: '1', sound: 'countdown', duration: 750 },
        { text: 'RUN', sound: 'countdown_go', duration: 800 }
    ];
    
    let currentStep = 0;
    
    function showNext() {
        if (currentStep >= steps.length) {
            countdownOverlay.classList.add('hidden');
            isCountingDown = false;
            if (onComplete) onComplete();
            return;
        }
        
        const step = steps[currentStep];
        countdownNumber.textContent = step.text;
        
        // Retrigger pop animation
        countdownNumber.classList.remove('countdown-pop');
        void countdownNumber.offsetWidth;
        countdownNumber.classList.add('countdown-pop');
        
        AudioEngine.play(step.sound);
        if (step.text === 'RUN') {
            triggerScreenShake();
        }
        
        currentStep++;
        setTimeout(showNext, step.duration);
    }
    
    showNext();
}

// =========================================================
// HAND TRACKING & KEYBOARD CONTROLS
// =========================================================
const vidEl = document.getElementById('input_video');
const canvEl = document.getElementById('output_canvas');
const cCtx = canvEl.getContext('2d');

function onResults(r) {
    cCtx.save();
    cCtx.clearRect(0, 0, canvEl.width, canvEl.height);
    cCtx.drawImage(r.image, 0, 0, canvEl.width, canvEl.height);
    if (r.multiHandLandmarks && r.multiHandLandmarks.length > 0) {
        handOn = true;
        const lm = r.multiHandLandmarks[0];
        drawConnectors(cCtx, lm, HAND_CONNECTIONS, { color: '#00ff88', lineWidth: 2 });
        drawLandmarks(cCtx, lm, { color: '#ff2233', lineWidth: 1, radius: 3 });
        
        const hx = lm[0].x;
        if (hx > 0.65) targetLane = 2;
        else if (hx < 0.35) targetLane = 0;
        else targetLane = 1;

        // Detect extension states for each finger: tip above knuckle
        const indexExtended = lm[8].y < lm[6].y;
        const middleExtended = lm[12].y < lm[10].y;
        const ringExtended = lm[16].y < lm[14].y;
        const pinkyExtended = lm[20].y < lm[18].y;

        // Peace Sign (✌️): Index and Middle extended, Ring and Pinky folded
        const isPeace = indexExtended && middleExtended && !ringExtended && !pinkyExtended;

        // Closed Fist (✊): Index, Middle, Ring, Pinky all folded
        const isFist = !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

        if (isPeace && !isJump && playerGroup.position.y < 0.5) {
            isJump = true;
            jumpV = 0.70;
            AudioEngine.play('jump');
            gestIcon.textContent = '✌️';
            gestTxt.textContent = 'JUMP!';
        } else if (isFist && !isSlide && !isJump) {
            isSlide = true;
            setTimeout(() => { isSlide = false; }, 600);
            AudioEngine.play('slide');
            gestIcon.textContent = '✊';
            gestTxt.textContent = 'SLIDE!';
        } else if (!isJump && !isSlide) {
            if (hx > 0.65) {
                gestIcon.textContent = '➡️';
                gestTxt.textContent = 'RIGHT';
            } else if (hx < 0.35) {
                gestIcon.textContent = '⬅️';
                gestTxt.textContent = 'LEFT';
            } else {
                gestIcon.textContent = '✋';
                gestTxt.textContent = 'CENTER';
            }
        }
        webcamSt.textContent = 'Hand Detected ✅';
        webcamSt.style.color = '#00ff88';
    } else {
        handOn = false;
        if (keyboardMode) {
            webcamSt.textContent = 'Keyboard Active ⌨️';
            webcamSt.style.color = '#e8c56c';
        } else {
            webcamSt.textContent = 'No Hand ❌';
            webcamSt.style.color = '#ff4500';
            gestIcon.textContent = '❌';
            gestTxt.textContent = 'Show Hand or Press Keys!';
        }
    }
    cCtx.restore();
}

// MediaPipe Hands (Local WASM/Assets first when served over HTTP, with CDN fallback)
const hands = new Hands({
    locateFile: (f) => {
        return location.protocol.startsWith('http') ? `libs/mediapipe/${f}` : `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`;
    }
});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
hands.onResults(onResults);

// KEYBOARD CONTROLS (Full fallback & alternative input)
let keyboardMode = false;
window.addEventListener('keydown', (e) => {
    keyboardMode = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        if (targetLane > 0) targetLane--;
        gestIcon.textContent = '⬅️';
        gestTxt.textContent = 'LEFT (KEY)';
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        if (targetLane < 2) targetLane++;
        gestIcon.textContent = '➡️';
        gestTxt.textContent = 'RIGHT (KEY)';
    } else if ((e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') && !isJump && playerGroup.position.y < 0.5) {
        isJump = true;
        jumpV = 0.70;
        AudioEngine.play('jump');
        gestIcon.textContent = '✌️';
        gestTxt.textContent = 'JUMP! (KEY)';
    } else if ((e.code === 'ArrowDown' || e.code === 'KeyS') && !isSlide && !isJump) {
        isSlide = true;
        setTimeout(() => { isSlide = false; }, 600);
        AudioEngine.play('slide');
        gestIcon.textContent = '✊';
        gestTxt.textContent = 'SLIDE! (KEY)';
    }
});

const camSelect = document.getElementById('camera-select');
let activeStream = null;
let cameraUnavailable = false;
let isProcessingFrame = false;

async function startCameraStream(deviceId, existingStream = null) {
    try {
        if (existingStream) {
            activeStream = existingStream;
        } else {
            if (activeStream) {
                activeStream.getTracks().forEach(track => track.stop());
            }
            const constraints = {
                video: deviceId 
                    ? { deviceId: { ideal: deviceId }, width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } 
                    : { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
            };
            activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        }

        vidEl.muted = true;
        vidEl.setAttribute('playsinline', '');
        vidEl.setAttribute('muted', '');
        vidEl.srcObject = activeStream;

        await vidEl.play().catch(e => {
            console.warn('Video play delayed, awaiting interaction:', e);
        });

        cameraUnavailable = false;
        keyboardMode = false;
        webcamSt.textContent = 'Camera Active ✅';
        webcamSt.style.color = '#00ff88';

        // Safe continuous frame processing loop
        const processFrame = async () => {
            if (!activeStream || !activeStream.active) return;
            if (vidEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !isProcessingFrame) {
                isProcessingFrame = true;
                try {
                    await hands.send({ image: vidEl });
                } catch (e) {
                    console.debug('Frame processing drop:', e);
                } finally {
                    isProcessingFrame = false;
                }
            }
            requestAnimationFrame(processFrame);
        };
        requestAnimationFrame(processFrame);
    } catch (err) {
        console.warn('Camera stream unavailable, switching to keyboard mode:', err);
        webcamSt.innerHTML = 'Camera Off (Click to Retry) 📷';
        webcamSt.style.color = '#e8c56c';
        webcamSt.style.cursor = 'pointer';
        keyboardMode = true;
        cameraUnavailable = true;
    }
}

async function initCameraDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        webcamSt.textContent = 'Camera Unsupported - Keyboard Ready ⌨️';
        webcamSt.style.color = '#e8c56c';
        keyboardMode = true;
        cameraUnavailable = true;
        return;
    }

    webcamSt.textContent = 'Starting Camera...';
    webcamSt.style.color = '#7df9ff';

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            
            const isMobileOrVirtual = (lbl) => {
                const l = lbl.toLowerCase();
                return l.includes('poco') || l.includes('phone') || l.includes('mobile') || 
                       l.includes('link to windows') || l.includes('droidcam') || 
                       l.includes('virtual') || l.includes('obs') || l.includes('epoccam') || l.includes('ivcam');
            };

            const currentTrack = stream.getVideoTracks()[0];
            const currentLabel = currentTrack ? currentTrack.label.toLowerCase() : '';

            // If current camera is already a physical built-in/front camera or valid, use it directly!
            if (!isMobileOrVirtual(currentLabel)) {
                await startCameraStream(null, stream);
                return;
            }

            // Otherwise check if a physical built-in webcam is available
            const preferredCam = videoDevices.find(d => {
                const label = d.label.toLowerCase();
                if (isMobileOrVirtual(label)) return false;
                return label.includes('integrated') || label.includes('built-in') || 
                       label.includes('front') || label.includes('facetime') || 
                       label.includes('webcam') || label.includes('camera');
            }) || videoDevices.find(d => !isMobileOrVirtual(d.label));

            if (preferredCam && preferredCam.deviceId) {
                stream.getTracks().forEach(t => t.stop());
                await startCameraStream(preferredCam.deviceId);
            } else {
                await startCameraStream(null, stream);
            }
        } catch (enumErr) {
            console.warn('Device enumeration error, using default stream:', enumErr);
            await startCameraStream(null, stream);
        }
    } catch (err) {
        console.warn('Camera access denied or failed:', err);
        webcamSt.innerHTML = 'Camera Blocked (Click to Retry) 📷';
        webcamSt.style.color = '#ff4500';
        webcamSt.style.cursor = 'pointer';
        keyboardMode = true;
        cameraUnavailable = true;
    }
}

// User click on webcam status or container to request/re-initialize camera
if (webcamSt) {
    webcamSt.addEventListener('click', () => {
        initCameraDevices();
    });
}
const webcamWrapper = document.getElementById('webcam-wrapper');
if (webcamWrapper) {
    webcamWrapper.addEventListener('click', () => {
        if (cameraUnavailable || !activeStream) {
            initCameraDevices();
        }
    });
}

initCameraDevices();

// FAST INITIAL LOADING (Ready in 1.2s for festival stall)
setTimeout(() => {
    loadScr.classList.add('fade-out');
    setTimeout(() => {
        loadScr.style.display = 'none';
    }, 600);
}, 1200);

// RESET RUNNER & OBSTACLES
function reset() {
    G.score = 0;
    G.coins = 0;
    G.combo = 0;
    G.bestCombo = 0;
    G.dist = 0;
    G.base = 0.48;
    G.speed = 0;
    targetLane = 1;
    isJump = false;
    isSlide = false;
    jumpV = 0;
    playerGroup.position.set(0, 0, 5);
    playerGroup.scale.set(1, 1, 1);
    obs.forEach((o, i) => {
        o.position.z = 80 + i * 50 + Math.random() * 30;
        o.userData.lane = Math.floor(Math.random() * 3);
        o.position.x = LANES[o.userData.lane];
        o.visible = true;
    });
    coins.forEach((c, i) => {
        c.position.z = 60 + i * 35 + Math.random() * 20;
        c.userData.lane = Math.floor(Math.random() * 3);
        c.position.x = LANES[c.userData.lane];
        c.visible = true;
    });
    scoreEl.textContent = '0';
    coinsEl.textContent = '0';
    if (bestScoreEl) bestScoreEl.textContent = getBestScore();
    comboEl.classList.add('hidden');
}

function triggerScreenShake() {
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 400);
}

let growlT = 0, lightningT = 0;

// =========================================================
// MAIN RENDER & GAME LOOP
// =========================================================
function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.1);
    const timeFactor = dt * 60; // 1.0 at 60Hz, 0.5 at 120Hz, 0.416 at 144Hz

    if (mixer) mixer.update(dt * (G.speed > 0.3 ? G.speed * 1.5 : 0.6));

    if (!G.playing) {
        ren.render(scene, cam);
        return;
    }

    // Pulsing blood-red runes along path borders
    edgeMat.emissiveIntensity = 1.2 + Math.sin(Date.now() * 0.006) * 0.6;

    // Animate active 3D wood torch sparks & organic flickering light intensity
    torchGroups.forEach(tg => {
        tg.userData.pl.intensity = tg.userData.baseIntensity + Math.sin(Date.now() * 0.008 + tg.position.z) * 1.5;
        tg.userData.parts.forEach(p => {
            p.position.y += p.userData.speedY * timeFactor;
            p.position.x += Math.sin(Date.now() * 0.01 + p.position.y) * 0.005;
            const progress = (p.position.y - p.userData.baseY) / 1.0;
            p.scale.setScalar(Math.max(1.0 - progress, 0.01));
            if (p.position.y > p.userData.baseY + 1.0) {
                p.position.y = p.userData.baseY;
                p.position.x = (Math.random() - 0.5) * 0.15;
                p.position.z = (Math.random() - 0.5) * 0.15;
            }
        });
    });

    // Pulsing molten volcanic lava ground
    gnd.material.emissiveIntensity = 0.35 + Math.sin(Date.now() * 0.003) * 0.15;

    // Atmospheric dynamic lightning strikes & thunder
    lightningT += dt;
    if (lightningT > 10 + Math.random() * 8) {
        moon.intensity = 15;
        scene.fog.color.setHex(0xdce6ff);
        scene.background.setHex(0xdce6ff);
        AudioEngine.play('thunder');
        lightningT = 0;
    } else {
        moon.intensity += (2.5 - moon.intensity) * Math.min(0.12 * timeFactor, 1.0);
        scene.fog.color.lerp(new THREE.Color(0x121d3a), Math.min(0.12 * timeFactor, 1.0));
        scene.background.lerp(new THREE.Color(0x121d3a), Math.min(0.12 * timeFactor, 1.0));
    }

    if (stars) stars.rotation.y += 0.00015 * timeFactor;

    // Runner speed control: hand presence or keyboard mode keeps full speed
    if (handOn || keyboardMode) {
        G.speed += (G.base - G.speed) * Math.min(0.05 * timeFactor, 1.0);
    } else {
        G.speed *= Math.pow(0.95, timeFactor);
    }

    // Animation playback speed proportional to movement
    if (runAction) runAction.timeScale = Math.max(G.speed * 1.6, 0.4);

    // Smooth horizontal lane transition
    const tx = LANES[targetLane];
    playerGroup.position.x += (tx - playerGroup.position.x) * Math.min(0.14 * timeFactor, 1.0);

    // Smooth trailing camera follow
    cam.position.x += (playerGroup.position.x * 0.3 - cam.position.x) * Math.min(0.06 * timeFactor, 1.0);
    cam.position.y += (5 + playerGroup.position.y * 0.5 - cam.position.y) * Math.min(0.06 * timeFactor, 1.0);
    cam.lookAt(playerGroup.position.x * 0.5, 3, playerGroup.position.z + 20);

    // Jump physics
    if (isJump || playerGroup.position.y > 0.05) {
        playerGroup.position.y += jumpV * timeFactor;
        jumpV -= 0.045 * timeFactor;
        if (playerGroup.position.y <= 0) {
            playerGroup.position.y = 0;
            isJump = false;
            jumpV = 0;
            triggerScreenShake();
        }
    }

    // Slide compression
    if (isSlide) {
        playerGroup.scale.set(1, 0.35, 1);
    } else {
        playerGroup.scale.set(1, 1, 1);
    }

    // Score accumulation & gradual speed ramp
    if (G.speed > 0.2) {
        G.score += G.speed * 0.25 * timeFactor;
        G.dist += G.speed * 0.8 * timeFactor;
        if (G.base < 0.80) {
            G.base += 0.00004 * timeFactor;
        }
    }
    const currentScore = Math.floor(G.score);
    scoreEl.textContent = currentScore;
    if (bestScoreEl) {
        const top = Math.max(getBestScore(), currentScore);
        bestScoreEl.textContent = top;
    }

    // Environment and obstacle speed scaled with timeFactor
    const spd = G.speed * timeFactor;
    trees.forEach(t => {
        t.position.z -= spd;
        if (t.position.z < -30) {
            t.position.z += 900;
            const s = Math.random() > 0.5 ? 1 : -1;
            t.position.x = s * (13 + Math.random() * 60);
        }
    });
    
    // Scroll background ancient arches
    arches.forEach(a => {
        a.position.z -= spd;
        if (a.position.z < -30) {
            a.position.z += 900;
        }
    });

    // Scroll mossy foreground shrubs
    foregroundShrubs.forEach(s => {
        s.position.z -= spd;
        if (s.position.z < -20) {
            s.position.z += 750;
            s.position.x = (Math.random() > 0.5 ? 1 : -1) * (10.5 + Math.random() * 2);
        }
    });

    groundTex.offset.y -= spd * 0.1;
    forestTex.offset.y -= spd * 0.1;

    // Obstacle collision and recycling
    obs.forEach(o => {
        if (!o.visible) return;
        o.position.z -= spd;
        if (o.position.z < -20) {
            o.position.z += 1000;
            o.userData.lane = Math.floor(Math.random() * 3);
            o.position.x = LANES[o.userData.lane];
            o.visible = true;
        }
        const dz = Math.abs(o.position.z - playerGroup.position.z);
        const dx = Math.abs(o.position.x - playerGroup.position.x);
        let hit = false;
        if (dz < 2.2 && dx < 2.2) {
            if (o.userData.type === 0) {
                if (!isJump) hit = true; // Root obstacle: jump over!
            } else if (o.userData.type === 1) {
                if (!isSlide) hit = true; // Branch obstacle: slide under!
            } else {
                hit = true; // Stump obstacle: lane-switch!
            }
        }
        if (hit && dz < 1.5) {
            gameOver();
            return;
        }
        if (dz < 4 && dz > 2 && dx < 3 && !o.userData.nm) {
            o.userData.nm = true;
            G.combo++;
            if (G.combo > G.bestCombo) G.bestCombo = G.combo;
            AudioEngine.play('nearmiss');
            triggerScreenShake();
            nearMissEl.classList.remove('hidden');
            nearMissEl.style.animation = 'none';
            void nearMissEl.offsetWidth;
            nearMissEl.style.animation = 'nearMissAnim 1s ease-out forwards';
            setTimeout(() => nearMissEl.classList.add('hidden'), 1000);
            comboEl.classList.remove('hidden');
            comboTxt.textContent = `COMBO x${G.combo}`;
            G.score += G.combo * 5;
        }
        if (dz > 6) o.userData.nm = false;
    });

    // Coins / Relics collection
    coins.forEach(c => {
        if (!c.visible) return;
        c.position.z -= spd;
        c.rotation.y += 0.08 * timeFactor;
        if (c.position.z < -20) {
            c.position.z += 1050;
            c.userData.lane = Math.floor(Math.random() * 3);
            c.position.x = LANES[c.userData.lane];
            c.visible = true;
        }
        if (Math.abs(c.position.z - playerGroup.position.z) < 2.5 && Math.abs(c.position.x - playerGroup.position.x) < 2.5) {
            c.visible = false;
            G.coins++;
            coinsEl.textContent = G.coins;
            AudioEngine.play('coin');
            G.score += 10;
        }
    });

    // Demon Monster tracking
    monG.position.z += (playerGroup.position.z - 20 - monG.position.z) * Math.min(0.015 * timeFactor, 1.0);
    monG.position.x += (playerGroup.position.x - monG.position.x) * Math.min(0.01 * timeFactor, 1.0);
    monG.position.y = Math.sin(Date.now() * 0.003) * 0.5;
    chaseLight.position.copy(monG.position);
    growlT += spd;
    if (growlT > 200) {
        AudioEngine.play('growl');
        growlT = 0;
    }

    // Flame ember particles update
    const pp = parts.geometry.attributes.position.array;
    for (let i = 0; i < pCnt; i++) {
        pp[i * 3 + 2] -= spd * 0.5;
        pp[i * 3 + 1] += Math.sin(Date.now() * 0.002 + i) * 0.02 * timeFactor;
        pp[i * 3] += Math.cos(Date.now() * 0.001 + i) * 0.01 * timeFactor;
        if (pp[i * 3 + 2] < -20) {
            pp[i * 3 + 2] += 100;
            pp[i * 3] = Math.random() * 80 - 40;
            pp[i * 3 + 1] = Math.random() * 25 + 1;
        }
    }
    parts.geometry.attributes.position.needsUpdate = true;

    torch.intensity = 25 + Math.sin(Date.now() * 0.01) * 5;
    speedBar.style.height = Math.min(G.speed / 0.80, 1) * 100 + '%';
    
    // Warning Flash if player loses hand tracking and not using keyboard
    if (!handOn && !keyboardMode && G.speed < 0.3) {
        warnFlash.classList.remove('hidden');
    } else {
        warnFlash.classList.add('hidden');
    }

    cam.fov = 65 + G.speed * 4;
    cam.updateProjectionMatrix();
    ren.render(scene, cam);
}

// =========================================================
// RUN COMPLETE & GAME OVER WORKFLOW
// =========================================================
function gameOver() {
    G.playing = false;
    AudioEngine.play('crash');
    AudioEngine.stopAmbient();
    document.getElementById('game-container').classList.add('shake');
    setTimeout(() => document.getElementById('game-container').classList.remove('shake'), 400);
    
    const finalScore = Math.floor(G.score);
    fScore.textContent = finalScore;
    fCoins.textContent = G.coins;
    fDist.textContent = Math.floor(G.dist) + 'm';
    if (fCombo) fCombo.textContent = G.bestCombo;
    
    // Check & display Best Score
    const best = Math.max(getBestScore(), finalScore);
    if (finalBestScoreEl) finalBestScoreEl.textContent = best;
    
    // Reset Name Input Form
    if (playerNameInput) {
        playerNameInput.value = '';
        playerNameInput.disabled = false;
    }
    if (saveScoreBtn) {
        saveScoreBtn.disabled = false;
        saveScoreBtn.textContent = 'SAVE SCORE';
    }
    if (saveStatusMsg) {
        saveStatusMsg.classList.add('hidden');
    }
    
    // Render Embedded Leaderboard
    renderLeaderboardList(resultsLbList, 5);
    
    setTimeout(() => {
        goScr.classList.remove('hidden');
        if (playerNameInput) playerNameInput.focus();
    }, 600);
}

// Start New Run Workflow with 3, 2, 1, RUN countdown
function startNewRun() {
    startScr.classList.add('hidden');
    goScr.classList.add('hidden');
    AudioEngine.init();
    reset();
    hud.classList.remove('hidden');
    gestInd.classList.remove('hidden');
    
    if (bestScoreEl) bestScoreEl.textContent = getBestScore();
    
    // Re-verify / trigger camera activation on explicit user click
    if (!activeStream || !activeStream.active) {
        initCameraDevices();
    }
    
    runCountdown(() => {
        AudioEngine.startAmbient();
        G.playing = true;
    });
}

// Next Player Workflow: reset arena and return to start screen for next in line
function setupNextPlayer() {
    goScr.classList.add('hidden');
    hud.classList.add('hidden');
    gestInd.classList.add('hidden');
    reset();
    startScr.classList.remove('hidden');
}

// Button Listeners
startBtn.addEventListener('click', startNewRun);

if (playAgainBtn) {
    playAgainBtn.addEventListener('click', startNewRun);
}

if (nextPlayerBtn) {
    nextPlayerBtn.addEventListener('click', setupNextPlayer);
}

if (restartBtn) {
    restartBtn.addEventListener('click', startNewRun);
}

addEventListener('resize', () => {
    ren.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
});

tick();
