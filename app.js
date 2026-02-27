// ============================================================
// 天文航海 3D 學習系統 — Main Application (Enhanced)
// ============================================================

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const EARTH_RADIUS = 3;
const CELESTIAL_RADIUS = 5;

const state = {
    phase: 0, step: 0,
    lat: 25, lon: 121, dec: 20, gha: 300,
    animProgress: 0, autoRotate: true,
    quizStep: 0, quizAnswers: {}
};

let computed = {};
let scene, camera, renderer, controls;
let earthMesh, celestialWireframe;
let animationId;
let groupEarth, groupCelestial, groupPZS, groupPhase1, groupPhase2, groupPhase3;

// Label tracking data: { id, position3D, textCh, textEn, type:'point'|'edge', color }
let labelDefs = [];

// ============================================================
// PHASES CONTENT (1-3 + Phase 4 Quiz)
// ============================================================
const PHASES = [
    {
        title: '階段一：確立 3D 絕對位置',
        desc: '確定天體在空間中的絕對位置和觀測者在當地的實際角度',
        steps: [
            {
                title: '天球模型概覽', content: `<p>您看到的外層球體代表<strong>天球 (Celestial Sphere)</strong>——一個假想的無限大球面。內部小球代表<strong>地球</strong>。</p>
<p>天球的旋轉軸穿過<strong>北天極 P (Pole)</strong>。3D 視圖中每個關鍵點和線段都標有中英文說明。</p>
<div class="key-point"><div class="label">🔑 關鍵概念</div>天球是天文航海的基礎參考框架。所有角度測量和計算都在這個球面上進行。</div>
<div class="legend">
  <div class="legend-item"><span class="legend-color" style="background:#00e5ff"></span>P — 天極 Pole</div>
  <div class="legend-item"><span class="legend-color" style="background:#ffd54f"></span>Z — 天頂 Zenith</div>
  <div class="legend-item"><span class="legend-color" style="background:#e040fb"></span>S — 天體 Star</div>
  <div class="legend-item"><span class="legend-color" style="background:#69f0ae"></span>GP — 地理位置</div>
</div>` },
            {
                title: '天體的地理位置 (GP)', content: `<p>天體的<strong>地理位置 (GP)</strong> 是天體在地球表面的投影點。</p>
<p>• <strong class="highlight">緯度 = 赤緯 δ (Declination)</strong><br>• <strong class="highlight">經度 由 GHA 決定</strong></p>
<div class="key-point"><div class="label">📐 3D 意涵</div>GP 是<strong>等高圈 (CoP)</strong> 的圓心。從 GP 看，天體在正頭頂——高度 90°。</div>
<p>調整<strong>赤緯 δ</strong> 和 <strong>GHA</strong> 滑桿，觀察 GP（綠色點）在地球上的移動！</p>` },
            {
                title: '觀測者天頂 (Z) 與 Ho', content: `<p><strong>天頂 Z (Zenith)</strong> 是 AP（假定船位）正上方在天球上的投影。</p>
<p>六分儀測量並修正後得到<strong>真實高度 Ho (Observed Altitude)</strong>。</p>
<div class="key-point"><div class="label">⚓ 觀測錨點</div>Ho 定義觀測者在以 GP 為圓心、<strong>90° − Ho</strong> 為角半徑的等高圈上。</div>
<p>3D 中 <span style="color:#ffd54f">黃色圓圈</span> 即為等高圈 CoP。</p>` },
            {
                title: '等高圈 (CoP) 定位原理', content: `<p>測量到高度 Ho，你就位於以 GP 為圓心、<strong>(90° − Ho)</strong> 為角半徑的圓上。</p>
<div class="formula-box">$$\\text{CoP 半徑} = 90° - H_o$$</div>
<p>兩個 CoP 的交點確定位置。但 CoP 半徑極大，無法直接在海圖上繪製。</p>
<div class="key-point"><div class="label">💡 為何需要截距法</div>用直線 LoP 近似 CoP 弧線——這就是階段二和三的任務。</div>` }
        ]
    },
    {
        title: '階段二：解算 PZS 三角形',
        desc: '透過球面三角學，計算理論高度 Hc 和方位角 Zn',
        steps: [
            {
                title: 'PZS 導航三角形', content: `<p>幾何核心是<strong>PZS 球面三角形</strong>，三個頂點：</p>
<p>• <strong style="color:#00e5ff">P (Pole)</strong> — 天極<br>• <strong style="color:#ffd54f">Z (Zenith)</strong> — 天頂<br>• <strong style="color:#e040fb">S (Star)</strong> — 天體</p>
<div class="key-point"><div class="label">🔺 功能</div>PZS 將<strong>赤道座標</strong>轉換為<strong>地平座標</strong>（Hc 和 Zn）。</div>
<p>三條彩色弧線：<span style="color:#00e5ff">PZ</span>、<span style="color:#e040fb">PS</span>、<span style="color:#ffab40">ZS</span>。</p>` },
            {
                title: '三條已知邊與角', content: `<p>解算所需三個已知量：</p>
<p><strong style="color:#00e5ff">邊 PZ — Co-latitude（餘緯度）</strong></p>
<div class="formula-box">$$PZ = 90° - \\phi_{AP}$$</div>
<p><strong style="color:#e040fb">邊 PS — Co-declination（餘赤緯）</strong></p>
<div class="formula-box">$$PS = 90° - \\delta$$</div>
<p><strong style="color:#ffab40">角 P — LHA（本地時角）</strong></p>
<div class="formula-box">$$LHA = GHA + \\lambda_{AP}$$</div>
<div class="key-point"><div class="label">📊 當前數值</div><span id="known-values-display">載入中...</span></div>` },
            {
                title: '球面餘弦定律', content: `<p>用<strong>球面餘弦定律</strong>求 ZS（天頂距）：</p>
<div class="formula-box">$$\\cos(ZS) = \\sin(\\phi) \\cdot \\sin(\\delta) + \\cos(\\phi) \\cdot \\cos(\\delta) \\cdot \\cos(LHA)$$</div>
<p>計算高度：</p>
<div class="formula-box">$$H_c = 90° - ZS$$</div>
<div class="key-point"><div class="label">📐 意義</div>Hc 是從 AP 算出的<strong>理論高度</strong>。AP 準確時 Hc = Ho。</div>` },
            {
                title: '方位角 Zn', content: `<p><strong>方位角 Zn (Azimuth)</strong> 是從 AP 指向 GP 的方向。</p>
<div class="formula-box">$$\\sin(Z) = \\frac{\\sin(LHA) \\cdot \\cos(\\delta)}{\\cos(H_c)}$$</div>
<div class="key-point"><div class="label">🧭 意義</div>Zn 決定截距的<strong>繪製方向</strong>。<span style="color:#e040fb">紫色虛線</span>顯示方位線。</div>` }
        ]
    },
    {
        title: '階段三：截距法 2D 投影',
        desc: '將 3D 角度差異透過截距法投影到 2D 海圖上',
        steps: [
            {
                title: '計算截距 (Intercept)', content: `<p>截距法將 Ho 和 Hc 差異轉為距離：</p>
<div class="formula-box">$$I = H_o - H_c$$</div>
<p>關鍵轉換：<strong>1 弧分 = 1 海浬 (nm)</strong></p>
<div class="key-point"><div class="label">📏 3D→距離</div>當前截距：<strong id="intercept-display">計算中...</strong></div>` },
            {
                title: 'Toward / Away', content: `<p>• <strong style="color:#69f0ae">Ho > Hc → Toward (T)</strong>：更靠近 GP</p>
<p>• <strong style="color:#ff5252">Ho < Hc → Away (A)</strong>：更遠離 GP</p>
<div class="key-point"><div class="label">💡 口訣</div><strong>「CGA — Computed Greater Away」</strong><br>計算值較大 → 離開方向</div>` },
            {
                title: '位置線 LoP', content: `<p>1. 從 AP 沿 Zn 出發<br>2. 移動 I 海浬<br>3. 畫<strong>垂直於 Zn</strong> 的直線</p>
<div class="key-point"><div class="label">📐 為何直線</div>LoP 是 CoP 弧線的<strong>切線近似</strong>。CoP 半徑極大時弧線≈直線。</div>
<p><span style="color:#ffd54f">金色線段</span> = LoP，<span style="color:#69f0ae">綠色箭頭</span> = 截距方向。</p>` },
            {
                title: '最終定位', content: `<p>多次觀測多個天體 → 多條 LoP → 交點就是<strong>天文船位</strong>。</p>
<div class="key-point"><div class="label">🎯 總結</div>1. 測量多天體 → 多條 LoP<br>2. 兩條 LoP 交點 = 船位<br>3. 三條以上形成誤差三角形</div>
<p>接下來進入<strong>例題測驗</strong>，手把手帶您實際計算！</p>` }
        ]
    },
    {
        title: '階段四：例題測驗',
        desc: '透過一道完整例題，手把手引導您完成天文航海計算',
        steps: [
            {
                title: '例題題目', content: `<div class="quiz-question"><div class="q-label">📝 例題</div><div class="q-text">
某船觀測太陽，已知條件如下：<br>
• 假定船位 (AP)：<strong>φ = 25°N，λ = 130°W</strong><br>
• 太陽赤緯：<strong>δ = 15°N</strong><br>
• 格林威治時角：<strong>GHA = 45°</strong><br>
• 六分儀觀測高度（修正後）：<strong>Ho = 55°12.0'</strong><br><br>
求：LHA、Hc、Zn、截距 I，並判斷 Toward 或 Away。
</div></div>
<div class="key-point"><div class="label">💡 提示</div>3D 視圖已自動切換到此例題的參數。接下來每一步，我們將帶您逐步計算。</div>
<div class="quiz-steps-progress" id="quiz-progress"></div>` },

            {
                title: '步驟一：計算 LHA', content: `<div class="quiz-question"><div class="q-label">步驟 1/5</div><div class="q-text">
<strong>本地時角 LHA</strong> = GHA + λ（東經為正，西經為負）<br><br>
GHA = 45°，λ = 130°W = −130°<br>
LHA = 45° + (−130°) = ?<br><br>
<em>提示：若結果為負，需加 360°</em>
</div></div>
<div class="quiz-input-row">
  <label>LHA =</label>
  <input type="number" class="quiz-input" id="quiz-lha" placeholder="輸入角度">
  <span>°</span>
  <button class="quiz-check-btn" onclick="checkQuiz('lha')">確認</button>
</div>
<div class="quiz-feedback" id="fb-lha"></div>
<div class="quiz-steps-progress" id="quiz-progress"></div>` },

            {
                title: '步驟二：計算 Hc', content: `<div class="quiz-question"><div class="q-label">步驟 2/5</div><div class="q-text">
用球面餘弦定律：<br>
$$\\sin(H_c) = \\sin(\\phi) \\cdot \\sin(\\delta) + \\cos(\\phi) \\cdot \\cos(\\delta) \\cdot \\cos(LHA)$$<br>
φ = 25°, δ = 15°, LHA = 275°<br><br>
sin(Hc) = sin(25°)·sin(15°) + cos(25°)·cos(15°)·cos(275°)<br>
= 0.4226 × 0.2588 + 0.9063 × 0.9659 × 0.08716<br>
= 0.1094 + 0.07631 = 0.1857<br>
Hc = arcsin(0.1857) = ?
</div></div>
<div class="quiz-input-row">
  <label>Hc ≈</label>
  <input type="number" class="quiz-input" id="quiz-hc" placeholder="度數（小數點後一位）" step="0.1">
  <span>°</span>
  <button class="quiz-check-btn" onclick="checkQuiz('hc')">確認</button>
</div>
<div class="quiz-feedback" id="fb-hc"></div>
<div class="quiz-steps-progress" id="quiz-progress"></div>` },

            {
                title: '步驟三：計算方位角 Zn', content: `<div class="quiz-question"><div class="q-label">步驟 3/5</div><div class="q-text">
$$\\sin(Z) = \\frac{\\sin(LHA) \\cdot \\cos(\\delta)}{\\cos(H_c)}$$<br>
LHA = 275°, δ = 15°, Hc ≈ 10.7°<br><br>
sin(Z) = sin(275°) × cos(15°) / cos(10.7°)<br>
= (−0.9962) × 0.9659 / 0.9826<br>
= −0.9793<br>
Z = arcsin(−0.9793) ≈ −78.3°<br><br>
LHA > 180°，所以 Zn = 360° − |Z| = ?
</div></div>
<div class="quiz-input-row">
  <label>Zn ≈</label>
  <input type="number" class="quiz-input" id="quiz-zn" placeholder="方位角度數" step="0.1">
  <span>°</span>
  <button class="quiz-check-btn" onclick="checkQuiz('zn')">確認</button>
</div>
<div class="quiz-feedback" id="fb-zn"></div>
<div class="quiz-steps-progress" id="quiz-progress"></div>` },

            {
                title: '步驟四：計算截距', content: `<div class="quiz-question"><div class="q-label">步驟 4/5</div><div class="q-text">
$$I = H_o - H_c$$<br>
Ho = 55°12.0' = 55.200°<br>
Hc ≈ 10.7°<br><br>
I = 55.200° − 10.7° = ?<br>
換算：I × 60 = ? 海浬 (nm)
</div></div>
<div class="quiz-input-row">
  <label>I ≈</label>
  <input type="number" class="quiz-input" id="quiz-intercept" placeholder="海浬數" step="0.1">
  <span>nm</span>
  <button class="quiz-check-btn" onclick="checkQuiz('intercept')">確認</button>
</div>
<div class="quiz-feedback" id="fb-intercept"></div>
<div class="quiz-steps-progress" id="quiz-progress"></div>` },

            {
                title: '步驟五：Toward or Away?', content: `<div class="quiz-question"><div class="q-label">步驟 5/5</div><div class="q-text">
Ho = 55.200° 與 Hc ≈ 10.7°<br><br>
Ho > Hc 嗎？如果是，截距方向為何？<br><br>
記住口訣：<strong>Ho > Hc → Toward</strong><br>
<strong>Computed Greater → Away</strong>
</div></div>
<div class="quiz-input-row">
  <label>方向 =</label>
  <select class="quiz-input" id="quiz-direction" style="cursor:pointer">
    <option value="">— 請選擇 —</option>
    <option value="toward">Toward (靠近 GP)</option>
    <option value="away">Away (遠離 GP)</option>
  </select>
  <button class="quiz-check-btn" onclick="checkQuiz('direction')">確認</button>
</div>
<div class="quiz-feedback" id="fb-direction"></div>
<div class="quiz-steps-progress" id="quiz-progress"></div>` },

            {
                title: '🎉 例題完成！', content: `<div class="key-point" style="border-color:rgba(105,240,174,0.3);background:rgba(105,240,174,0.06)">
<div class="label" style="color:#69f0ae">✅ 恭喜完成！</div>
您已成功完成一道完整的天文航海計算例題！<br><br>
<strong>答案總結：</strong><br>
• LHA = 275°<br>
• Hc ≈ 10.7°<br>
• Zn ≈ 281.7°<br>
• I ≈ 2670.0 nm — <span style="color:#69f0ae">Toward</span><br><br>
在實際航海中，截距通常不會這麼大（這是因為本例的 AP 與 GP 距離很遠）。<br>
實際天文導航中，AP 通常會接近真實位置，截距一般在 30 nm 以內。
</div>
<p>🔄 您可以回到前面的階段複習，或調整滑桿參數來探索不同的計算場景！</p>` }
        ]
    }
];

