// ==========================================
// MISSIONDESK CORE APP LOGIC (UI, SORA, Weather, Files)
// ==========================================

// --- GLOBAL VARIABLES ---
window.currentPanel = 0;
window.sailResult = { grc: 0, arc: 0, sail: 0, grcLabel: '–', arcLabel: '–' };
window.smhiData = null;
window.waypoints = []; 
window.fencePoints = []; 
window.rallyPoints = []; 
window._nrgSuggested = null;
window._loadedFiles = { mission: '', fence: '', rally: '' };

window._avwxMetars = null;
window._avwxTafs = null;
window._avwxNotams = null;
window._avwxFetchTs = null;
window.uploadedCharts = []; // Stores charts as Base64 images
window.ofpInputData = {}; // Stores all manual OFP inputs
window.saveOfpField = function(id, val) {
  window.ofpInputData[id] = val;
};

// --- UX REDESIGN: VALIDATION & STALE DATA ---
window._sailCalculated = false;

window.markStaleData = function() {
  if (window._sailCalculated) {
    const warn = document.getElementById('stale-warn-sail');
    if (warn) warn.style.display = 'inline';
  }
};

window.validateAndNext = function(currentPanel, nextPanel) {
  let isValid = true;
  let firstErr = null;

  if (currentPanel === 0) {
    // Fields that MUST be filled
    const reqIds = ['mission-name', 'op-name', 'pilot-name', 'op-date', 'drone-model', 'drone-dim', 'drone-speed'];
    
    reqIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (!el.value.trim()) {
          el.classList.add('input-error');
          isValid = false;
          if (!firstErr) firstErr = el;
        } else {
          el.classList.remove('input-error');
        }
        // Remove red border as soon as user starts typing
        el.addEventListener('input', function() { this.classList.remove('input-error'); }, {once: true});
      }
    });
  }

  // If anything is missing, abort and scroll to the error!
  if (!isValid && firstErr) {
    // If the field is inside a collapsed accordion, open it first!
    const accordionContent = firstErr.closest('.accordion-content');
    if (accordionContent && accordionContent.style.display === 'none') {
      const header = accordionContent.previousElementSibling;
      if (header && header.classList.contains('accordion-header')) header.click();
    }
    // Smooth scroll to the red field
    firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  window.goTo(nextPanel);
};

// --- TEXT SIZE SCALING ---
window.currentTextOffset = parseInt(localStorage.getItem('missiondesk-text-size')) || 0;
window.adjustTextSize = function(delta) {
  window.currentTextOffset += delta;
  if (window.currentTextOffset < -2) window.currentTextOffset = -2; // Min limit
  if (window.currentTextOffset > 10) window.currentTextOffset = 10; // Max limit
  
  document.documentElement.style.setProperty('--tz', window.currentTextOffset + 'px');
  localStorage.setItem('missiondesk-text-size', window.currentTextOffset);
  
  // Force auto-expand on the text boxes so they do not clip text when it grows
  if (typeof window.triggerAutoExpand === 'function') window.triggerAutoExpand();
};

window.syncApiKeys = function() {
  const oaipSettings = document.getElementById('settings-openaip-key');
  const oaipWeather = document.getElementById('openaip-api-key');
  const cwxSettings = document.getElementById('settings-checkwx-key');
  const cwxWeather = document.getElementById('checkwx-api-key');

  const oaipVal = localStorage.getItem('openaip_key') || '';
  const cwxVal = localStorage.getItem('checkwx_key') || '';

  if (oaipSettings && oaipSettings.value !== oaipVal) oaipSettings.value = oaipVal;
  if (oaipWeather && oaipWeather.value !== oaipVal) oaipWeather.value = oaipVal;
  if (cwxSettings && cwxSettings.value !== cwxVal) cwxSettings.value = cwxVal;
  if (cwxWeather && cwxWeather.value !== cwxVal) cwxWeather.value = cwxVal;

  const lbl = document.getElementById('settings-textsize-label');
  if (lbl) lbl.textContent = (window.currentTextOffset >= 0 ? '+' : '') + window.currentTextOffset;
};

window.testCheckWxKey = async function() {
  const statusEl = document.getElementById('settings-checkwx-status');
  const key = localStorage.getItem('checkwx_key') || '';
  if (!key) {
    if (statusEl) { statusEl.style.color = 'var(--danger)'; statusEl.textContent = '⚠ No API key entered.'; }
    return;
  }
  if (statusEl) { statusEl.style.color = 'var(--accent)'; statusEl.textContent = '⟳ Testing key…'; }
  try {
    const res = await fetch(`https://api.checkwx.com/metar/ESSA/decoded`, { headers: { 'X-API-Key': key } });
    const data = await res.json();
    if (data && data.data && data.data.length > 0) {
      if (statusEl) { statusEl.style.color = 'var(--ok)'; statusEl.textContent = '✓ Key valid – CheckWX responded successfully.'; }
    } else if (data && data.errors) {
      if (statusEl) { statusEl.style.color = 'var(--danger)'; statusEl.textContent = '✗ Key rejected: ' + (data.errors[0] || 'Unknown error'); }
    } else {
      if (statusEl) { statusEl.style.color = 'var(--warn)'; statusEl.textContent = '⚠ Unexpected response. Key may still work.'; }
    }
  } catch(e) {
    if (statusEl) { statusEl.style.color = 'var(--danger)'; statusEl.textContent = '✗ Network error: ' + e.message; }
  }
};

window.settingsClearApiKeys = function() {
  if (!confirm('Remove all saved API keys from this browser? You will need to re-enter them to use METAR/TAF and airspace features.')) return;
  localStorage.removeItem('openaip_key');
  localStorage.removeItem('checkwx_key');
  window.syncApiKeys();
  window.refreshAllMaps();
  alert('API keys cleared.');
};

// --- HELPERS & UTILS ---
window.escHtml = function(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
};

// --- INPUT / FILE-IMPORT SAFETY LIMITS ---
// Hard caps used to reject pathological imports before they reach the parsers.
window.MAX_IMPORT_BYTES = 8 * 1024 * 1024;   // 8 MB — waypoint / .plan / .dbrf text files
window.MAX_PDF_BYTES    = 50 * 1024 * 1024;  // 50 MB — PDF chart uploads
window.MAX_WAYPOINTS    = 2000;              // sane ceiling on imported nav points / vertices

// Returns true only for a finite, in-range WGS-84 coordinate pair.
window.isValidLatLon = function(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
         lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
};

// Drops out-of-range / non-finite points and caps the collection size.
// Returns { points, dropped, capped } so callers can report what happened.
window.sanitisePoints = function(points, cap) {
  cap = cap || window.MAX_WAYPOINTS;
  const list = Array.isArray(points) ? points : [];
  const valid = list.filter(p => p && window.isValidLatLon(Number(p.lat), Number(p.lon)));
  const dropped = list.length - valid.length;
  const capped = valid.length > cap;
  return { points: capped ? valid.slice(0, cap) : valid, dropped, capped };
};

// Applies a default maxlength to every free-text field that doesn't already
// declare one, preventing pathologically large strings from live typing.
// Programmatic .value assignment (e.g. loading a .dbrf) bypasses maxlength,
// so previously-saved data is never truncated — only manual entry is bounded.
window.applyInputSafetyLimits = function() {
  document.querySelectorAll('input[type="text"], input:not([type])').forEach(el => {
    if (!el.hasAttribute('maxlength')) el.setAttribute('maxlength', '1000');
  });
  document.querySelectorAll('textarea').forEach(el => {
    if (!el.hasAttribute('maxlength')) el.setAttribute('maxlength', '50000');
  });
};

window._debounce = function(fn, ms) {
  let t; return function(...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
};

window.fmt = function(n, decimals) {
  if (n == null || isNaN(n)) return '–';
  return new Intl.NumberFormat('en-GB', { minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 6 }).format(n);
};

window.formatDateInput = function(el) {
  let v = el.value.replace(/[^0-9]/g, '');
  if (v.length > 4)  v = v.slice(0,4) + '-' + v.slice(4);
  if (v.length > 7)  v = v.slice(0,7) + '-' + v.slice(7);
  if (v.length > 10) v = v.slice(0,10);
  el.value = v;
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(v);
  el.style.borderColor = v.length === 0 ? '' : ok ? 'var(--ok)' : 'var(--warn)';
};

window.openUrl = function(url) {
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); setTimeout(() => document.body.removeChild(a), 0);
};

window.toggleTheme = function() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('dbrf-theme', next);
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
};

window.toggleSidebar = function() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('hidden');
  }
  
  // Force the maps to redraw – done with two time delays
  // to ensure the CSS animation has fully completed.
  const resizeMaps = () => {
    if (window._deliveryMap && typeof window._deliveryMap.invalidateSize === 'function') window._deliveryMap.invalidateSize();
    if (window._waypointMap && typeof window._waypointMap.invalidateSize === 'function') window._waypointMap.invalidateSize();
    if (window._briefMap && typeof window._briefMap.invalidateSize === 'function') window._briefMap.invalidateSize();
  };
  
  setTimeout(resizeMaps, 10);
  setTimeout(resizeMaps, 250);
};

window.updateHeaderMissionName = function() {
  const nameInput = document.getElementById('mission-name');
  const headerName = document.getElementById('header-mission-name');
  if (nameInput && headerName) {
    headerName.textContent = nameInput.value ? `[ ${nameInput.value.toUpperCase()} ]` : '';
  }
};

// --- NAVIGATION ---
window.goTo = function(idx) {
  document.querySelectorAll('.panel').forEach((p,i) => { p.classList.toggle('active', i === idx); });
  document.querySelectorAll('.step-btn').forEach((b,i) => {
    b.classList.remove('active', 'done');
    if (i < idx) b.classList.add('done');
    if (i === idx) b.classList.add('active');
  });
  window.currentPanel = idx;
  
  // Index 5 is now Weather & Airspace
  if (idx === 5) {
    if (typeof window.prefillCoordsForSMHI === 'function') window.prefillCoordsForSMHI();
    if (typeof window.updateRadioFreqUI === 'function') window.updateRadioFreqUI();
  }
  
  // Index 1 is our new Volume Planner
  if (idx === 1) {
    setTimeout(() => {
      if (typeof window.calcVolumes === 'function') window.calcVolumes();
    }, 50);
  }
  
  // Force expansion and size updates as soon as the page becomes visible
  setTimeout(() => {
    if (window._deliveryMap && typeof window._deliveryMap.invalidateSize === 'function') window._deliveryMap.invalidateSize();
    if (window._waypointMap && typeof window._waypointMap.invalidateSize === 'function') window._waypointMap.invalidateSize();
    if (window._briefMap && typeof window._briefMap.invalidateSize === 'function') window._briefMap.invalidateSize();
    if (window._volumeMap && typeof window._volumeMap.invalidateSize === 'function') window._volumeMap.invalidateSize();
    if (typeof window.triggerAutoExpand === 'function') window.triggerAutoExpand();
  }, 10);
  setTimeout(() => { if (typeof window.triggerAutoExpand === 'function') window.triggerAutoExpand(); }, 150);

  const mainContent = document.querySelector('.main-content');
  if (mainContent) mainContent.scrollTo({top: 0, behavior: 'smooth'});
  else window.scrollTo({top: 0, behavior: 'smooth'});
};

window.toggleConOps = function() {
  const el = document.getElementById('conops-full');
  const arrow = document.getElementById('conops-arrow');
  if (el.style.display === 'none') { el.style.display = 'block'; if (arrow) arrow.textContent = '▲'; } 
  else { el.style.display = 'none'; if (arrow) arrow.textContent = '▼'; }
};

window.handleOpTypeChange = function() {
  const type = document.getElementById('op-type').value;
  const isDelivery = type === 'leverans';
  document.getElementById('delivery-section').style.display = isDelivery ? 'block' : 'none';
  if (isDelivery) {
    if(typeof window.updateDeliveryMap === 'function') window.updateDeliveryMap();
    const startEl = document.getElementById('delivery-start-coords');
    if (window.waypoints && window.waypoints.length > 0 && startEl && !startEl.value.trim()) {
      if(typeof window.autoFillDeliveryCoords === 'function') window.autoFillDeliveryCoords();
    }
  }
};

window.handleFlightTypeChange = function() {
  const type = document.getElementById('op-flighttype').value;
  const isAuto = type === 'autonomt';
  document.getElementById('waypoint-section').style.display = isAuto ? 'block' : 'none';
  if (isAuto && window.waypoints.length === 0) if(typeof window.addWaypoint === 'function') window.addWaypoint();
};

// --- COORDINATE PARSING ---
window.parseCoords = function(raw) {
  if (!raw || raw === '–') return null;
  raw = raw.trim();
  const dmsRe = /(\d+)[°]\s*(\d+)['\u2019]\s*(\d+(?:\.\d+)?)["\u201d\u2019]{1,2}\s*([NSns])[,\s]+(\d+)[°]\s*(\d+)['\u2019]\s*(\d+(?:\.\d+)?)["\u201d\u2019]{1,2}\s*([EWew])/;
  const dms = raw.match(dmsRe);
  if (dms) {
    let lat = parseInt(dms[1]) + parseInt(dms[2]) / 60 + parseFloat(dms[3]) / 3600;
    let lon = parseInt(dms[5]) + parseInt(dms[6]) / 60 + parseFloat(dms[7]) / 3600;
    if (/[Ss]/.test(dms[4])) lat = -lat;
    if (/[Ww]/.test(dms[8])) lon = -lon;
    return { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
  }
  const decRe = /([-\d.]+)\s*°?\s*([NSns])?,?\s*([-\d.]+)\s*°?\s*([EWew])?/;
  const dec = raw.match(decRe);
  if (dec) {
    let lat = parseFloat(dec[1]);
    let lon = parseFloat(dec[3]);
    if (dec[2] && /[Ss]/.test(dec[2])) lat = -lat;
    if (dec[4] && /[Ww]/.test(dec[4])) lon = -lon;
    if (!isNaN(lat) && !isNaN(lon)) return { lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
  }
  return null;
};

window.parseCoordFull = function(raw) {
  if (!raw) return null;
  raw = raw.trim();
  const basic = window.parseCoords(raw);
  if (basic) return basic;

  const dmsRe = /(\d+)[°\s](\d+)['\s]([\d.]+)["\s]*([NS])[,\s]+(\d+)[°\s](\d+)['\s]([\d.]+)["\s]*([EW])/i;
  const dm = raw.match(dmsRe);
  if (dm) {
    let lat = parseFloat(dm[1]) + parseFloat(dm[2])/60 + parseFloat(dm[3])/3600;
    let lon = parseFloat(dm[5]) + parseFloat(dm[6])/60 + parseFloat(dm[7])/3600;
    if (/S/i.test(dm[4])) lat = -lat;
    if (/W/i.test(dm[8])) lon = -lon;
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) return {lat, lon};
  }
  const plainRe = /([-\d.]+)\s*([NS])?\s*[,\s]\s*([-\d.]+)\s*([EW])?/i;
  const pl = raw.match(plainRe);
  if (pl) {
    let lat = parseFloat(pl[1]);
    let lon = parseFloat(pl[3]);
    if (/S/i.test(pl[2])) lat = -lat;
    if (/W/i.test(pl[4])) lon = -lon;
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) return {lat, lon};
  }
  return null;
};

window.applyParsedCoords = function(raw, forceOverwrite) {
  const parsed = window.parseCoords(raw);
  if (!parsed) return;
  window._parsedLat = parsed.lat;
  window._parsedLon = parsed.lon;
};

window.prefillCoordsForSMHI = function() {
  const coordsRaw = document.getElementById('op-coords')?.value || '';
  const parsed = window.parseCoords(coordsRaw);
  if (parsed) {
    window._parsedLat = parsed.lat;
    window._parsedLon = parsed.lon;
    const status = document.getElementById('smhi-status');
    if (status && !status.textContent) {
      status.style.color = 'var(--muted)';
      status.textContent = `Coordinates from DOI: ${parsed.lat.toFixed(6)}, ${parsed.lon.toFixed(6)} – use the links above to fetch forecast`;
    }
  }
};

window.getWeatherCoords = function() {
  if (window._parsedLat && window._parsedLon) {
    return { lat: window._parsedLat.toFixed(4), lon: window._parsedLon.toFixed(4) };
  }
  const coordsRaw = document.getElementById('op-coords')?.value || '';
  const parsed = window.parseCoords(coordsRaw);
  const lat = parsed?.lat || 57.7;
  const lon = parsed?.lon || 11.97;
  return { lat: lat.toFixed(4), lon: lon.toFixed(4) };
};

// --- DRONE DATABASE & ENERGY ---
window.fillUasFromSelect = function(key) {
  if (typeof window.UAS_MODELS === 'undefined') return;
  const m = window.UAS_MODELS[key];
  if (m) document.getElementById('conops-uas').value = m.desc;
};

window.searchDroneDB = function(query) {
  if (typeof window.DRONE_DB === 'undefined') return [];
  
  // If the field is empty: return the entire database
  if (!query || query.trim() === '') {
    return window.DRONE_DB;
  }
  
  // Otherwise filter based on what the user types in
  const q = query.toLowerCase().trim();
  return window.DRONE_DB.filter(d => d.key.includes(q) || d.name.toLowerCase().includes(q));
};

window.showDroneSuggestions = function(val) {
  const box = document.getElementById('drone-suggestions');
  const statusEl = document.getElementById('drone-lookup-status');
  if (!box) return;
  
  // Fetch the list from the search function
  const results = window.searchDroneDB(val || '');

  // If no drone was found
  if (results.length === 0) {
    box.style.display = 'none';
    if (statusEl && val && val.length > 1) {
      statusEl.style.color = 'var(--muted)';
      statusEl.textContent = 'Model not in database – enter specs manually';
    }
    return;
  }
  
  // Build the list visually
  box.innerHTML = results.map(d => {
    const typeIcon  = d.type === 'fixed-wing' ? '✈ ' : d.type === 'fixed-wing-vtol' ? '✈⬆ ' : '🚁 ';
    const typeColor = (d.type||'').includes('fixed-wing') ? 'var(--ok)' : 'var(--accent)';
    return `
    <div class="drone-suggestion-item" data-drone-key="${d.key}"
      style="padding:8px 12px;cursor:pointer;font-family:var(--mono);font-size:11px;border-bottom:1px solid var(--border);">
      <span style="color:${typeColor}">${typeIcon}</span><strong>${d.name}</strong>
      <span style="color:var(--muted);margin-left:8px;">${window.fmt(d.dim,2)} m · ${window.fmt(d.mtom,3)} kg · EU ${d.euClass}</span>
    </div>`;
  }).join('');
  
  box.style.display = 'block';
};

window.hideDroneSuggestions = function() {
  const box = document.getElementById('drone-suggestions');
  if (box) box.style.display = 'none';
};

window.applyDroneSpec = function(key) {
  const drone = window.DRONE_DB.find(x => x.key === key);
  if (!drone) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  
  set('drone-model',  drone.name);
  set('drone-dim',    drone.dim);
  set('drone-speed',  drone.maxSpeed);
  set('drone-mtom',   drone.mtom);
  set('drone-cruise', drone.cruiseSpeed);

  const classEl = document.getElementById('drone-class');
  if (classEl && drone.euClass) {
    for (const opt of classEl.options) { if (opt.value === drone.euClass) { classEl.value = drone.euClass; break; } }
  }

  if (typeof window.updateDimHint === 'function') window.updateDimHint();
  const igrcDim = document.getElementById('igrc-dim'); if (igrcDim) igrcDim.value = drone.dim;
  const igrcSpeed = document.getElementById('igrc-speed'); if (igrcSpeed) igrcSpeed.value = drone.maxSpeed;

  const statusEl = document.getElementById('drone-lookup-status');
  if (statusEl) {
    statusEl.style.color = 'var(--ok)';
    const typeLabel = drone.type === 'fixed-wing' ? ' · Fixed-wing' : drone.type === 'fixed-wing-vtol' ? ' · VTOL fixed-wing' : ' · Multirotor';
    statusEl.textContent = `✓ ${drone.name}${typeLabel} · ${window.fmt(drone.dim,2)} m · ${window.fmt(drone.mtom,3)} kg · ${window.fmt(drone.maxSpeed,1)} m/s max · EU ${drone.euClass}`;
  }

  if (drone.nrg) {
    const nrg = drone.nrg;
    const nrgFields = [
      ['nrg-setup', nrg.setup], ['nrg-takeoff', nrg.takeoff], ['nrg-cruise', nrg.cruise],
      ['nrg-descent', nrg.descent], ['nrg-takeoff-min', nrg.takeoffMin], ['nrg-descent-min', nrg.descentMin],
    ];
    nrgFields.forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val != null) {
        el.value = val;
        el.style.borderColor = 'var(--accent)'; el.style.background = 'rgba(0,105,180,0.03)';
        const badge = document.getElementById(id + '-badge'); if (badge) badge.style.display = 'inline';
      }
    });

    const banner = document.getElementById('nrg-source-banner');
    const bannerText = document.getElementById('nrg-source-text');
    if (banner && bannerText) {
      const typeLabel = drone.type === 'fixed-wing' ? 'Fixed-wing' : drone.type === 'fixed-wing-vtol' ? 'VTOL fixed-wing' : 'Multirotor';
      bannerText.textContent = `Energy profile: ${drone.name} (${typeLabel}) — ${nrg.note || 'Database estimate'}. Adjust values to match your actual experience.`;
      banner.style.display = 'flex';
    }
    window._nrgSuggested = { ...nrg, model: drone.name };
  }

  window.hideDroneSuggestions();
  if (typeof window.recalcFlightTime === 'function') window.recalcFlightTime();
};

