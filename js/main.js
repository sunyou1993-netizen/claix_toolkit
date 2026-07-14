/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Global reference for active intervals to prevent leaks on exit
let activeIntervals = [];

// ==============================================
// BASE SYSTEM: LAYOUT SCALING & NAVIGATION
// ==============================================

function initApp() {
  const mascotEl = document.getElementById('mascot-img');
  if (mascotEl) {
    // Mascot image is handled locally or via index.html
  }
  handleViewportRescale();
  window.addEventListener('resize', handleViewportRescale);
  
  // Quick alert overlay helper
  window.showAlert = function(msg, duration = 2000) {
    const alertBox = document.getElementById('audio-alert');
    alertBox.textContent = msg;
    alertBox.classList.add('show');
    setTimeout(() => alertBox.classList.remove('show'), duration);
  };

  // Run the sub-app automatic routing system on startup
  detectAndRouteSubApp();
}

function handleViewportRescale() {
  const canvas = document.getElementById('signage-canvas');
  if (!canvas) return;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  // Scale independently horizontally and vertically to stretch and fill screen with zero margins
  const scaleX = cw / 1080;
  const scaleY = ch / 1920;
  canvas.style.transform = `scale(${scaleX}, ${scaleY})`;
  canvas.style.transformOrigin = 'center center';
}

function stopAllActiveIntervals() {
  try {
    activeIntervals.forEach(id => clearInterval(id));
  } catch (e) {
    console.warn("Failed to clear active intervals:", e);
  }
  activeIntervals = [];
  
  // Stop mic if running
  if (noiseMicStream) {
    try {
      noiseMicStream.getTracks().forEach(track => track.stop());
    } catch (e) {
      console.warn("Failed to stop mic tracks:", e);
    }
    noiseMicStream = null;
  }
  if (noiseAudioCtx) {
    try {
      noiseAudioCtx.close();
    } catch (e) {
      console.warn("Failed to close audio context:", e);
    }
    noiseAudioCtx = null;
  }
}

// Automatic sub-app detection and routing handler
function detectAndRouteSubApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const curHost = window.location.hostname;
  
  const toolSubdomains = {
    'claix-pomodoro-timer-g7ph': 'timer',
    'claix-pomodoro-timer-tk2v': 'pomodoro',
    'claix-stopwatch2-la7h': 'stopwatch',
    'claix-worldtime3-shtk': 'worldclock',
    'claix-board-nvw9': 'paint',
    'claix-piano-3sum': 'noise',
    'claix-wheelgame-pmii': 'picker',
    'claix-piano-abpk': 'instruments',
    'claix-ladder-8ly1': 'ladder'
  };
  
  let toolId = null;
  
  // 1. Detect tool based on custom domain hostname
  const isSubAppDomain = Object.keys(toolSubdomains).some(sub => curHost.includes(sub));
  for (const [sub, tId] of Object.entries(toolSubdomains)) {
    if (curHost.includes(sub)) {
      toolId = tId;
      break;
    }
  }
  
  // 2. Query parameter fallback for standalone/tool views in alternative previews
  if (!toolId) {
    const qTool = urlParams.get('tool') || urlParams.get('standalone') || urlParams.get('view');
    if (qTool && qTool !== 'true') {
      toolId = qTool;
    }
  }
  
  const knownTools = ['timer', 'pomodoro', 'stopwatch', 'worldclock', 'paint', 'noise', 'picker', 'instruments', 'ladder'];
  if (toolId && knownTools.includes(toolId)) {
    // Force set standalone state inside options if needed and load the tool directly
    openToolLocally(toolId);
  }

  // If in standalone/subapp mode, hide all redundant "goToService" buttons since we're already on the service!
  if (isSubAppDomain || urlParams.has('standalone') || urlParams.has('view')) {
    const hideButtons = () => {
      document.querySelectorAll('button[onclick^="goToService"]').forEach(btn => {
        btn.style.display = 'none';
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hideButtons);
    } else {
      hideButtons();
    }
  }
}

// Launches a tool directly in local view mode without external redirection
function openToolLocally(toolId) {
  document.getElementById('view-dashboard').style.display = 'none';
  
  const views = document.querySelectorAll('.tool-detail-view');
  views.forEach(v => v.classList.remove('active'));
  
  const target = document.getElementById('tool-' + toolId);
  if (target) {
    target.classList.add('active');
  }
  
  // Trigger appropriate init script for the selected widget module
  if (toolId === 'timer') startTimerModule();
  if (toolId === 'pomodoro') startPomoModule();
  if (toolId === 'stopwatch') startStopwatchModule();
  if (toolId === 'worldclock') startWorldClockModule();
  if (toolId === 'paint') startPaintModule();
  if (toolId === 'noise') startNoiseModule();
  if (toolId === 'picker') startPickerModule();
  if (toolId === 'instruments') startInstrumentsModule();
  if (toolId === 'ladder') startLadderModule();
}

// Global Nav Handlers
window.openTool = function(toolId) {
  isClosingTool = false; // Reset close guard lock on navigation
  // Direct redirect mapping for externalized tools
  const toolUrls = {
    'timer': 'https://claix-pomodoro-timer-g7ph.vercel.app/',
    'pomodoro': 'https://claix-pomodoro-timer-tk2v.vercel.app/',
    'stopwatch': 'https://claix-stopwatch2-la7h.vercel.app/',
    'worldclock': 'https://claix-worldtime3-shtk.vercel.app/',
    'paint': 'https://claix-board-nvw9.vercel.app/',
    'noise': 'https://claix-piano-3sum.vercel.app/',
    'picker': 'https://claix-wheelgame-pmii.vercel.app/',
    'instruments': 'https://claix-piano-abpk.vercel.app/',
    'ladder': 'https://claix-ladder-8ly1.vercel.app/'
  };

  const curHost = window.location.hostname;
  const isTargetHost = toolUrls[toolId] && (new URL(toolUrls[toolId])).hostname === curHost;

  // Only redirect if a tool url is mapped and it is NOT the current hostname
  if (toolUrls[toolId] && !isTargetHost) {
    window.goToService(toolUrls[toolId]);
    return;
  }

  // Otherwise, load page locally
  openToolLocally(toolId);
};

let isClosingTool = false;

