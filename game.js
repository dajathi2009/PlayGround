(() => {
  const $ = (id) => document.getElementById(id);
  const homeScreen = $('homeScreen'), gameScreen = $('gameScreen'), canvas = $('gameCanvas');
  let ctx = null;
  try { ctx = canvas && canvas.getContext('2d'); } catch (_) { /* Canvas may be unavailable in restricted browsers. */ }
  const colors = ['#5be6df', '#ff5cad', '#ffd36b', '#a68aff'];
  const keys = ['d', 'f', 'j', 'k'];
  const difficulties = {
    flow: { speed: 330, gap: 510, bpm: 112, label: 'FLOW' },
    pulse: { speed: 390, gap: 425, bpm: 126, label: 'PULSE' },
    overdrive: { speed: 455, gap: 345, bpm: 144, label: 'OVERDRIVE' }
  };
  let difficulty = 'flow', running = false, started = false, soundOn = true, audio, master;
  let notes = [], startAt = 0, lastFrame = 0, lastSpawn = 0, raf = 0, score = 0, combo = 0, maxCombo = 0, hits = 0, perfects = 0, misses = 0, judged = 0, elapsed = 0;
  let judgeTimer, toastTimer, countdownTimer, pauseAt = 0, particles = [], canvasW = 0, canvasH = 0, hitY = 0, sessionId = 0;
  const bestKey = 'neonPulseBest';
  function readBest() {
    try { return Math.max(0, Number(window.localStorage.getItem(bestKey)) || 0); }
    catch (_) { return 0; }
  }
  function saveBest(value) {
    try { window.localStorage.setItem(bestKey, String(value)); } catch (_) { /* Storage can be disabled or full. */ }
  }
  $('homeBest').textContent = String(readBest()).padStart(6, '0');

  document.querySelectorAll('.diff-option').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.diff-option').forEach(b => b.classList.remove('active'));
    button.classList.add('active'); difficulty = button.dataset.diff;
  }));
  $('soundToggle').addEventListener('click', () => {
    soundOn = !soundOn; $('soundToggle').classList.toggle('muted', !soundOn);
    $('soundToggle').setAttribute('aria-label', soundOn ? 'Mute sound' : 'Enable sound');
    if (soundOn && audio) tone(660, .07, .025);
  });
  $('playButton').addEventListener('click', startGame);
  $('againButton').addEventListener('click', startGame);
  $('exitButton').addEventListener('click', goHome);
  $('homeButton').addEventListener('click', goHome);
  document.querySelectorAll('.lane-key').forEach(button => {
    button.addEventListener('pointerdown', event => { event.preventDefault(); hitLane(+button.dataset.lane); });
  });
  window.addEventListener('keydown', event => {
    if (event.repeat) return;
    const lane = keys.indexOf(event.key.toLowerCase());
    if (lane !== -1 && running) { event.preventDefault(); hitLane(lane); document.querySelectorAll('.lane-key')[lane].classList.add('pressed'); }
    if (event.key === 'Escape' && running) goHome();
  });
  window.addEventListener('keyup', event => { const lane = keys.indexOf(event.key.toLowerCase()); if (lane !== -1) document.querySelectorAll('.lane-key')[lane].classList.remove('pressed'); });
  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && started) { started = false; pauseAt = performance.now(); cancelAnimationFrame(raf); showToast('PAUSED · RETURN TO THE GAME'); }
    else if (!document.hidden && running && !started && pauseAt) { startAt += performance.now() - pauseAt; lastSpawn += performance.now() - pauseAt; pauseAt = 0; started = true; lastFrame = performance.now(); const activeSession = sessionId; raf = requestAnimationFrame(now => loop(now, activeSession)); }
  });

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    try {
      const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
      canvasW = rect.width; canvasH = rect.height; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); hitY = canvasH - Math.max(100, canvasH * .22);
      if (!running) drawIdle();
    } catch (_) { ctx = null; }
  }
  function startGame() {
    const thisSession = ++sessionId;
    $('resultsOverlay').classList.add('hidden'); homeScreen.classList.add('hidden'); gameScreen.classList.remove('hidden');
    score = 0; combo = 0; maxCombo = 0; hits = 0; perfects = 0; misses = 0; judged = 0; elapsed = 0; notes = []; particles = []; started = false; running = true; lastSpawn = 0;
    $('scoreDisplay').textContent = '000000'; $('comboDisplay').textContent = '0'; $('accuracyDisplay').innerHTML = '100<span>%</span>'; $('progressFill').style.width = '0%'; $('gameStatus').textContent = 'READY';
    resizeCanvas(); cancelAnimationFrame(raf); clearInterval(countdownTimer); clearTimeout(judgeTimer); pauseAt = 0;
    if (soundOn) initAudio();
    const countdown = $('countdown'); countdown.classList.remove('hidden'); let count = 3;
    countdown.textContent = count; if (soundOn) tone(440, .1, .04);
    countdownTimer = setInterval(() => {
      if (!running || thisSession !== sessionId) { clearInterval(countdownTimer); return; }
      count--;
      if (count > 0) { countdown.textContent = count; if (soundOn) tone(440 + (3 - count) * 70, .1, .04); }
      else if (count === 0) { countdown.textContent = 'GO!'; if (soundOn) tone(880, .18, .05); }
      else { clearInterval(countdownTimer); countdownTimer = null; countdown.classList.add('hidden'); started = true; startAt = performance.now(); lastFrame = startAt; lastSpawn = startAt + 650; $('gameStatus').textContent = 'PLAYING'; raf = requestAnimationFrame(now => loop(now, thisSession)); }
    }, 750);
  }
  function goHome() {
    sessionId++; running = false; started = false; cancelAnimationFrame(raf); clearInterval(countdownTimer); countdownTimer = null; clearTimeout(judgeTimer); pauseAt = 0; $('countdown').classList.add('hidden');
    $('resultsOverlay').classList.add('hidden'); gameScreen.classList.add('hidden'); homeScreen.classList.remove('hidden'); $('gameStatus').textContent = 'READY';
  }
  function initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { soundOn = false; return; }
      if (!audio) { audio = new AudioContext(); master = audio.createGain(); master.gain.value = .22; master.connect(audio.destination); }
      if (audio.state === 'suspended') {
        const resume = audio.resume();
        if (resume && typeof resume.catch === 'function') resume.catch(() => {});
      }
    } catch (_) { soundOn = false; }
  }
  function tone(frequency, duration = .08, volume = .04, type = 'sine') {
    if (!soundOn || !audio) return;
    try { const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = type; osc.frequency.value = frequency; gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration); osc.connect(gain); gain.connect(master); osc.start(); osc.stop(audio.currentTime + duration); } catch (_) {}
  }
  function loop(now, loopSession = sessionId) {
    if (!running || !started || loopSession !== sessionId) return;
    const delta = Math.min(Math.max(0, now - lastFrame), 50); lastFrame = now; elapsed = now - startAt;
    const config = difficulties[difficulty], trackLength = 34000;
    if (now >= lastSpawn && elapsed < trackLength) {
      spawnNote(now);
      lastSpawn = now + config.gap * (.82 + Math.random() * .35);
    }
    notes.forEach(note => {
      note.y += config.speed * delta / 1000;
      if (!note.hit && !note.missed && note.y > hitY + 45) { note.missed = true; registerMiss(); }
    });
    notes = notes.filter(n => n.y < canvasH + 55 && !n.hit);
    particles = particles.filter(p => now - p.time < 550);
    $('progressFill').style.width = `${Math.min(100, elapsed / trackLength * 100)}%`;
    if (!safeDraw()) return;
    if (elapsed >= trackLength + 1600 && notes.length === 0) { finishGame(); return; }
    raf = requestAnimationFrame(nextFrame => loop(nextFrame, loopSession));
  }
  function spawnNote(now) {
    let lane;
    if (Math.random() < .58 && notes.length) { const prev = notes[notes.length - 1].lane; lane = (prev + 1 + Math.floor(Math.random() * 3)) % 4; }
    else lane = Math.floor(Math.random() * 4);
    notes.push({ lane, y: -25, hit: false, missed: false, born: now, size: 12 });
    if (difficulty !== 'flow' && Math.random() > (difficulty === 'pulse' ? .83 : .68)) {
      const second = (lane + 1 + Math.floor(Math.random() * 3)) % 4;
      notes.push({ lane: second, y: -25, hit: false, missed: false, born: now, size: 12 });
    }
  }
  function laneCenter(lane) { return canvasW * (lane + .5) / 4; }
  function hitLane(lane) {
    if (!running || !started) return;
    const target = notes.filter(n => n.lane === lane && !n.hit && !n.missed).sort((a, b) => Math.abs(a.y - hitY) - Math.abs(b.y - hitY))[0];
    if (!target) { return; }
    const distance = Math.abs(target.y - hitY);
    if (distance > 68) { return; }
    target.hit = true; hits++; judged++; combo++; maxCombo = Math.max(combo, maxCombo);
    const perfect = distance <= 25;
    const points = perfect ? 1000 : 650;
    score += points + Math.min(combo, 50) * (perfect ? 10 : 4);
    if (perfect) perfects++;
    showJudge(perfect ? 'PERFECT' : 'GOOD', perfect ? 'perfect' : 'good');
    burst(laneCenter(lane), hitY, colors[lane]);
    tone(perfect ? 540 + lane * 115 : 420 + lane * 90, perfect ? .09 : .07, .04, perfect ? 'sine' : 'triangle');
    updateHUD();
  }
  function registerMiss() { misses++; judged++; combo = 0; updateHUD(); showJudge('MISS', 'miss'); tone(130, .12, .025, 'triangle'); }
  function updateHUD() {
    $('scoreDisplay').textContent = String(score).padStart(6, '0'); $('comboDisplay').textContent = combo;
    const accuracy = judged ? Math.round((hits / judged) * 100) : 100; $('accuracyDisplay').innerHTML = `${accuracy}<span>%</span>`;
  }
  function showJudge(text, type) {
    const judge = $('judgeText'); judge.textContent = text; judge.className = `judge show ${type}`;
    clearTimeout(judgeTimer); judgeTimer = setTimeout(() => judge.classList.remove('show'), 420);
  }
  function burst(x, y, color) {
    for (let i = 0; i < 10; i++) particles.push({ x, y, vx: (Math.random() - .5) * 150, vy: (Math.random() - .5) * 130, time: performance.now(), color });
  }
  function drawIdle() { safeDraw(); }
  function safeDraw() {
    try { draw(); return true; }
    catch (_) {
      running = false; started = false; cancelAnimationFrame(raf);
      $('gameStatus').textContent = 'DISPLAY ERROR'; showToast('DISPLAY ISSUE · PLEASE RELOAD');
      return false;
    }
  }
  function draw() {
    if (!ctx || !canvasW || !canvasH) return;
    ctx.clearRect(0, 0, canvasW, canvasH);
    const laneW = canvasW / 4;
    for (let lane = 0; lane < 4; lane++) {
      const x = lane * laneW;
      const grad = ctx.createLinearGradient(0, 0, 0, canvasH); grad.addColorStop(0, `${colors[lane]}00`); grad.addColorStop(.7, `${colors[lane]}05`); grad.addColorStop(1, `${colors[lane]}0b`);
      ctx.fillStyle = grad; ctx.fillRect(x, 0, laneW, canvasH);
      if (lane) { ctx.strokeStyle = '#ffffff0d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasH); ctx.stroke(); }
      ctx.fillStyle = `${colors[lane]}1a`; ctx.fillRect(x + laneW * .31, 0, laneW * .38, canvasH);
      ctx.fillStyle = `${colors[lane]}88`; ctx.font = '9px "DM Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(['●', '◆', '▲', '■'][lane], x + laneW / 2, 20);
    }
    // Hit zone glows at the timing line.
    const lineGrad = ctx.createLinearGradient(0, hitY - 20, 0, hitY + 20); lineGrad.addColorStop(0, '#ffffff00'); lineGrad.addColorStop(.5, '#a3fff522'); lineGrad.addColorStop(1, '#ffffff00'); ctx.fillStyle = lineGrad; ctx.fillRect(0, hitY - 20, canvasW, 40);
    ctx.strokeStyle = '#ffffff24'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(canvasW, hitY); ctx.stroke();
    for (let lane = 0; lane < 4; lane++) { ctx.strokeStyle = `${colors[lane]}cc`; ctx.shadowColor = colors[lane]; ctx.shadowBlur = 12; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lane * laneW + 12, hitY); ctx.lineTo((lane + 1) * laneW - 12, hitY); ctx.stroke(); ctx.shadowBlur = 0; }
    notes.forEach(note => {
      if (note.hit || note.missed) return;
      const x = laneCenter(note.lane), y = note.y, color = colors[note.lane], w = Math.min(42, laneW * .55);
      ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 17;
      roundedRect(ctx, x - w / 2, y - 10, w, 20, 7); ctx.fillStyle = color; ctx.fill();
      roundedRect(ctx, x - w / 2 + 3, y - 7, w - 6, 14, 5); ctx.fillStyle = '#111321'; ctx.fill();
      ctx.fillStyle = color; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(['●', '◆', '▲', '■'][note.lane], x, y + .5); ctx.restore();
    });
    const now = performance.now();
    particles.forEach(p => { const age = (now - p.time) / 550, alpha = 1 - age; ctx.globalAlpha = alpha; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x + p.vx * age, p.y + p.vy * age, 2.5 * alpha, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;
  }
  function roundedRect(context, x, y, w, h, r) {
    context.beginPath();
    if (typeof context.roundRect === 'function') { context.roundRect(x, y, w, h, r); return; }
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    context.moveTo(x + radius, y); context.lineTo(x + w - radius, y); context.quadraticCurveTo(x + w, y, x + w, y + radius);
    context.lineTo(x + w, y + h - radius); context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    context.lineTo(x + radius, y + h); context.quadraticCurveTo(x, y + h, x, y + h - radius);
    context.lineTo(x, y + radius); context.quadraticCurveTo(x, y, x + radius, y);
  }
  function finishGame() {
    running = false; started = false; cancelAnimationFrame(raf); $('gameStatus').textContent = 'COMPLETE';
    const accuracy = judged ? Math.round(hits / judged * 100) : 100;
    const grade = accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 50 ? 'C' : 'D';
    $('finalScore').textContent = String(score).padStart(6, '0'); $('finalAccuracy').textContent = `${accuracy}%`; $('finalCombo').textContent = maxCombo; $('finalPerfect').textContent = perfects; $('resultGrade').textContent = grade;
    $('resultTitle').textContent = accuracy >= 90 ? 'In the zone.' : accuracy >= 65 ? 'Nice rhythm.' : 'Keep the beat.';
    $('resultDiff').textContent = difficulties[difficulty].label;
    $('resultsOverlay').classList.remove('hidden');
    if (score > readBest()) { saveBest(score); $('homeBest').textContent = String(score).padStart(6, '0'); showToast('NEW PERSONAL BEST ✦'); }
  }
  function showToast(message) { const toast = $('toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1800); }
})();