window.nrgMarkEdited = function(fieldId) {
  const el = document.getElementById(fieldId);
  if (el) { el.style.borderColor = ''; el.style.background  = ''; }
  const badge = document.getElementById(fieldId + '-badge');
  if (badge) badge.style.display = 'none';
};

window.nrgResetToDefaults = function() {
  const s = window._nrgSuggested;
  if (!s) return;
  const map = {
    'nrg-setup': s.setup, 'nrg-takeoff': s.takeoff, 'nrg-cruise': s.cruise,
    'nrg-descent': s.descent, 'nrg-takeoff-min': s.takeoffMin, 'nrg-descent-min': s.descentMin,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val != null) {
      el.value = val; el.style.borderColor = 'var(--accent)'; el.style.background = 'rgba(0,105,180,0.03)';
      const badge = document.getElementById(id + '-badge'); if (badge) badge.style.display = 'inline';
    }
  });
  if (typeof window.recalcEnergy === 'function') window.recalcEnergy();
};

window.recalcEnergy = function() {
  const setupPct = parseFloat(document.getElementById('nrg-setup')?.value) || 0;
  const takeoffRate = parseFloat(document.getElementById('nrg-takeoff')?.value) || 0;
  const takeoffMin = parseFloat(document.getElementById('nrg-takeoff-min')?.value) || 0;
  const cruiseRate = parseFloat(document.getElementById('nrg-cruise')?.value) || 0;
  const descentRate = parseFloat(document.getElementById('nrg-descent')?.value) || 0;
  const descentMin = parseFloat(document.getElementById('nrg-descent-min')?.value) || 0;
  const reservePct = parseFloat(document.getElementById('nrg-reserve')?.value) || 0;
  
  const totalMin = parseFloat(document.getElementById('op-duration')?.value) || 0;
  
  if (totalMin <= 0) {
    document.getElementById('nrg-result').style.display = 'none';
    return;
  }

  const cruiseMin = Math.max(0, totalMin - takeoffMin - descentMin);
  
  const e_takeoff = takeoffRate * takeoffMin;
  const e_cruise = cruiseRate * cruiseMin;
  const e_descent = descentRate * descentMin;
  const e_fixed = setupPct;
  const e_reserve = reservePct;
  
  const e_total = e_fixed + e_takeoff + e_cruise + e_descent + e_reserve;
  const e_flight = e_fixed + e_takeoff + e_cruise + e_descent;

  const resultBox = document.getElementById('nrg-result');
  const bar = document.getElementById('nrg-bar');
  const legend = document.getElementById('nrg-legend');
  const summary = document.getElementById('nrg-summary');
  const warning = document.getElementById('nrg-warning');

  resultBox.style.display = 'block';

  const cFixed = '#647b91';
  const cTakeoff = '#0069b4';
  const cCruise = '#1a7a3a';
  const cDescent = '#c96a00';
  const cReserve = '#c62828';
  const cRemaining = '#d1d9e0';

  const pFixed = Math.min(e_fixed, 100);
  const pTakeoff = Math.min(e_takeoff, 100 - pFixed);
  const pCruise = Math.min(e_cruise, 100 - pFixed - pTakeoff);
  const pDescent = Math.min(e_descent, 100 - pFixed - pTakeoff - pCruise);
  const pReserve = Math.min(e_reserve, 100 - pFixed - pTakeoff - pCruise - pDescent);
  const pRemaining = Math.max(0, 100 - e_total);

  bar.innerHTML = `
    ${pFixed > 0 ? `<div style="width:${pFixed}%;background:${cFixed};" title="Setup: ${e_fixed.toFixed(1)}%"></div>` : ''}
    ${pTakeoff > 0 ? `<div style="width:${pTakeoff}%;background:${cTakeoff};" title="Take-off: ${e_takeoff.toFixed(1)}%"></div>` : ''}
    ${pCruise > 0 ? `<div style="width:${pCruise}%;background:${cCruise};" title="Cruise: ${e_cruise.toFixed(1)}%"></div>` : ''}
    ${pDescent > 0 ? `<div style="width:${pDescent}%;background:${cDescent};" title="Descent: ${e_descent.toFixed(1)}%"></div>` : ''}
    ${pReserve > 0 ? `<div style="width:${pReserve}%;background:${cReserve};" title="Reserve: ${e_reserve.toFixed(1)}%"></div>` : ''}
    ${pRemaining > 0 ? `<div style="width:${pRemaining}%;background:${cRemaining};" title="Remaining: ${pRemaining.toFixed(1)}%"></div>` : ''}
  `;

  legend.innerHTML = `
    <div style="display:flex;align-items:center;gap:4px;"><div style="width:8px;height:8px;background:${cFixed};border-radius:2px;"></div>Setup ${e_fixed.toFixed(1)}%</div>
    <div style="display:flex;align-items:center;gap:4px;"><div style="width:8px;height:8px;background:${cTakeoff};border-radius:2px;"></div>Take-off ${e_takeoff.toFixed(1)}%</div>
    <div style="display:flex;align-items:center;gap:4px;"><div style="width:8px;height:8px;background:${cCruise};border-radius:2px;"></div>Cruise ${e_cruise.toFixed(1)}%</div>
    <div style="display:flex;align-items:center;gap:4px;"><div style="width:8px;height:8px;background:${cDescent};border-radius:2px;"></div>Descent ${e_descent.toFixed(1)}%</div>
    <div style="display:flex;align-items:center;gap:4px;"><div style="width:8px;height:8px;background:${cReserve};border-radius:2px;"></div>Reserve ${e_reserve.toFixed(1)}%</div>
  `;

  summary.innerHTML = `Total duration: <strong>${totalMin} min</strong> &nbsp;|&nbsp; Estimated consumption (incl reserve): <strong><span style="color:${e_total > 100 ? 'var(--danger)' : e_total > 85 ? 'var(--warn)' : 'var(--ok)'}">${e_total.toFixed(1)}%</span></strong>`;

  if (e_total > 100) {
    warning.style.display = 'block';
    warning.textContent = `⚠ WARNING: Estimated energy requirement (${e_total.toFixed(1)}%) exceeds battery capacity. Reduce flight time.`;
  } else if (e_total > 85) {
    warning.style.display = 'block';
    warning.style.color = 'var(--warn)';
    warning.style.borderColor = 'var(--warn)';
    warning.style.background = 'rgba(201,106,0,0.1)';
    warning.textContent = `⚠ CAUTION: Energy margin is tight. Monitor battery closely.`;
  } else {
    warning.style.display = 'none';
  }
};

window.recalcFlightTime = function() {
  const cruiseMs = parseFloat(document.getElementById('drone-cruise')?.value) || 10;
  const dwellSec = parseFloat(document.getElementById('drone-wp-dwell')?.value) || 0;
  
  let totalDist = 0;
  let wpCount = 0;

  if (window.waypoints && window.waypoints.length > 1) {
    const valid = window.waypoints.filter(wp => wp.lat != null && wp.lon != null && !isNaN(wp.lat) && !isNaN(wp.lon));
    wpCount = valid.length;
    for (let i = 1; i < valid.length; i++) {
      const p1 = {lat:parseFloat(valid[i-1].lat),lon:parseFloat(valid[i-1].lon)};
      const p2 = {lat:parseFloat(valid[i].lat),lon:parseFloat(valid[i].lon)};
      const R=6371000, dLat=(p2.lat-p1.lat)*Math.PI/180, dLon=(p2.lon-p1.lon)*Math.PI/180;
      const a=Math.sin(dLat/2)**2+Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.sin(dLon/2)**2;
      totalDist += 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
  } else if (document.getElementById('op-type')?.value === 'leverans') {
    totalDist = parseFloat(document.getElementById('delivery-distance')?.value) || 0;
  }

  if (totalDist > 0 && cruiseMs > 0) {
    const flightTimeSec = (totalDist / cruiseMs) + (Math.max(0, wpCount - 2) * dwellSec);
    const flightTimeMin = Math.ceil(flightTimeSec / 60);
    const durEl = document.getElementById('op-duration');
    if (durEl) {
        durEl.value = flightTimeMin;
        durEl.style.borderColor = 'var(--accent)';
    }
    window.recalcEnergy();
  }
};

// --- ACCORDION LOGIC (FAS 2 UX) ---
window.initAccordions = function() {
  // Leta upp alla sektionsrubriker i Steg 1 (DOI)
  const labels = document.querySelectorAll('#panel-0 .section-label');
  
  labels.forEach((label, index) => {
    // If it is already configured, skip it
    if (label.classList.contains('accordion-header')) return;
    
    // Remove old manual click functions
    label.removeAttribute('onclick');
    const oldArrow = label.querySelector('#conops-arrow');
    if (oldArrow) oldArrow.remove();
    
    // Style the heading and add the arrow
    label.classList.add('accordion-header');
    const arrow = document.createElement('span');
    arrow.className = 'accordion-arrow';
    arrow.textContent = '▼';
    label.appendChild(arrow);
    
    // Create a wrapper for the content
    const content = document.createElement('div');
    content.className = 'accordion-content';
    
    // Move all content into the wrapper until the next heading is reached
    let nextEl = label.nextElementSibling;
    while (nextEl && !nextEl.classList.contains('section-label') && !nextEl.classList.contains('btn-row')) {
      const toMove = nextEl;
      nextEl = nextEl.nextElementSibling;
      content.appendChild(toMove);
    }
    label.parentNode.insertBefore(content, label.nextSibling);
    
    // Click function to expand and collapse
    label.onclick = function() {
      const isCollapsed = label.classList.contains('collapsed');
      if (isCollapsed) {
        label.classList.remove('collapsed');
        content.style.display = 'block';
        arrow.style.transform = 'rotate(0deg)';
        
        // Resolve auto-height on text boxes
        if (typeof window.triggerAutoExpand === 'function') window.triggerAutoExpand();
        
        // UX REDESIGN: Redraw and centre maps when accordions open!
        if (content.querySelector('#delivery-leaflet-map') && window._deliveryMap) {
          window._deliveryMap.invalidateSize();
          if (typeof window.updateDeliveryMap === 'function') setTimeout(window.updateDeliveryMap, 50);
        }
        if (content.querySelector('#waypoint-leaflet-map') && window._waypointMap) {
          window._waypointMap.invalidateSize();
          if (typeof window.updateWaypointPreview === 'function') setTimeout(window.updateWaypointPreview, 50);
        }
      } else {
        label.classList.add('collapsed');
        content.style.display = 'none';
        arrow.style.transform = 'rotate(-90deg)';
      }
    };
    
    // UX: Leave the first section (A1) open, collapse the rest by default
    if (index > 0) {
      label.classList.add('collapsed');
      content.style.display = 'none';
      arrow.style.transform = 'rotate(-90deg)';
    }
  });
};

// --- SORA RISK ASSESSMENT ---
window.updateDimHint = function() {
  const dim   = parseFloat(document.getElementById('igrc-dim')?.value   || document.getElementById('drone-dim')?.value)   || 0;
  const speed = parseFloat(document.getElementById('igrc-speed')?.value || document.getElementById('drone-speed')?.value) || 0;

  // Step 1 hint (drone spec panel) — measurement methodology reminder
  const dimHint = document.getElementById('dim-hint');
  if (dimHint) dimHint.textContent = 'Largest dimension (diagonal for multirotor)';

  // Step 3 hints (SORA panel) — show which iGRC column applies
  const dimClassHint   = document.getElementById('dim-class-hint');
  const speedClassHint = document.getElementById('speed-class-hint');
  if (!dimClassHint && !speedClassHint) return;

  if (typeof window.getDimCol === 'function' && dim > 0 && speed > 0) {
    const col = window.getDimCol(dim, speed);
    if (col === null) {
      const msg = 'UA exceeds SORA scope (>40 m or >200 m/s) — certification category required';
      if (dimClassHint)   dimClassHint.textContent   = msg;
      if (speedClassHint) speedClassHint.textContent = '';
    } else {
      const colLabel = window.COL_LABELS ? window.COL_LABELS[col] : `Col ${col + 1}`;
      if (dimClassHint)   dimClassHint.textContent   = `iGRC column: ${col + 1} (${colLabel})`;
      if (speedClassHint) speedClassHint.textContent = `Both criteria satisfied for column ${col + 1}`;
    }
  } else {
    if (dimClassHint)   dimClassHint.textContent   = dim   > 0 ? '' : '';
    if (speedClassHint) speedClassHint.textContent = speed > 0 ? '' : '';
  }
};

// Validates the numeric inputs that feed the SORA ground/air-risk engine.
// Rejects missing required fields, non-finite values, negatives and absurd
// magnitudes. The SORA scope ceilings (>40 m / >200 m/s) are intentionally NOT
// rejected here — those are valid edge cases the engine itself reports as
// "outside SORA scope". Returns { ok, dim, speed, mass, message }.
window._validateSoraNumeric = function(dimRaw, speedRaw, massRaw) {
  if (dimRaw === '' || speedRaw === '') {
    return { ok: false, message: 'Enter characteristic dimension and max speed to calculate SAIL.' };
  }
  const dim = parseFloat(dimRaw), speed = parseFloat(speedRaw);
  if (!Number.isFinite(dim) || dim <= 0 || dim > 1000) {
    return { ok: false, message: 'Characteristic dimension must be a positive number in metres.' };
  }
  if (!Number.isFinite(speed) || speed <= 0 || speed > 2000) {
    return { ok: false, message: 'Max speed must be a positive number in m/s.' };
  }
  let mass = null;
  if (massRaw !== '') {
    const m = parseFloat(massRaw);
    // A negative/zero/absurd MTOM would, among other things, wrongly trigger the
    // ≤250 g iGRC=1 special case — reject it rather than guess.
    if (!Number.isFinite(m) || m <= 0 || m > 100000) {
      return { ok: false, message: 'MTOM must be a positive number in kg, or left blank.' };
    }
    mass = m;
  }
  return { ok: true, dim, speed, mass };
};

// Shows a caution in the SAIL result area and clears stale risk values so a bad
// input never leaves a previously-computed SAIL on screen.
function _showSailCaution(message) {
  const sn = document.getElementById('sail-num');
  if (sn) { sn.textContent = '⚠ ' + message; sn.style.color = 'var(--warn)'; }
  ['igrc-val','grc-val','arc-val'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '–'; });
  window.sailResult = { grc: 0, iGRC: 0, arc: 0, sail: 0, grcLabel: '–', arcLabel: '–' };
}

window.calcSAIL25 = function() {
  window._sailCalculated = true;
  const warn = document.getElementById('stale-warn-sail'); if (warn) warn.style.display = 'none';

  // --- Gather inputs ---
  const popEl   = document.querySelector('input[name="pop"]:checked');

  // Runtime input guard — never feed garbage to the SORA engine. Read the raw
  // strings (not parsed fallbacks) so "missing" can be told from "invalid".
  const dimRaw   = (document.getElementById('igrc-dim')?.value   || document.getElementById('drone-dim')?.value   || '').trim();
  const speedRaw = (document.getElementById('igrc-speed')?.value || document.getElementById('drone-speed')?.value || '').trim();
  const massRaw  = (document.getElementById('drone-mtom')?.value || '').trim();
  const guard = window._validateSoraNumeric(dimRaw, speedRaw, massRaw);
  if (!guard.ok) { _showSailCaution(guard.message); return; }
  const dimVal  = guard.dim;
  const speedVal= guard.speed;
  const massKg  = guard.mass; // kg, or null when blank

  // Sync igrc-dim from drone-dim if the SORA field is still empty
  if (document.getElementById('igrc-dim') && document.getElementById('drone-dim')) {
    if (!document.getElementById('igrc-dim').value) document.getElementById('igrc-dim').value = document.getElementById('drone-dim').value;
  }

  // --- Compute iGRC and Final GRC via igrc.js ---
  const grcResult = window.computeGroundRisk({
    dimMeters:  dimVal,
    speedMs:    speedVal,
    massGrams:  massKg !== null ? massKg * 1000 : null,
    popQual:    popEl ? popEl.value : 'suburban',
    mitigations: {
      m1a: document.querySelector('input[name="m1a"]:checked')?.value || 'none',
      m1b: document.querySelector('input[name="m1b"]:checked')?.value || 'none',
      m1c: document.querySelector('input[name="m1c"]:checked')?.value || 'none',
      m2:  document.querySelector('input[name="m2"]:checked')?.value  || 'none',
    },
  });

  if (grcResult.outOfScope) {
    document.getElementById('sail-num').textContent = 'Outside SORA scope';
    document.getElementById('sail-num').style.color = 'var(--danger)';
    document.getElementById('igrc-val').textContent = '–';
    document.getElementById('grc-val').textContent  = grcResult.reason || 'Certification category required';
    document.getElementById('arc-val').textContent  = '–';
    window.sailResult = { grc: 0, iGRC: 0, arc: 0, sail: 0, grcLabel: '–', arcLabel: '–' };
    return;
  }

  const iGRC     = grcResult.igrc;
  let   finalGRC = grcResult.finalGRC;

  // GRC > 7 requires certification — show warning but do not abort
  if (finalGRC > 7) {
    document.getElementById('sail-num').textContent = 'GRC > 7 — Certification required';
    document.getElementById('sail-num').style.color = 'var(--danger)';
    document.getElementById('igrc-val').textContent = iGRC;
    document.getElementById('grc-val').textContent  = finalGRC + ' (Certification required)';
    document.getElementById('arc-val').textContent  = '–';
    window.sailResult = { grc: finalGRC, iGRC, arc: 0, sail: 0, grcLabel: finalGRC.toString(), arcLabel: '–' };
    return;
  }

  // --- Compute ARC, TMPR, and SAIL via arc.js ---
  const densityVal = document.getElementById('arc-local-density')?.value;
  const strategicMit = (() => {
    if (document.getElementById('arc-claim-atypical')?.value === 'yes') return { claimAtypical: true };
    if (densityVal && densityVal !== 'none') return { localDensityRating: parseInt(densityVal) };
    return null;
  })();

  const overrideRaw = document.getElementById('arc-authority-override')?.value;
  const airResult = window.computeAirRisk({
    atypical:       document.getElementById('arc-atypical')?.value      === 'yes',
    aboveFL600:     document.getElementById('arc-above-fl600')?.value   === 'yes',
    airportEnv:     document.getElementById('arc-airport-env')?.value   === 'yes',
    classBCD:       document.getElementById('arc-class-bcd')?.value     === 'yes',
    above150m:      document.getElementById('arc-above-150')?.value     === 'yes',
    modeSVeilOrTMZ: document.getElementById('arc-mode-s')?.value        === 'yes',
    controlled:     document.getElementById('arc-controlled')?.value    === 'yes',
    urban:          document.getElementById('arc-urban')?.value         === 'yes',
    authorityOverrideARC: (overrideRaw && overrideRaw !== 'none') ? overrideRaw : null,
    isVLOS:         document.getElementById('arc-vlos')?.value          === 'vlos',
    strategicMitigation: strategicMit,
    finalGRC,
  });

  const { residualARC, initialARC, aec, aecDescription, tmpr, tmprRobustness, tmprRiskRatio,
          vlosExempt, tmprNote, sail, sailRoman, sailOutOfScope, sailReason,
          strategicMitApplied, strategicMitWarning,
          authorityOverrideApplied, effectiveInitialARC } = airResult;

  if (sailOutOfScope) {
    document.getElementById('sail-num').textContent = 'Outside SORA scope';
    document.getElementById('sail-num').style.color = 'var(--danger)';
    document.getElementById('arc-val').textContent = 'ARC-' + residualARC.toUpperCase();
    window.sailResult = { grc: finalGRC, iGRC, arc: 0, arcLetter: residualARC, sail: 0, grcLabel: finalGRC.toString(), arcLabel: 'ARC-' + residualARC.toUpperCase() };
    _renderArcResultBox(airResult);
    return;
  }

  const arcLetterOrder = { a: 1, b: 2, c: 3, d: 4 };
  const arcNum = arcLetterOrder[residualARC] || 2;
  const arcLabel = 'ARC-' + residualARC.toUpperCase() + (strategicMitApplied ? ' →mitigated' : '');

  window.sailResult = { grc: finalGRC, iGRC, arc: arcNum, arcLetter: residualARC, sail, grcLabel: finalGRC.toString(), arcLabel };

  const osoFilter = document.getElementById('oso-sail-filter');
  if (osoFilter && typeof window.sailOrder !== 'undefined') osoFilter.value = window.sailOrder[sail - 1] || 'all';

  document.getElementById('sail-num').textContent = 'SAIL ' + (sailRoman || sail);
  document.getElementById('igrc-val').textContent = iGRC;
  document.getElementById('grc-val').textContent  = finalGRC;
  document.getElementById('arc-val').textContent  = arcLabel;

  document.getElementById('sail-num').style.color = sail <= 2 ? 'var(--ok)' : sail <= 4 ? 'var(--warn)' : 'var(--danger)';
  document.getElementById('igrc-val').className = 'risk-card-value ' + (iGRC <= 2 ? 'risk-low' : iGRC <= 4 ? 'risk-med' : 'risk-high');
  document.getElementById('grc-val').className  = 'risk-card-value ' + (finalGRC <= 2 ? 'risk-low' : finalGRC <= 4 ? 'risk-med' : 'risk-high');
  document.getElementById('arc-val').className  = 'risk-card-value ' + (arcNum <= 1 ? 'risk-low' : arcNum <= 2 ? 'risk-med' : 'risk-high');

  _renderArcResultBox(airResult);

  if (typeof window.renderOSO === 'function') window.renderOSO();
  if (typeof window.assessContainment === 'function') window.assessContainment();
};