window.closeTool = function() {
  if (isClosingTool) return;
  isClosingTool = true;

  try {
    stopAllActiveIntervals();
  } catch (e) {
    console.warn("Error inside stopAllActiveIntervals during close:", e);
  }
  
  // Determine if we are currently running on the main toolkit page itself.
  const isMainPage = window.location.hostname.includes('claix-toolkit-xzrp') || 
                     window.location.hostname.includes('localhost') || 
                     window.location.hostname.includes('127.0.0.1') ||
                     window.location.hostname.includes('run.app');
  
  if (isMainPage) {
    isClosingTool = false; // Reset lock for local modal usage
    // Local modal closure for main app or local dev preview
    const dashboardEl = document.getElementById('view-dashboard');
    if (dashboardEl) {
      dashboardEl.style.display = 'flex';
    }
    const views = document.querySelectorAll('.tool-detail-view');
    views.forEach(v => v.classList.remove('active'));
    
    // Smoothly clear queries so URL looks clean again
    if (window.history.pushState) {
      const cleanLocation = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.pushState({ path: cleanLocation }, '', cleanLocation);
    }
  } else {
    // Standalone deployed sub-apps: Navigate back dynamically to previous parent toolkit URL!
    const urlParams = new URLSearchParams(window.location.search);
    const redirectKeys = [
      'redirect', 'redirect_uri', 'redirect_url', 'redirectUrl',
      'back', 'back_url', 'backUrl',
      'returnUrl', 'return_url', 'return', 'return_to', 'returnTo',
      'callback', 'callback_url', 'callbackUrl',
      'from', 'url', 'parent', 'origin', 'domain', 'host',
      'ret', 'ret_url', 'retUrl', 'retURL',
      'exit', 'exit_url', 'exitUrl',
      'referrer', 'ref', 'source', 'home', 'homeUrl', 'home_url',
      'prev', 'prev_url', 'prevUrl', 'next', 'to', 'baseUrl', 'base_url', 'clean_url'
    ];
    
    let targetUrl = '';
    
    // 1. Check if the referrer or redirect params contains a run.app (AI Studio dev preview URL)
    // This ensures we always return to the correct preview environment if we came from one!
    let referrerUrl = '';
    for (const key of redirectKeys) {
      const val = urlParams.get(key);
      if (val && val.includes('run.app')) {
        referrerUrl = val;
        break;
      }
    }
    if (!referrerUrl && document.referrer && document.referrer.includes('run.app')) {
      referrerUrl = document.referrer;
    }

    if (referrerUrl) {
      targetUrl = referrerUrl;
    } else {
      // 2. Otherwise parse general redirect parameter or referrer
      for (const key of redirectKeys) {
        const val = urlParams.get(key);
        if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
          targetUrl = val;
          break;
        }
      }
      if (!targetUrl && document.referrer && (document.referrer.startsWith('http://') || document.referrer.startsWith('https://'))) {
        targetUrl = document.referrer;
      }
    }

    // Default fallback to the main classroom helper portal
    if (!targetUrl) {
      targetUrl = 'https://claix-toolkit-xzrp.vercel.app/';
    }

    // If targetUrl's hostname ends up being the same as the current host (self-referential loop), reset it to the main toolkit
    try {
      const parsedTarget = new URL(targetUrl);
      if (parsedTarget.hostname === window.location.hostname) {
        targetUrl = 'https://claix-toolkit-xzrp.vercel.app/';
      }
    } catch (e) {}

    // Force return directly to main toolkit for safety unless we have a specific dev preview run.app referrer
    if (!targetUrl.includes('run.app')) {
      targetUrl = 'https://claix-toolkit-xzrp.vercel.app/';
    }

    // Try window.top first to breakout of iframe if we are same-origin/embedded safely, fallback to window.location
    let canAccessTop = false;
    try {
      if (window.top && window.top !== window) {
        const testHost = window.top.location.host;
        canAccessTop = !!testHost;
      }
    } catch (e) {
      canAccessTop = false;
    }

    try {
      if (canAccessTop) {
        window.top.location.replace(targetUrl);
      } else {
        window.location.replace(targetUrl);
      }
    } catch (e) {
      window.location.href = targetUrl;
    }
    // Defensive final fallback
    setTimeout(() => {
      isClosingTool = false; // Reset lock in case fallback was reached or user remains on page
      window.location.href = targetUrl;
    }, 50);
  }
};

window.goToService = function(url) {
  // Navigate in the same window/frame to preserve referrer and browser history.
  // We append multiple back/redirect parameters so that the Vercel sub-app knows exactly how to return to our dev/shared app in case it gets parsed from the query string.
  try {
    const cleanUrl = window.location.origin + window.location.pathname;
    const originUrl = window.location.origin;
    const targetUrl = new URL(url);
    
    // An exhaustive list of parameter keys commonly used for redirection/back-navigation callbacks
    // We omit sensitive keys like 'url' or 'host' to avoid clobbering internal target routing parameters
    const redirectKeys = [
      'redirect', 'redirect_uri', 'redirect_url', 'redirectUrl',
      'back', 'back_url', 'backUrl',
      'returnUrl', 'return_url', 'return', 'return_to', 'returnTo',
      'callback', 'callback_url', 'callbackUrl',
      'from', 'parent',
      'ret', 'ret_url', 'retUrl', 'retURL',
      'exit', 'exit_url', 'exitUrl',
      'referrer', 'ref', 'source', 'home', 'homeUrl', 'home_url',
      'prev', 'prev_url', 'prevUrl', 'next', 'to'
    ];
    
    redirectKeys.forEach(key => {
      // Set to clean fallback URL so sub-apps don't get polluted by old queries
      targetUrl.searchParams.set(key, cleanUrl);
    });
    
    // Also provide variations for clean / base / origin configurations in case they only accept simple absolute landing pages
    targetUrl.searchParams.set('origin', originUrl);
    targetUrl.searchParams.set('domain', originUrl);
    targetUrl.searchParams.set('baseUrl', cleanUrl);
    targetUrl.searchParams.set('base_url', cleanUrl);
    targetUrl.searchParams.set('clean_url', cleanUrl);
    
    window.location.href = targetUrl.toString();
  } catch (e) {
    // Fallback if URL object creation fails for some reason
    window.location.href = url;
  }
};


// ==============================================
// CONTEXT AUDIO SYNTH INTERACTION ENGINE
// ==============================================
let mainSynthCtx = null;

function getSynthContext() {
  if (!mainSynthCtx) {
    mainSynthCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (mainSynthCtx.state === 'suspended') {
    mainSynthCtx.resume();
  }
  return mainSynthCtx;
}

function triggerSynthesizerNote(frequency, duration = 0.4, type = 'sine', volumeScale = 1.0) {
  try {
    const ctx = getSynthContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0.25 * volumeScale, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn("Synth could not ignite context yet:", err);
  }
}

// Standard Sound Presets
function playSoundTick() {
  triggerSynthesizerNote(700, 0.05, 'triangle', 0.8);
}

function playSoundTock() {
  triggerSynthesizerNote(440, 0.08, 'sine', 0.6);
}

function playSoundGong() {
  try {
    const ctx = getSynthContext();
    const time = ctx.currentTime;
    
    // Add nice dual frequency chime resonance
    const freqs = [330, 440];
    freqs.forEach(f => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, time);
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 1.5);
    });
  } catch (e) {}
}

function playSoundVictory() {
  // Joyful C Major arpeggio
  const chord = [261.63, 329.63, 392.00, 523.25];
  const ctx = getSynthContext();
  const time = ctx.currentTime;
  
  chord.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time + i * 0.12);
    gain.gain.setValueAtTime(0, time + i * 0.12);
    gain.gain.linearRampToValueAtTime(0.2, time + i * 0.12 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + i * 0.12 + 0.9);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time + i * 0.12);
    osc.stop(time + i * 0.12 + 1.0);
  });
}


// ==============================================
// MODULE 1: INTERACTIVE CLASSROOM TIMER
// ==============================================
let timerSecondsTotal = 300; // 5 min initially
let timerSecondsLeft = 300;
let isTimerRunning = false;
let timerTickInterval = null;