// ============================================================
// QUIZ LOGIC
// ============================================================
const QUIZ_ANSWERS = {
    lha: {
        answer: 275, tolerance: 1, unit: '°',
        correct: '✅ 正確！LHA = 45° + (−130°) = −85°，加 360° = 275°',
        wrong: '❌ LHA = GHA + λ = 45° + (−130°) = −85°。負值加 360° → <strong>275°</strong>'
    },
    hc: {
        answer: 10.7, tolerance: 0.5, unit: '°',
        correct: '✅ 正確！Hc ≈ 10.7°',
        wrong: '❌ sin(Hc) = 0.1857，Hc = arcsin(0.1857) ≈ <strong>10.7°</strong>'
    },
    zn: {
        answer: 281.7, tolerance: 1.5, unit: '°',
        correct: '✅ 正確！Zn ≈ 281.7°（從北起順時針量至方位線）',
        wrong: '❌ Z ≈ −78.3°，LHA>180° → Zn = 360° − 78.3° ≈ <strong>281.7°</strong>'
    },
    intercept: {
        answer: 2670, tolerance: 30, unit: 'nm',
        correct: '✅ 正確！I = (55.2° − 10.7°) × 60 ≈ 2670 nm (Toward)',
        wrong: '❌ I = (55.200° − 10.7°) × 60 = 44.5° × 60 ≈ <strong>2670 nm</strong>'
    },
    direction: {
        answer: 'toward', tolerance: 0, unit: '',
        correct: '✅ 正確！Ho (55.2°) > Hc (10.7°) → Toward，實際位置更靠近 GP',
        wrong: '❌ Ho > Hc，所以方向是 <strong>Toward</strong>（靠近 GP）'
    }
};