// Renders the ARC/TMPR result boxes inside the SORA panel.
function _renderArcResultBox(r) {
  const arcColor = { a: 'var(--ok)', b: 'var(--ok)', c: 'var(--warn)', d: 'var(--danger)' };
  const initBox = document.getElementById('arc-initial-result');
  if (initBox) {
    const mitLine = r.strategicMitApplied
      ? `<br>Strategic mitigation: <span style="color:var(--ok)">✓ Applied → Residual <strong>ARC-${r.residualARC.toUpperCase()}</strong></span>`
      : r.strategicMitWarning
        ? `<br>Strategic mitigation: <span style="color:var(--warn)">⚠ ${r.strategicMitWarning}</span>`
        : `<br>Strategic mitigation: <span style="color:var(--muted)">None claimed — Residual = Initial</span>`;
    initBox.style.display = 'block';
    const overrideLine = r.authorityOverrideApplied
      ? `<br><span style="color:var(--danger)">⚠ Authority override: ARC raised to <strong>ARC-${r.effectiveInitialARC.toUpperCase()}</strong> — ${r.authorityOverrideNote}</span>`
      : '';
    initBox.innerHTML =
      `<strong>AEC ${r.aec}</strong> — ${r.aecDescription}<br>` +
      `Initial ARC: <strong style="color:${arcColor[r.initialARC]}">ARC-${r.initialARC.toUpperCase()}</strong>` +
      overrideLine +
      mitLine;
  }
  const tmprBox = document.getElementById('arc-tmpr-result');
  if (tmprBox) {
    const tmprColor = r.vlosExempt ? 'var(--ok)' : { None: 'var(--ok)', Low: 'var(--ok)', Medium: 'var(--warn)', High: 'var(--danger)' }[r.tmpr] || 'var(--muted)';
    tmprBox.style.display = 'block';
    tmprBox.innerHTML =
      `Residual ARC: <strong style="color:${arcColor[r.residualARC]}">ARC-${r.residualARC.toUpperCase()}</strong><br>` +
      `TMPR required: <strong style="color:${tmprColor}">${r.tmpr}</strong> (robustness: ${r.tmprRobustness})` +
      (r.tmprRiskRatio !== null ? ` — risk ratio objective ≤${r.tmprRiskRatio}` : '') +
      `<br><span style="color:var(--muted)">${r.tmprNote}</span>`;
  }
}

window.assessContainment = function() {
  const adjPop = document.getElementById('cont-adj-pop')?.value || 'suburban';
  const assembly = document.getElementById('cont-assembly')?.value || 'no';
  const level = document.querySelector('input[name="containment"]:checked')?.value || null;
  const sail = window.sailResult.sail || 0;
  const resultEl = document.getElementById('containment-result');

  let minRequired = 'low';
  if (sail >= 4 || adjPop === 'urban') minRequired = 'medium';
  if (sail >= 5 || (adjPop === 'urban' && assembly === 'yes') || (assembly === 'yes' && sail >= 4)) minRequired = 'high';

  const levelOrder = {low:1, medium:2, high:3};
  const selectedLevel = level ? levelOrder[level] : 0;
  const requiredLevel = levelOrder[minRequired];
  const adequate = selectedLevel >= requiredLevel;

  const levelNames = {low:'Low', medium:'Medium', high:'High'};
  if(resultEl) resultEl.innerHTML = `
    <div class="brief-row"><span class="brief-key">SAIL Level:</span><span class="brief-val">SAIL ${window.sailOrder ? window.sailOrder[sail-1] : sail}</span></div>
    <div class="brief-row"><span class="brief-key">Adjacent population:</span><span class="brief-val">${adjPop}</span></div>
    <div class="brief-row"><span class="brief-key">Crowd within 1 km:</span><span class="brief-val">${assembly === 'yes' ? 'Yes' : 'No'}</span></div>
    <div class="brief-row"><span class="brief-key">Minimum required:</span><span class="brief-val warn">${levelNames[minRequired]}</span></div>
    <div class="brief-row"><span class="brief-key">Selected level:</span><span class="brief-val ${adequate ? 'ok' : 'danger'}">${level ? levelNames[level] : 'Not selected'} <span class="status-badge ${adequate ? 'badge-ok' : 'badge-danger'}">${adequate ? '✓ ADEQUATE' : '✗ INADEQUATE'}</span></span></div>
    ${!adequate ? '<div class="brief-row" style="margin-top:8px;"><span class="brief-key" style="color:var(--danger)">⚠ Increase containment robustness to at least: ' + levelNames[minRequired] + '</span></div>' : ''}
  `;
};

window.renderOSO = function() {
  const filterSail = document.getElementById('oso-sail-filter')?.value || 'all';

  function makeList(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    items.forEach(oso => {
      const sailIdx = window.sailOrder ? window.sailOrder.indexOf(filterSail) : 0;
      const osoMinIdx = window.sailOrder ? window.sailOrder.indexOf(oso.minSail) : 0;
      const dimmed = filterSail !== 'all' && sailIdx < osoMinIdx;

      const div = document.createElement('div');
      div.className = 'oso-item' + (dimmed ? ' na' : '');
      div.dataset.num = oso.num;
      
      // UX REDESIGN: Added .oso-desc-box which is hidden by default
      div.innerHTML = `
        <div class="oso-check">☐</div>
        <div class="oso-text" style="width:100%;">
          <div>
            <span class="oso-num">OSO #${oso.num}</span>
            <span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-left:8px;">Min SAIL ${oso.minSail}</span>
            &nbsp;${oso.text}
          </div>
          <div class="oso-desc-box" style="display:none; margin-top:10px;">
            <textarea class="oso-desc-input auto-expand" placeholder="How is this objective met? (Required for audit/review)" style="width:100%;font-family:var(--sans);font-size:calc(12px + var(--tz));padding:8px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);resize:none;overflow:hidden;min-height:30px;line-height:1.4;"></textarea>
          </div>
        </div>
      `;
      
      // UX REDESIGN: Click logic that ignores clicks inside the text box itself
      div.onclick = (e) => {
        if (dimmed) return;
        if (e.target.tagName.toLowerCase() === 'textarea') return; // Prevent the box from closing when the user is typing
        
        div.classList.toggle('checked');
        div.querySelector('.oso-check').textContent = div.classList.contains('checked') ? '✓' : '☐';
        
        const descBox = div.querySelector('.oso-desc-box');
        if (descBox) {
          descBox.style.display = div.classList.contains('checked') ? 'block' : 'none';
          if (div.classList.contains('checked') && typeof window.triggerAutoExpand === 'function') {
            setTimeout(window.triggerAutoExpand, 10);
          }
        }
        window.updateOSOProgress();
      };
      el.appendChild(div);
    });
  }
  
  if (window.osoData) {
    makeList('oso-list-1', window.osoData.technical);
    makeList('oso-list-2', window.osoData.org);
    makeList('oso-list-3', window.osoData.human);
    makeList('oso-list-4', window.osoData.environment);
  }
  window.updateOSOProgress();
};

window.updateOSOProgress = function() {
  const all = document.querySelectorAll('.oso-item:not(.na)');
  const checked = document.querySelectorAll('.oso-item.checked');
  const textEl = document.getElementById('oso-progress-text');
  const fillEl = document.getElementById('oso-progress-fill');
  
  if (textEl) textEl.textContent = `${checked.length} / ${all.length} confirmed`;
  if (fillEl && all.length > 0) {
    const pct = (checked.length / all.length) * 100;
    fillEl.style.width = pct + '%';
    // Red up to 50%, yellow up to 99%, green at 100%
    fillEl.style.background = pct === 100 ? 'var(--ok)' : (pct > 50 ? 'var(--warn)' : 'var(--danger)');
  }

  // Update section status (chunking)
  [1, 2, 3, 4].forEach(i => {
    const list = document.getElementById(`oso-list-${i}`);
    const status = document.getElementById(`oso-sec-${i}-status`);
    if (list && status) {
      const sAll = list.querySelectorAll('.oso-item:not(.na)').length;
      const sChecked = list.querySelectorAll('.oso-item.checked').length;
      status.textContent = `${sChecked}/${sAll} completed`;
      status.style.color = sChecked === sAll && sAll > 0 ? 'var(--ok)' : 'var(--muted)';
    }
  });
};

// --- WAYPOINT EDITOR ---
window.renderWaypointList = function() {
  const container = document.getElementById('waypoint-list');
  if (!container) return;
  container.innerHTML = '';
  if (window.waypoints.length === 0) {
    container.innerHTML = '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);padding:8px 0;">No waypoints added yet – click + or use bulk import.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  window.waypoints.forEach((wp, i) => {
    const isFirst = i === 0, isLast = i === window.waypoints.length - 1;
    const icon = isFirst ? '📍' : isLast ? '🏁' : `WP${i}`;
    const parsed = window.parseCoordFull(wp.coords);
    const coordOk = !!parsed;
    const coordColor = coordOk ? 'var(--ok)' : (wp.coords ? 'var(--danger)' : 'var(--border)');
    const coordHint = coordOk ? `✓ ${parsed.lat.toFixed(6)}, ${parsed.lon.toFixed(6)}` : (wp.coords ? '✗ Invalid format' : '');

    const row = document.createElement('div');
    row.dataset.wpIndex = i;

    // Add a 40px column for the OFP checkbox
    row.style.cssText = 'display:grid;grid-template-columns:28px 1fr 60px 100px 40px auto;gap:6px;align-items:start;margin-bottom:10px;';

    row.innerHTML = `
      <span style="font-family:var(--mono);font-size:11px;color:var(--muted);padding-top:8px;text-align:center;">${icon}</span>
      <div>
        <input type="text" value="${window.escHtml(wp.coords)}" maxlength="120" data-wp-field="coords"
          placeholder="Paste coordinates in any supported format"
          style="width:100%;font-family:var(--mono);font-size:11px;padding:6px 8px;border:1px solid ${coordColor};border-radius:3px;background:var(--surface);">
        <div id="wp-hint-${i}" style="font-family:var(--mono);font-size:9px;color:${coordColor};margin-top:2px;">${coordHint}</div>
      </div>
      <input type="number" value="${window.escHtml(wp.alt)}" placeholder="Alt m" data-wp-field="alt"
        style="font-family:var(--mono);font-size:11px;padding:6px 8px;border:1px solid var(--border);border-radius:3px;background:var(--surface);" lang="en">
      <input type="text" value="${window.escHtml(wp.name)}" maxlength="80" placeholder="Name (optional)" data-wp-field="name"
        style="font-family:var(--mono);font-size:11px;padding:6px 8px;border:1px solid var(--border);border-radius:3px;background:var(--surface);">

      <div style="display:flex;flex-direction:column;align-items:center;padding-top:4px;" title="Force include this waypoint in the OFP">
        <input type="checkbox" ${wp.forceOfp ? 'checked' : ''} data-wp-field="forceOfp" style="width:14px;height:14px;cursor:pointer;">
        <span style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-top:2px;">OFP</span>
      </div>

      <div style="display:flex;gap:4px;padding-top:4px;">
        ${i > 0 ? `<button data-wp-action="move-up" title="Move up" style="font-family:var(--mono);font-size:10px;padding:4px 7px;border:1px solid var(--border);background:var(--surface2);border-radius:3px;cursor:pointer;">↑</button>` : '<span style="width:27px;"></span>'}
        ${i < window.waypoints.length-1 ? `<button data-wp-action="move-down" title="Move down" style="font-family:var(--mono);font-size:10px;padding:4px 7px;border:1px solid var(--border);background:var(--surface2);border-radius:3px;cursor:pointer;">↓</button>` : '<span style="width:27px;"></span>'}
        <button data-wp-action="remove" title="Remove" style="font-family:var(--mono);font-size:10px;padding:4px 7px;border:1px solid var(--danger);color:var(--danger);background:rgba(198,40,40,0.06);border-radius:3px;cursor:pointer;">✕</button>
      </div>
    `;
    frag.appendChild(row);
  });
  container.appendChild(frag);
  if(typeof window.updateWaypointPreview === 'function') window.updateWaypointPreview();
};

window.updateWpFeedback = function(i, inputEl) {
  const parsed = window.parseCoordFull(inputEl.value);
  const hintEl = document.getElementById(`wp-hint-${i}`);
  if (!hintEl) return;
  if (!inputEl.value) { inputEl.style.borderColor = 'var(--border)'; hintEl.textContent = ''; hintEl.style.color = 'var(--muted)'; }
  else if (parsed) { inputEl.style.borderColor = 'var(--ok)'; hintEl.textContent = `✓ ${parsed.lat.toFixed(6)}, ${parsed.lon.toFixed(6)}`; hintEl.style.color = 'var(--ok)'; }
  else { inputEl.style.borderColor = 'var(--danger)'; hintEl.textContent = '✗ Could not parse coordinate'; hintEl.style.color = 'var(--danger)'; }
};

window.addWaypoint = function() {
  window.waypoints.push({ coords: '', lat: '', lon: '', alt: '', name: '' });
  window.renderWaypointList();
};

window.removeWaypoint = function(i) {
  window.waypoints.splice(i, 1);
  window.renderWaypointList();
};

window.moveWaypoint = function(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= window.waypoints.length) return;
  [window.waypoints[i], window.waypoints[j]] = [window.waypoints[j], window.waypoints[i]];
  window.renderWaypointList();
};

window.clearWaypoints = function() {
  window.waypoints = [];
  window.renderWaypointList();
};