function startTimerModule() {
  updateTimerUI();
}

function updateTimerUI() {
  const mins = Math.floor(timerSecondsLeft / 60).toString().padStart(2, '0');
  const secs = (timerSecondsLeft % 60).toString().padStart(2, '0');
  document.getElementById('timer-display').textContent = `${mins}:${secs}`;
  
  // Circle stroke offset calculation
  const circle = document.getElementById('timer-progress');
  const dashTotal = 1432;
  const ratio = timerSecondsLeft / timerSecondsTotal;
  const offset = dashTotal - (dashTotal * (isNaN(ratio) ? 1 : ratio));
  circle.style.strokeDashoffset = offset;
}

window.adjustTimer = function(seconds) {
  playSoundTick();
  if (isTimerRunning) return;
  timerSecondsTotal = Math.max(10, timerSecondsTotal + seconds);
  timerSecondsLeft = timerSecondsTotal;
  updateTimerUI();
};

window.toggleTimer = function() {
  playSoundTick();
  const btn = document.getElementById('timer-primary');
  const statusLbl = document.getElementById('timer-status');
  
  if (isTimerRunning) {
    // Pause state
    clearInterval(timerTickInterval);
    isTimerRunning = false;
    btn.textContent = "시작";
    btn.className = "flex-1 h-[140px] text-[48px] font-semibold text-white bg-[#006CFF] rounded-[32px] active:scale-95 transition shadow-lg shadow-blue-500/20";
    statusLbl.textContent = "일시정지";
    statusLbl.className = "text-[28px] font-semibold text-amber-500 tracking-widest mt-2 uppercase";
  } else {
    // Start state
    isTimerRunning = true;
    btn.textContent = "일시정지";
    btn.className = "flex-1 h-[140px] text-[48px] font-semibold text-[#006CFF] bg-blue-50 border-2 border-[#006CFF] rounded-[32px] active:scale-95 transition";
    statusLbl.textContent = "정원 카운트";
    statusLbl.className = "text-[28px] font-semibold text-emerald-500 tracking-widest mt-2 uppercase pulse-active";
    
    timerTickInterval = setInterval(() => {
      if (timerSecondsLeft > 0) {
        timerSecondsLeft--;
        updateTimerUI();
        if (timerSecondsLeft <= 10 && timerSecondsLeft > 0) {
          // Tension countdown tone ticks
          playSoundTock();
        }
      } else {
        // Complete!
        clearInterval(timerTickInterval);
        isTimerRunning = false;
        playSoundGong();
        showAlert("⏰ 설정 시간이 모두 완로되었습니다!", 4000);
        resetTimer();
      }
    }, 1000);
    activeIntervals.push(timerTickInterval);
  }
};

window.resetTimer = function() {
  playSoundTock();
  clearInterval(timerTickInterval);
  isTimerRunning = false;
  timerSecondsLeft = timerSecondsTotal;
  updateTimerUI();
  
  const btn = document.getElementById('timer-primary');
  const statusLbl = document.getElementById('timer-status');
  btn.textContent = "시작";
  btn.className = "flex-1 h-[140px] text-[48px] font-semibold text-white bg-[#006CFF] rounded-[32px] active:scale-95 transition shadow-lg shadow-blue-500/20";
  statusLbl.textContent = "준비 완료";
  statusLbl.className = "text-[28px] font-semibold text-[#006CFF] tracking-widest mt-2 uppercase";
};


// ==============================================
// MODULE 2: POMODORO MODULE
// ==============================================
let pomoTimeTotal = 1500; // 25 mins
let pomoTimeLeft = 1500;
let isPomoRunning = false;
let isBreakState = false;
let pomoInterval = null;

function startPomoModule() {
  updatePomoUI();
}

function updatePomoUI() {
  const mins = Math.floor(pomoTimeLeft / 60).toString().padStart(2, '0');
  const secs = (pomoTimeLeft % 60).toString().padStart(2, '0');
  document.getElementById('pomo-display').textContent = `${mins}:${secs}`;
  
  const fBadge = document.getElementById('pomo-badge-focus');
  const bBadge = document.getElementById('pomo-badge-break');
  if (isBreakState) {
    bBadge.className = "text-[28px] font-bold px-8 py-3 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-sm";
    fBadge.className = "text-[28px] font-bold px-8 py-3 rounded-full bg-slate-100 text-slate-400 border border-slate-200";
    document.getElementById('pomo-status').textContent = "쉬는 시간";
  } else {
    fBadge.className = "text-[28px] font-bold px-8 py-3 rounded-full bg-red-100 text-red-600 border border-red-200 shadow-sm";
    bBadge.className = "text-[28px] font-bold px-8 py-3 rounded-full bg-slate-100 text-slate-400 border border-slate-200";
    document.getElementById('pomo-status').textContent = "공부하기";
  }
}

window.togglePomo = function() {
  playSoundTick();
  const btn = document.getElementById('pomo-primary');
  
  if (isPomoRunning) {
    clearInterval(pomoInterval);
    isPomoRunning = false;
    btn.textContent = isBreakState ? "휴식 계속하기" : "집중 계속하기";
    btn.className = "flex-1 h-[140px] text-[48px] font-semibold text-white bg-red-500 rounded-[32px] active:scale-95 transition shadow-lg shadow-red-500/20";
  } else {
    isPomoRunning = true;
    btn.textContent = "일시 정지";
    btn.className = "flex-1 h-[140px] text-[48px] font-semibold text-red-500 bg-white border-2 border-red-500 rounded-[32px] active:scale-95 transition";
    
    pomoInterval = setInterval(() => {
      if (pomoTimeLeft > 0) {
        pomoTimeLeft--;
        updatePomoUI();
      } else {
        // Pomodoro Cycle Done
        clearInterval(pomoInterval);
        isPomoRunning = false;
        playSoundGong();
        
        if (!isBreakState) {
          // Switch to break
          isBreakState = true;
          pomoTimeTotal = 300; // 5 min break
          pomoTimeLeft = 300;
          showAlert("🍅 집중 시간이 끝났습니다! 5분 휴식을 취해보세요.", 4000);
        } else {
          // Switch back to study
          isBreakState = false;
          pomoTimeTotal = 1500; // 25 min study
          pomoTimeLeft = 1500;
          showAlert("📚 머리가 리프레시 되었습니다! 다시 집중을 시작합시다.", 4000);
        }
        resetPomo();
      }
    }, 1000);
    activeIntervals.push(pomoInterval);
  }
};

window.resetPomo = function() {
  playSoundTock();
  clearInterval(pomoInterval);
  isPomoRunning = false;
  pomoTimeLeft = pomoTimeTotal;
  updatePomoUI();
  
  const btn = document.getElementById('pomo-primary');
  btn.textContent = isBreakState ? "휴식 시작" : "집중 시작";
  btn.className = "flex-1 h-[140px] text-[48px] font-semibold text-white bg-red-500 rounded-[32px] active:scale-95 transition shadow-lg shadow-red-500/20";
};


// ==============================================
// MODULE 3: STOPWATCH MODULE
// ==============================================
let stopwatchStartTime = 0;
let stopwatchElapsedTime = 0;
let isStopwatchRunning = false;
let stopwatchInterval = null;
let lapCount = 0;