function checkQuiz(key) {
    const ans = QUIZ_ANSWERS[key];
    let input, isCorrect;
    if (key === 'direction') {
        input = document.getElementById('quiz-direction').value;
        isCorrect = input === ans.answer;
    } else {
        input = parseFloat(document.getElementById('quiz-' + key).value);
        isCorrect = !isNaN(input) && Math.abs(input - ans.answer) <= ans.tolerance;
    }
    const fb = document.getElementById('fb-' + key);
    const inputEl = key === 'direction' ? document.getElementById('quiz-direction') : document.getElementById('quiz-' + key);
    fb.className = 'quiz-feedback show ' + (isCorrect ? 'correct-fb' : 'wrong-fb');
    fb.innerHTML = isCorrect ? ans.correct : ans.wrong;
    inputEl.className = inputEl.className.replace(/ correct| wrong/g, '') + (isCorrect ? ' correct' : ' wrong');
    state.quizAnswers[key] = isCorrect;
    updateQuizProgress();
}

function updateQuizProgress() {
    const progEls = document.querySelectorAll('#quiz-progress');
    const keys = ['lha', 'hc', 'zn', 'intercept', 'direction'];
    const labels = ['LHA', 'Hc', 'Zn', '截距', '方向'];
    progEls.forEach(el => {
        el.innerHTML = keys.map((k, i) => {
            const done = state.quizAnswers[k] === true;
            const active = state.step === i + 1;
            return `<span class="quiz-step-chip ${done ? 'done-chip' : active ? 'active-chip' : ''}">${labels[i]} ${done ? '✓' : ''}</span>`;
        }).join('');
    });
}