window.toggleBulkImport = function() {
  const box = document.getElementById('waypoint-import-box');
  if(box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

window.parseBulkWaypoints = function() {
  const lines = document.getElementById('waypoint-bulk').value.split('\n').map(l => l.trim()).filter(l => l);
  const parsed = [];
  lines.forEach(line => {
    let remaining = line, coordStr = '';
    const dmsM = line.match(/(\d+[°\s]\d+['\s][\d.]+"?\s*[NS][,\s]+\d+[°\s]\d+['\s][\d.]+"?\s*[EW])/i);
    if (dmsM) { coordStr = dmsM[1]; remaining = line.replace(coordStr, '').replace(/^[\s,]+/, ''); }
    else { const decM = line.match(/^([-\d.]+\s*[NS]?\s*[,\s]\s*[-\d.]+\s*[EW]?)/i); if (decM) { coordStr = decM[1]; remaining = line.slice(coordStr.length).replace(/^[\s,]+/, ''); } }
    if (!coordStr) return;
    const p = window.parseCoordFull(coordStr); if (!p) return;
    const remParts = remaining.split(',').map(s => s.trim());
    const alt = remParts[0] && /^\d+$/.test(remParts[0]) ? remParts[0] : '';
    const name = alt ? remParts.slice(1).join(', ') : remParts.join(', ');
    parsed.push({ coords: coordStr.trim(), lat: p.lat, lon: p.lon, alt, name });
  });
  const clean = window.sanitisePoints(parsed, window.MAX_WAYPOINTS);
  if (clean.points.length > 0) {
    window.waypoints = clean.points; window.renderWaypointList();
    document.getElementById('waypoint-import-box').style.display = 'none';
    document.getElementById('waypoint-bulk').value = '';
    if (clean.dropped || clean.capped) alert(`${clean.dropped} out-of-range waypoint(s) dropped${clean.capped ? `; list capped at ${window.MAX_WAYPOINTS}` : ''}.`);
  }
  else { alert('No valid coordinates found.'); }
};

// --- FILE LOADERS & QUICK LOAD LOGIC ---
window.updateQLStatus = function() {
  const ql = document.getElementById('ql-status');
  if (!ql) return;
  let parts = [];
  if (window._loadedFiles.mission) parts.push(`✓ Mission: ${window._loadedFiles.mission}`);
  if (window._loadedFiles.fence) parts.push(`🔶 Fence: ${window._loadedFiles.fence}`);
  if (window._loadedFiles.rally) parts.push(`🟢 Rally: ${window._loadedFiles.rally}`);
  ql.textContent = parts.join('\n');
  ql.style.color = parts.length ? 'var(--ok)' : 'var(--text)';
};

const WP_NAV_CMDS = new Set([16, 17, 18, 19, 20, 21, 22, 82]);
const WP_CMD_NAMES = { 16:'WP', 17:'LOITER', 18:'LOITER', 19:'LOITER_T', 20:'RTL', 21:'LAND', 22:'TAKEOFF', 82:'LOITER_ALT' };

window.parseQGCWPL = function(lines) {
  const result = []; let home = null; let skipped = 0;
  lines.slice(1).forEach((line, lineIdx) => {
    const cols = line.split('\t');
    if (cols.length < 11) { skipped++; return; }
    const idx = parseInt(cols[0]), current = parseInt(cols[1]), cmd = parseInt(cols[3]);
    const lat = parseFloat(cols[8]), lon = parseFloat(cols[9]), alt = parseFloat(cols[10]);
    if (lat === 0 && lon === 0) { skipped++; return; }
    if (idx === 0 && current === 1) { home = { lat, lon, alt }; result.push({ coords: `${lat.toFixed(7)}, ${lon.toFixed(7)}`, lat, lon, alt: Math.round(alt), name: 'HOME' }); return; }
    if (!WP_NAV_CMDS.has(cmd)) { skipped++; return; }
    result.push({ coords: `${lat.toFixed(7)}, ${lon.toFixed(7)}`, lat, lon, alt: Math.round(alt), name: `${WP_CMD_NAMES[cmd]||'CMD'}-${idx}` });
  });
  return { format: 'QGC WPL 110', waypoints: result, home, skipped };
};

window.parseQGCPlan = function(json) {
  // Validate the parsed JSON has the shape we expect before trusting any field.
  if (!json || typeof json !== 'object') throw new Error('Plan file is not a valid JSON object.');
  const items = json?.mission?.items || json?.items || [];
  if (!Array.isArray(items)) throw new Error('Plan file has no recognisable mission items.');
  const home  = json?.mission?.plannedHomePosition || json?.plannedHomePosition;
  const homeValid = Array.isArray(home) && home.length >= 2 && window.isValidLatLon(Number(home[0]), Number(home[1]));
  const result = []; let skipped = 0;
  if (homeValid) {
    const hlat = Number(home[0]), hlon = Number(home[1]);
    result.push({ coords: `${hlat.toFixed(7)}, ${hlon.toFixed(7)}`, lat: hlat, lon: hlon, alt: Math.round(Number(home[2]) || 0), name: 'HOME' });
  }
  items.forEach((item, i) => {
    if (item && item.type === 'SimpleItem') {
      const cmd = item.command;
      if (!WP_NAV_CMDS.has(cmd)) { skipped++; return; }
      const params = Array.isArray(item.params) ? item.params : [];
      const lat = parseFloat(params[4] ?? item.coordinate?.[0]), lon = parseFloat(params[5] ?? item.coordinate?.[1]), alt = parseFloat(params[6] ?? item.coordinate?.[2]) || 0;
      if (!window.isValidLatLon(lat, lon)) { skipped++; return; }
      result.push({ coords: `${lat.toFixed(7)}, ${lon.toFixed(7)}`, lat, lon, alt: Math.round(alt), name: `${WP_CMD_NAMES[cmd]||'WP'}-${i+1}` });
    } else { skipped++; }
  });
  return { format: 'QGC Plan JSON', waypoints: result, home: homeValid ? {lat:Number(home[0]),lon:Number(home[1])} : null, skipped };
};

window.parseLitchiCSV = function(lines) {
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const latIdx = header.findIndex(h => h.includes('latitude')), lonIdx = header.findIndex(h => h.includes('longitude')), altIdx = header.findIndex(h => h.includes('altitude'));
  if (latIdx === -1 || lonIdx === -1) throw new Error('Litchi CSV saknar lat/lon');
  const result = []; let skipped = 0;
  lines.slice(1).forEach((line, i) => {
    const cols = line.split(',').map(c => c.trim());
    const lat = parseFloat(cols[latIdx]), lon = parseFloat(cols[lonIdx]), alt = altIdx >= 0 ? Math.round(parseFloat(cols[altIdx]) || 0) : '';
    if (isNaN(lat) || isNaN(lon)) { skipped++; return; }
    result.push({ coords: `${lat.toFixed(7)}, ${lon.toFixed(7)}`, lat, lon, alt, name: `WP${i+1}` });
  });
  return { format: 'Litchi CSV', waypoints: result, home: null, skipped };
};

window.parseWaypointFile = function(text, filename) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
  if (lines[0]?.startsWith('QGC WPL')) return window.parseQGCWPL(lines);
  if (lines[0]?.startsWith('{')) {
    let parsed;
    try { parsed = JSON.parse(lines.join('\n')); }
    catch (e) { throw new Error('Mission file contains invalid JSON.'); }
    return window.parseQGCPlan(parsed);
  }
  if (lines[0]?.toLowerCase().includes('latitude')) return window.parseLitchiCSV(lines);
  throw new Error(`Unknown file format.`);
};

window.parseQGCFence = function(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
  if (!lines[0]?.startsWith('QGC WPL')) throw new Error('Inte ett QGC WPL-format.');
  const points = []; let home = null;
  lines.slice(1).forEach(line => {
    const cols = line.split('\t'); if (cols.length < 11) return;
    const idx=parseInt(cols[0]), cmd=parseInt(cols[3]), lat=parseFloat(cols[8]), lon=parseFloat(cols[9]);
    if (idx===0 && parseInt(cols[1])===1 && cmd===16) { home={lat,lon}; return; }
    if (cmd===5001 && !isNaN(lat) && !isNaN(lon)) points.push({lat,lon});
  });
  return {points, home};
};

window.parseQGCRally = function(text) {
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('//'));
  if (!lines[0]?.startsWith('QGC WPL')) throw new Error('Inte ett QGC WPL-format.');
  const points = [];
  lines.slice(1).forEach(line => {
    const cols = line.split('\t'); if (cols.length < 11) return;
    const cmd=parseInt(cols[3]), lat=parseFloat(cols[8]), lon=parseFloat(cols[9]), alt=parseFloat(cols[10]);
    if (cmd===5100 && !isNaN(lat) && !isNaN(lon)) points.push({lat, lon, alt: isNaN(alt) ? null : Math.round(alt)});
  });
  return {points};
};

window.quickLoadMission = function(inputEl) {
  const file = inputEl.files?.[0]; if (!file) return;
  const ql = document.getElementById('ql-status'); ql.style.color = 'var(--accent)'; ql.textContent = `⟳ Reading ${file.name}…`;
  if (file.size > window.MAX_IMPORT_BYTES) {
    ql.style.color = 'var(--danger)';
    ql.textContent = `✗ File too large (${(file.size/1048576).toFixed(1)} MB). Limit is ${window.MAX_IMPORT_BYTES/1048576} MB.`;
    inputEl.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const result = window.parseWaypointFile(e.target.result, file.name);
      if (result.waypoints.length === 0) { ql.style.color = 'var(--warn)'; ql.textContent = `⚠ No navigation waypoints found.`; return; }
      const clean = window.sanitisePoints(result.waypoints, window.MAX_WAYPOINTS);
      if (clean.points.length === 0) { ql.style.color = 'var(--warn)'; ql.textContent = `⚠ No valid in-range coordinates found.`; return; }
      window.waypoints = clean.points;
      const opFlightEl = document.getElementById('op-flighttype');
      if (opFlightEl && opFlightEl.value !== 'autonomt') { opFlightEl.value = 'autonomt'; opFlightEl.dispatchEvent(new Event('change')); }
      document.getElementById('waypoint-section').style.display = 'block';
      if (result.home && document.getElementById('op-coords') && !document.getElementById('op-coords').value.trim()) 
        document.getElementById('op-coords').value = `${result.home.lat.toFixed(6)}, ${result.home.lon.toFixed(6)}`;
      
      window._loadedFiles.mission = `${file.name} (${result.waypoints.length} pts)`;
      window.updateQLStatus();
      
      if(typeof window.renderWaypointList === 'function') window.renderWaypointList(); 
      if(typeof window.recalcFlightTime === 'function') window.recalcFlightTime();
      if (document.getElementById('op-type')?.value === 'leverans' && typeof window.autoFillDeliveryCoords === 'function') window.autoFillDeliveryCoords();
      if (clean.dropped || clean.capped) {
        ql.style.color = 'var(--warn)';
        ql.textContent += `\n⚠ ${clean.dropped} out-of-range point(s) dropped${clean.capped ? `; list capped at ${window.MAX_WAYPOINTS}` : ''}.`;
      }
    } catch(err) { ql.style.color = 'var(--danger)'; ql.textContent = `✗ Error: ${err.message}`; }
    inputEl.value = '';
  };
  reader.readAsText(file);
};

window.quickLoadFence = function(inputEl) {
  const file = inputEl.files?.[0]; if (!file) return;
  const ql = document.getElementById('ql-status');
  if (file.size > window.MAX_IMPORT_BYTES) {
    if (ql) { ql.style.color = 'var(--danger)'; ql.textContent = `✗ Fence file too large (limit ${window.MAX_IMPORT_BYTES/1048576} MB).`; }
    inputEl.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const result = window.parseQGCFence(e.target.result);
      const clean = window.sanitisePoints(result.points, window.MAX_WAYPOINTS);
      window.fencePoints = clean.points;
      window._loadedFiles.fence = `${file.name} (${clean.points.length} vertices)`;
      window.updateQLStatus();
      if ((clean.dropped || clean.capped) && ql) {
        ql.style.color = 'var(--warn)';
        ql.textContent += `\n⚠ Fence: ${clean.dropped} invalid vertex(es) dropped${clean.capped ? `; capped at ${window.MAX_WAYPOINTS}` : ''}.`;
      }
      if (typeof window.updateWaypointPreview === 'function') window.updateWaypointPreview();
    } catch(err) {
      // Previously a silent empty catch — now surface the failure to the user.
      if (ql) { ql.style.color = 'var(--danger)'; ql.textContent = `✗ Fence import failed: ${err.message}`; }
    }
    inputEl.value = '';
  };
  reader.readAsText(file);
};

window.quickLoadRally = function(inputEl) {
  const file = inputEl.files?.[0]; if (!file) return;
  const ql = document.getElementById('ql-status');
  if (file.size > window.MAX_IMPORT_BYTES) {
    if (ql) { ql.style.color = 'var(--danger)'; ql.textContent = `✗ Rally file too large (limit ${window.MAX_IMPORT_BYTES/1048576} MB).`; }
    inputEl.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const result = window.parseQGCRally(e.target.result);
      const clean = window.sanitisePoints(result.points, window.MAX_WAYPOINTS);
      window.rallyPoints = clean.points;
      window._loadedFiles.rally = `${file.name} (${clean.points.length} pts)`;
      window.updateQLStatus();
      if ((clean.dropped || clean.capped) && ql) {
        ql.style.color = 'var(--warn)';
        ql.textContent += `\n⚠ Rally: ${clean.dropped} invalid point(s) dropped${clean.capped ? `; capped at ${window.MAX_WAYPOINTS}` : ''}.`;
      }
      if (typeof window.updateWaypointPreview === 'function') window.updateWaypointPreview();
    } catch(err) {
      // Previously a silent empty catch — now surface the failure to the user.
      if (ql) { ql.style.color = 'var(--danger)'; ql.textContent = `✗ Rally import failed: ${err.message}`; }
    }
    inputEl.value = '';
  };
  reader.readAsText(file);
};

window.clearQuickLoad = function() {
  window.waypoints = []; window.fencePoints = []; window.rallyPoints = [];
  window._loadedFiles = { mission: '', fence: '', rally: '' };
  window.updateQLStatus();
  if (typeof window.renderWaypointList === 'function') window.renderWaypointList();
  if (typeof window.refreshAllMaps === 'function') window.refreshAllMaps();
};

window.loadWaypointFile = function(inputEl) { window.quickLoadMission(inputEl); };
window.loadFenceFile = function(inputEl) { window.quickLoadFence(inputEl); };
window.clearFence = function() { 
  window.fencePoints = []; 
  window._loadedFiles.fence = '';
  window.updateQLStatus();
  if (typeof window.updateWaypointPreview === 'function') window.updateWaypointPreview(); 
};

// --- EXTERNAL WEATHER AND MAP LINKS ---
window.openSMHI = function() { const c = window.getWeatherCoords(); window.openUrl(`https://www.smhi.se/vader/prognoser/ortprognos/q/${c.lat},${c.lon}`); };
window.openYr = function() { const c = window.getWeatherCoords(); window.openUrl(`https://www.yr.no/en/forecast/daily-table/${c.lat},${c.lon}`); };
window.openWindy = function() { const c = window.getWeatherCoords(); window.openUrl(`https://www.windy.com/${c.lat}/${c.lon}?wind,${c.lat},${c.lon},10`); };
window.openOpenMeteo = function() { const c = window.getWeatherCoords(); window.openUrl(`https://open-meteo.com/en/docs#latitude=${c.lat}&longitude=${c.lon}`); };
window.openOpenAIP = function() { window.openUrl(`https://www.openaip.net`); };
window.openSkyVector = function() { const c = window.getWeatherCoords(); window.openUrl(`https://skyvector.com/?ll=${c.lat},${c.lon}&chart=301&zoom=2`); };
window.openLFVMap = function() { const c = window.getWeatherCoords(); window.openUrl(`https://dronechart.lfv.se#${c.lat},${c.lon},11`); };

window.updateWindKt = function() {
  const ws = parseFloat(document.getElementById('w-wind')?.value);
  const el = document.getElementById('w-wind-kt');
  if (el) el.textContent = !isNaN(ws) ? '≈ ' + (ws / 0.51444).toFixed(1) + ' kt' : '';
};

window.liveWeatherAssessment = function() {
  const ws   = document.getElementById('w-wind')?.value;
  const vis  = document.getElementById('w-vis')?.value;
  const tcc  = document.getElementById('w-cloud')?.value;
  const temp = document.getElementById('w-temp')?.value;
  const pm   = document.getElementById('w-precip-mm')?.value;
  const rh   = document.getElementById('w-humid')?.value;
  
  if (!ws && !temp) return;
  
  const tempVal = parseFloat(temp) || 10;
  const rhVal   = parseFloat(rh)   || 0;
  const iceSelect = document.getElementById('w-ice');
  if (iceSelect) {
    if (tempVal <= 0) iceSelect.value = 'yes';
    else if (tempVal < 5 && rhVal > 80) iceSelect.value = 'possible';
    else iceSelect.value = 'no';
  }
  
  const pmVal = parseFloat(pm) || 0;
  const pSelect = document.getElementById('w-precip');
  if (pSelect) {
    if (pmVal === 0) pSelect.value = 'none';
    else if (pmVal < 0.5) pSelect.value = 'light';
    else if (pmVal < 4)   pSelect.value = 'moderate';
    else pSelect.value = 'heavy';
  }

  // UX REDESIGN: Colour-code the weather cards and update the Go/No-Go
  const setCardState = (inputId, state) => {
    const card = document.getElementById(inputId)?.closest('.weather-card');
    if (card) {
      card.classList.remove('wx-card-ok', 'wx-card-warn', 'wx-card-danger');
      if (state) card.classList.add(`wx-card-${state}`);
    }
  };

  let hasDanger = false;
  let hasWarn = false;
  let hasData = false;

  // Assessment: Wind
  if (ws) {
    hasData = true; const wsv = parseFloat(ws);
    if (wsv > 12) { setCardState('w-wind', 'danger'); hasDanger = true; }
    else if (wsv > 8) { setCardState('w-wind', 'warn'); hasWarn = true; }
    else setCardState('w-wind', 'ok');
  } else setCardState('w-wind', '');

  // Assessment: Visibility
  const los = document.getElementById('op-los')?.value || 'VLOS';
  if (vis) {
    hasData = true; const vsv = parseFloat(vis);
    if (los === 'VLOS' && vsv < 0.5) { setCardState('w-vis', 'danger'); hasDanger = true; }
    else if (los === 'VLOS' && vsv < 0.8) { setCardState('w-vis', 'warn'); hasWarn = true; }
    else setCardState('w-vis', 'ok');
  } else setCardState('w-vis', '');

  // Assessment: Cloud cover
  if (tcc) {
    hasData = true; const tccv = parseFloat(tcc);
    if (tccv > 6) { setCardState('w-cloud', 'warn'); hasWarn = true; }
    else setCardState('w-cloud', 'ok');
  } else setCardState('w-cloud', '');

  // Assessment: Temperature
  if (temp) {
    hasData = true;
    if (tempVal <= 0) { setCardState('w-temp', 'danger'); hasDanger = true; }
    else if (tempVal <= 5) { setCardState('w-temp', 'warn'); hasWarn = true; }
    else setCardState('w-temp', 'ok');
  } else setCardState('w-temp', '');

  // Assessment: Precipitation
  if (pm) {
    hasData = true;
    if (pmVal >= 0.5) { setCardState('w-precip-mm', 'danger'); hasDanger = true; }
    else if (pmVal > 0) { setCardState('w-precip-mm', 'warn'); hasWarn = true; }
    else setCardState('w-precip-mm', 'ok');
  } else setCardState('w-precip-mm', '');

  // Assessment: Humidity
  if (rh) {
    hasData = true; const rhv = parseFloat(rh);
    if (rhv >= 95) { setCardState('w-humid', 'danger'); hasDanger = true; }
    else if (rhv >= 90) { setCardState('w-humid', 'warn'); hasWarn = true; }
    else setCardState('w-humid', 'ok');
  } else setCardState('w-humid', '');

  // Update the banner at the top
  const banner = document.getElementById('wx-go-nogo-banner');
  if (banner) {
    banner.className = 'wx-banner';
    if (!hasData) {
      banner.classList.add('wx-banner-none');
      banner.textContent = 'WEATHER ASSESSMENT: WAITING FOR DATA';
    } else if (hasDanger) {
      banner.classList.add('wx-banner-danger');
      banner.textContent = 'NO-GO: WEATHER OUTSIDE SAFE LIMITS';
    } else if (hasWarn) {
      banner.classList.add('wx-banner-warn');
      banner.textContent = 'MARGINAL: FLY WITH CAUTION';
    } else {
      banner.classList.add('wx-banner-ok');
      banner.textContent = 'GO: CONDITIONS ACCEPTABLE';
    }
  }

// Uppdatera vindriktnings-pilen
  const wdir = document.getElementById('w-winddir')?.value;
  const dirIcon = document.getElementById('w-winddir-icon');
  if (dirIcon) {
    if (wdir && !isNaN(parseFloat(wdir))) {
      dirIcon.style.transform = `rotate(${parseFloat(wdir)}deg)`;
    } else {
      dirIcon.style.transform = 'rotate(0deg)';
    }
  }

  window.smhiData = { manual: true, source: 'Manually entered data' };
  if(typeof window.renderSMHIAssessment === 'function') window.renderSMHIAssessment(ws, vis, tcc, temp, pm, rh, new Date().toISOString());
};