function startStopwatchModule() {
  updateStopwatchUI(0);
}

function updateStopwatchUI(totalMs) {
  const roundedSecs = Math.floor(totalMs / 1000);
  const mins = Math.floor(roundedSecs / 60).toString().padStart(2, '0');
  const secs = (roundedSecs % 60).toString().padStart(2, '0');
  const ms = Math.floor((totalMs % 1000) / 10).toString().padStart(2, '0');
  
  document.getElementById('stopwatch-display-main').textContent = `${mins}:${secs}`;
  document.getElementById('stopwatch-display-ms').textContent = `.${ms}`;
}

window.toggleStopwatch = function() {
  playSoundTick();
  const primaryBtn = document.getElementById('stopwatch-primary');
  
  if (isStopwatchRunning) {
    // stop
    clearInterval(stopwatchInterval);
    isStopwatchRunning = false;
    primaryBtn.textContent = "출발";
    primaryBtn.className = "flex-1 h-[140px] text-[48px] font-semibold text-white bg-emerald-500 rounded-[32px] active:scale-95 transition shadow-lg shadow-emerald-500/20";
  } else {
    // start
    stopwatchStartTime = Date.now() - stopwatchElapsedTime;
    isStopwatchRunning = true;
    primaryBtn.textContent = "멈춤";
    primaryBtn.className = "flex-1 h-[140px] text-[48px] font-semibold text-white bg-red-500 rounded-[32px] active:scale-95 transition shadow-md";
    
    stopwatchInterval = setInterval(() => {
      stopwatchElapsedTime = Date.now() - stopwatchStartTime;
      updateStopwatchUI(stopwatchElapsedTime);
    }, 10);
    activeIntervals.push(stopwatchInterval);
  }
};

window.lapStopwatch = function() {
  if (!isStopwatchRunning && stopwatchElapsedTime === 0) return;
  playSoundTick();
  lapCount++;
  
  const roundedSecs = Math.floor(stopwatchElapsedTime / 1000);
  const mins = Math.floor(roundedSecs / 60).toString().padStart(2, '0');
  const secs = (roundedSecs % 60).toString().padStart(2, '0');
  const ms = Math.floor((stopwatchElapsedTime % 1000) / 10).toString().padStart(2, '0');
  const timeStr = `${mins}:${secs}.${ms}`;
  
  const container = document.getElementById('stopwatch-laps');
  if (lapCount === 1) {
    container.innerHTML = ''; // Clear default placard
  }
  
  const lapRow = document.createElement('div');
  lapRow.className = "flex justify-between border-b border-dashed pb-2 text-[26px]";
  lapRow.innerHTML = `
    <span class="text-emerald-500 font-bold">#${lapCount}</span>
    <span class="text-slate-500">기록 구간</span>
    <span class="font-bold text-slate-800">${timeStr}</span>
  `;
  container.prepend(lapRow);
};

window.resetStopwatch = function() {
  playSoundTock();
  clearInterval(stopwatchInterval);
  isStopwatchRunning = false;
  stopwatchElapsedTime = 0;
  lapCount = 0;
  updateStopwatchUI(0);
  
  document.getElementById('stopwatch-primary').textContent = "출발";
  document.getElementById('stopwatch-primary').className = "flex-1 h-[140px] text-[48px] font-semibold text-white bg-emerald-500 rounded-[32px] active:scale-95 transition shadow-lg shadow-emerald-500/20";
  document.getElementById('stopwatch-laps').innerHTML = `<div class="text-center text-slate-400 py-10 text-[26px]">기록된 랩 타임이 없습니다.</div>`;
};


// ==============================================
// MODULE 4: WORLD CLOCK MODULE
// ==============================================
let clockIntervalId = null;

function startWorldClockModule() {
  updateWorldTimes();
  clockIntervalId = setInterval(updateWorldTimes, 1000);
  activeIntervals.push(clockIntervalId);
}

function updateWorldTimes() {
  const now = new Date();
  
  // Hand vectors generator
  function rotateClockHands(prefix, targetOffsetHours) {
    const localNow = new Date(now.getTime() + (targetOffsetHours - 9) * 3600000); // adjust to target relative to our locale offset
    const h = localNow.getHours();
    const m = localNow.getMinutes();
    const s = localNow.getSeconds();
    
    const degH = (h % 12) * 30 + m * 0.5;
    const degM = m * 6;
    const degS = s * 6;
    
    const lineH = document.getElementById(`clock-${prefix}-hour`);
    const lineM = document.getElementById(`clock-${prefix}-min`);
    const lineS = document.getElementById(`clock-${prefix}-sec`);
    
    if (lineH) lineH.setAttribute('transform', `rotate(${degH} 50 50)`);
    if (lineM) lineM.setAttribute('transform', `rotate(${degM} 50 50)`);
    if (lineS) lineS.setAttribute('transform', `rotate(${degS} 50 50)`);
  }

  // Seoul Time (UTC+9)
  const formatSeoul = getOffsetTimeStrings(9);
  document.getElementById('txt-seoul-time').textContent = formatSeoul.time;
  document.getElementById('txt-seoul-date').textContent = formatSeoul.date;
  rotateClockHands('seoul', 9);

  // New York Time (UTC-4)
  const formatNY = getOffsetTimeStrings(-4);
  document.getElementById('txt-ny-time').textContent = formatNY.time;
  document.getElementById('txt-ny-date').textContent = formatNY.date;
  rotateClockHands('ny', -4);

  // London Time (UTC+1)
  const formatLondon = getOffsetTimeStrings(1);
  document.getElementById('txt-london-time').textContent = formatLondon.time;
  document.getElementById('txt-london-date').textContent = formatLondon.date;
  rotateClockHands('london', 1);

  // Sydney Time (UTC+10)
  const formatSydney = getOffsetTimeStrings(10);
  document.getElementById('txt-sydney-time').textContent = formatSydney.time;
  document.getElementById('txt-sydney-date').textContent = formatSydney.date;
  rotateClockHands('sydney', 10);
}

function getOffsetTimeStrings(offsetHours) {
  // Convert current system time to target locale time
  const utc = Date.now() + (new Date().getTimezoneOffset() * 60000);
  const targetDate = new Date(utc + (3600000 * offsetHours));
  
  const h = targetDate.getHours().toString().padStart(2, '0');
  const m = targetDate.getMinutes().toString().padStart(2, '0');
  const s = targetDate.getSeconds().toString().padStart(2, '0');
  
  const month = targetDate.getMonth() + 1;
  const date = targetDate.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayStr = days[targetDate.getDay()];
  
  return {
    time: `${h}:${m}:${s}`,
    date: `${month}월 ${date}일 (${dayStr})`
  };
}


// ==============================================
// MODULE 5: DRAWING CHALKBOARD (그림판)
// ==============================================
let paintCanvas = null;
let paintCtx = null;
let isPainting = false;
let paintColor = '#0f172a';
let paintSize = 15;
let currentStamp = null; // ⭐, ❤️ etc