// ============================================================
// MATH ENGINE
// ============================================================
function computeNavigation() {
    const lat = state.lat * DEG;
    const dec = state.dec * DEG;
    let lha = (state.gha + state.lon) % 360;
    if (lha < 0) lha += 360;
    const lhaRad = lha * DEG;
    let gpLon = -state.gha;
    if (gpLon < -180) gpLon += 360;
    const sinHc = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(lhaRad);
    const hcRad = Math.asin(Math.max(-1, Math.min(1, sinHc)));
    const hcDeg = hcRad * RAD;
    const cosHc = Math.cos(hcRad);
    let zRad = 0;
    if (cosHc !== 0) {
        const sinZ = Math.sin(lhaRad) * Math.cos(dec) / cosHc;
        const cosZ = (Math.sin(dec) - Math.sin(lat) * sinHc) / (Math.cos(lat) * cosHc);
        zRad = Math.atan2(sinZ, cosZ);
    }
    let znDeg = zRad * RAD;
    if (znDeg < 0) znDeg += 360;
    const hoDeg = hcDeg + 0.35;
    const interceptDeg = hoDeg - hcDeg;
    const interceptNm = interceptDeg * 60;
    computed = { lha, lhaRad, gpLat: state.dec, gpLon, hcRad, hcDeg, znDeg, zRad, hoDeg, interceptDeg, interceptNm, zdDeg: 90 - hcDeg, pzDeg: 90 - state.lat, psDeg: 90 - state.dec, lat, dec };
    return computed;
}

// ============================================================
// 3D HELPERS
// ============================================================
function latLonToVec3(latDeg, lonDeg, radius) {
    const la = latDeg * DEG, lo = lonDeg * DEG;
    return new THREE.Vector3(radius * Math.cos(la) * Math.cos(lo), radius * Math.sin(la), radius * Math.cos(la) * Math.sin(lo));
}