window.renderSMHIAssessment = function(ws, vis, tcc, temp, pm, rh, validTime) {
  const box = document.getElementById('smhi-assessment');
  const content = document.getElementById('smhi-assessment-content');
  const los = document.getElementById('op-los')?.value || 'VLOS';

  const wsV  = parseFloat(ws)  || 0;
  const visV = parseFloat(vis) || 10;
  const tccV = parseFloat(tcc) || 0;
  const tmpV = parseFloat(temp)|| 15;
  const pmV  = parseFloat(pm)  || 0;
  const rhV  = parseFloat(rh)  || 50;

  const checks = [
    { label: 'Wind speed', value: ws ? `${ws} m/s` : '–', ok: !ws || wsV <= 8, warn: wsV > 8 && wsV <= 12, msg: !ws ? 'Not entered' : wsV <= 8 ? `OK – within limits (${(wsV/0.51444).toFixed(1)} kt)` : wsV <= 12 ? `WARNING – high wind (${(wsV/0.51444).toFixed(1)} kt)` : `STOP – exceeds 12 m/s (${(wsV/0.51444).toFixed(1)} kt)` },
    { label: 'Visibility (horizontal)', value: vis ? `${vis} km` : '–', ok: !vis || los !== 'VLOS' || visV >= 0.8, warn: vis && los === 'VLOS' && visV >= 0.5 && visV < 0.8, msg: !vis ? 'Not entered' : (los === 'VLOS' && visV < 0.8) ? 'WARNING – below VLOS minimum (800m)' : 'OK' },
    { label: 'Cloud cover', value: tcc ? `${tcc} oktas` : '–', ok: !tcc || tccV <= 6, warn: tccV === 7, msg: !tcc ? 'Not entered' : tccV <= 6 ? 'OK' : tccV === 7 ? 'Almost overcast' : 'Overcast – check cloud base' },
    { label: 'Temperature', value: temp ? `${temp} °C` : '–', ok: !temp || tmpV > 5, warn: temp && tmpV > 0 && tmpV <= 5, msg: !temp ? 'Not entered' : tmpV <= 0 ? 'STOP – icing risk on UAS' : tmpV <= 5 ? 'WARNING – potential ice risk' : 'OK' },
    { label: 'Precipitation intensity', value: pm ? `${pm} mm/h` : '–', ok: !pm || pmV < 0.1, warn: pm && pmV >= 0.1 && pmV < 0.5, msg: !pm ? 'Not entered' : pmV >= 0.5 ? 'WARNING – precipitation may affect electronics' : pmV > 0 ? 'Light drizzle' : 'No precipitation' },
    { label: 'Relative humidity', value: rh ? `${rh} %` : '–', ok: !rh || rhV < 90, warn: rh && rhV >= 90 && rhV < 95, msg: !rh ? 'Not entered' : rhV >= 95 ? 'WARNING – extreme humidity' : rhV >= 90 ? 'High humidity' : 'OK' }
  ];

  const rows = checks.map(c => {
    const badge = !c.ok ? '✗ WARNING' : c.warn ? '⚠ CAUTION' : '✓ OK';
    const badgeCls = !c.ok ? 'badge-danger' : c.warn ? 'badge-warn' : 'badge-ok';
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);">
      <span style="font-family:var(--mono);font-size:10px;color:var(--muted);min-width:170px;flex-shrink:0;">${c.label}:</span>
      <span style="font-family:var(--mono);font-size:11px;font-weight:bold;min-width:70px;flex-shrink:0;color:${!c.ok?'var(--danger)':c.warn?'var(--warn)':'var(--ok)'};">${window.escHtml(c.value)}</span>
      <div style="flex-shrink:0;"><span class="status-badge ${badgeCls}">${badge}</span></div>
      <span style="font-size:11px;color:var(--muted);">${c.msg}</span>
    </div>`;
  }).join('');

  const filledChecks = checks.filter(c => c.value !== '–');
  const hasStop = filledChecks.some(c => !c.ok && !c.warn);
  const hasWarn = filledChecks.some(c => c.warn);
  const overallBadge = filledChecks.length === 0
    ? '<span class="status-badge badge-warn">⚠ ENTER WEATHER DATA ABOVE</span>'
    : hasStop
    ? '<span class="status-badge badge-danger">⚠ ABORT – SEE DETAILS</span>'
    : hasWarn
      ? '<span class="status-badge badge-warn">⚠ FLY WITH CAUTION</span>'
      : '<span class="status-badge badge-ok">✓ CLEARED FOR FLIGHT</span>';

  const sourceNote = window.smhiData?.manual
    ? 'Manually entered data'
    : `Source: external services | ${new Date(validTime).toLocaleString('en-GB')}`;

  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
      <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:var(--text);">
        Summary: ${overallBadge}
      </div>
    </div>
    ${rows}
    <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:12px;">${sourceNote}</div>
  `;
  box.style.display = 'block';
};

window.flightCategory = function(m) {
  const vis  = parseFloat(m.visib) || 10;
  const ceil = m.clouds
    ? Math.min(...m.clouds.filter(c => ['BKN','OVC','VV'].includes(c.cover)).map(c => c.base || 9999))
    : 9999;
  if (vis >= 5 && ceil >= 3000) return 'VFR';
  if (vis >= 3 && ceil >= 1000) return 'MVFR';
  if (vis >= 1 && ceil >= 500)  return 'IFR';
  return 'LIFR';
};

window.haversineKm = function(p1, p2) {
  const R    = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLon = (p2.lon - p1.lon) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2
    + Math.cos(p1.lat * Math.PI/180) * Math.cos(p2.lat * Math.PI/180) * Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

window.routeBbox = function(pts, km = 50) {
  const validPts = pts.filter(p => p && !isNaN(p.lat) && !isNaN(p.lon));
  if(validPts.length === 0) return { minLat:0, maxLat:0, minLon:0, maxLon:0 };
  const lats = validPts.map(p => p.lat);
  const lons  = validPts.map(p => p.lon);
  const midLat = lats.reduce((a,b) => a+b, 0) / lats.length;
  const dLat = km / 111;
  const dLon = km / (111 * Math.cos(midLat * Math.PI / 180));
  return {
    minLat: (Math.min(...lats) - dLat).toFixed(3),
    maxLat: (Math.max(...lats) + dLat).toFixed(3),
    minLon: (Math.min(...lons) - dLon).toFixed(3),
    maxLon: (Math.max(...lons) + dLon).toFixed(3),
  };
};

window.fetchAllRouteWx = async function() {
  const btn = document.getElementById('avwx-fetch-btn');
  const statusEl = document.getElementById('avwx-status');
  const keyInput = document.getElementById('checkwx-api-key');
  if (!btn || !statusEl) return;

  const apiKey = keyInput ? keyInput.value.trim() : localStorage.getItem('checkwx_key');
  if (!apiKey) { statusEl.style.color = 'var(--danger)'; statusEl.textContent = '⚠ Missing CheckWX API key.'; return; }

  const pts = (window.waypoints || []).map(wp => typeof window.parseCoordFull === 'function' ? window.parseCoordFull(wp.coords) : null).filter(Boolean);
  const centerRaw = document.getElementById('op-coords')?.value;
  const center = typeof window.parseCoordFull === 'function' ? window.parseCoordFull(centerRaw) || window.parseCoords(centerRaw) : null;
  if (center && pts.length === 0) pts.unshift(center);

  if (pts.length === 0) { statusEl.style.color = 'var(--warn)'; statusEl.textContent = '⚠ No coordinates.'; return; }

  // Find start and end points
  const startPt = pts[0];
  const destPt = pts[pts.length - 1] || startPt;

  // Find nearest airports for start and end
  function getNearestIcao(lat, lon) {
    let nearest = null, minDist = Infinity;
    for (const [icao, data] of Object.entries(window.airportRadioDb || {})) {
      const d = window.haversineKm({lat, lon}, {lat: data.lat, lon: data.lon});
      if (d < minDist) { minDist = d; nearest = icao; }
    }
    return nearest;
  }
  
  const targetIcaos = [...new Set([getNearestIcao(startPt.lat, startPt.lon), getNearestIcao(destPt.lat, destPt.lon)].filter(Boolean))].join(',');
  const radiusMiles = 30; 
  
  btn.disabled = true; btn.textContent = '⟳ Fetching WX & NOTAM…';
  statusEl.style.color = 'var(--accent)';
  statusEl.textContent = `⟳ Fetching 50km radius + explicit data for ${targetIcaos || 'route'}...`;

  try {
    const headers = { 'X-API-Key': apiKey };
    
    // Fetch by radius AND explicit ICAO (in case they are outside 50 km) as well as NOTAMs for these ICAOs
    const fetches = [
      fetch(`https://api.checkwx.com/metar/lat/${startPt.lat}/lon/${startPt.lon}/radius/${radiusMiles}/decoded`, { headers }).then(r => r.json()),
      fetch(`https://api.checkwx.com/taf/lat/${startPt.lat}/lon/${startPt.lon}/radius/${radiusMiles}/decoded`, { headers }).then(r => r.json())
    ];
    if (targetIcaos) {
      fetches.push(fetch(`https://api.checkwx.com/metar/icao/${targetIcaos}/decoded`, { headers }).then(r => r.json()));
      fetches.push(fetch(`https://api.checkwx.com/taf/icao/${targetIcaos}/decoded`, { headers }).then(r => r.json()));
      fetches.push(fetch(`https://api.checkwx.com/notam/icao/${targetIcaos}/decoded`, { headers }).then(r => r.json()));
    }

    const results = await Promise.all(fetches);
    const radMetar = results[0], radTaf = results[1];
    const expMetar = results[2] || {data:[]}, expTaf = results[3] || {data:[]}, notamRes = results[4] || {data:[]};

    // Merge and remove duplicates (based on ICAO)
    const allMetarsRaw = [...(radMetar.data||[]), ...(expMetar.data||[])];
    const metarMap = new Map();
    allMetarsRaw.forEach(m => { if(m.icao) metarMap.set(m.icao, m); });
    
    let metars = Array.from(metarMap.values()).map(m => ({
      icaoId: m.icao, name: m.station?.name || m.name || '', rawOb: m.raw_text,
      flightCategory: m.flight_category || 'VFR', temp: m.temperature?.celsius,
      dewp: m.dewpoint?.celsius, wspd: m.wind?.speed_kts, wdir: m.wind?.degrees,
      visib: m.visibility?.meters_float ? (m.visibility.meters_float / 1609.34) : (m.visibility?.miles_float || 10),
      baro: m.barometer?.hpa || m.barometer?.mb // <-- NEW: Picks up air pressure directly from the API!
    }));

    const allTafsRaw = [...(radTaf.data||[]), ...(expTaf.data||[])];
    let tafMap = {};
    allTafsRaw.forEach(t => { tafMap[t.icao] = { icaoId: t.icao, rawTAF: t.raw_text }; });

    // Push NOTAMs into the manual field
    let notamTextCount = 0;
    if (notamRes && notamRes.data && notamRes.data.length > 0) {
      // Extract raw_text, remove empty rows
      const notamTexts = notamRes.data.map(n => n.text || n.raw_text || '').filter(Boolean);
      notamTextCount = notamTexts.length;
      const notamEl = document.getElementById('la-active-notam');
      if (notamEl) {
        const header = `--- AUTOMATED NOTAMS FOR ${targetIcaos} ---\n`;
        if (!notamEl.value.includes(header)) {
          notamEl.value = (notamEl.value.trim() ? notamEl.value + '\n\n' : '') + header + notamTexts.join('\n\n');
        }
        if (typeof window.triggerAutoExpand === 'function') window.triggerAutoExpand();
      }
    }

    window._avwxMetars = metars; window._avwxTafs = tafMap; window._avwxFetchTs = new Date();
    const now = new Date().toLocaleTimeString('en-GB') + ' UTC';

    if(typeof window.renderMetarTafResult === 'function') window.renderMetarTafResult(metars, tafMap, pts, now, false);

    statusEl.style.color = 'var(--ok)';
    statusEl.textContent = `✓ ${metars.length} METAR · ${Object.keys(tafMap).length} TAF · ${notamTextCount} NOTAMs saved · ${now}`;
    if (metars.length > 0 && document.getElementById('notam-icao')) document.getElementById('notam-icao').value = targetIcaos || metars[0].icaoId;
    
  } catch(e) {
    statusEl.style.color = 'var(--danger)'; statusEl.textContent = `⚠ API Error: ${e.message}`;
  } finally {
    btn.disabled = false; btn.textContent = '⛅ FETCH METAR · TAF · NOTAM';
  }
};

window.updateRadioFreqUI = function() {
  const container = document.getElementById('radio-freq-ui-container');
  if (!container) return;

  const coordsRaw = document.getElementById('op-coords')?.value || '';
  const wps = window.waypoints && window.waypoints.length > 0 
    ? window.waypoints.map(wp => window.parseCoordFull(wp.coords)).filter(Boolean)
    : [];
  if (wps.length === 0) {
    const parsed = window.parseCoords(coordsRaw);
    if (parsed) wps.push(parsed);
  }

  if (wps.length === 0) {
    container.innerHTML = '<div style="font-family:var(--mono);font-size:11px;color:var(--warn);">⚠ No coordinates found. Enter DOI coordinates or load a mission.</div>';
    return;
  }
  if (typeof window.airportRadioDb === 'undefined') return;

  const airports = Object.entries(window.airportRadioDb).map(([icao, data]) => {
    const dists = wps.map(wp => window.haversineKm(wp, {lat: data.lat, lon: data.lon}));
    const minDist = Math.min(...dists);
    return { icao, ...data, dist: minDist };
  }).filter(a => !isNaN(a.dist) && a.dist <= 50).sort((a,b) => a.dist - b.dist);

  if (airports.length === 0) {
    container.innerHTML = '<div style="font-family:var(--mono);font-size:11px;color:var(--muted);">No airports found within 50 km radius in database.</div>';
    return;
  }

  const rows = airports.map((ap, i) => {
    const freqs = [];
    if (ap.twr)  freqs.push('TWR: ' + window.escHtml(ap.twr));
    if (ap.gnd)  freqs.push('GND: ' + window.escHtml(ap.gnd));
    if (ap.app)  freqs.push('APP: ' + window.escHtml(ap.app));
    if (ap.atis) freqs.push('ATIS: ' + window.escHtml(ap.atis));
    if (ap.info) freqs.push('INFO: ' + window.escHtml(ap.info));
    if (ap.mil)  freqs.push('MIL: ' + window.escHtml(ap.mil));
    
    return `
      <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:${i === airports.length-1 ? 'none' : '1px solid var(--border)'};">
        <div style="font-family:var(--mono);font-size:11px;font-weight:bold;color:var(--accent);">
          ${window.escHtml(ap.icao)} - ${window.escHtml(ap.name)} <span style="color:var(--text);font-weight:normal;">(${ap.dist.toFixed(1)} km)</span>
        </div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text);margin-top:4px;">
          ${freqs.join(' &nbsp;|&nbsp; ')}
        </div>
        ${ap.tel ? `<div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:2px;">📞 ${window.escHtml(ap.tel)}</div>` : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = rows + `
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-family:var(--mono);font-size:10px;color:var(--text);">
      <strong>Sweden FIS:</strong> 126.650 MHz &nbsp;|&nbsp; <strong>Emergency:</strong> 121.500 MHz
      <div style="color:var(--muted);font-size:9px;margin-top:4px;">Source: MissionDesk Local Aeronautical Database</div>
    </div>
  `;
};

window.renderMetarTafResult = function(metars, tafMap, pts, fetchTime, failed = false) {
  const res = document.getElementById('avwx-result');
  const inner = document.getElementById('avwx-result-inner');
  if (!res || !inner) return;
  res.style.display = 'block'; 
  
  if (failed || !metars || metars.length === 0) {
    inner.innerHTML = `<div style="color:var(--muted);font-family:var(--mono);font-size:10px;">No METAR/TAF stations found in this area, or service unavailable.</div>`;
    return;
  }

  const rows = metars.map(m => {
    const taf = tafMap[m.icaoId] ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);color:var(--muted);font-family:monospace;font-size:11px;">TAF: ${window.escHtml(tafMap[m.icaoId].rawTAF)}</div>` : '';
    return `<div style="margin-bottom:8px;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:3px;">
      <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;font-weight:bold;margin-bottom:4px;">
        <span>${window.escHtml(m.icaoId)} - ${window.escHtml(m.name || 'Station')}</span>
        <span style="color:${m.flightCategory === 'VFR' ? 'var(--ok)' : 'var(--warn)'}">${window.escHtml(m.flightCategory || 'N/A')}</span>
      </div>
      <div style="font-family:monospace;font-size:11px;">${window.escHtml(m.rawOb)}</div>
      ${taf}
    </div>`;
  }).join('');
  inner.innerHTML = `<div style="margin-bottom:8px;font-family:var(--mono);font-size:9px;color:var(--muted);">SOURCE: CheckWX Aviation Weather API</div>` + rows;
};

window.fetchOpenMeteo = async function() {
  // 1. Prioritera Waypoint 1 (eller DOI om waypoint saknas)
  let targetCoords = null;
  if (window.waypoints && window.waypoints.length > 0) {
    const wp1 = window.waypoints[0];
    const lat = parseFloat(wp1.lat), lon = parseFloat(wp1.lon);
    if (!isNaN(lat) && !isNaN(lon)) targetCoords = { lat, lon };
  }
  if (!targetCoords && window._parsedLat && window._parsedLon) {
    targetCoords = { lat: window._parsedLat, lon: window._parsedLon };
  }
  if (!targetCoords) {
    const coordsRaw = document.getElementById('op-coords')?.value || '';
    const parsed = window.parseCoords(coordsRaw);
    targetCoords = parsed ? parsed : { lat: 57.7, lon: 11.97 };
  }

  // 2. Find nearest airport from the local database
  let nearestAirport = null;
  let minDist = Infinity;
  if (typeof window.airportRadioDb !== 'undefined') {
    for (const [icao, data] of Object.entries(window.airportRadioDb)) {
      const d = window.haversineKm(targetCoords, { lat: data.lat, lon: data.lon });
      if (d < minDist) {
        minDist = d;
        nearestAirport = { icao, ...data };
      }
    }
  }

  // If an airport is found, use its coordinates. Otherwise fall back to WP1.
  let fetchLat = targetCoords.lat;
  let fetchLon = targetCoords.lon;
  let airportIcao = '';
  let airportName = '';

  if (nearestAirport && minDist < 200) {
    fetchLat = nearestAirport.lat;
    fetchLon = nearestAirport.lon;
    airportIcao = nearestAirport.icao;
    airportName = nearestAirport.name;
  }

  const tbody = document.getElementById('weather-tbody');
  const btn = document.getElementById('btn-fetch-weather');
  if (!tbody || !btn) return;

  btn.disabled = true;
  btn.textContent = '⟳ Fetching...';
  tbody.innerHTML = `<tr><td colspan="7" style="padding:10px;text-align:center;color:var(--muted);">Fetching METAR & Forecast for ${airportIcao ? window.escHtml(airportIcao) : 'target location'}...</td></tr>`;

  try {
    let metarData = null;

    // --- PART A: FETCH METAR FROM AVIATIONWEATHER (Free, no API key required) ---
    if (airportIcao) {
      const awUrl = `https://aviationweather.gov/api/data/metar?ids=${airportIcao}&format=json`;
      try {
        const awRes = await fetch(awUrl);
        const awJson = await awRes.json();
        if (awJson && awJson.length > 0) {
          metarData = awJson[0];
        }
      } catch(e) { console.warn("Failed to fetch METAR from AviationWeather", e); }
    }

    // --- PART B: FETCH FORECAST FROM OPEN-METEO FOR THE AIRPORT COORDINATES ---
    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${fetchLat}&longitude=${fetchLon}&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms&timezone=auto&forecast_days=2`;
    const res = await fetch(omUrl);
    if (!res.ok) throw new Error('Open-Meteo response failed');
    const data = await res.json();
    
    const now = new Date();
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).toISOString().slice(0, 16);
    
    const hourly = data.hourly;
    const startIndex = hourly.time.findIndex(t => t >= currentHour) >= 0 ? hourly.time.findIndex(t => t >= currentHour) : 0;
    const times = hourly.time.slice(startIndex, startIndex + 12);
    
    let html = '';
    times.forEach((time, i) => {
      const idx = startIndex + i;
      const tStr = new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const temp = hourly.temperature_2m[idx];
      const wind = hourly.wind_speed_10m[idx];
      const gust = hourly.wind_gusts_10m[idx];
      const prec = hourly.precipitation[idx];
      const cloud = hourly.cloud_cover[idx];
      const visi = hourly.visibility[idx];
      
      const windColor = wind > 8 ? 'var(--danger)' : wind > 5 ? 'var(--warn)' : 'var(--text)';
      const gustColor = gust > 10 ? 'var(--danger)' : 'var(--text)';
      
      html += `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:4px 6px;font-weight:bold;">${tStr}</td>
        <td style="padding:4px 6px;">${window.escHtml(temp)}</td>
        <td style="padding:4px 6px;color:${windColor};font-weight:${wind > 5 ? 'bold' : 'normal'}">${wind.toFixed(1)}</td>
        <td style="padding:4px 6px;color:${gustColor};">${gust.toFixed(1)}</td>
        <td style="padding:4px 6px;">${window.escHtml(prec)}</td>
        <td style="padding:4px 6px;">${window.escHtml(cloud)}</td>
        <td style="padding:4px 6px;">${window.escHtml(visi)}</td>
      </tr>`;
    });
    
    tbody.innerHTML = html;
    
    // --- PART C: FILL IN "CURRENT CONDITIONS" WITH METAR OR FALLBACK ---
    if (metarData) {
      // METAR found! Converting the observed values:
      const windMs = metarData.wspd ? (metarData.wspd * 0.51444).toFixed(1) : '0.0';
      const visKm = metarData.visib != null ? (metarData.visib === '10+' || metarData.visib >= 10 ? '10.0' : (metarData.visib * 1.60934).toFixed(1)) : '';
      
      document.getElementById('w-wind').value = windMs;
      if (metarData.wdir != null) document.getElementById('w-winddir').value = metarData.wdir;
      if (metarData.temp != null) document.getElementById('w-temp').value = metarData.temp;
      document.getElementById('w-vis').value = visKm;
      
      // Air pressure (handles both hPa and inHg)
      if (metarData.altim != null) {
        let hpa = metarData.altim;
        if (hpa < 100) hpa = hpa * 33.8639; // If inHg, convert to hPa
        document.getElementById('w-pressure').value = hpa.toFixed(0);
      }
      
      // Relative humidity (calculated from temperature and dew point)
      if (metarData.temp != null && metarData.dewp != null) {
        const t = metarData.temp;
        const td = metarData.dewp;
        const rh = 100 * Math.exp((17.625 * td) / (243.04 + td)) / Math.exp((17.625 * t) / (243.04 + t));
        document.getElementById('w-humid').value = rh.toFixed(0);
      }

      // Cloud cover in oktas
      if (metarData.clouds && metarData.clouds.length > 0) {
        const coverMap = { 'CLR':0, 'SKC':0, 'FEW':2, 'SCT':4, 'BKN':6, 'OVC':8, 'OVX':8 };
        let maxOktas = 0;
        metarData.clouds.forEach(c => { if (coverMap[c.cover] > maxOktas) maxOktas = coverMap[c.cover]; });
        document.getElementById('w-cloud').value = maxOktas;
      }

      // Precipitation from METAR wxString (e.g. -RA, +SN)
      if (metarData.wxString) {
        const wx = metarData.wxString.toUpperCase();
        if (wx.includes('RA') || wx.includes('DZ')) {
          if (wx.includes('-')) document.getElementById('w-precip-mm').value = '0.5';
          else if (wx.includes('+')) document.getElementById('w-precip-mm').value = '5.0';
          else document.getElementById('w-precip-mm').value = '2.0';
        } else if (wx.includes('SN')) {
          document.getElementById('w-precip-mm').value = '1.0';
        } else {
          document.getElementById('w-precip-mm').value = '0';
        }
      } else {
        document.getElementById('w-precip-mm').value = '0';
      }

      window.smhiData = { manual: false, validTimeStr: `${airportIcao} METAR (${metarData.obsTime})`, source: 'AviationWeather.gov (METAR) + Open-Meteo (Forecast)' };
      
      // Update the heading above the table with source
      const labelEl = document.querySelector('label[style*="WEATHER ASSESSMENT FOR UAS FLIGHT"]');
      if (labelEl) labelEl.textContent = `// WEATHER FROM ${airportIcao} (${minDist.toFixed(1)} KM) | SRC: AVIATIONWEATHER.GOV`;

    } else if (hourly.wind_speed_10m[startIndex] !== undefined) {
       // Fallback to Open-Meteo if no airport was found nearby
       document.getElementById('w-wind').value = hourly.wind_speed_10m[startIndex].toFixed(1);
       document.getElementById('w-winddir').value = hourly.wind_direction_10m[startIndex];
       document.getElementById('w-temp').value = hourly.temperature_2m[startIndex];
       document.getElementById('w-humid').value = hourly.relative_humidity_2m[startIndex];
       document.getElementById('w-precip-mm').value = hourly.precipitation[startIndex];
       document.getElementById('w-cloud').value = Math.round(hourly.cloud_cover[startIndex] / 12.5);
       document.getElementById('w-vis').value = (hourly.visibility[startIndex] / 1000).toFixed(1);
       
       window.smhiData = { manual: false, validTimeStr: `Forecast (${new Date(hourly.time[startIndex]).toLocaleString()})`, source: 'Open-Meteo API (DWD ICON / ECMWF)' };
       
       const labelEl = document.querySelector('label[style*="WEATHER ASSESSMENT FOR UAS FLIGHT"]');
       if (labelEl) labelEl.textContent = `// WEATHER FORECAST FOR COORDINATES | SRC: OPEN-METEO`;
    }

    if(typeof window.liveWeatherAssessment === 'function') window.liveWeatherAssessment();
    if(typeof window.updateWindKt === 'function') window.updateWindKt();
    
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding:10px;text-align:center;color:var(--danger);">Error fetching data: ${window.escHtml(err.message)}</td></tr>`;
  } finally {
    btn.disabled = false; btn.textContent = '⟳ Fetch Weather Data';
  }
};

window.clearWxData = function() {
  window._avwxMetars = null; window._avwxTafs = null; window._avwxNotams = null;
  document.getElementById('avwx-status').textContent = '';
  if (document.getElementById('avwx-result')) document.getElementById('avwx-result').style.display = 'none';
};

window.autoFillWeatherFromNearestMetar = function() {
  const statusEl = document.getElementById('wx-autofill-status');
  if (!window._avwxMetars || window._avwxMetars.length === 0) {
    if (statusEl) { 
      statusEl.style.display='block'; 
      statusEl.textContent='⚠ No METARs fetched yet. Click "FETCH METAR" first.'; 
      statusEl.style.color='var(--warn)'; 
      setTimeout(() => statusEl.style.display='none', 5000);
    }
    return;
  }
  
  // Select the first (nearest) METAR station from the list
  const m = window._avwxMetars[0];
  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) { el.value = val; el.style.color = 'var(--accent)'; } };
  
  if (m.wspd != null) set('w-wind', (m.wspd * 0.51444).toFixed(1));
  if (m.wdir != null) set('w-winddir', m.wdir);
  if (m.visib != null) set('w-vis', m.visib >= 9 ? '10.0' : (m.visib * 1.60934).toFixed(1));
  if (m.temp != null) set('w-temp', m.temp);
  
  // Relative humidity
  if (m.temp != null && m.dewp != null) {
    const t = m.temp, td = m.dewp;
    const rh = 100 * Math.exp((17.625 * td) / (243.04 + td)) / Math.exp((17.625 * t) / (243.04 + t));
    set('w-humid', rh.toFixed(0));
  }
  
  // Air pressure (fetched directly from the CheckWX API or via regex as fallback)
  if (m.baro != null) {
    set('w-pressure', m.baro.toFixed(0));
  } else {
    const qnhMatch = m.rawOb.match(/Q0*(\d{3,4})/i);
    const altMatch = m.rawOb.match(/A(\d{4})/i);
    if (qnhMatch) {
      set('w-pressure', parseInt(qnhMatch[1], 10));
    } else if (altMatch) {
      set('w-pressure', ((parseInt(altMatch[1], 10) / 100) * 33.8639).toFixed(0));
    }
  }
  
  // Analyse the raw text (rawOb) to find air pressure (QNH / Altimeter)
  const qnhMatch = m.rawOb.match(/Q(\d{4})/);
  const altMatch = m.rawOb.match(/A(\d{4})/);
  if (qnhMatch) {
    set('w-pressure', qnhMatch[1]);
  } else if (altMatch) {
    const hpa = (parseInt(altMatch[1]) / 100) * 33.8639;
    set('w-pressure', hpa.toFixed(0));
  }
  
  // Analyse cloud cover (oktas)
  const cloudMatch = m.rawOb.match(/(CLR|SKC|FEW|SCT|BKN|OVC|VV)\d{0,3}/g);
  if (cloudMatch) {
    const coverMap = { 'CLR':0, 'SKC':0, 'FEW':2, 'SCT':4, 'BKN':6, 'OVC':8, 'VV':8 };
    let maxOktas = 0;
    cloudMatch.forEach(c => {
      const type = c.replace(/\d/g, '');
      if (coverMap[type] > maxOktas) maxOktas = coverMap[type];
    });
    set('w-cloud', maxOktas);
  } else if (m.rawOb.includes('CAVOK')) {
    set('w-cloud', 0);
  }
  
  // Analyse precipitation (rain / snow)
  if (m.rawOb.includes(' RA') || m.rawOb.includes(' DZ')) {
     if (m.rawOb.includes('-RA') || m.rawOb.includes('-DZ')) set('w-precip-mm', '0.5');
     else if (m.rawOb.includes('+RA')) set('w-precip-mm', '5.0');
     else set('w-precip-mm', '2.0');
  } else if (m.rawOb.includes(' SN')) {
     set('w-precip-mm', '1.0');
  } else {
     set('w-precip-mm', '0');
  }

  // Update the assessment
  if (typeof window.liveWeatherAssessment === 'function') window.liveWeatherAssessment();
  if (typeof window.updateWindKt === 'function') window.updateWindKt();

  // Show green confirmation
  if (statusEl) {
    statusEl.style.display='block';
    statusEl.style.background='rgba(0,150,60,0.07)';
    statusEl.style.border='1px solid var(--ok)';
    statusEl.style.color='var(--ok)';
    statusEl.textContent=`✓ Filled successfully from ${m.icaoId} METAR`;
    setTimeout(() => statusEl.style.display='none', 5000);
  }
};