function startPaintModule() {
  paintCanvas = document.getElementById('paint-canvas');
  paintCtx = paintCanvas.getContext('2d');
  
  // Resize to fill layout fully
  const container = document.getElementById('paint-canvas-container');
  paintCanvas.width = container.clientWidth;
  paintCanvas.height = container.clientHeight;
  
  // Apply standard background fills on initialization
  selectPaintBg('white');
  
  // Reset pointers
  paintCanvas.addEventListener('mousedown', startDrawing);
  paintCanvas.addEventListener('mousemove', drawLine);
  paintCanvas.addEventListener('mouseup', stopDrawing);
  paintCanvas.addEventListener('mouseleave', stopDrawing);
  
  // Touch integrations for physical digital displays
  paintCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    paintCanvas.dispatchEvent(mouseEvent);
  });
  
  paintCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    paintCanvas.dispatchEvent(mouseEvent);
  });

  paintCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    paintCanvas.dispatchEvent(mouseEvent);
  });
}

function getCanvasCoordinates(e) {
  const rect = paintCanvas.getBoundingClientRect();
  // We must divide by scalingFactor because the entire layout viewport is scale-transformed!
  const canvasElement = document.getElementById('signage-canvas');
  const styleTransform = window.getComputedStyle(canvasElement).getPropertyValue('transform');
  let scaleX = 1.0;
  let scaleY = 1.0;
  if (styleTransform && styleTransform !== 'none') {
    const values = styleTransform.split('(')[1].split(')')[0].split(',');
    scaleX = parseFloat(values[0]) || 1.0;
    scaleY = parseFloat(values[3]) || scaleX || 1.0;
  }
  
  return {
    x: (e.clientX - rect.left) / scaleX,
    y: (e.clientY - rect.top) / scaleY
  };
}

function startDrawing(e) {
  const coords = getCanvasCoordinates(e);
  
  if (currentStamp) {
    // Stamp mode active - place stamp emoji and skip line draw
    playSoundTick();
    paintCtx.font = `${paintSize * 4}px Arial`;
    paintCtx.textAlign = 'center';
    paintCtx.textBaseline = 'middle';
    paintCtx.fillText(currentStamp, coords.x, coords.y);
    return;
  }
  
  isPainting = true;
  paintCtx.beginPath();
  paintCtx.moveTo(coords.x, coords.y);
  paintCtx.lineWidth = paintSize;
  paintCtx.lineCap = 'round';
  paintCtx.lineJoin = 'round';
  paintCtx.strokeStyle = paintColor;
}

function drawLine(e) {
  if (!isPainting || currentStamp) return;
  const coords = getCanvasCoordinates(e);
  paintCtx.lineTo(coords.x, coords.y);
  paintCtx.stroke();
}

function stopDrawing() {
  isPainting = false;
  paintCtx.closePath();
}

window.selectColor = function(color, btn) {
  playSoundTick();
  currentStamp = null;
  document.getElementById('stamp-indicator-btn').textContent = "그리기 모드";
  
  // Manage UI active selection outline tabs
  const btns = btn.parentNode.querySelectorAll('.paint-tool-btn');
  btns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  if (color === 'eraser') {
    paintColor = '#ffffff'; // White overlay represents eraser
    // If vintage green board is selected, match eraser color to blackboard color!
    const container = document.getElementById('paint-canvas-container');
    if (container.classList.contains('bg-[#0b5c3e]')) {
      paintColor = '#0b5c3e';
    }
  } else {
    paintColor = color;
  }
};

window.selectSize = function(size) {
  playSoundTick();
  paintSize = size;
  
  // Sync helper visual indicator highlights if needed (simplified)
  showAlert(`두께가 ${size}px로 변경되었습니다.`);
};

window.selectPaintBg = function(style) {
  playSoundTick();
  const container = document.getElementById('paint-canvas-container');
  // Clear styles
  container.className = "relative flex-1 rounded-3xl overflow-hidden shadow-inner border border-slate-200";
  
  // Temporarily grab image data to avoid drawing wipeout on background transformation
  const tmpImg = paintCtx.getImageData(0, 0, paintCanvas.width, paintCanvas.height);
  
  if (style === 'white') {
    container.classList.add('bg-white');
    paintCtx.fillStyle = '#ffffff';
    paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
  } else if (style === 'green') {
    // Vintage traditional green chalkboard
    container.classList.add('bg-[#0b5c3e]');
    paintCtx.fillStyle = '#0b5c3e';
    paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
  } else if (style === 'grid') {
    container.classList.add('bg-slate-50');
    paintCtx.fillStyle = '#f8fafc';
    paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
    // Draw fine grid pattern lines
    paintCtx.strokeStyle = '#e2e8f0';
    paintCtx.lineWidth = 1.2;
    for (let x = 40; x < paintCanvas.width; x += 40) {
      paintCtx.beginPath();
      paintCtx.moveTo(x, 0);
      paintCtx.lineTo(x, paintCanvas.height);
      paintCtx.stroke();
    }
    for (let y = 40; y < paintCanvas.height; y += 40) {
      paintCtx.beginPath();
      paintCtx.moveTo(0, y);
      paintCtx.lineTo(paintCanvas.width, y);
      paintCtx.stroke();
    }
  }
  
  // Draw the image data back over the new solid background
  paintCtx.putImageData(tmpImg, 0, 0);
};

window.selectStamp = function(stamp) {
  playSoundTick();
  currentStamp = stamp;
  document.getElementById('stamp-indicator-btn').textContent = `스탬프: ${stamp}`;
  showAlert(`인쇄 도우미: 도화지를 원하는 부분에 탭하여 ${stamp} 도장을 채워보세요.`);
};

window.clearStamp = function() {
  playSoundTock();
  currentStamp = null;
  document.getElementById('stamp-indicator-btn').textContent = "그리기 모드";
};

window.clearPaintCanvas = function() {
  playSoundTock();
  paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
  
  // Re-fill standard backdrop color
  const container = document.getElementById('paint-canvas-container');
  if (container.classList.contains('bg-[#0b5c3e]')) {
    paintCtx.fillStyle = '#0b5c3e';
  } else {
    paintCtx.fillStyle = '#ffffff';
  }
  paintCtx.fillRect(0, 0, paintCanvas.width, paintCanvas.height);
  showAlert("💡 판서가 정상적으로 모두 삭제되었습니다.");
};


// ==============================================
// MODULE 6: NOISE METER (AUDIO DECI BEL ANALYSIS)
// ==============================================
let noiseAudioCtx = null;
let noiseMicStream = null;
let noiseAnalyser = null;
let simulatedNoiseInterval = null;

function startNoiseModule() {
  // Clear any existing simulation interval first
  if (simulatedNoiseInterval) clearInterval(simulatedNoiseInterval);
  updateNoiseDashboardUI(35); // Initial baseline noise level
  
  // Active simulation engine directly so the user sees moving vectors immediately
  activeSimulatedNoise();
}