function createGreatCircleArc(v1, v2, radius, segments, color) {
    const pts = [];
    for (let i = 0; i <= segments; i++) pts.push(new THREE.Vector3().lerpVectors(v1, v2, i / segments).normalize().multiplyScalar(radius));
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, linewidth: 2, transparent: true, opacity: 0.9 }));
}

function createCircleOnSphere(cLat, cLon, angDeg, radius, color, segs) {
    segs = segs || 80;
    const cv = latLonToVec3(cLat, cLon, 1).normalize(), ar = angDeg * DEG;
    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(cv.dot(up)) > 0.99) up = new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(cv, up).normalize(), v = new THREE.Vector3().crossVectors(cv, u).normalize();
    const pts = [];
    for (let i = 0; i <= segs; i++) {
        const t = (i / segs) * 2 * Math.PI;
        pts.push(new THREE.Vector3().addScaledVector(cv, Math.cos(ar)).addScaledVector(u, Math.sin(ar) * Math.cos(t)).addScaledVector(v, Math.sin(ar) * Math.sin(t)).normalize().multiplyScalar(radius));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, linewidth: 2, transparent: true, opacity: 0.6 }));
}

function createPointMarker(color, size) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(size || 0.08, 16, 16), new THREE.MeshBasicMaterial({ color })));
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const ctx = cv.getContext('2d'), grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},0.6)`);
    grd.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, blending: THREE.AdditiveBlending }));
    sp.scale.set(0.4, 0.4, 1); g.add(sp);
    return g;
}

function createWireframeCircle(r, segs, color, opacity) {
    const pts = [];
    for (let i = 0; i <= segs; i++) { const t = (i / segs) * 2 * Math.PI; pts.push(new THREE.Vector3(r * Math.cos(t), 0, r * Math.sin(t))); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity || 0.15 }));
}

function midpoint3D(a, b) { return new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5); }

function clearGroup(group) {
    while (group.children.length > 0) {
        const ch = group.children[0];
        if (ch.geometry) ch.geometry.dispose();
        if (ch.material) { if (ch.material.map) ch.material.map.dispose(); ch.material.dispose(); }
        group.remove(ch);
    }
}

// ============================================================
// SCENE SETUP
// ============================================================
function initScene() {
    const vp = document.getElementById('viewport');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(vp.clientWidth, vp.clientHeight);
    renderer.setClearColor(0x0a0e1a, 1);
    vp.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, vp.clientWidth / vp.clientHeight, 0.1, 100);
    camera.position.set(6, 4, 8);
    camera.lookAt(0, 0, 0);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.3;
    controls.minDistance = 5; controls.maxDistance = 18;
    scene.add(new THREE.AmbientLight(0x404060, 0.5));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(5, 5, 5); scene.add(dl);
    groupEarth = new THREE.Group(); groupCelestial = new THREE.Group();
    groupPZS = new THREE.Group(); groupPhase1 = new THREE.Group();
    groupPhase2 = new THREE.Group(); groupPhase3 = new THREE.Group();
    scene.add(groupEarth, groupCelestial, groupPZS, groupPhase1, groupPhase2, groupPhase3);
    createEarth(); createCelestialSphere(); createStarfield(); createAxisLine();
    window.addEventListener('resize', onResize);
}

function createEarth() {
    earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 64, 64), new THREE.MeshPhongMaterial({ color: 0x0a2040, emissive: 0x041020, transparent: true, opacity: 0.6 }));
    groupEarth.add(earthMesh);
    groupEarth.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.002, 24, 24), new THREE.MeshBasicMaterial({ color: 0x1a3a6a, wireframe: true, transparent: true, opacity: 0.12 })));
    groupEarth.add(createWireframeCircle(EARTH_RADIUS * 1.003, 100, 0x2060a0, 0.35));
    for (let lat = -60; lat <= 60; lat += 30) { if (lat === 0) continue; const r = EARTH_RADIUS * 1.003 * Math.cos(lat * DEG); const c = createWireframeCircle(r, 80, 0x1a3a6a, 0.15); c.position.y = EARTH_RADIUS * 1.003 * Math.sin(lat * DEG); groupEarth.add(c); }
    for (let lon = 0; lon < 180; lon += 30) { const pts = []; for (let i = 0; i <= 80; i++) { const la = (i / 80) * Math.PI * 2; pts.push(new THREE.Vector3(EARTH_RADIUS * 1.003 * Math.cos(la) * Math.cos(lon * DEG), EARTH_RADIUS * 1.003 * Math.sin(la), EARTH_RADIUS * 1.003 * Math.cos(la) * Math.sin(lon * DEG))); } groupEarth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x1a3a6a, transparent: true, opacity: 0.15 }))); }
}

function createCelestialSphere() {
    celestialWireframe = new THREE.Mesh(new THREE.SphereGeometry(CELESTIAL_RADIUS, 32, 32), new THREE.MeshBasicMaterial({ color: 0x1a2a5a, wireframe: true, transparent: true, opacity: 0.05 }));
    groupCelestial.add(celestialWireframe);
    groupCelestial.add(createWireframeCircle(CELESTIAL_RADIUS * 1.001, 120, 0x3060c0, 0.2));
}

function createStarfield() {
    const geo = new THREE.BufferGeometry(), n = 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1), r = 15 + Math.random() * 10; pos[i * 3] = r * Math.sin(p) * Math.cos(t); pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t); pos[i * 3 + 2] = r * Math.cos(p); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaabbdd, size: 0.06, transparent: true, opacity: 0.7 })));
}

function createAxisLine() {
    const pts = [new THREE.Vector3(0, -CELESTIAL_RADIUS * 1.1, 0), new THREE.Vector3(0, CELESTIAL_RADIUS * 1.1, 0)];
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x4060a0, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.3 }));
    ln.computeLineDistances(); scene.add(ln);
}

// ============================================================
// LABEL SYSTEM — HTML overlays tracking 3D positions
// ============================================================
function updateLabels() {
    const container = document.getElementById('labels-container');
    if (!container) return;
    container.innerHTML = '';
    const vp = document.getElementById('viewport');
    const w = vp.clientWidth, h = vp.clientHeight;

    labelDefs.forEach(def => {
        const pos = def.position3D.clone().project(camera);
        // Behind camera check
        if (pos.z > 1) return;
        const x = (pos.x * 0.5 + 0.5) * w;
        const y = (-pos.y * 0.5 + 0.5) * h;
        if (x < -50 || x > w + 50 || y < -30 || y > h + 30) return;

        const el = document.createElement('div');
        el.className = 'label-3d ' + (def.type === 'point' ? 'label-point' : 'label-edge');
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.color = def.color;
        el.innerHTML = `${def.textCh}<span class="label-en">${def.textEn}</span>`;
        container.appendChild(el);
    });
}

// ============================================================
// UPDATE 3D SCENE + LABELS
// ============================================================
function updateScene() {
    const c = computeNavigation();
    clearGroup(groupPZS); clearGroup(groupPhase1); clearGroup(groupPhase2); clearGroup(groupPhase3);
    labelDefs = [];

    // Key positions
    const pVec = new THREE.Vector3(0, CELESTIAL_RADIUS, 0);
    const zPos = latLonToVec3(state.lat, state.lon, CELESTIAL_RADIUS);
    let starLon = state.lon - c.lha; if (starLon < -180) starLon += 360; if (starLon > 180) starLon -= 360;
    const sPos = latLonToVec3(state.dec, starLon, CELESTIAL_RADIUS);
    const gpPos = latLonToVec3(state.dec, starLon, EARTH_RADIUS * 1.01);
    const apPos = latLonToVec3(state.lat, state.lon, EARTH_RADIUS * 1.01);

    // P, Z, S markers
    const pM = createPointMarker(0x00e5ff, 0.1); pM.position.copy(pVec); groupPZS.add(pM);
    const zM = createPointMarker(0xffd54f, 0.1); zM.position.copy(zPos); groupPZS.add(zM);
    const sM = createPointMarker(0xe040fb, 0.1); sM.position.copy(sPos); groupPZS.add(sM);

    // Point labels
    labelDefs.push({ position3D: pVec, textCh: 'P 天極', textEn: 'Celestial Pole', type: 'point', color: '#00e5ff' });
    labelDefs.push({ position3D: zPos, textCh: 'Z 天頂', textEn: 'Zenith (AP)', type: 'point', color: '#ffd54f' });
    labelDefs.push({ position3D: sPos, textCh: 'S 天體', textEn: 'Star / Body', type: 'point', color: '#e040fb' });

    // GP & AP on Earth
    const gpM = createPointMarker(0x69f0ae, 0.08); gpM.position.copy(gpPos); groupPhase1.add(gpM);
    const apM = createPointMarker(0xffd54f, 0.06); apM.position.copy(apPos); groupPhase1.add(apM);
    labelDefs.push({ position3D: gpPos, textCh: 'GP 地理位置', textEn: 'Geographic Position', type: 'point', color: '#69f0ae' });
    labelDefs.push({ position3D: apPos, textCh: 'AP 假定船位', textEn: 'Assumed Position', type: 'point', color: '#ffd54f' });

    // PZS arcs + edge labels
    const arcPZ = createGreatCircleArc(pVec, zPos, CELESTIAL_RADIUS, 40, 0x00e5ff); groupPZS.add(arcPZ);
    const arcPS = createGreatCircleArc(pVec, sPos, CELESTIAL_RADIUS, 40, 0xe040fb); groupPZS.add(arcPS);
    const arcZS = createGreatCircleArc(zPos, sPos, CELESTIAL_RADIUS, 40, 0xffab40); groupPZS.add(arcZS);

    // Edge midpoint labels
    const midPZ = midpoint3D(pVec, zPos).normalize().multiplyScalar(CELESTIAL_RADIUS * 1.06);
    const midPS = midpoint3D(pVec, sPos).normalize().multiplyScalar(CELESTIAL_RADIUS * 1.06);
    const midZS = midpoint3D(zPos, sPos).normalize().multiplyScalar(CELESTIAL_RADIUS * 1.06);
    labelDefs.push({ position3D: midPZ, textCh: `PZ 餘緯 ${c.pzDeg.toFixed(1)}°`, textEn: 'Co-latitude', type: 'edge', color: '#00e5ff' });
    labelDefs.push({ position3D: midPS, textCh: `PS 餘赤緯 ${c.psDeg.toFixed(1)}°`, textEn: 'Co-declination', type: 'edge', color: '#e040fb' });
    labelDefs.push({ position3D: midZS, textCh: `ZS 天頂距 ${c.zdDeg.toFixed(1)}°`, textEn: 'Zenith Distance', type: 'edge', color: '#ffab40' });

    // Phase 1: CoP
    if (state.phase >= 0) {
        const copR = 90 - c.hoDeg;
        if (copR > 0 && copR < 90) {
            const cop = createCircleOnSphere(state.dec, starLon, copR, EARTH_RADIUS * 1.01, 0xffd54f, 100);
            groupPhase1.add(cop);
            // CoP label at top of circle
            const copLabelPos = latLonToVec3(state.dec + copR * 0.7, starLon, EARTH_RADIUS * 1.05);
            labelDefs.push({ position3D: copLabelPos, textCh: '等高圈 CoP', textEn: 'Circle of Position', type: 'edge', color: '#ffd54f' });
        }
    }

    // Phase 2: LHA arc
    if (state.phase >= 1) {
        const zDir = zPos.clone().normalize(), sDir = sPos.clone().normalize();
        const zP = new THREE.Vector3(zDir.x, 0, zDir.z).normalize();
        const sP = new THREE.Vector3(sDir.x, 0, sDir.z).normalize();
        const aZ = Math.atan2(zP.z, zP.x), aS = Math.atan2(sP.z, sP.x);
        const pts = [];
        for (let i = 0; i <= 30; i++) { const a = aZ + (aS - aZ) * (i / 30); pts.push(new THREE.Vector3(Math.cos(a), CELESTIAL_RADIUS * 0.95, Math.sin(a))); }
        groupPhase2.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffab40, transparent: true, opacity: 0.7 })));
        // LHA label
        const lhaMid = pts[15].clone();
        labelDefs.push({ position3D: lhaMid, textCh: `∠P LHA ${c.lha.toFixed(1)}°`, textEn: 'Local Hour Angle', type: 'edge', color: '#ffab40' });
    }

    // Phase 3: Intercept + LoP
    if (state.phase >= 2) {
        const apV = latLonToVec3(state.lat, state.lon, EARTH_RADIUS * 1.015);
        const gpV = latLonToVec3(state.dec, starLon, EARTH_RADIUS * 1.015);
        const dir = gpV.clone().sub(apV).normalize();
        const iLen = Math.min(Math.max(c.interceptNm / 60 * 0.5, 0.1), 1.5);
        const tw = c.interceptNm >= 0;
        const iEnd = apV.clone().add(dir.clone().multiplyScalar(tw ? iLen : -iLen));
        const aC = tw ? 0x69f0ae : 0xff5252;
        groupPhase3.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([apV, iEnd]), new THREE.LineBasicMaterial({ color: aC, linewidth: 3 })));
        const tip = createPointMarker(aC, 0.05); tip.position.copy(iEnd); groupPhase3.add(tip);
        // Intercept label
        labelDefs.push({ position3D: midpoint3D(apV, iEnd), textCh: `截距 I=${c.interceptNm.toFixed(1)}nm`, textEn: tw ? 'Intercept (Toward)' : 'Intercept (Away)', type: 'edge', color: tw ? '#69f0ae' : '#ff5252' });

        // LoP
        const norm = iEnd.clone().normalize();
        const perp = new THREE.Vector3().crossVectors(dir, norm).normalize();
        const lS = iEnd.clone().add(perp.clone().multiplyScalar(1.2));
        const lE = iEnd.clone().add(perp.clone().multiplyScalar(-1.2));
        groupPhase3.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([lS, lE]), new THREE.LineBasicMaterial({ color: 0xffd54f, linewidth: 3, transparent: true, opacity: 0.9 })));
        [lS, lE].forEach(p => { const m = createPointMarker(0xffd54f, 0.04); m.position.copy(p); groupPhase3.add(m); });
        labelDefs.push({ position3D: lS, textCh: '位置線 LoP', textEn: 'Line of Position', type: 'point', color: '#ffd54f' });

        // Azimuth line
        const aEnd = apV.clone().add(dir.clone().multiplyScalar(3));
        const azL = new THREE.Line(new THREE.BufferGeometry().setFromPoints([apV, aEnd]), new THREE.LineDashedMaterial({ color: 0xe040fb, dashSize: 0.1, gapSize: 0.06, transparent: true, opacity: 0.4 }));
        azL.computeLineDistances(); groupPhase3.add(azL);
        labelDefs.push({ position3D: midpoint3D(apV, aEnd), textCh: `方位線 Zn=${c.znDeg.toFixed(1)}°`, textEn: 'Azimuth Line', type: 'edge', color: '#e040fb' });
    }

    groupPhase1.visible = true;
    groupPhase2.visible = state.phase >= 1;
    groupPhase3.visible = state.phase >= 2;
    groupPZS.visible = true;
    updateDisplayValues(c);
}

function updateDisplayValues(c) {
    document.getElementById('val-hc').textContent = c.hcDeg.toFixed(2) + '°';
    document.getElementById('val-ho').textContent = c.hoDeg.toFixed(2) + '°';
    document.getElementById('val-intercept').textContent = c.interceptNm.toFixed(1) + ' nm';
    document.getElementById('val-zn').textContent = c.znDeg.toFixed(1) + '°';
    const kv = document.getElementById('known-values-display');
    if (kv) kv.innerHTML = `PZ=${c.pzDeg.toFixed(1)}° | PS=${c.psDeg.toFixed(1)}° | LHA=${c.lha.toFixed(1)}°`;
    const id = document.getElementById('intercept-display');
    if (id) { const d = c.interceptNm >= 0 ? 'Toward' : 'Away'; id.innerHTML = `${Math.abs(c.interceptNm).toFixed(1)} nm <span style="color:${c.interceptNm >= 0 ? '#69f0ae' : '#ff5252'}">${d}</span>`; }
}

// ============================================================
// UI CONTROLLER
// ============================================================
function renderSidebar() {
    const phase = PHASES[state.phase], step = phase.steps[state.step];
    document.getElementById('sidebar-header').innerHTML = `<h2>${phase.title}</h2><div class="phase-desc">${phase.desc}</div>`;
    const dc = document.getElementById('step-indicator'); dc.innerHTML = '';
    for (let i = 0; i < phase.steps.length; i++) { const d = document.createElement('div'); d.className = 'step-dot' + (i === state.step ? ' active' : i < state.step ? ' completed' : ''); dc.appendChild(d); }
    const cnt = document.getElementById('sidebar-content');
    cnt.innerHTML = `<div class="step-content"><h3><span class="step-num">${state.step + 1}</span>${step.title}</h3>${step.content}</div>`;
    cnt.scrollTop = 0;
    if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([cnt]).catch(() => { });
    document.getElementById('btn-prev').disabled = (state.phase === 0 && state.step === 0);
    const isLast = (state.phase === PHASES.length - 1 && state.step === PHASES[state.phase].steps.length - 1);
    document.getElementById('btn-next').textContent = isLast ? '🎉 完成' : '下一步 →';
    document.querySelectorAll('.phase-tab').forEach((t, i) => t.classList.toggle('active', i === state.phase));
    if (state.phase === 3) updateQuizProgress();
}

function switchPhase(idx) {
    state.phase = idx; state.step = 0;
    // Phase 4 quiz: set parameters to example
    if (idx === 3) { state.lat = 25; state.lon = -130; state.dec = 15; state.gha = 45; syncControlsToState(); }
    renderSidebar(); updateScene();
}

function nextStep() {
    const ph = PHASES[state.phase];
    if (state.step < ph.steps.length - 1) state.step++;
    else if (state.phase < PHASES.length - 1) { state.phase++; state.step = 0; if (state.phase === 3) { state.lat = 25; state.lon = -130; state.dec = 15; state.gha = 45; syncControlsToState(); } }
    renderSidebar(); updateScene();
}

function prevStep() {
    if (state.step > 0) state.step--;
    else if (state.phase > 0) { state.phase--; state.step = PHASES[state.phase].steps.length - 1; }
    renderSidebar(); updateScene();
}

function syncControlsToState() {
    ['lat', 'lon', 'dec', 'gha'].forEach(k => {
        const el = document.getElementById('ctrl-' + k); if (el) el.value = state[k];
    });
    updateControlDisplays();
}

function updateControlDisplays() {
    const fmt = { lat: v => `${Math.abs(v)}°${v >= 0 ? 'N' : 'S'}`, lon: v => `${Math.abs(v)}°${v >= 0 ? 'E' : 'W'}`, dec: v => `${Math.abs(v)}°${v >= 0 ? 'N' : 'S'}`, gha: v => `${v}°` };
    ['lat', 'lon', 'dec', 'gha'].forEach(k => { const d = document.getElementById('disp-' + k); if (d) d.textContent = fmt[k](state[k]); });
}

// ============================================================
// CONTROLS
// ============================================================
function initControls() {
    const ctrls = [
        { id: 'ctrl-lat', key: 'lat', disp: 'disp-lat', format: v => `${Math.abs(v)}°${v >= 0 ? 'N' : 'S'}` },
        { id: 'ctrl-lon', key: 'lon', disp: 'disp-lon', format: v => `${Math.abs(v)}°${v >= 0 ? 'E' : 'W'}` },
        { id: 'ctrl-dec', key: 'dec', disp: 'disp-dec', format: v => `${Math.abs(v)}°${v >= 0 ? 'N' : 'S'}` },
        { id: 'ctrl-gha', key: 'gha', disp: 'disp-gha', format: v => `${v}°` }
    ];
    ctrls.forEach(ct => {
        const el = document.getElementById(ct.id), dp = document.getElementById(ct.disp);
        el.value = state[ct.key]; dp.textContent = ct.format(state[ct.key]);
        el.addEventListener('input', () => { state[ct.key] = parseFloat(el.value); dp.textContent = ct.format(state[ct.key]); updateScene(); });
    });
}

// ============================================================
// ANIMATION LOOP
// ============================================================
function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    updateLabels();
}

function onResize() {
    const vp = document.getElementById('viewport');
    camera.aspect = vp.clientWidth / vp.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(vp.clientWidth, vp.clientHeight);
}

function startApp() {
    const ov = document.getElementById('welcome-overlay');
    ov.classList.add('hidden'); setTimeout(() => ov.style.display = 'none', 600);
}

function init() {
    initScene(); initControls(); computeNavigation(); updateScene(); renderSidebar(); animate();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