window.openOpenAIP = function() {
  // The map. subdomain has been shut down by OpenAIP; go directly to the main site
  window.openUrl('https://www.openaip.net');
};

// --- TEM (Threats & Error Management) ---
window.addTemRow = function(type, val1 = '', val2 = '', prob = '', sev = '') {
  const container = document.getElementById(`tem-${type}s-container`);
  if (!container) return;

  const isThreat = type === 'threat';
  const row = document.createElement('div');
  row.className = `tem-row tem-${type}-row`;
  row.style.cssText = `display:grid;grid-template-columns:${isThreat ? '1fr 1fr 70px 70px 60px' : '1fr 1fr 60px'};gap:16px;margin-bottom:8px;align-items:start;`;
  
  const probSelect = isThreat ? `
    <select class="tem-prob" style="font-family:var(--sans);font-size:12px;padding:6px 4px;border:1px solid var(--border);border-radius:4px;background:var(--surface);height:100%;min-height:30px;">
      <option value="" ${prob===''?'selected':''}>-</option>
      <option value="Low" ${prob==='Low'?'selected':''}>Low</option>
      <option value="Med" ${prob==='Med'?'selected':''}>Med</option>
      <option value="High" ${prob==='High'?'selected':''}>High</option>
    </select>
    <select class="tem-sev" style="font-family:var(--sans);font-size:12px;padding:6px 4px;border:1px solid var(--border);border-radius:4px;background:var(--surface);height:100%;min-height:30px;">
      <option value="" ${sev===''?'selected':''}>-</option>
      <option value="Low" ${sev==='Low'?'selected':''}>Low</option>
      <option value="Med" ${sev==='Med'?'selected':''}>Med</option>
      <option value="High" ${sev==='High'?'selected':''}>High</option>
    </select>
  ` : '';

  // Use textarea with the auto-expand class so it adjusts height automatically
  row.innerHTML = `
    <textarea class="tem-val1 auto-expand" placeholder="Describe the ${type}..." style="width:100%;font-family:var(--sans);font-size:calc(12px + var(--tz));padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);resize:none;overflow:hidden;min-height:30px;line-height:1.4;">${window.escHtml(val1)}</textarea>
    <textarea class="tem-val2 auto-expand" placeholder="How will you mitigate this?" style="width:100%;font-family:var(--sans);font-size:calc(12px + var(--tz));padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--surface);resize:none;overflow:hidden;min-height:30px;line-height:1.4;">${window.escHtml(val2)}</textarea>
    ${probSelect}
    <div style="display:flex;gap:4px;align-items:stretch;height:100%;min-height:30px;">
      <button class="btn btn-secondary" data-tem-action="add" data-tem-type="${type}" style="padding:0 12px;font-size:16px;border-color:var(--accent);color:var(--accent);height:100%;" title="Add row">+</button>
      <button class="btn btn-secondary" data-tem-action="remove" style="padding:0 12px;font-size:14px;border-color:var(--danger);color:var(--danger);background:rgba(198,40,40,0.06);height:100%;" title="Remove row">✕</button>
    </div>
  `;
  container.appendChild(row);
  
  // Trigger the size calculation immediately for pre-filled rows
  if (typeof window.triggerAutoExpand === 'function') {
    setTimeout(window.triggerAutoExpand, 10);
  }
};

window.addCommonThreats = function() {
  window.addTemRow('threat', 'Bird strike / Avian activity in area', 'Maintain visual watch. Evade horizontally if attacked. Do not climb above bird.', 'Low', 'Med');
  window.addTemRow('threat', 'Loss of C2 Link (Signal loss)', 'RTL altitude verified clear of obstacles. Auto-RTL triggers after 10s.', 'Med', 'Med');
  window.addTemRow('threat', 'Unexpected airspace intrusion (Manned AC)', 'Immediate descent to max 20m AGL or landing. Maintain listen watch on VHF.', 'Low', 'High');
  window.addTemRow('threat', 'Sudden weather change / Wind gust', 'Monitor local conditions. Land immediately if wind > 10m/s.', 'Med', 'Med');
};

window.renderInitialTemRows = function() {
  const threatsContainer = document.getElementById('tem-threats-container');
  const errorsContainer = document.getElementById('tem-errors-container');
  if (threatsContainer && threatsContainer.children.length === 0) window.addTemRow('threat');
  if (errorsContainer && errorsContainer.children.length === 0) window.addTemRow('error');
};

// --- AUTO-EXPAND TEXTAREAS ---
window.triggerAutoExpand = function() {
  // Finds both standard text boxes and the dynamically created TEM rows
  document.querySelectorAll('textarea.auto-expand, textarea.tem-val1, textarea.tem-val2').forEach(ta => {
    ta.style.height = '1px'; // Temporarily collapse the field to reset scrollHeight
    ta.style.height = ta.scrollHeight + 'px'; // Expand to the actual text height
  });
};

window.initAutoExpand = function() {
  if (window._autoExpandInit) return;
  window._autoExpandInit = true;
  document.body.addEventListener('input', function(e) {
    if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'textarea' && e.target.classList.contains('auto-expand')) {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    }
  });
  setTimeout(window.triggerAutoExpand, 200);
};

window.dbrfNewPlan = function() {
  if (!confirm("Are you sure you want to start a new plan? All unsaved data will be cleared.")) return;
  
  // Clears all input fields but does NOT touch the API keys
  document.querySelectorAll('input[type="text"], input[type="number"], input[type="time"], input[type="date"], textarea').forEach(el => {
    if (el.id !== 'checkwx-api-key' && el.id !== 'openaip-api-key') el.value = '';
  });
  
  // Resets checkboxes, radio buttons, and drop-down menus
  document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(el => el.checked = false);
  document.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
  
  // Clears global variables and lists
  window.waypoints = [];
  window.fencePoints = [];
  window.rallyPoints = [];
  window._nrgSuggested = null;
  window._loadedFiles = { mission: '', fence: '', rally: '' };
  window.uploadedCharts = [];
  window.ofpInputData = {};
  
  // Clears the OSO checklist
  document.querySelectorAll('.oso-item').forEach(el => { 
    el.classList.remove('checked'); 
    const chk = el.querySelector('.oso-check'); 
    if (chk) chk.textContent = '☐'; 
  });
  
  // Resets the TEM fields to default
  const tContainer = document.getElementById('tem-threats-container');
  const eContainer = document.getElementById('tem-errors-container');
  if (tContainer) tContainer.innerHTML = '';
  if (eContainer) eContainer.innerHTML = '';
  if (typeof window.renderInitialTemRows === 'function') window.renderInitialTemRows();
  
  // Forces redraw of all panels so they are cleared
  if(typeof window.updateQLStatus === 'function') window.updateQLStatus();
  if(typeof window.renderWaypointList === 'function') window.renderWaypointList();
  if(typeof window.clearWxData === 'function') window.clearWxData();
  if(typeof window.clearCharts === 'function') window.clearCharts();
  if(typeof window.calcSAIL25 === 'function') window.calcSAIL25();
  if(typeof window.updateRadioFreqUI === 'function') window.updateRadioFreqUI();
  
  // Updates mission name in header
  if(typeof window.calcSAIL25 === 'function') window.calcSAIL25();
  if(typeof window.updateRadioFreqUI === 'function') window.updateRadioFreqUI();
  if(typeof window.updateHeaderMissionName === 'function') window.updateHeaderMissionName(); // <--- ADD THIS

  // Hide weather and energy boxes
  const nrgBox = document.getElementById('nrg-result');
  if(nrgBox) nrgBox.style.display = 'none';
  const smhiBox = document.getElementById('smhi-assessment');
  if(smhiBox) smhiBox.style.display = 'none';
  
  // Set today's date in the date field
  const d = new Date();
  const dateInput = document.getElementById('op-date');
  if (dateInput) {
    dateInput.value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    if (typeof window.formatDateInput === 'function') window.formatDateInput(dateInput);
  }
  
  if(typeof window.handleOpTypeChange === 'function') window.handleOpTypeChange();
  if(typeof window.handleFlightTypeChange === 'function') window.handleFlightTypeChange();
  if(typeof window.refreshAllMaps === 'function') window.refreshAllMaps();
  
  // Return to Page 1
  window.goTo(0);
  
  // Show confirmation in the header
  const s = document.getElementById('dbrf-status');
  if (s) { 
    s.style.color = 'var(--ok)'; 
    s.textContent = '✓ Started new plan'; 
    setTimeout(()=>s.textContent='', 4000); 
  }
};

// --- SAVE & LOAD DBRF ---
window.dbrfCollect = function() {
  const data = {
    version: 2, savedAt: new Date().toISOString(), fields: {}, radios: {}, checkboxes: {},
    waypoints: window.waypoints, fencePoints: window.fencePoints, rallyPoints: window.rallyPoints,
    nrgSuggested: window._nrgSuggested, osoChecked: [], osoDesc: {}, // <-- Added osoDesc
    loadedFiles: window._loadedFiles
  };
  document.querySelectorAll('input[type="text"], input[type="number"], input[type="time"], input[type="date"], select, textarea').forEach(el => { if(el.id) data.fields[el.id] = el.value; });
  document.querySelectorAll('input[type="radio"]:checked').forEach(el => { if(el.name) data.radios[el.name] = el.value; });
  document.querySelectorAll('input[type="checkbox"]').forEach(el => { if(el.id) data.checkboxes[el.id] = el.checked; });
  
  // UX REDESIGN: Save which OSOs are ticked AND their text entries
  document.querySelectorAll('.oso-item').forEach(el => {
    if (el.dataset.num) {
      if (el.classList.contains('checked')) data.osoChecked.push(el.dataset.num);
      const ta = el.querySelector('.oso-desc-input');
      if (ta && ta.value) data.osoDesc[el.dataset.num] = ta.value;
    }
  });

  data.tem = { threats: [], errors: [] };
  
  // UX REDESIGN: Also save Prob and Sev for Threats
  document.querySelectorAll('.tem-threat-row').forEach(row => {
    const v1 = row.querySelector('.tem-val1').value;
    const v2 = row.querySelector('.tem-val2').value;
    const prob = row.querySelector('.tem-prob')?.value || '';
    const sev = row.querySelector('.tem-sev')?.value || '';
    if (v1 || v2) data.tem.threats.push([v1, v2, prob, sev]);
  });
  
  document.querySelectorAll('.tem-error-row').forEach(row => {
    const v1 = row.querySelector('.tem-val1').value;
    const v2 = row.querySelector('.tem-val2').value;
    if (v1 || v2) data.tem.errors.push([v1, v2]);
  });
  data.uploadedCharts = window.uploadedCharts;
  data.ofpInputData = window.ofpInputData;
  return data;
};

window.dbrfSave = async function() {
  try {
    const data = window.dbrfCollect();
    const missionName = (data.fields['mission-name'] || 'plan').replace(/[^a-z0-9_-]/gi, '_');
    const dateStr = new Date().toISOString().slice(0,10);
    const filename = `${missionName}_${dateStr}.dbrf`;
    const json = JSON.stringify(data, null, 2);
    
    const statusEl = document.getElementById('dbrf-status');
    function showStatus(msg, ok) {
      if (!statusEl) return;
      statusEl.style.color = ok ? 'var(--ok)' : 'var(--danger)';
      statusEl.textContent = msg;
      if (ok) setTimeout(() => { statusEl.textContent = ''; }, 5000);
    }

    // 1. Tauri Native Dialog
    if (window.__TAURI__ && window.__TAURI__.dialog && window.__TAURI__.fs) {
      try {
        const { save } = window.__TAURI__.dialog;
        const { writeTextFile } = window.__TAURI__.fs;
        const filePath = await save({
          defaultPath: filename,
          filters: [{ name: 'MissionDesk Plan', extensions: ['dbrf'] }]
        });
        if (filePath) {
          await writeTextFile(filePath, json);
          showStatus(`✓ Saved: ${filePath}`, true);
        }
        return;
      } catch(e) {
        console.error("Tauri save error", e);
      }
    }

    // 2. Web File System Access API (Chrome/Edge fallback)
    if (window.showSaveFilePicker) {
      try {
        const blob = new Blob([json], { type: 'application/json' });
        const fh = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'MissionDesk Plan', accept: { 'application/json': ['.dbrf'] } }]
        });
        const writable = await fh.createWritable();
        await writable.write(blob);
        await writable.close();
        showStatus(`✓ Saved: ${fh.name}`, true);
        return;
      } catch(pickerErr) {
        if (pickerErr.name === 'AbortError') return; 
      }
    }

    // 3. Fallback (direkt till Downloads)
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus(`✓ Saved to downloads: ${filename}`, true);
  } catch(e) {
    console.error(e);
  }
};