function updateNoiseDashboardUI(decibels) {
  const maxDB = 110;
  const clamped = Math.min(maxDB, Math.max(0, Math.round(decibels)));
  
  document.getElementById('noise-val-display').textContent = clamped;
  
  // Circle Dashboard gauge needle progress mapping
  // Semicircle dash offset is mapped from 0 to 188.4px total
  const gaugePath = document.getElementById('noise-gauge-path');
  const dTotal = 188.4;
  const ratio = clamped / maxDB;
  const offset = dTotal - (dTotal * ratio);
  gaugePath.style.strokeDashoffset = offset;
  
  // Badge guidelines status styling transformations
  const badgeObj = document.getElementById('noise-alert-badge');
  const gQuiet = document.getElementById('noise-guide-quiet');
  const gNorm = document.getElementById('noise-guide-normal');
  const gLoud = document.getElementById('noise-guide-loud');
  
  gQuiet.className = "bg-white border rounded-2xl p-4 flex flex-col items-center";
  gNorm.className = "bg-white border rounded-2xl p-4 flex flex-col items-center";
  gLoud.className = "bg-white border rounded-2xl p-4 flex flex-col items-center";
  
  if (clamped < 46) {
    badgeObj.textContent = "😊 평온함 (자습 가능)";
    badgeObj.className = "text-[26px] font-black text-emerald-500 px-8 py-2 rounded-full bg-emerald-50 border border-emerald-200 mt-2";
    gaugePath.setAttribute('stroke', '#10b981'); // emerald
    gQuiet.className = "bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col items-center shadow-sm";
  } else if (clamped <= 70) {
    badgeObj.textContent = "🗣️ 보통 수준 (토론 질문)";
    badgeObj.className = "text-[26px] font-black text-amber-500 px-8 py-2 rounded-full bg-amber-50 border border-amber-200 mt-2";
    gaugePath.setAttribute('stroke', '#f59e0b'); // amber
    gNorm.className = "bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col items-center shadow-sm";
  } else {
    badgeObj.textContent = "🚨 시끄러움! (경고 주의)";
    badgeObj.className = "text-[26px] font-black text-red-500 px-8 py-2 rounded-full bg-red-50 border border-red-200 mt-2";
    gaugePath.setAttribute('stroke', '#ef4444'); // red
    gLoud.className = "bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col items-center shadow-sm";
  }
}

function activeSimulatedNoise() {
  let timeCount = 0;
  simulatedNoiseInterval = setInterval(() => {
    timeCount += 0.15;
    // Beautiful organic wave simulation using sin waves to mimic classrooms
    let target = 35 + Math.sin(timeCount * 0.4) * 8 + Math.sin(timeCount * 1.5) * 4 + (Math.random() * 5);
    updateNoiseDashboardUI(target);
  }, 150);
  activeIntervals.push(simulatedNoiseInterval);
}

window.initRealMicAudio = async function() {
  playSoundTick();
  try {
    // Request microphone permissions
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Stop simulated interval if running
    if (simulatedNoiseInterval) clearInterval(simulatedNoiseInterval);
    
    noiseMicStream = stream;
    noiseAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = noiseAudioCtx.createMediaStreamSource(stream);
    
    noiseAnalyser = noiseAudioCtx.createAnalyser();
    noiseAnalyser.fftSize = 512;
    source.connect(noiseAnalyser);
    
    document.getElementById('noise-mic-status').textContent = "🎙️ 실제 교실 소음 측정 활성화 됨 (실시간 측정중)";
    document.getElementById('noise-mic-status').className = "text-[22px] font-bold text-teal-600 bg-teal-50 px-6 py-2 rounded-full border border-teal-200 shadow-sm";
    
    const nodeData = new Uint8Array(noiseAnalyser.frequencyBinCount);
    
    const decibelSampler = setInterval(() => {
      noiseAnalyser.getByteFrequencyData(nodeData);
      
      let sum = 0;
      for (let i = 0; i < nodeData.length; i++) {
        sum += nodeData[i];
      }
      
      const average = sum / nodeData.length;
      // Convert mapping ratio 0-255 to human class decibel levels 30-100dB
      const mappedDb = 30 + (average / 255) * 80;
      updateNoiseDashboardUI(mappedDb);
    }, 100);
    
    activeIntervals.push(decibelSampler);
  } catch (err) {
    console.warn("User rejected or browser iframe blocked microphone integration:", err);
    showAlert("❌ 마이크 접근이 제한되어 가상 측정(시뮬레이션)으로 이어집니다.", 3000);
  }
};


// ==============================================
// MODULE 7: WINNER/PRESENTER PICKER (RULLETTE)
// ==============================================
let pickerNames = [];
let isSpinning = false;
let confettiIntervalId = null;

function startPickerModule() {
  // Default classical student names seed roster
  const defaultRoster = "지민, 민우, 하은, 예준, 윤서, 도윤, 주원, 서아, 현우, 수민";
  const txtFld = document.getElementById('picker-names-txt');
  if (!txtFld.value.trim()) {
    txtFld.value = defaultRoster;
  }
  
  parseStudentRoster();
  drawRouletteWheel(0);
}

function parseStudentRoster() {
  const txt = document.getElementById('picker-names-txt').value;
  // Splits names on comma or newline divider tokens
  pickerNames = txt.split(/[,\n]/)
                    .map(name => name.trim())
                    .filter(name => name.length > 0);
}

window.resetStudentRoster = function() {
  playSoundTick();
  const defaultRoster = "지민, 민우, 하은, 예준, 윤서, 도윤, 주원, 서아, 현우, 수민";
  document.getElementById('picker-names-txt').value = defaultRoster;
  parseStudentRoster();
  drawRouletteWheel(0);
};

window.clearStudentRoster = function() {
  playSoundTock();
  document.getElementById('picker-names-txt').value = '';
  pickerNames = [];
  drawRouletteWheel(0);
};

// Radial Canvas Wheel Renderer drawing sector slots
function drawRouletteWheel(startAngleOffset = 0) {
  const canvas = document.getElementById('roulette-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const radius = size / 2;
  
  ctx.clearRect(0, 0, size, size);
  
  if (pickerNames.length === 0) {
    // Draw default empty placard
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('목록에 이름을 적어주세요!', radius, radius);
    return;
  }
  
  const arcSize = (Math.PI * 2) / pickerNames.length;
  // Vibrant theme color palette for roulette segments
  const colors = [
    '#ffe4e6', '#ffedd5', '#fef9c3', '#ecfdf5', '#ecfeff', '#e0f2fe', '#eef2ff', '#f5f3ff', '#fdf4ff', '#fae8ff'
  ];
  const borderHexColors = [
    '#f43f5e', '#f97316', '#eab308', '#10b981', '#06b6d4', '#0ea5e9', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'
  ];
  
  for (let i = 0; i < pickerNames.length; i++) {
    const angle = startAngleOffset + (i * arcSize);
    ctx.beginPath();
    ctx.fillStyle = colors[i % colors.length];
    
    // Draw arc from hub
    ctx.moveTo(radius, radius);
    ctx.arc(radius, radius, radius - 6, angle, angle + arcSize);
    ctx.lineTo(radius, radius);
    ctx.fill();
    
    // Fine slot outlines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Text labels inside segments
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(angle + (arcSize / 2));
    
    ctx.fillStyle = '#334155';
    // Position labels near outer edge offset
    ctx.textAlign = 'right';
    ctx.font = '900 32px Pretendard';
    ctx.fillText(pickerNames[i], radius - 48, 12);
    ctx.restore();
  }
}

window.spinRoulette = function() {
  parseStudentRoster();
  if (pickerNames.length === 0) {
    showAlert("⚠️ 먼저 학생 이름을 입력해주세요!");
    return;
  }
  if (isSpinning) return;
  
  isSpinning = true;
  document.getElementById('picker-trigger-btn').disabled = true;
  document.getElementById('picker-result-txt').textContent = "선정 중... 🎁";
  
  // Choose random award winner
  const winnerIndex = Math.floor(Math.random() * pickerNames.length);
  const arcSize = (Math.PI * 2) / pickerNames.length;
  
  // Calculate final absolute stopping angle
  // Pointer points straight upwards (index is determined by landing under pointer)
  const pointerAngle = -Math.PI / 2; 
  // Normalize landing sector center offset
  const winnerCenterAngle = (winnerIndex * arcSize) + (arcSize / 2);
  const targetStopAngleOffset = pointerAngle - winnerCenterAngle;
  
  // Spin multiple rotations before decelerating
  const totalRotations = Math.PI * 2 * (8 + Math.floor(Math.random() * 4));
  const finalRotAngle = targetStopAngleOffset - totalRotations;
  
  let currentAngle = 0;
  let speed = 0.5; // Initial radian velocity
  const start = Date.now();
  const runDuration = 3800; // 3.8sec animation and braking
  
  function animateSpin() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / runDuration, 1.0);
    
    // Decelerating rotation formula
    const easing = 1 - Math.pow(1 - progress, 4); // Quartic ease out
    currentAngle = finalRotAngle * easing;
    
    drawRouletteWheel(currentAngle);
    
    // Generate tick click sounds proportional to sector transitions
    const stepCount = Math.floor((currentAngle / (Math.PI * 2)) * pickerNames.length * 10);
    if (!animateSpin.lastStep || stepCount !== animateSpin.lastStep) {
      playSoundTick();
      animateSpin.lastStep = stepCount;
    }
    
    if (progress < 1.0) {
      requestAnimationFrame(animateSpin);
    } else {
      // Completed, display winner!
      isSpinning = false;
      document.getElementById('picker-trigger-btn').disabled = false;
      
      const winnerName = pickerNames[winnerIndex];
      document.getElementById('picker-result-txt').textContent = `축하합니다! 당첨자: ${winnerName} 🎉`;
      playSoundVictory();
      launchConfettiExplosion();
    }
  }
  
  requestAnimationFrame(animateSpin);
};

// Celebration Confetti particle generator
function launchConfettiExplosion() {
  const canvas = document.getElementById('presenter-confetti');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  
  const colors = ['#006CFF', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  const particles = [];
  
  // Generate beautiful gold and colored confetti structures
  for (let i = 0; i < 150; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.7) * 18 - 8,
      size: Math.random() * 12 + 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      gravity: 0.25
    });
  }
  
  if (confettiIntervalId) clearInterval(confettiIntervalId);
  
  let loopCount = 0;
  confettiIntervalId = setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    loopCount++;
    
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rot += p.rotSpeed;
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      ctx.restore();
    });
    
    if (loopCount > 90) { // Disappear after approx 3 seconds
      clearInterval(confettiIntervalId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, 33);
  activeIntervals.push(confettiIntervalId);
}


// ==============================================
// MODULE 8: MUSICAL HAND INSTRUMENTS (PIANO)
// ==============================================
let selectedInstrumentPreset = 'piano'; // piano, xylo, retro

function startInstrumentsModule() {
  // Mode selection buttons highlighter
  selectInstrumentMode('piano');
  
  // Keyboard alphanumeric triggers mapping (1 to 8 keys)
  const allowedKeys = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const scaleMapping = {
    '1': 'C4', '2': 'D4', '3': 'E4', '4': 'F4', '5': 'G4', '6': 'A4', '7': 'B4', '8': 'C5'
  };
  
  window.addEventListener('keydown', (e) => {
    if (allowedKeys.includes(e.key)) {
      triggerPianoTone(scaleMapping[e.key]);
    }
  });
}

window.selectInstrumentMode = function(preset) {
  playSoundTick();
  selectedInstrumentPreset = preset;
  
  // Clear other button markers
  document.getElementById('inst-btn-piano').className = "h-[70px] px-8 text-[22px] font-black rounded-2xl bg-white text-slate-500 border border-slate-200";
  document.getElementById('inst-btn-xylo').className = "h-[70px] px-8 text-[22px] font-black rounded-2xl bg-white text-slate-500 border border-slate-200";
  document.getElementById('inst-btn-retro').className = "h-[70px] px-8 text-[22px] font-black rounded-2xl bg-white text-slate-500 border border-slate-200";
  
  document.getElementById(`inst-btn-${preset}`).className = "h-[70px] px-8 text-[22px] font-black rounded-2xl bg-violet-600 text-white shadow-sm";
};

window.triggerPianoTone = function(note) {
  const freqs = {
    'C4': 261.63, // Do
    'D4': 293.66, // Re
    'E4': 329.63, // Mi
    'F4': 349.23, // Fa
    'G4': 392.00, // Sol
    'A4': 440.00, // La
    'B4': 493.88, // Si
    'C5': 523.25  // High Do
  };
  
  const freq = freqs[note];
  if (!freq) return;
  
  // Custom Synthesis Engine based on instrument modes
  if (selectedInstrumentPreset === 'piano') {
    // Beautiful clean layered sine wave
    triggerSynthesizerNote(freq, 0.5, 'sine', 1.2);
  } else if (selectedInstrumentPreset === 'xylo') {
    // Sharp triangle chime attack with rapid decay
    triggerSynthesizerNote(freq, 0.25, 'triangle', 1.4);
    triggerSynthesizerNote(freq * 2, 0.15, 'sine', 0.5); // Add chime high overtone
  } else if (selectedInstrumentPreset === 'retro') {
    // Classic 8-bit square retro arcade note
    triggerSynthesizerNote(freq, 0.4, 'square', 0.55);
  }
};


// ==============================================
// MODULE 9: KOREAN LADDER GAME (사다리 타기)
// ==============================================
let ladderPlayersCount = 4;
let ladderNodes = [];
let solvedPaths = {};
let isLadderSolving = false;

function startLadderModule() {
  regenerateLadderLayout();
}

// Adjust player counts
window.adjustLadderCount = function(delta) {
  playSoundTick();
  ladderPlayersCount = Math.max(2, Math.min(6, ladderPlayersCount + delta));
  document.getElementById('ladder-count-display').textContent = `${ladderPlayersCount}명`;
  regenerateLadderLayout();
};