window.dbrfLoad = function(inputEl) {
  const file = inputEl.files?.[0]; if (!file) return;
  const statusEl = document.getElementById('dbrf-status');
  if (file.size > window.MAX_IMPORT_BYTES) {
    if (statusEl) { statusEl.style.color = 'var(--danger)'; statusEl.textContent = `✗ Plan file too large (limit ${window.MAX_IMPORT_BYTES/1048576} MB).`; }
    inputEl.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      let data;
      try { data = JSON.parse(e.target.result); }
      catch (pe) { throw new Error('Plan file is not valid JSON (.dbrf).'); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Plan file has an unexpected structure.');
      Object.entries(data.fields || {}).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.value = val; });
      // Migrate radio values from pre-SORA-v2.5 .dbrf files to current values.
      // Old values were based on the incorrect iGRC matrix and mitigation scheme.
      const radioMigrations = {
        pop: { sparse: 'remote', rural: 'lightly', urban: 'low_metro', crowd: 'assemblies' },
        m1a: { partial: 'low', full: 'medium' },
        m1b: { low: 'none', med: 'medium' },  // 'low' was N/A in SORA v2.5; med → medium
        m1c: { yes: 'low' },
        m2:  { low: 'none', med: 'medium' },  // 'low' was N/A in SORA v2.5; med → medium
      };
      const migratedRadios = {};
      Object.entries(data.radios || {}).forEach(([name, val]) => {
        const migration = radioMigrations[name];
        migratedRadios[name] = (migration && migration[val]) ? migration[val] : val;
      });
      Object.entries(migratedRadios).forEach(([name, val]) => { const el = document.querySelector(`input[name="${name}"][value="${val}"]`); if (el) el.checked = true; });
      Object.entries(data.checkboxes || {}).forEach(([id, checked]) => { const el = document.getElementById(id); if (el) el.checked = checked; });

      // ARC backward-compat: translate old 'airspace' radio values to the new
      // boolean select elements. Old files stored airspace as a single radio
      // value; new files store individual select IDs in data.fields already.
      if (data.radios && data.radios.airspace && !data.fields?.['arc-atypical']) {
        const arcMap = {
          atypical:   { 'arc-atypical': 'yes' },
          'G-low':    {},  // AEC 10 defaults (all no) — ARC-b
          'G-med':    {},  // AEC 10 conservative default — ARC-b
          'G-high':   { 'arc-above-150': 'yes' },
          controlled: { 'arc-controlled': 'yes' },
        };
        const overrides = arcMap[data.radios.airspace] || {};
        ['arc-atypical','arc-above-fl600','arc-airport-env','arc-class-bcd',
         'arc-above-150','arc-mode-s','arc-controlled','arc-urban'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = overrides[id] || 'no';
        });
      }
      // Old arc-mit / tmpr radios are no longer used; their concepts are
      // now represented by arc-local-density and arc-vlos selects.
      if (data.radios) {
        const oldVlos = data.radios['arc-mit'] === 'vlos' || data.radios['tmpr'] === 'low';
        const vlosEl = document.getElementById('arc-vlos');
        if (vlosEl && oldVlos && !data.fields?.['arc-vlos']) vlosEl.value = 'vlos';
      }
      
      // Reset and hide OSO fields
      document.querySelectorAll('.oso-item').forEach(el => { 
        el.classList.remove('checked'); 
        const chk = el.querySelector('.oso-check'); 
        if (chk) chk.textContent = '☐'; 
        const descBox = el.querySelector('.oso-desc-box');
        if (descBox) descBox.style.display = 'none';
      });
      
      // Load ticked OSOs and their free-text entries
      const osoDesc = data.osoDesc || {};
      (data.osoChecked || []).forEach(num => {
        const el = document.querySelector(`.oso-item[data-num="${num}"]`);
        if (el) { 
          el.classList.add('checked'); 
          const chk = el.querySelector('.oso-check'); 
          if (chk) chk.textContent = '✓'; 
          const descBox = el.querySelector('.oso-desc-box');
          if (descBox) descBox.style.display = 'block';
          const ta = el.querySelector('.oso-desc-input');
          if (ta && osoDesc[num]) ta.value = osoDesc[num];
        }
      });

      window.waypoints   = window.sanitisePoints(data.waypoints   || [], window.MAX_WAYPOINTS).points;
      window.fencePoints = window.sanitisePoints(data.fencePoints || [], window.MAX_WAYPOINTS).points;
      window.rallyPoints = window.sanitisePoints(data.rallyPoints || [], window.MAX_WAYPOINTS).points;
	  window.ofpInputData = (data.ofpInputData && typeof data.ofpInputData === 'object') ? data.ofpInputData : {};
      
      window._loadedFiles = data.loadedFiles || { mission: '', fence: '', rally: '' };
      if(typeof window.updateQLStatus === 'function') window.updateQLStatus();

      if(typeof window.handleOpTypeChange === 'function') window.handleOpTypeChange();
      if(typeof window.handleFlightTypeChange === 'function') window.handleFlightTypeChange();
      if(typeof window.calcSAIL25 === 'function') window.calcSAIL25();
      if(typeof window.renderWaypointList === 'function') window.renderWaypointList();
      
      const tContainer = document.getElementById('tem-threats-container');
      const eContainer = document.getElementById('tem-errors-container');
      if (tContainer) tContainer.innerHTML = '';
      if (eContainer) eContainer.innerHTML = '';
      
      if (data.tem) {
        if (data.tem.threats && data.tem.threats.length > 0) {
          data.tem.threats.forEach(t => window.addTemRow('threat', t[0], t[1], t[2] || '', t[3] || ''));
        } else { window.addTemRow('threat'); }
        
		window.uploadedCharts = data.uploadedCharts || [];
      if (typeof window.renderChartGallery === 'function') window.renderChartGallery();
		
        if (data.tem.errors && data.tem.errors.length > 0) {
          data.tem.errors.forEach(e => window.addTemRow('error', e[0], e[1]));
        } else { window.addTemRow('error'); }
      } else {
        window.renderInitialTemRows();
      }

if(typeof window.updateHeaderMissionName === 'function') window.updateHeaderMissionName(); // <--- ADD THIS

      if(typeof window.triggerAutoExpand === 'function') setTimeout(window.triggerAutoExpand, 100);
      if(typeof window.triggerAutoExpand === 'function') setTimeout(window.triggerAutoExpand, 100);

      if (statusEl) { statusEl.style.color = 'var(--ok)'; statusEl.textContent = `✓ Loaded: ${file.name}`; setTimeout(()=>{ if (statusEl.textContent.startsWith('✓ Loaded')) statusEl.textContent=''; }, 4000); }
    } catch(err) {
      // Previously a generic, detail-free alert — now report the actual reason.
      if (statusEl) { statusEl.style.color = 'var(--danger)'; statusEl.textContent = `✗ Failed to load plan: ${err.message}`; }
      else alert('Failed to load plan: ' + err.message);
    }
    inputEl.value = '';
  };
  reader.readAsText(file);
};

window.openAROWeb = function() {
  const icao = document.getElementById('notam-icao')?.value?.trim().toUpperCase() || '';
  window.openUrl('https://aro.lfv.se/');
  if (icao) {
    const el = document.getElementById('avwx-status');
    if (el) { el.style.color='var(--accent)'; el.textContent=`↗ AROWeb opened – search PIB for ${icao} and paste NOTAM below.`; }
  }
};

window.openDronkarta = function() {
  window.openUrl('https://dronechart.lfv.se');
};

// --- CHARTS & PDF UPLOAD ---
window.handleChartUpload = async function(input) {
  const files = input.files;
  if (!files || files.length === 0) return;
  const statusEl = document.getElementById('chart-upload-status');
  statusEl.style.color = 'var(--warn)';
  statusEl.textContent = '⟳ Processing files...';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type === 'application/pdf') {
      await window.processPDF(file);
    } else if (file.type.startsWith('image/')) {
      await window.processImage(file);
    }
  }
  input.value = '';
  statusEl.style.color = 'var(--ok)';
  statusEl.textContent = `✓ Processed ${files.length} file(s). Maps added to briefing.`;
  setTimeout(() => statusEl.textContent = '', 5000);
  window.renderChartGallery();
};

window.processImage = function(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      window.uploadedCharts.push({ base64: e.target.result, name: file.name });
      resolve();
    };
    reader.readAsDataURL(file);
  });
};

window.processPDF = async function(file) {
  if (file.size > window.MAX_PDF_BYTES) {
    alert(`PDF too large (${(file.size/1048576).toFixed(1)} MB). Limit is ${window.MAX_PDF_BYTES/1048576} MB.`);
    return;
  }
  if (typeof pdfjsLib === 'undefined') {
    alert('The PDF engine has not finished loading — please try again in a moment.');
    return;
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // High resolution for printing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      window.uploadedCharts.push({
        base64: canvas.toDataURL('image/jpeg', 0.85), // JPEG saves space in the .dbrf file
        name: `${file.name} (Page ${pageNum})`
      });
    }
  } catch (err) {
    alert("Could not read the PDF file: " + err.message);
  }
};

window.renderChartGallery = function() {
  const gallery = document.getElementById('chart-gallery');
  if (!gallery) return;
  gallery.innerHTML = window.uploadedCharts.map((chart, idx) => `
    <div style="border:1px solid var(--border); border-radius:4px; overflow:hidden; background:var(--surface); display:flex; flex-direction:column; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
      <div class="chart-thumb" data-chart-action="fullscreen" data-chart-idx="${idx}" title="Click to view full size" style="height:160px; background-image:url('${window.escHtml(chart.base64)}'); background-size:contain; background-position:center; background-repeat:no-repeat; background-color:#fff; cursor:zoom-in; transition:opacity 0.2s;"></div>
      <div style="padding:8px; font-family:var(--mono); font-size:10px; color:var(--text); text-align:center; border-top:1px solid var(--border); word-break:break-all;">
        ${window.escHtml(chart.name)}
      </div>
      <button class="chart-remove-btn" data-chart-action="remove" data-chart-idx="${idx}" style="background:rgba(198,40,40,0.06); color:var(--danger); border:none; border-top:1px solid var(--border); padding:8px; cursor:pointer; font-family:var(--mono); font-size:10px; font-weight:bold; transition:all 0.2s;">✕ REMOVE</button>
    </div>
  `).join('');
};

window.showChartFullscreen = function(idx) {
  const chart = window.uploadedCharts[idx];
  if (!chart) return;
  const modal = document.getElementById('chart-modal');
  const img = document.getElementById('chart-modal-img');
  const title = document.getElementById('chart-modal-title');
  if (modal && img && title) {
    img.src = chart.base64;
    title.textContent = chart.name;
    modal.style.display = 'flex';
  }
};

window.closeChartFullscreen = function() {
  const modal = document.getElementById('chart-modal');
  if (modal) modal.style.display = 'none';
};

window.removeChart = function(idx) {
  window.uploadedCharts.splice(idx, 1);
  window.renderChartGallery();
};

window.clearCharts = function() {
  window.uploadedCharts = [];
  window.renderChartGallery();
};

// ==========================================
// VOLUME PLANNER LOGIC (DIPUL METHOD KINEMATICS)
// ==========================================

window.initVolumeMap = function() {
  if (window._volumeMap) return;
  const el = document.getElementById('volume-leaflet-map');
  if (!el) return;

  window._volumeMap = L.map('volume-leaflet-map').setView([57.7, 11.97], 13);
  
  // Store the base layers in global variables so we can toggle between them
  window._esriLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
  });
  // Lantmäteriet official topographic map via their open WMTS service
  window._topoLayer = L.tileLayer('https://minkarta.lantmateriet.se/map/topowebbcache/?layer=topowebb&style=default&tilematrixset=3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}', {
    maxNativeZoom: 15, // Lantmäteriet delivers tiles up to zoom 15...
    maxZoom: 18,       // ...but we let Leaflet stretch them if we zoom closer!
    attribution: 'Map data &copy; Lantmäteriet'
  });

  // Default is ESRI
  window._esriLayer.addTo(window._volumeMap);
  window._isTopoActive = false;

  // Creates three layers for the buffers and one for the route itself
  window._volGrbLayer = L.geoJSON(null, { style: { color: '#c62828', weight: 1, fillOpacity: 0.15 } }).addTo(window._volumeMap);
  window._volCvLayer = L.geoJSON(null, { style: { color: '#e65100', weight: 1, fillOpacity: 0.2, dashArray: '5, 5' } }).addTo(window._volumeMap);
  window._volFgLayer = L.geoJSON(null, { style: { color: '#2e7d32', weight: 1, fillOpacity: 0.3 } }).addTo(window._volumeMap);
  window._volPathLayer = L.geoJSON(null, { style: { color: '#111', weight: 3 } }).addTo(window._volumeMap);
};

window.toggleTopoMap = function() {
  if (!window._volumeMap) return;
  const btn = document.getElementById('btn-layer-topo');
  if (window._isTopoActive) {
    window._volumeMap.removeLayer(window._topoLayer);
    window._esriLayer.addTo(window._volumeMap);
    window._isTopoActive = false;
    if(btn) { btn.style.background = ''; btn.style.color = 'var(--text)'; }
  } else {
    window._volumeMap.removeLayer(window._esriLayer);
    window._topoLayer.addTo(window._volumeMap);
    window._isTopoActive = true;
    if(btn) { btn.style.background = 'var(--text)'; btn.style.color = '#fff'; }
  }
};

window.toggleAirspaceLayer = function() {
  if (!window._volumeMap) return;
  const btn = document.getElementById('btn-layer-aip');
  if (!window._airspaceLayer) {
    const apiKey = localStorage.getItem('openaip_key');
    if (!apiKey) { alert('Missing API Key!'); return; }
    window._airspaceLayer = L.tileLayer(`https://api.core.openaip.net/v2/maps/classic/{z}/{x}/{y}.png?apiKey=${apiKey}`, { maxNativeZoom: 14, maxZoom: 18, transparent: true, opacity: 0.6 });
  }
  if (window._volumeMap.hasLayer(window._airspaceLayer)) {
    window._volumeMap.removeLayer(window._airspaceLayer);
    if(btn) { btn.style.background = ''; btn.style.color = 'var(--accent)'; }
  } else {
    window._airspaceLayer.addTo(window._volumeMap);
    if(btn) { btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; }
  }
};

window.toggleLFVLayer = function() {
  if (!window._volumeMap) return;
  const btn = document.getElementById('btn-layer-lfv');
  if (!window._lfvLayer) {
    window._lfvLayer = L.tileLayer.wms('https://daim.lfv.se/geoserver/wms', { layers: 'mais:CTR,mais:TIZ,mais:ATZ,mais:RSTA,mais:DNGA,DAIM_TOPO:HKP1K,DAIM_TOPO:RWY5K', format: 'image/png', transparent: true, opacity: 0.55 });
  }
  if (window._volumeMap.hasLayer(window._lfvLayer)) {
    window._volumeMap.removeLayer(window._lfvLayer);
    if(btn) { btn.style.background = ''; btn.style.color = '#005b9f'; }
  } else {
    window._lfvLayer.addTo(window._volumeMap);
    if(btn) { btn.style.background = '#005b9f'; btn.style.color = '#fff'; }
  }
};

window.togglePopLayer = function() {
  if (!window._volumeMap) return;
  const btn = document.getElementById('btn-layer-scb');
  if (!window._popLayer) {
    window._popLayer = L.tileLayer.wms('https://geodata.scb.se/geoserver/stat/wms', { layers: 'stat:Tatorter', format: 'image/png', transparent: true, opacity: 0.5 });
  }
  if (window._volumeMap.hasLayer(window._popLayer)) {
    window._volumeMap.removeLayer(window._popLayer);
    if(btn) { btn.style.background = ''; btn.style.color = 'var(--accent3)'; }
  } else {
    window._popLayer.addTo(window._volumeMap);
    if(btn) { btn.style.background = 'var(--accent3)'; btn.style.color = '#fff'; }
  }
};

window.calcVolumes = function() {
  if (!window._volumeMap) window.initVolumeMap();
  
  // 1. Fetch input values
  const v = parseFloat(document.getElementById('vol-speed').value) || 15;
  const w = parseFloat(document.getElementById('vol-wind').value) || 8;
  const h = parseFloat(document.getElementById('vol-height').value) || 50;
  const gps = parseFloat(document.getElementById('vol-gps').value) || 3;
  const t_r = parseFloat(document.getElementById('vol-reaction').value) || 3;
  const t_l = parseFloat(document.getElementById('vol-latency').value) || 1;
  const fts = document.getElementById('vol-fts').value;

  // 2. KINEMATIC MATHEMATICS
  // Flight Geography (FG) = The minimum distance the drone can deviate from the planned route due to system error.
  const fg_margin = gps;

  // Contingency Volume (CV) = The distance the drone can travel (forward + wind drift) during reaction time before FTS activates.
  const t_total = t_r + t_l;
  const cv_margin = (v + w) * t_total;

  // Ground Risk Buffer (GRB) = The distance the drone travels/drifts whilst falling towards the ground.
  let grb_margin = 0;
  if (fts === 'ballistic') {
    grb_margin = h; // 1:1 rule (safety radius corresponds to flight height)
  } else if (fts === 'parachute') {
    const fallTime = h / 4; // Assumes approx. 4 m/s descent rate
    grb_margin = w * fallTime; // Wind drift throughout the full descent
  } else if (fts === 'glide') {
    grb_margin = h * 3; // Assumes a glide ratio of 3:1 (fixed-wing)
  }

  // 3. Update the results in the interface
  document.getElementById('res-fg').textContent = fg_margin.toFixed(1);
  document.getElementById('res-cv').textContent = cv_margin.toFixed(1);
  document.getElementById('res-grb').textContent = grb_margin.toFixed(1);

  const total_radius = fg_margin + cv_margin + grb_margin;
  document.getElementById('res-total').textContent = total_radius.toFixed(1);

  // AUTOMATION: Results are sent back to Step 1 so they are saved in .dbrf and the Briefing!
  const radiusEl = document.getElementById('op-radius');
  const bufferEl = document.getElementById('op-buffer');
  if (radiusEl) radiusEl.value = Math.round(fg_margin + cv_margin);
  if (bufferEl) bufferEl.value = Math.round(grb_margin);

  // 4. DRAW THE ZONES ON THE MAP
  window._volFgLayer.clearLayers();
  window._volCvLayer.clearLayers();
  window._volGrbLayer.clearLayers();
  window._volPathLayer.clearLayers();

  // Build a GeoJSON line from the waypoints, or a point if only start coordinates are available
  let geojson = null;
  let validWps = (window.waypoints || []).filter(wp => !isNaN(parseFloat(wp.lat)) && !isNaN(parseFloat(wp.lon)));

  if (validWps.length > 1) {
    const coords = validWps.map(wp => [parseFloat(wp.lon), parseFloat(wp.lat)]);
    geojson = turf.lineString(coords);
  } else if (validWps.length === 1) {
    geojson = turf.point([parseFloat(validWps[0].lon), parseFloat(validWps[0].lat)]);
  } else {
    const raw = document.getElementById('op-coords')?.value;
    const parsed = window.parseCoords(raw);
    if (parsed) {
      geojson = turf.point([parsed.lon, parsed.lat]);
    }
  }

  if (geojson) {
    window._volPathLayer.addData(geojson);

    // Turf.buffer uses kilometres
    const fg_km = Math.max(fg_margin / 1000, 0.001);
    const cv_km = Math.max((fg_margin + cv_margin) / 1000, 0.001);
    const grb_km = Math.max((total_radius) / 1000, 0.001);

    try {
      // Draw zones (outer first so inner ones appear on top)
      const grbBuffer = turf.buffer(geojson, grb_km, {units: 'kilometers', steps: 32});
      window._volGrbLayer.addData(grbBuffer);

      const cvBuffer = turf.buffer(geojson, cv_km, {units: 'kilometers', steps: 32});
      window._volCvLayer.addData(cvBuffer);

      const fgBuffer = turf.buffer(geojson, fg_km, {units: 'kilometers', steps: 32});
      window._volFgLayer.addData(fgBuffer);

      // Centre the camera neatly
      window._volumeMap.fitBounds(window._volGrbLayer.getBounds(), { padding: [30, 30] });
    } catch(e) {
      console.error("Turf geometry error:", e);
    }
  }
};