window.regenerateLadderLayout = function() {
  playSoundTock();
  const topInputs = document.getElementById('ladder-top-inputs');
  const bottomInputs = document.getElementById('ladder-bottom-inputs');
  
  topInputs.innerHTML = '';
  bottomInputs.innerHTML = '';
  solvedPaths = {};
  isLadderSolving = false;
  
  const initialNames = ['지은', '종현', '다혜', '수호', '은우', '채원'];
  const initialPrizes = ['⭐꽝⭐', '백만골드', '발표자', '심부름', '청소하기', '과자선물'];
  
  // Render text controls mapping to paths
  for (let i = 0; i < ladderPlayersCount; i++) {
    // Header names box
    const nameInput = document.createElement('input');
    nameInput.type = "text";
    nameInput.className = "w-full text-center text-[22px] font-black h-[60px] border border-cyan-200 bg-cyan-50/50 rounded-xl outline-none focus:bg-white focus:border-cyan-500 font-sans";
    nameInput.value = initialNames[i] || `학생 ${i+1}`;
    nameInput.id = `ladder-top-${i}`;
    topInputs.appendChild(nameInput);
    
    // Bottom prizes outcome box
    const prizeInput = document.createElement('input');
    prizeInput.type = "text";
    prizeInput.className = "w-full text-center text-[22px] font-black h-[60px] border border-slate-200 bg-slate-50 rounded-xl outline-none focus:bg-white focus:border-cyan-550 font-sans";
    prizeInput.value = initialPrizes[i] || `벌칙 ${i+1}`;
    prizeInput.id = `ladder-bottom-${i}`;
    bottomInputs.appendChild(prizeInput);
  }
  
  // Build underlying rung topology schema representation
  buildLadderGridTopology();
  drawLadderBaseCanvas();
};

function buildLadderGridTopology() {
  ladderNodes = [];
  
  // Nodes density structure: 5 vertical height intervals
  const verticalJoints = 5;
  
  // Setup standard randomized horizontal bridge coordinates
  for (let y = 0; y < verticalJoints; y++) {
    const rowRungs = [];
    for (let x = 0; x < ladderPlayersCount - 1; x++) {
      // Create random connection rung bridge (approx 55% probability)
      // Prevent adjacent rungs overlap on identical horizontal levels
      const carryRung = Math.random() < 0.55 && (x === 0 || !rowRungs[x - 1]);
      rowRungs.push(carryRung);
    }
    ladderNodes.push(rowRungs);
  }
}

function drawLadderBaseCanvas() {
  const canvas = document.getElementById('ladder-canvas');
  const container = document.getElementById('ladder-canvas-container');
  
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const cols = ladderPlayersCount;
  const colWidth = canvas.width / cols;
  
  // Verticals lines
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  
  for (let i = 0; i < cols; i++) {
    const x = (i * colWidth) + (colWidth / 2);
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, canvas.height - 20);
    ctx.stroke();
    
    // Draw pretty circular start node buttons
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(x, 20, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, canvas.height - 20, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Horizontals rungs
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 6;
  
  const numRows = ladderNodes.length;
  const rowHeight = (canvas.height - 80) / (numRows + 1);
  
  for (let r = 0; r < numRows; r++) {
    const y = 60 + (r * rowHeight);
    for (let c = 0; c < cols - 1; c++) {
      if (ladderNodes[r][c]) {
        const xStart = (c * colWidth) + (colWidth / 2);
        const xEnd = ((c + 1) * colWidth) + (colWidth / 2);
        
        ctx.beginPath();
        ctx.moveTo(xStart, y);
        ctx.lineTo(xEnd, y);
        ctx.stroke();
      }
    }
  }
}

window.triggerLadderAnimation = function() {
  if (isLadderSolving) return;
  playSoundTick();
  
  isLadderSolving = true;
  document.getElementById('ladder-trigger-btn').disabled = true;
  document.getElementById('ladder-trigger-btn').textContent = "사다리 주행 중... 🏃";
  
  const canvas = document.getElementById('ladder-canvas');
  const ctx = canvas.getContext('2d');
  const cols = ladderPlayersCount;
  const colWidth = canvas.width / cols;
  const numRows = ladderNodes.length;
  const rowHeight = (canvas.height - 80) / (numRows + 1);
  
  // Standard list color strings for pathways
  const lineColors = ['#ef4444', '#006CFF', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
  
  // Solves pathway navigation coordinates list for a player index
  function solvePathForPlayer(playerIndex) {
    const coords = [{ x: (playerIndex * colWidth) + (colWidth / 2), y: 20 }];
    let currentCol = playerIndex;
    
    for (let r = 0; r < numRows; r++) {
      const y = 60 + (r * rowHeight);
      
      // Node intersection check:
      let nextCol = currentCol;
      if (currentCol > 0 && ladderNodes[r][currentCol - 1]) {
        // Cross rung left
        nextCol = currentCol - 1;
      } else if (currentCol < cols - 1 && ladderNodes[r][currentCol]) {
        // Cross rung right
        nextCol = currentCol + 1;
      }
      
      const xStart = (currentCol * colWidth) + (colWidth / 2);
      const xEnd = (nextCol * colWidth) + (colWidth / 2);
      
      // Traverse down vertical first
      coords.push({ x: xStart, y: y });
      
      if (nextCol !== currentCol) {
        // Traverse cross rung horizontally
        coords.push({ x: xEnd, y: y });
        currentCol = nextCol;
      }
    }
    
    // Final exit node drop
    coords.push({ x: (currentCol * colWidth) + (colWidth / 2), y: canvas.height - 20 });
    return { path: coords, finalCol: currentCol };
  }
  
  // Resolve ALL lanes
  const playersPaths = [];
  for (let i = 0; i < cols; i++) {
    playersPaths.push(solvePathForPlayer(i));
  }
  
  // Stagger draw animations sequence with interval timers
  let activeDrawIndex = 0;
  
  function drawNextLaneSegment() {
    if (activeDrawIndex >= cols) {
      // Completed all drawings!
      document.getElementById('ladder-trigger-btn').disabled = false;
      document.getElementById('ladder-trigger-btn').textContent = "다시 시작하기";
      isLadderSolving = false;
      document.getElementById('ladder-instruction-label').textContent = "🎁 사다리 게임 결과를 확인해 보세요! 🎁";
      playSoundVictory();
      return;
    }
    
    const resolve = playersPaths[activeDrawIndex];
    const coords = resolve.path;
    const pathColor = lineColors[activeDrawIndex % lineColors.length];
    
    let pathIdx = 0;
    
    function step() {
      if (pathIdx >= coords.length - 1) {
        // Done with this path, highlight bottom label outcome alert
        const topName = document.getElementById(`ladder-top-${activeDrawIndex}`).value;
        const bottomPrize = document.getElementById(`ladder-bottom-${resolve.finalCol}`).value;
        showAlert(`🎉 ${topName} ➡️ ${bottomPrize}`, 2500);
        
        // Stagger to next player node draw
        activeDrawIndex++;
        setTimeout(drawNextLaneSegment, 500);
        return;
      }
      
      const pt1 = coords[pathIdx];
      const pt2 = coords[pathIdx + 1];
      
      // Animate line segment
      let steps = 15;
      let currStep = 0;
      
      function smoothDraw() {
        currStep++;
        const ratio = currStep / steps;
        const currX = pt1.x + (pt2.x - pt1.x) * ratio;
        const currY = pt1.y + (pt2.y - pt1.y) * ratio;
        
        ctx.strokeStyle = pathColor;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(currX, currY);
        ctx.stroke();
        
        // Sparkle ticker beep sound
        if (currStep === 1) playSoundTick();
        
        if (currStep < steps) {
          requestAnimationFrame(smoothDraw);
        } else {
          pathIdx++;
          step();
        }
      }
      smoothDraw();
    }
    
    step();
  }
  
  // Trigger cascade
  drawNextLaneSegment();
};


// Run framework on load
initApp();