// --- EVENT DELEGATION ---
// Shared delegation hub for declarative data-goto / data-action handlers. This is
// the foundation for the CSP inline-handler refactor: later batches migrate more
// on* handlers onto this hub by adding new kebab-case data-action values below.
// One document-level listener resolves the clicked element via closest() so that
// clicks landing on a child <span> still match the button that carries the attribute.
window.initEventDelegation = function() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-goto],[data-action]');
    if (!el) return;
    if (el.dataset.goto !== undefined) { window.goTo(parseInt(el.dataset.goto, 10)); return; }
    switch (el.dataset.action) {
      case 'toggle-sidebar': window.toggleSidebar(); break;
      case 'toggle-theme':   window.toggleTheme(); break;
      case 'new-plan':       window.dbrfNewPlan(); break;
      case 'save-plan':      window.dbrfSave(); break;
      case 'open-plan':      document.getElementById('dbrf-open-input').click(); break;
      case 'text-size':      window.adjustTextSize(parseInt(el.dataset.delta, 10)); break;
      case 'open-url':       window.openUrl(el.dataset.url); break;
      case 'generate-briefing': window.generateBriefing(); window.goTo(9); break;
      case 'generate-ofp':      window.generateOFP(); window.goTo(10); break;
      // --- Batch 2a (panel-0 / Step 1 DOI) ---
      case 'trigger-input':     document.getElementById(el.dataset.target)?.click(); break;
      case 'clear-quick-load':  window.clearQuickLoad(); break;
      case 'recalc-flight-time': window.recalcFlightTime(); break;
      case 'nrg-reset':         window.nrgResetToDefaults(); break;
      case 'autofill-delivery': window.autoFillDeliveryCoords(); break;
      case 'add-waypoint':      window.addWaypoint(); break;
      case 'clear-waypoints':   window.clearWaypoints(); break;
      case 'toggle-bulk-import': window.toggleBulkImport(); break;
      case 'clear-fence':       window.clearFence(); break;
      case 'open-lfv-map':      window.openLFVMap(); break;
      case 'parse-bulk-waypoints': window.parseBulkWaypoints(); break;
      case 'validate-next':     window.validateAndNext(parseInt(el.dataset.from, 10), parseInt(el.dataset.to, 10)); break;
      // --- Batch 3 (panel-volume + panel-1) ---
      case 'toggle-topo-map':       window.toggleTopoMap(); break;
      case 'toggle-airspace-layer': window.toggleAirspaceLayer(); break;
      case 'toggle-lfv-layer':      window.toggleLFVLayer(); break;   // distinct from 'open-lfv-map'
      case 'toggle-pop-layer':      window.togglePopLayer(); break;
      case 'recalc-sail-next':      window.calcSAIL25(); window.goTo(3); break;
      // --- Batch 4 (panel-2 Containment, panel-3 OSO, panel-4 Weather & Airspace) ---
      case 'assess-containment-next': window.assessContainment(); window.goTo(4); break;
      case 'open-smhi':             window.openSMHI(); break;
      case 'open-yr':               window.openYr(); break;
      case 'open-windy':            window.openWindy(); break;
      case 'autofill-weather-metar': window.autoFillWeatherFromNearestMetar(); break;
      case 'fetch-open-meteo':      if (typeof window.fetchOpenMeteo === 'function') window.fetchOpenMeteo(); break;
      case 'refresh-all-maps':      window.refreshAllMaps(); break;
      case 'open-openaip':          window.openOpenAIP(); break;
      case 'open-skyvector':        window.openSkyVector(); break;
      case 'toggle-map-embed':      window.toggleMapEmbed(); break;
      case 'fetch-all-route-wx':    window.fetchAllRouteWx(); break;
      case 'clear-wx-data':         window.clearWxData(); break;
      case 'update-radio-freq-ui':  window.updateRadioFreqUI(); break;
      // --- Batch 5a (panel-5/6/7/8/9 + chart overlay + panel-11 Settings) ---
      case 'add-common-threats':    window.addCommonThreats(); break;
      case 'clear-charts':          window.clearCharts(); break;
      case 'print-briefing-only':   window.printBriefingOnly(); break;
      case 'print-ofp-only':        window.printOFPOnly(); break;
      case 'close-chart-fullscreen': window.closeChartFullscreen(); break;
      case 'test-checkwx-key':      window.testCheckWxKey(); break;
      case 'settings-clear-api-keys': window.settingsClearApiKeys(); break;
      case 'text-size-reset':       window.adjustTextSize(-window.currentTextOffset); break;
      // Settings explicit light/dark theme buttons (distinct from header 'toggle-theme').
      // Reproduces the original inline behaviour: set attribute, persist, sync the header icon.
      case 'set-theme': {
        const t = el.dataset.theme;
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('dbrf-theme', t);
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
        break;
      }
    }
  });

  // The .dbrf file input is wired directly (it carries an id, not a delegated action).
  const dbrfInput = document.getElementById('dbrf-open-input');
  if (dbrfInput) dbrfInput.addEventListener('change', () => window.dbrfLoad(dbrfInput));
};

// Field-level handlers for panel-0 (Step 1 DOI), migrated off inline oninput/
// onchange/onfocus/onblur attributes (CSP inline-handler refactor, batch 2a).
// Generated markup (drone-suggestions dropdown, renderWaypointList rows) is NOT
// wired here — that is batch 2b.
window.initPanel0FieldHandlers = function() {
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, () => fn(el)); };

  // Quick-load file inputs
  on('ql-mission-input', 'change', el => window.quickLoadMission(el));
  on('ql-fence-input',   'change', el => window.quickLoadFence(el));
  on('ql-rally-input',   'change', el => window.quickLoadRally(el));

  // Date field
  on('op-date', 'input', el => window.formatDateInput(el));

  // UAS model search box (static input; suggestion items are batch 2b)
  on('drone-model', 'focus', el => window.showDroneSuggestions(el.value));
  on('drone-model', 'click', el => window.showDroneSuggestions(el.value));
  on('drone-model', 'input', el => window.droneLookupDebounced(el.value));
  on('drone-model', 'blur',  ()  => setTimeout(window.hideDroneSuggestions, 250));

  // Characteristic dimension
  on('drone-dim', 'input', () => window.updateDimHint());

  // Flight-time inputs
  on('drone-cruise',   'input', () => window.recalcFlightTime());
  on('drone-wp-dwell', 'input', () => window.recalcFlightTime());

  // Energy fields — mark edited (exact key) then recalc
  [['nrg-setup','nrg-setup'], ['nrg-takeoff','nrg-takeoff'], ['nrg-cruise','nrg-cruise'],
   ['nrg-descent','nrg-descent'], ['nrg-takeoff-min','nrg-takeoff-min'], ['nrg-descent-min','nrg-descent-min']]
    .forEach(([id, key]) => on(id, 'input', () => { window.nrgMarkEdited(key); window.recalcEnergy(); }));
  on('nrg-reserve', 'input', () => window.recalcEnergy());

  // Operation / flight type selects
  on('op-type',       'change', () => window.handleOpTypeChange());
  on('op-flighttype', 'change', () => window.handleFlightTypeChange());

  // Delivery coordinate fields — map + distance + flight-time chain
  ['delivery-start-coords', 'delivery-dest-coords'].forEach(id =>
    on(id, 'input', () => { window.updateDeliveryMap(); window.calcDeliveryDistance(); window.recalcFlightTime(); }));

  // Waypoint / fence file inputs
  on('wp-file-input',    'change', el => window.loadWaypointFile(el));
  on('fence-file-input', 'change', el => window.loadFenceFile(el));

  // ConOps UAS select
  on('conops-uas-select', 'change', el => window.fillUasFromSelect(el.value));
};

// Delegated listeners for the two app.js-GENERATED lists (CSP inline-handler
// refactor, batch 2b): the drone-suggestions dropdown and the waypoint rows.
// Both render into PERSISTENT containers whose innerHTML is replaced on each
// render, so these listeners are attached ONCE here — never inside the render
// functions (which would stack a duplicate listener on every re-render).
window.initGeneratedListDelegation = function() {
  // --- Drone-suggestions dropdown (#drone-suggestions) ---
  const dropdown = document.getElementById('drone-suggestions');
  if (dropdown) {
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('[data-drone-key]');
      if (item) window.applyDroneSpec(item.dataset.droneKey);
    });
  }

  // --- Waypoint rows (#waypoint-list) ---
  // Index is resolved from the row element's data-wp-index, never baked into
  // per-row handlers, so it stays correct across re-renders/reordering.
  const wpList = document.getElementById('waypoint-list');
  if (wpList) {
    const rowIndex = (el) => {
      const row = el.closest('[data-wp-index]');
      return row ? parseInt(row.dataset.wpIndex, 10) : -1;
    };
    wpList.addEventListener('input', (e) => {
      const el = e.target;
      const field = el.dataset.wpField;
      if (!field) return;
      const i = rowIndex(el);
      if (i < 0 || !window.waypoints[i]) return;
      if (field === 'coords') {
        window.waypoints[i].coords = el.value;
        window.updateWpFeedback(i, el);
        window._debounce(window.updateWaypointPreview, 200)();
      } else if (field === 'alt') {
        window.waypoints[i].alt = el.value;
        window._debounce(window.updateWaypointPreview, 200)();
      } else if (field === 'name') {
        window.waypoints[i].name = el.value;
        window._debounce(window.updateWaypointPreview, 200)();
      }
    });
    wpList.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.wpField !== 'forceOfp') return;
      const i = rowIndex(el);
      if (i < 0 || !window.waypoints[i]) return;
      window.waypoints[i].forceOfp = el.checked;
    });
    wpList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-wp-action]');
      if (!btn) return;
      const i = rowIndex(btn);
      if (i < 0) return;
      switch (btn.dataset.wpAction) {
        case 'move-up':   window.moveWaypoint(i, -1); break;
        case 'move-down': window.moveWaypoint(i, 1);  break;
        case 'remove':    window.removeWaypoint(i);   break;
      }
    });
  }

  // --- TEM rows (#tem-threats-container / #tem-errors-container) (batch 5b) ---
  // Generated by addTemRow; the +/✕ buttons carry data-tem-action. The add button
  // also carries data-tem-type so the new row matches its list; remove walks up to
  // the enclosing .tem-row (reproduces the old parentElement.parentElement.remove()).
  ['tem-threats-container', 'tem-errors-container'].forEach((id) => {
    const container = document.getElementById(id);
    if (!container) return;
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tem-action]');
      if (!btn) return;
      if (btn.dataset.temAction === 'add') window.addTemRow(btn.dataset.temType);
      else if (btn.dataset.temAction === 'remove') btn.closest('.tem-row')?.remove();
    });
  });

  // --- Chart gallery cards (#chart-gallery) (batch 5b) ---
  // Generated by renderChartGallery; the thumbnail and remove button carry
  // data-chart-action + data-chart-idx. Hover effects now live in CSS
  // (.chart-thumb:hover / .chart-remove-btn:hover), not inline onmouseover/out.
  const gallery = document.getElementById('chart-gallery');
  if (gallery) {
    gallery.addEventListener('click', (e) => {
      const el = e.target.closest('[data-chart-action]');
      if (!el) return;
      const idx = parseInt(el.dataset.chartIdx, 10);
      if (el.dataset.chartAction === 'fullscreen') window.showChartFullscreen(idx);
      else if (el.dataset.chartAction === 'remove') window.removeChart(idx);
    });
  }

  // --- Editable OFP fields (#ofp-content) (batch 6) ---
  // Generated by generateOFP; every editable field carries data-ofp. Semantics
  // are preserved EXACTLY: standard fields, the actual-% field and the take-off
  // field act on 'input'; the RETO/ATO time fields act on 'change' ONLY (no
  // double-fire / no recalc per keystroke). saveOfpField is keyed by element id
  // so edited values survive regeneration via window.ofpInputData.
  const ofp = document.getElementById('ofp-content');
  if (ofp) {
    ofp.addEventListener('input', (e) => {
      const el = e.target.closest('[data-ofp]');
      if (!el) return;
      const t = el.dataset.ofp;
      if (t === 'save')              window.saveOfpField(el.id, el.value);
      else if (t === 'save-actual') { window.saveOfpField(el.id, el.value); window.ofpRecalcActual(); }
      else if (t === 'takeoff')      window.ofpUpdateTakeoff(el.value);
      // 'save-reto' is change-only — intentionally ignored on input
    });
    ofp.addEventListener('change', (e) => {
      const el = e.target.closest('[data-ofp]');
      if (!el) return;
      if (el.dataset.ofp === 'save-reto') {
        window.saveOfpField(el.id, el.value);
        window.ofpRecalcRETO(parseInt(el.dataset.ofpIdx, 10));
      }
    });
  }
};

// Field handlers for panel-volume (Step 2) and panel-1 (Steps 2–7), migrated off
// inline oninput/onchange attributes (CSP inline-handler refactor, batch 3). This
// is the critical SORA path: volume inputs feed window.calcVolumes() and the
// iGRC/ARC/SAIL controls feed window.calcSAIL25() (which keeps its own input guard).
window.initBatch3FieldHandlers = function() {
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

  // panel-volume — 6 number inputs + 1 select, all recompute the operational volumes.
  ['vol-speed', 'vol-wind', 'vol-height', 'vol-gps', 'vol-reaction', 'vol-latency']
    .forEach(id => on(id, 'input', () => window.calcVolumes()));
  on('vol-fts', 'change', () => window.calcVolumes());

  // panel-1 — the two dimension/speed fields update the iGRC column hint.
  on('igrc-dim',   'input', () => window.updateDimHint());
  on('igrc-speed', 'input', () => window.updateDimHint());

  // panel-1 — the 12 ARC/strategic/TMPR selects re-run the full SORA assessment.
  ['arc-atypical', 'arc-above-fl600', 'arc-airport-env', 'arc-class-bcd', 'arc-above-150',
   'arc-mode-s', 'arc-controlled', 'arc-urban', 'arc-authority-override',
   'arc-local-density', 'arc-claim-atypical', 'arc-vlos']
    .forEach(id => on(id, 'change', () => window.calcSAIL25()));
};

// Field handlers for panel-3 (Step 9 OSO) and panel-4 (Weather & Airspace),
// migrated off inline onchange/oninput attributes (CSP inline-handler refactor,
// batch 4). The two API-key fields reproduce their original inline behaviour
// EXACTLY — same sanitisation rules and localStorage keys ('openaip_key' /
// 'checkwx_key') — so saved keys keep loading on next start.
window.initBatch4FieldHandlers = function() {
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, () => fn(el)); };

  // panel-3 — OSO SAIL filter re-renders the OSO lists.
  on('oso-sail-filter', 'change', () => window.renderOSO());

  // panel-4 — wind speed field updates the knots conversion readout.
  on('w-wind', 'input', () => window.updateWindKt());

  // panel-4 — OpenAIP / CheckWX API keys use the shared helpers (same fields also
  // exist on the Settings panel; see window.applyOpenAipKey / window.applyCheckWxKey).
  on('openaip-api-key', 'input', el => window.applyOpenAipKey(el));
  on('checkwx-api-key', 'input', el => window.applyCheckWxKey(el));
};

// Shared API-key field handlers. Both the Weather & Airspace panel (panel-4) and
// the Settings panel (panel-11) expose OpenAIP / CheckWX key fields with identical
// behaviour, so the logic lives here once. The sanitisation rules and localStorage
// keys ('openaip_key' / 'checkwx_key') match the original inline handlers byte for
// byte, so previously-saved keys keep loading on next start.
window.applyOpenAipKey = function(el) {
  const k = el.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  el.value = k;
  try { localStorage.setItem('openaip_key', k); } catch (e) {}
  window.syncApiKeys();
  window.refreshAllMaps();
};
window.applyCheckWxKey = function(el) {
  const k = el.value.trim();
  el.value = k;
  try { localStorage.setItem('checkwx_key', k); } catch (e) {}
  window.syncApiKeys();
};

// Field handlers for the Charts panel (panel-7) and Settings panel (panel-11),
// migrated off inline onchange/oninput attributes (CSP inline-handler refactor,
// batch 5a). The Settings key fields reuse the shared helpers above.
window.initBatch5FieldHandlers = function() {
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, () => fn(el)); };

  // panel-7 — chart upload file input.
  on('chart-upload-input', 'change', el => window.handleChartUpload(el));

  // panel-11 — Settings OpenAIP / CheckWX API key fields (shared helpers).
  on('settings-openaip-key', 'input', el => window.applyOpenAipKey(el));
  on('settings-checkwx-key', 'input', el => window.applyCheckWxKey(el));
};

// --- INIT HOOKS ---
document.addEventListener('DOMContentLoaded', () => {
  // Wire the delegated nav/header/sidebar event hub.
  window.initEventDelegation();
  // Wire panel-0 (Step 1 DOI) field handlers migrated off inline attributes.
  if (typeof window.initPanel0FieldHandlers === 'function') window.initPanel0FieldHandlers();
  // Wire container-level delegation for the generated drone/waypoint lists.
  if (typeof window.initGeneratedListDelegation === 'function') window.initGeneratedListDelegation();
  // Wire panel-volume + panel-1 (SORA path) field handlers.
  if (typeof window.initBatch3FieldHandlers === 'function') window.initBatch3FieldHandlers();
  // Wire panel-3 (OSO) + panel-4 (Weather & Airspace) field handlers.
  if (typeof window.initBatch4FieldHandlers === 'function') window.initBatch4FieldHandlers();
  // Wire panel-7 (Charts) + panel-11 (Settings) field handlers.
  if (typeof window.initBatch5FieldHandlers === 'function') window.initBatch5FieldHandlers();
  // Bound every free-text field against pathologically large input.
  if (typeof window.applyInputSafetyLimits === 'function') window.applyInputSafetyLimits();
  // Apply saved text size immediately
  document.documentElement.style.setProperty('--tz', window.currentTextOffset + 'px');
  // Displayed version comes solely from app/js/version.js (window.MISSIONDESK_VERSION),
  // read at runtime on both the Tauri desktop build and the web/GitHub Pages mirror.
  // To change the displayed version: bump app/js/version.js. CI sets the build number there automatically.
  const versionEl = document.getElementById('app-version');
  if (versionEl) versionEl.textContent = 'v' + (window.MISSIONDESK_VERSION || '?');

  // UX REDESIGN: Listen for changes that make the SORA calculation stale
  ['drone-dim', 'drone-speed', 'drone-model', 'pop-controlled', 'pop-sparse', 'pop-rural', 'pop-suburban', 'pop-urban', 'pop-crowd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', window.markStaleData);
    if (el) el.addEventListener('change', window.markStaleData);
  });
  
  // Listen for changes to Mission Name
  const missionNameInput = document.getElementById('mission-name');
  if (missionNameInput) {
    missionNameInput.addEventListener('input', window.updateHeaderMissionName);
  }
  
  // pdf.js worker source is now set by the vendored ES-module loader in index.html
  // (window.pdfjsLib + GlobalWorkerOptions.workerSrc). The old CDN assignment that
  // lived here ran before the deferred module loaded and pointed at a stale worker,
  // so it has been removed — see the <script type="module"> shim in index.html.
  if (typeof window.renderOSO === 'function') window.renderOSO();
  if (typeof window.initAutoExpand === 'function') window.initAutoExpand();
  if (typeof window.initAccordions === 'function') window.initAccordions();
  
  const savedTheme = localStorage.getItem('dbrf-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  const checkwxKeyInput = document.getElementById('checkwx-api-key');
  if (checkwxKeyInput) {
    checkwxKeyInput.value = localStorage.getItem('checkwx_key') || '';
  }
  const oaipKeyInput = document.getElementById('openaip-api-key');
  if (oaipKeyInput) {
    oaipKeyInput.value = localStorage.getItem('openaip_key') || '';
  }
  window.syncApiKeys();

  const d = new Date();
  const dateInput = document.getElementById('op-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    if (typeof window.formatDateInput === 'function') window.formatDateInput(dateInput);
  }

  // GRC inputs — radio buttons
  document.querySelectorAll('input[name="pop"], input[name="m1a"], input[name="m1b"], input[name="m1c"], input[name="m2"]')
    .forEach(el => el.addEventListener('change', window.calcSAIL25));
    
  ['w-wind','w-vis','w-cloud','w-temp','w-humid','w-precip-mm','w-pressure','w-winddir'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', window.liveWeatherAssessment); el.addEventListener('change', window.liveWeatherAssessment); }
  });
  
  document.querySelectorAll('input[name="containment"], #cont-adj-pop, #cont-assembly')
    .forEach(el => el.addEventListener('change', window.assessContainment));

  const opCoordsEl = document.getElementById('op-coords');
  if(opCoordsEl) opCoordsEl.addEventListener('blur', function() { window.applyParsedCoords(this.value, true); });

  const patchInput = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function() {
      const f = this.files?.[0]; if (!f) return;
      const r = new FileReader(); r.onload = ev => { window[key] = ev.target.result; }; r.readAsText(f);
    });
  };
  patchInput('ql-mission-input', '_dbrfRawMission'); 
  patchInput('ql-fence-input', '_dbrfRawFence');
  patchInput('ql-rally-input', '_dbrfRawRally'); 
  patchInput('wp-file-input', '_dbrfRawMission');
  patchInput('fence-file-input', '_dbrfRawFence');

  setTimeout(() => {
    if(typeof window.handleOpTypeChange === 'function') window.handleOpTypeChange();
    if(typeof window.handleFlightTypeChange === 'function') window.handleFlightTypeChange();
    if(typeof window.calcSAIL25 === 'function') window.calcSAIL25();
    if (typeof window.renderInitialTemRows === 'function') window.renderInitialTemRows();
    if (typeof window.updateHeaderMissionName === 'function') window.updateHeaderMissionName(); // <--- ADD THIS
  }, 100);
});