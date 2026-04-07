// ==========================================
// MISSIONDESK PDF & BRIEFING GENERATOR HELPERS
// ==========================================

window.printBriefingOnly = function() {
  const oldTitle = document.title;
  const mName = document.getElementById('mission-name')?.value || 'MissionDesk';
  document.title = mName + '_Briefing';
  document.body.classList.remove('print-ofp-only');
  document.body.classList.add('print-briefing-only');
  window.print();
  document.body.classList.remove('print-briefing-only');
  document.title = oldTitle;
};

window.printOFPOnly = function() {
  const oldTitle = document.title;
  const mName = document.getElementById('mission-name')?.value || 'MissionDesk';
  document.title = mName + '_OFP';
  document.body.classList.remove('print-briefing-only');
  document.body.classList.add('print-ofp-only');
  window.print();
  document.body.classList.remove('print-ofp-only');
  document.title = oldTitle;
};

window.buildBriefAirspaceLinks = function() {
  const bar = document.getElementById('brief-airspace-link-bar');
  if (!bar) return;
  const pts = window._briefMapPoints;
  if (!pts || pts.length === 0) return;
  const lat = (pts.reduce((a,p) => a + p.lat, 0) / pts.length).toFixed(4);
  const lon = (pts.reduce((a,p) => a + p.lon, 0) / pts.length).toFixed(4);
  const z   = pts.length === 1 ? 13 : 11;
  const links = [
    { href: `https://www.openaip.net`,  label: '✈ OPENAIP AIRSPACE ↗' },
    { href: `https://dronechart.lfv.se#${lat},${lon},${z}`,             label: '🗺 LFV UASKARTA ↗' },
    { href: `https://skyvector.com/?ll=${lat},${lon}&chart=301&zoom=2`,  label: '📡 SKYVECTOR ↗' },
    { href: `https://www.windy.com/${lat}/${lon}?wind,${lat},${lon},10`, label: '🌬 WINDY ↗' },
  ];
  bar.innerHTML = links.map(l =>
    `<a href="${l.href}" target="_blank" rel="noopener" class="btn btn-secondary" style="border-color:var(--accent);color:var(--accent);font-size:10px;padding:6px 12px;margin-right:8px;display:inline-block;text-decoration:none;font-weight:bold;">${l.label}</a>`
  ).join('');
};

window.buildBriefingMap = function(isDelivery, isAutonomous) {
  let pts = [];

  if (isDelivery) {
    const sp = typeof window.parseCoords === 'function' ? window.parseCoords(document.getElementById('delivery-start-coords')?.value) : null;
    const dp = typeof window.parseCoords === 'function' ? window.parseCoords(document.getElementById('delivery-dest-coords')?.value) : null;
    if (sp) pts.push({lat:sp.lat, lon:sp.lon, name: document.getElementById('delivery-start-loc')?.value || 'Start', type:'start', alt:'0'});
    if (dp) pts.push({lat:dp.lat, lon:dp.lon, name: document.getElementById('delivery-dest-loc')?.value || 'Destination', type:'dest', alt:'0'});
    if (window.waypoints && window.waypoints.length > 0) {
      pts = [];
      window.waypoints.forEach((wp, i) => {
        const latN = parseFloat(wp.lat), lonN = parseFloat(wp.lon);
        if (!isNaN(latN) && !isNaN(lonN) && (latN !== 0 || lonN !== 0)) {
          pts.push({ lat: latN, lon: lonN, name: wp.name || `WP${i+1}`, type: i===0?'start':i===window.waypoints.length-1?'dest':'wp', alt: wp.alt||'0' });
        }
      });
    }
  } else {
    const resolved = [];
    if (window.waypoints) {
      window.waypoints.forEach((wp, i) => {
        let lat = null, lon = null;
        const latN = parseFloat(wp.lat), lonN = parseFloat(wp.lon);
        if (!isNaN(latN) && !isNaN(lonN)) {
          lat = latN; lon = lonN;
        } else {
          const p = typeof window.parseCoordFull === 'function' ? window.parseCoordFull(wp.coords || '') : null;
          if (p) { lat = p.lat; lon = p.lon; }
        }
        if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
          resolved.push({ lat, lon, name: wp.name || `WP${i+1}`, alt: wp.alt || '0' });
        }
      });
    }
    resolved.forEach((wp, i) => {
      pts.push({
        lat: wp.lat, lon: wp.lon,
        name: wp.name,
        type: i === 0 ? 'start' : i === resolved.length-1 ? 'dest' : 'wp',
        alt: wp.alt,
      });
    });
  }

  if (pts.length === 0) {
    const cp = typeof window.parseCoords === 'function' ? window.parseCoords(document.getElementById('op-coords')?.value) : null;
    if (cp) pts.push({lat:cp.lat, lon:cp.lon, name: document.getElementById('op-location')?.value || 'Operating site', type:'single', alt:'0'});
  }

  window._briefMapPoints = pts;

  if (pts.length === 0) {
    return `<div style="font-family:var(--mono);font-size:11px;color:var(--muted);padding:16px;background:var(--surface2);border-radius:4px;">
      Enter coordinates in the DOI step or load a mission file to display the map in the brief.
    </div>`;
  }

  const centerLat = pts.reduce((a,p)=>a+p.lat,0)/pts.length;
  const centerLon = pts.reduce((a,p)=>a+p.lon,0)/pts.length;
  const lat = centerLat.toFixed(4), lon = centerLon.toFixed(4);
  const zoom = pts.length === 1 ? 13 : 11;

  const cruiseMs    = parseFloat(document.getElementById('drone-cruise')?.value) || 10;
  const dwellSec    = parseFloat(document.getElementById('drone-wp-dwell')?.value) || 0;
  const cruiseRate  = parseFloat(document.getElementById('nrg-cruise')?.value)  || 4;   
  const hoverRate   = parseFloat(document.getElementById('nrg-takeoff')?.value) || 8;   
  const VERT_MS     = 3;

  const segData = [{distM:0, segSec:0, cumSec:0, cumPct:0}];
  for (let i = 1; i < pts.length; i++) {
    const p1 = pts[i-1], p2 = pts[i];
    const R=6371000, dLat=(p2.lat-p1.lat)*Math.PI/180, dLon=(p2.lon-p1.lon)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.sin(dLon/2)**2;
    const distM = 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    const altDiff = Math.abs((parseFloat(p2.alt)||0)-(parseFloat(p1.alt)||0));
    const segSec = distM/cruiseMs + altDiff/VERT_MS + (i>0&&i<pts.length-1?dwellSec:0);
    const segPct = (segSec/60)*cruiseRate + (i>0&&i<pts.length-1?(dwellSec/60)*hoverRate:0);
    const prev = segData[i-1];
    segData.push({distM, segSec, segPct, cumSec:prev.cumSec+segSec, cumPct:prev.cumPct+segPct});
  }

  const fmtTime = s => s<60 ? `${Math.round(s)}s` : `${Math.floor(s/60)}m${Math.round(s%60).toString().padStart(2,'0')}s`;
  const tableRows = pts.map((p,i) => {
    const d = segData[i];
    const distTxt  = i===0 ? '–' : `${(d.distM/1000).toFixed(2)}`;
    const segTxt   = i===0 ? '–' : fmtTime(d.segSec);
    const cumTxt   = fmtTime(d.cumSec);
    const eIntTxt  = i===0 ? '–' : `${(d.segPct||0).toFixed(1)}%`;
    const eAccTxt  = `${d.cumPct.toFixed(1)}%`;
    const rowBg    = p.type==='start'?'background:rgba(27,122,60,0.07);' : p.type==='dest'?'background:rgba(0,105,180,0.07);' : '';
    const warnStyle = d.cumPct>70?'color:var(--danger);font-weight:bold;':d.cumPct>40?'color:var(--warn);':'';
    return `<tr style="${rowBg}">
      <td style="padding:5px 8px;border:1px solid var(--border);font-family:monospace;font-weight:bold;">${i+1}</td>
      <td style="padding:5px 8px;border:1px solid var(--border);">${window.escHtml(p.name)}</td>
      <td style="padding:5px 8px;border:1px solid var(--border);font-family:monospace;">${p.lat.toFixed(6)}</td>
      <td style="padding:5px 8px;border:1px solid var(--border);font-family:monospace;">${p.lon.toFixed(6)}</td>
      <td style="padding:5px 8px;border:1px solid var(--border);font-family:monospace;">${p.alt||'–'}</td>
      <td style="padding:5px 8px;border:1px solid var(--border);font-family:monospace;color:var(--muted);">${distTxt}</td>
      <td style="padding:5px 8px;border:1px solid var(--border);font-family:monospace;">${segTxt}</td>
      <td style="padding:5px 8px;border:1px solid var(--border);font-family:monospace;">${cumTxt}</td>
      <td style="padding:5px 8px;border:1px solid var(--border);font-family:monospace;">${eIntTxt}</td>
      <td style="padding:5px 8px;border:1px solid var(--border);font-family:monospace;${warnStyle}">${eAccTxt}</td>
    </tr>`;
  }).join('');

  const totalSec = segData[pts.length-1]?.cumSec || 0;
  const totalPct = segData[pts.length-1]?.cumPct || 0;
  const totalDist = segData.reduce((s,d)=>s+d.distM,0);

  const table = `
    <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:1px;margin-bottom:4px;margin-top:12px;">
      WAYPOINT LIST · ${pts.length} points · ${(totalDist/1000).toFixed(2)} km · T. Acc ~${fmtTime(totalSec)} · E. Acc ~${totalPct.toFixed(1)}%
    </div>
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:inherit;">
      <tr style="background:var(--surface2);font-size:0.85em;">
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);">#</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);">Name</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);">Lat</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);">Lon</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);">Alt (m)</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);">Dist (km)</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);" title="Time interval between waypoints">T. Int</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);" title="Accumulated time at this waypoint">T. Acc</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);" title="Energy consumed between waypoints">E. Int</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);" title="Accumulated energy consumption at this waypoint">E. Acc</th>
      </tr>
      ${tableRows}
    </table>
    </div>
    <div style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:4px;">
      Parameters: cruise ${cruiseMs} m/s · vertical climb/descent 3 m/s · dwell ${dwellSec} s/WP · consumption ${cruiseRate}%/min
    </div>`;

  const mapHtml = `<div class="leaflet-map-box tall" id="brief-leaflet-map" style="margin-top:8px;"></div>`;
  const linksHtml = `<div class="map-link-bar" id="brief-airspace-link-bar" style="margin-top:10px;"></div>`;

  return mapHtml + table + linksHtml;
};

window.buildEnergyBriefRow = function() {
  const totalMin = parseFloat(document.getElementById('op-duration')?.value) || 0;
  if (totalMin <= 0) return '';
  const setupPct    = parseFloat(document.getElementById('nrg-setup')?.value)       || 2;
  const takeoffRate = parseFloat(document.getElementById('nrg-takeoff')?.value)     || 5;
  const cruiseRate  = parseFloat(document.getElementById('nrg-cruise')?.value)      || 3;
  const descentRate = parseFloat(document.getElementById('nrg-descent')?.value)     || 2.5;
  const takeoffMin  = parseFloat(document.getElementById('nrg-takeoff-min')?.value) || 1.5;
  const descentMin  = parseFloat(document.getElementById('nrg-descent-min')?.value) || 1.5;
  const reservePct  = parseFloat(document.getElementById('nrg-reserve')?.value)     || 20;
  const cruiseMin   = Math.max(0, totalMin - takeoffMin - descentMin);
  const e_total = setupPct + takeoffRate*takeoffMin + cruiseRate*cruiseMin + descentRate*descentMin + reservePct;
  const color = e_total > 100 ? 'var(--danger)' : e_total > 85 ? 'var(--warn)' : 'var(--ok)';
  const src = window._nrgSuggested;
  const srcNote = src ? ` <span style="color:var(--muted);font-weight:normal;font-size:9px;">[${window.escHtml(src.model)}]</span>` : '';
  return `<div class="brief-row"><span class="brief-key">Energy consumption (estimated):</span>
    <span class="brief-val" style="color:${color};font-weight:bold;">${window.fmt(e_total,1)}% of battery${srcNote}</span></div>
    <div class="brief-row"><span class="brief-key">Energy phase breakdown:</span>
    <span class="brief-val" style="font-family:var(--mono);font-size:10px;">
      Setup: ${window.fmt(setupPct,1)}% · Take-off: ${window.fmt(takeoffRate*takeoffMin,1)}% · Cruise: ${window.fmt(cruiseRate*cruiseMin,1)}% · Descent: ${window.fmt(descentRate*descentMin,1)}% · Reserve: ${window.fmt(reservePct,0)}%
    </span></div>`;
};

window.buildWaypointBriefSection = function() {
  if (!window.waypoints || window.waypoints.length === 0) return '';
  const isAuto = document.getElementById('op-flighttype')?.value === 'autonomt';
  if (!isAuto) return '';

  function haversine(a, b) {
    const R = 6371000, toRad = x => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
  }

  let cumDist = 0;
  const rows = window.waypoints.map((wp, i) => {
    const legDist = i > 0 ? haversine(window.waypoints[i-1], wp) : 0;
    cumDist += legDist;
    const legStr = i === 0 ? '—' : Math.round(legDist) + ' m';
    const cumStr = i === 0 ? '0 m' : Math.round(cumDist) + ' m';
    const isHome = wp.name === 'HOME';
    const isLast = i === window.waypoints.length - 1;
    const rowBg  = isHome ? 'background:rgba(0,105,180,0.06);' : isLast ? 'background:rgba(0,150,60,0.05);' : '';
    return `<tr style="${rowBg}">
      <td style="padding:4px 8px;border:1px solid var(--border);font-weight:bold;
        color:${isHome ? 'var(--accent)' : isLast ? 'var(--ok)' : 'var(--text)'};
        font-family:var(--mono);font-size:10px;">${isHome ? '🏠' : i}. ${window.escHtml(wp.name || '')}</td>
      <td style="padding:4px 8px;border:1px solid var(--border);font-family:monospace;font-size:10px;">${wp.lat.toFixed(6)}</td>
      <td style="padding:4px 8px;border:1px solid var(--border);font-family:monospace;font-size:10px;">${wp.lon.toFixed(6)}</td>
      <td style="padding:4px 8px;border:1px solid var(--border);font-family:monospace;font-size:10px;text-align:right;">${wp.alt != null ? window.escHtml(wp.alt) + ' m' : '–'}</td>
      <td style="padding:4px 8px;border:1px solid var(--border);font-family:monospace;font-size:10px;text-align:right;color:var(--muted);">${legStr}</td>
      <td style="padding:4px 8px;border:1px solid var(--border);font-family:monospace;font-size:10px;text-align:right;">${cumStr}</td>
    </tr>`;
  }).join('');

  const totalDist = Math.round(cumDist);
  const cruiseSpeed = parseFloat(document.getElementById('drone-cruise')?.value) || 10;
  const flightTimeSec = cruiseSpeed > 0 ? cumDist / cruiseSpeed : 0;
  const ftMin = Math.floor(flightTimeSec / 60);
  const ftSec = Math.round(flightTimeSec % 60);

  return `<div class="brief-section">
    <div class="brief-header">&#9658; 02c / WAYPOINTS &amp; ROUTE – AUTONOMOUS FLIGHT (A4c)</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:10px;">
      ${window.waypoints.length} waypoints · Total route distance: <strong>${totalDist} m</strong>
      · Est. flight time at ${cruiseSpeed} m/s cruise: <strong>${ftMin}m ${ftSec}s</strong>
      · Format: <strong>WGS-84 decimal degrees · Alt AGL (m)</strong>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px;">
      <tr style="background:var(--surface2);">
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);">Waypoint</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);">Latitude</th>
        <th style="padding:5px 8px;text-align:left;border:1px solid var(--border);">Longitude</th>
        <th style="padding:5px 8px;text-align:right;border:1px solid var(--border);">Alt (m)</th>
        <th style="padding:5px 8px;text-align:right;border:1px solid var(--border);">Leg dist</th>
        <th style="padding:5px 8px;text-align:right;border:1px solid var(--border);">Cumulative</th>
      </tr>
      ${rows}
    </table>
    <div style="font-family:var(--mono);font-size:9px;color:var(--muted);">
      &#128309; Altitudes are relative to home (AGL) unless otherwise stated in mission file.
      Verify all waypoints against current airspace and terrain data before flight.
    </div>
  </div>`;
};

window.buildFenceBriefSection = function() {
  if (!window.fencePoints || window.fencePoints.length < 3) return '';
  let perimeter = 0;
  const n = window.fencePoints.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i+1)%n;
    const p1=window.fencePoints[i], p2=window.fencePoints[j];
    area += p1.lon*p2.lat - p2.lon*p1.lat;
    const R=6371000, dLat=(p2.lat-p1.lat)*Math.PI/180, dLon=(p2.lon-p1.lon)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.sin(dLon/2)**2;
    perimeter += 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  const areaM2 = Math.abs(area)/2*(111320*Math.cos(window.fencePoints[0].lat*Math.PI/180))*111320;
  const rows = window.fencePoints.map((p,i)=>`<tr>
    <td style="padding:4px 8px;border:1px solid var(--border);">F${i+1}</td>
    <td style="padding:4px 8px;border:1px solid var(--border);font-family:monospace;">${p.lat.toFixed(6)}</td>
    <td style="padding:4px 8px;border:1px solid var(--border);font-family:monospace;">${p.lon.toFixed(6)}</td>
  </tr>`).join('');
  return `<div class="brief-section">
    <div class="brief-header">&#9658; 02c / GEOFENCE (ELECTRONIC BOUNDARY ZONE)</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:10px;font-family:var(--mono);font-size:11px;">
      <span>&#128310; <strong>${n} points</strong></span>
      <span>&#128207; Perimeter: <strong>${Math.round(perimeter)} m</strong></span>
      <span>&#128208; Area: <strong>~${window.fmt(areaM2/1000000, 3)} km&#178;</strong></span>
      <span style="color:var(--muted);">Format: ArduPilot FENCE_POINT (cmd 5001) &#183; QGC WPL 110</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px;">
      <tr style="background:var(--surface2);">
        <th style="padding:4px 8px;text-align:left;border:1px solid var(--border);">Point</th>
        <th style="padding:4px 8px;text-align:left;border:1px solid var(--border);">Lat (WGS-84)</th>
        <th style="padding:4px 8px;text-align:left;border:1px solid var(--border);">Lon (WGS-84)</th>
      </tr>${rows}
    </table>
    <div style="font-family:var(--mono);font-size:10px;color:var(--muted);">
      The polygon is closed – the last point connects to F1. Displayed as an orange area on the operations map.
    </div>
  </div>`;
};

window.buildRallyBriefSection = function() {
  if (!window.rallyPoints || window.rallyPoints.length === 0) return '';
  const rows = window.rallyPoints.map((p,i) => `
    <tr>
      <td style="padding:5px 10px;border:1px solid var(--border);font-weight:bold;
        color:var(--ok);">R${i+1}</td>
      <td style="padding:5px 10px;border:1px solid var(--border);font-family:monospace;">${p.lat.toFixed(6)}</td>
      <td style="padding:5px 10px;border:1px solid var(--border);font-family:monospace;">${p.lon.toFixed(6)}</td>
      <td style="padding:5px 10px;border:1px solid var(--border);font-family:monospace;">
        ${p.alt!=null?window.escHtml(p.alt)+' m':'-'}</td>
    </tr>`).join('');
  return `<div class="brief-section">
    <div class="brief-header">&#9658; 02d / RALLY POINTS &#8211; RTL EMERGENCY LANDING SITES</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">
      Rally points define alternative RTL landing sites when the primary home position cannot be reached.
      ArduPilot automatically selects the nearest rally point when RTL is triggered.
      Format: <strong>MAV_CMD_NAV_RALLY_POINT (cmd 5100) &#183; QGC WPL 110</strong>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px;">
      <tr style="background:var(--surface2);">
        <th style="padding:5px 10px;text-align:left;border:1px solid var(--border);">Point</th>
        <th style="padding:5px 10px;text-align:left;border:1px solid var(--border);">Lat (WGS-84)</th>
        <th style="padding:5px 10px;text-align:left;border:1px solid var(--border);">Lon (WGS-84)</th>
        <th style="padding:5px 10px;text-align:left;border:1px solid var(--border);">Alt AGL (m)</th>
      </tr>
      ${rows}
    </table>
    <div style="font-family:var(--mono);font-size:10px;color:var(--muted);">
      &#128994; Displayed as green pin markers on the map. Verify that each rally point
      is clear of obstacles and approved for landing.
    </div>
  </div>`;
};

window.buildNotamBriefSection = function() {
  return ''; // Manual NOTAM is already handled in the Briefing
};

// Builds the radio section of the Briefing based on the full operation route (<50 km from any waypoint)
window.buildRadioFreqBriefSection = function() {
  try {
    const coordsRaw = document.getElementById('op-coords')?.value || '';
    const wps = window.waypoints && window.waypoints.length > 0 
      ? window.waypoints.map(wp => window.parseCoordFull(wp.coords)).filter(Boolean)
      : [];
    if (wps.length === 0) {
      const parsed = window.parseCoords(coordsRaw);
      if (parsed) wps.push(parsed);
      else wps.push({lat: 57.7, lon: 11.97});
    }

    let rows = '';
    function radioRow(ap, label, distStr = '') {
      if (!ap) return '';
      let html = '<div style="margin-bottom:8px;">';
      html += '<div style="font-weight:bold;font-family:var(--mono);font-size:11px;">' + window.escHtml(label + ': ' + ap.icao + ' ' + ap.name) + (distStr ? ` <span style="color:var(--muted);font-weight:normal;">(${distStr})</span>` : '') + '</div>';
      const freqs = [];
      if (ap.twr)  freqs.push('TWR: ' + ap.twr + ' MHz');
      if (ap.gnd)  freqs.push('GND: ' + ap.gnd + ' MHz');
      if (ap.app)  freqs.push('APP: ' + ap.app + ' MHz');
      if (ap.atis) freqs.push('ATIS: ' + ap.atis + ' MHz');
      if (ap.info) freqs.push('INFO: ' + ap.info + ' MHz');
      if (ap.mil)  freqs.push('MIL: ' + ap.mil + ' MHz');
      if (freqs.length) html += '<div style="font-family:var(--mono);font-size:10px;color:var(--text);margin-left:12px;">' + freqs.map(f => window.escHtml(f)).join(' &nbsp;|&nbsp; ') + '</div>';
      if (ap.tel)  html += '<div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-left:12px;">TWR TEL: ' + window.escHtml(ap.tel) + '</div>';
      html += '</div>';
      return html;
    }

    if (wps.length > 0 && typeof window.airportRadioDb !== 'undefined') {
      const airports = Object.entries(window.airportRadioDb).map(([icao, data]) => {
        // Find the shortest distance to *any* waypoint on the route
        const dists = wps.map(wp => window.haversineKm(wp, {lat: data.lat, lon: data.lon}));
        const minDist = Math.min(...dists);
        return { icao, ...data, dist: minDist };
      }).filter(a => !isNaN(a.dist) && a.dist <= 50).sort((a,b) => a.dist - b.dist);

      airports.forEach((ap, i) => {
        rows += radioRow(ap, i === 0 ? 'Nearest airport' : 'Alternative within 50 km', `${ap.dist.toFixed(1)} km`);
      });
    }

    rows += '<div style="margin-top:4px;font-family:var(--mono);font-size:10px;">';
    rows += '<strong>Sweden FIS:</strong> 126.650 MHz &nbsp;|&nbsp; <strong>Emergency:</strong> 121.500 MHz';
    rows += '<div style="color:var(--muted);font-size:9px;margin-top:4px;">Source: MissionDesk Local Aeronautical Database</div>';
    rows += '</div>';

    return `<div class="brief-section"><div class="brief-header">\u25b8 05c / RADIO FREQUENCIES &amp; CONTACT</div>${rows}</div>`;
  } catch(e) { return ''; }
};

// Same logic to populate radio information in the OFP notes
window.buildAutoRadioNotes = function() {
  const lines = [];
  try {
    const coordsRaw = document.getElementById('op-coords')?.value || '';
    const wps = window.waypoints && window.waypoints.length > 0 
      ? window.waypoints.map(wp => window.parseCoordFull(wp.coords)).filter(Boolean)
      : [];
    if (wps.length === 0) {
      const parsed = window.parseCoords(coordsRaw);
      if (parsed) wps.push(parsed);
    }
    
    if (wps.length > 0 && typeof window.airportRadioDb !== 'undefined') {
      const airports = Object.entries(window.airportRadioDb).map(([icao, data]) => {
        const dists = wps.map(wp => window.haversineKm(wp, {lat: data.lat, lon: data.lon}));
        const minDist = Math.min(...dists);
        return { icao, ...data, dist: minDist };
      }).filter(a => !isNaN(a.dist) && a.dist <= 50).sort((a,b) => a.dist - b.dist);

      if (airports.length > 0) {
        lines.push('--- Nearest Airports (<50km) ---');
        airports.forEach(ap => {
          const freqs = [];
          if(ap.twr) freqs.push('TWR '+ap.twr);
          if(ap.gnd) freqs.push('GND '+ap.gnd);
          if(ap.app) freqs.push('APP '+ap.app);
          if(ap.info) freqs.push('INFO '+ap.info);
          if(ap.atis) freqs.push('ATIS '+ap.atis);
          if(ap.mil) freqs.push('MIL '+ap.mil);
          lines.push(`${ap.icao} (${ap.dist.toFixed(0)}km): ${freqs.join(', ')}`);
        });
      }
    }
  } catch(e) {}

  lines.push('Sweden FIS: 126.650 MHz');
  lines.push('Emergency: 121.500 MHz');
  
  return lines.join('\n');
};

window.generateBriefing = function() {
  const now = new Date();
  document.getElementById('brief-timestamp').textContent =
    now.toLocaleDateString('en-GB') + ' at ' + now.toLocaleTimeString('en-GB');

  const v = id => window.escHtml(document.getElementById(id)?.value || '–');
  const vRaw = id => document.getElementById(id)?.value || '–';
  const isDelivery   = document.getElementById('op-type')?.value === 'leverans';
  const isAutonomous = document.getElementById('op-flighttype')?.value === 'autonomt';

  const catEl = document.querySelector('input[name="cat"]:checked');
  const cat = catEl ? catEl.value : '–';
  const los = v('op-los');

  let osoChecked = 0;
  document.querySelectorAll('.oso-item:not(.na)').forEach(o => { if (o.classList.contains('checked')) osoChecked++; });
  const osoTotal = document.querySelectorAll('.oso-item:not(.na)').length;

  const sailResultLocal = window.sailResult || {sail:0, grcLabel:'–', arcLabel:'–', iGRC:'–'};
  const sailLabel = sailResultLocal.sail > 0 ? (window.sailOrder ? window.sailOrder[sailResultLocal.sail - 1] : sailResultLocal.sail) : '–';
  const sailColor = sailResultLocal.sail <= 2 ? 'ok' : sailResultLocal.sail <= 4 ? 'warn' : 'danger';

  const hasConOps = vRaw('conops-uas') !== '–' || vRaw('conops-route') !== '–';

  const containmentLevel = document.querySelector('input[name="containment"]:checked')?.value || '–';
  const containmentNames = {low:'Low robustness', medium:'Medium robustness', high:'High robustness'};
  const containmentDisplay = containmentNames[containmentLevel] || '–';

  const wind = parseFloat(vRaw('w-wind')) || 0;
  const vis = parseFloat(v('w-vis')) || 0;
  const precip = v('w-precip');
  const ice = v('w-ice');
  const precipMm = parseFloat(v('w-precip-mm')) || 0;

  let weatherOk = true;
  let weatherWarnings = [];
  if (wind > 8) { weatherOk = false; weatherWarnings.push('Wind exceeds 8 m/s'); }
  if (vis > 0 && vis < 0.8 && los === 'VLOS') { weatherOk = false; weatherWarnings.push('Visibility below 800m (VLOS requirement)'); }
  if (precip === 'heavy') { weatherOk = false; weatherWarnings.push('Heavy rain/thunderstorm'); }
  if (precipMm >= 0.5) { weatherOk = false; weatherWarnings.push(`Precipitation ${precipMm} mm/h`); }
  if (ice === 'yes') { weatherOk = false; weatherWarnings.push('Icing risk – do not fly'); }

  const weatherStatus = weatherOk ? 'OK – Conditions acceptable' : 'WARNING: ' + weatherWarnings.join('; ');
  const weatherClass = weatherOk ? 'ok' : 'danger';

  let temThreatsHtml = '';
  document.querySelectorAll('.tem-threat-row').forEach(row => {
    const v1 = window.escHtml(row.querySelector('.tem-val1').value);
    const v2 = window.escHtml(row.querySelector('.tem-val2').value);
    const prob = window.escHtml(row.querySelector('.tem-prob')?.value || '-');
    const sev = window.escHtml(row.querySelector('.tem-sev')?.value || '-');
    if (v1 || v2) temThreatsHtml += `<tr><td style="padding:4px 8px;border:1px solid var(--border);white-space:pre-wrap;">${v1}</td><td style="padding:4px 8px;border:1px solid var(--border);white-space:pre-wrap;">${v2}</td><td style="padding:4px 8px;border:1px solid var(--border);text-align:center;">${prob}</td><td style="padding:4px 8px;border:1px solid var(--border);text-align:center;">${sev}</td></tr>`;
  });
  if (!temThreatsHtml) temThreatsHtml = `<tr><td colspan="4" style="padding:4px 8px;border:1px solid var(--border);color:var(--muted);text-align:center;">No threats logged</td></tr>`;

  let temErrorsHtml = '';
  document.querySelectorAll('.tem-error-row').forEach(row => {
    const v1 = window.escHtml(row.querySelector('.tem-val1').value);
    const v2 = window.escHtml(row.querySelector('.tem-val2').value);
    if (v1 || v2) temErrorsHtml += `<tr><td style="padding:4px 8px;border:1px solid var(--border);white-space:pre-wrap;">${v1}</td><td style="padding:4px 8px;border:1px solid var(--border);white-space:pre-wrap;">${v2}</td></tr>`;
  });
  if (!temErrorsHtml) temErrorsHtml = `<tr><td colspan="2" style="padding:4px 8px;border:1px solid var(--border);color:var(--muted);text-align:center;">No errors logged</td></tr>`;

  const html = `
    <div class="brief-section">
      <div class="brief-header">▸ 01 / IDENTIFICATION & DOI (SORA 2.5 Step #1)</div>
      ${v('mission-name') !== '–' ? `<div class="brief-row"><span class="brief-key">Mission:</span><span class="brief-val" style="font-weight:bold;font-size:1.05em;">${v('mission-name')}</span></div>` : ''}
      ${v('mission-desc') !== '–' ? `<div class="brief-row"><span class="brief-key">Description:</span><span class="brief-val" style="white-space:pre-wrap;">${v('mission-desc')}</span></div>` : ''}
      <div class="brief-row"><span class="brief-key">Operator / Organisation:</span><span class="brief-val">${v('op-name')}</span></div>
      <div class="brief-row"><span class="brief-key">Pilot Flying (PF):</span><span class="brief-val">${v('pilot-name')}</span></div>
      ${v('pilot-monitor') !== '–' ? `<div class="brief-row"><span class="brief-key">Pilot Monitoring (PM):</span><span class="brief-val">${v('pilot-monitor')}</span></div>` : ''}
      <div class="brief-row"><span class="brief-key">Date:</span><span class="brief-val">${v('op-date')}</span></div>
      <div class="brief-row"><span class="brief-key">Planned departure:</span><span class="brief-val">${v('op-time')} UTC</span></div>
      <div class="brief-row"><span class="brief-key">Planned flight time:</span><span class="brief-val">${v('op-duration')} minutes</span></div>
      <div class="brief-row"><span class="brief-key">UAS / Model:</span><span class="brief-val">${v('drone-model')} (EU Class: ${v('drone-class')})</span></div>
      <div class="brief-row"><span class="brief-key">Characteristic dimension:</span><span class="brief-val">${v('drone-dim')} m &nbsp;|&nbsp; Max speed: ${v('drone-speed')} m/s &nbsp;|&nbsp; Cruise: ${v('drone-cruise') || '10'} m/s</span></div>
      <div class="brief-row"><span class="brief-key">MTOM:</span><span class="brief-val">${v('drone-mtom')} kg</span></div>
      <div class="brief-row"><span class="brief-key">Remote ID:</span><span class="brief-val">${v('drone-rid')}</span></div>
      <div class="brief-row"><span class="brief-key">Operation category:</span><span class="brief-val">${cat}</span></div>
      <div class="brief-row"><span class="brief-key">Flight regime:</span><span class="brief-val">${los}</span></div>
      <div class="brief-row"><span class="brief-key">Operation type:</span><span class="brief-val">${v('op-type')}</span></div>
      ${window.buildEnergyBriefRow ? window.buildEnergyBriefRow() : ''}
    </div>

    <div class="brief-section">
      <div class="brief-header">▸ 02 / OPERATIONS VOLUME (DOI Annex A)</div>
      <div class="brief-row"><span class="brief-key">Location / address:</span><span class="brief-val">${v('op-location')}</span></div>
      <div class="brief-row"><span class="brief-key">Coordinates (centrum):</span><span class="brief-val">${v('op-coords')}</span></div>
      <div class="brief-row"><span class="brief-key">Max altitude AGL:</span><span class="brief-val">${v('op-alt')} m</span></div>
      <div class="brief-row"><span class="brief-key">Operating radius / volume:</span><span class="brief-val">${v('op-radius')} m</span></div>
      <div class="brief-row"><span class="brief-key">Contingency volume / buffer:</span><span class="brief-val">${v('op-buffer')} m</span></div>
      <div class="brief-row"><span class="brief-key">Adjacent area:</span><span class="brief-val" style="white-space:pre-wrap;">${v('op-adjacent')}</span></div>
      <div class="brief-row"><span class="brief-key">Adjacent airspace:</span><span class="brief-val" style="white-space:pre-wrap;">${v('op-adj-air')}</span></div>
      <div class="brief-row"><span class="brief-key">Purpose:</span><span class="brief-val" style="white-space:pre-wrap;">${v('op-purpose')}</span></div>
      ${isDelivery ? `
      <div style="border-top:1px solid var(--border);margin:10px 0 6px;padding-top:8px;">
        <div class="brief-key" style="color:var(--accent);margin-bottom:6px;">▸ DELIVERY ROUTE</div>
        <div class="brief-row"><span class="brief-key">📍 Start point:</span><span class="brief-val">${v('delivery-start-loc')} &nbsp;|&nbsp; ${v('delivery-start-coords')}</span></div>
        <div class="brief-row"><span class="brief-key">🏁 Destination:</span><span class="brief-val">${v('delivery-dest-loc')} &nbsp;|&nbsp; ${v('delivery-dest-coords')}</span></div>
        <div class="brief-row"><span class="brief-key">Payload:</span><span class="brief-val">${v('delivery-payload')}</span></div>
        <div class="brief-row"><span class="brief-key">Route distance:</span><span class="brief-val">${v('delivery-distance')} m</span></div>
        <div class="brief-row"><span class="brief-key">Route description:</span><span class="brief-val" style="white-space:pre-wrap;">${v('delivery-route')}</span></div>
      </div>` : ''}
      ${hasConOps ? `
      <div class="brief-row" style="margin-top:8px;"><span class="brief-key">UAS system description:</span><span class="brief-val">${v('conops-uas')}</span></div>
      <div class="brief-row"><span class="brief-key">Crew & roles:</span><span class="brief-val" style="white-space:pre-wrap;">${v('conops-crew')}</span></div>
      <div class="brief-row"><span class="brief-key">Certificates:</span><span class="brief-val">${v('conops-certs')}</span></div>
      <div class="brief-row"><span class="brief-key">Flight path / operation description:</span><span class="brief-val" style="white-space:pre-wrap;">${v('conops-route')}</span></div>
      <div class="brief-row"><span class="brief-key">Environment / obstacles:</span><span class="brief-val" style="white-space:pre-wrap;">${v('conops-env')}</span></div>
      <div class="brief-row"><span class="brief-key">Exposed third parties:</span><span class="brief-val" style="white-space:pre-wrap;">${v('conops-3rd')}</span></div>
      <div class="brief-row"><span class="brief-key">Normal procedure:</span><span class="brief-val" style="white-space:pre-wrap;">${v('conops-normal')}</span></div>
      <div class="brief-row"><span class="brief-key">Communication plan:</span><span class="brief-val" style="white-space:pre-wrap;">${v('conops-comms')}</span></div>
      <div class="brief-row"><span class="brief-key">Separation & delineation:</span><span class="brief-val">${v('conops-sep')}</span></div>
      <div class="brief-row"><span class="brief-key">Restrictions:</span><span class="brief-val">${v('conops-limits')}</span></div>
      ` : ''}
    </div>

    <div class="brief-section" id="brief-map-section">
      <div class="brief-header">▸ 02b / OPERATIONS MAP & AIRSPACE</div>
      ${window.buildBriefingMap ? window.buildBriefingMap(isDelivery, isAutonomous) : ''}
      <div id="brief-airspace-links" style="margin-top:12px;padding:12px 16px;background:var(--surface2);border-radius:4px;border:1px solid var(--border);">
        <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:1px;margin-bottom:8px;">AIRSPACE – EXTERNAL MAP SERVICES</div>
        <div class="map-link-bar" id="brief-airspace-link-bar">
          </div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--muted);">
          Opens in new window · Check airspace restrictions, NOTAM layer and UAS zones
        </div>
      </div>
      ${v('airspace-notes') !== '–' ? `<div class="brief-row" style="margin-top:10px;"><span class="brief-key">Airspace notes:</span><span class="brief-val" style="white-space:pre-wrap;">${v('airspace-notes')}</span></div>` : ''}
    </div>

    ${window.buildWaypointBriefSection ? window.buildWaypointBriefSection() : ''}
    ${window.buildFenceBriefSection ? window.buildFenceBriefSection() : ''}
    ${window.buildRallyBriefSection ? window.buildRallyBriefSection() : ''}

    <div class="brief-section">
      <div class="brief-header">▸ 03 / RISK ASSESSMENT – SORA 2.5 Steps #2–#8</div>
      <div class="brief-row"><span class="brief-key">Characteristic dim / speed:</span><span class="brief-val">${v('drone-dim')} m / ${v('drone-speed')} m/s</span></div>
      <div class="brief-row"><span class="brief-key">Intrinsic GRC (iGRC):</span><span class="brief-val">${sailResultLocal.iGRC || '–'}</span></div>
      <div class="brief-row"><span class="brief-key">Final GRC (after mitigation):</span><span class="brief-val">${sailResultLocal.grcLabel}</span></div>
      <div class="brief-row"><span class="brief-key">Residual ARC:</span><span class="brief-val">${sailResultLocal.arcLabel}</span></div>
      <div class="brief-row"><span class="brief-key">SAIL Level (Step #7):</span><span class="brief-val ${sailColor}">SAIL ${sailLabel} &nbsp;<span class="status-badge badge-${sailColor}">${sailResultLocal.sail <= 2 ? 'LOW RISK' : sailResultLocal.sail <= 4 ? 'MEDIUM RISK' : 'HIGH RISK'}</span></span></div>
      <div class="brief-row" style="margin-top:6px;"><span class="brief-key">Containment level (Step #8):</span><span class="brief-val">${containmentDisplay}</span></div>
      <div class="brief-row"><span class="brief-key">Containment measure:</span><span class="brief-val">${v('cont-tech-measure')}</span></div>
      <div class="brief-row"><span class="brief-key">Contingency volume:</span><span class="brief-val">${v('cont-contingency-vol')}</span></div>
      <div class="brief-row"><span class="brief-key">Justification:</span><span class="brief-val" style="white-space:pre-wrap;">${v('cont-justification')}</span></div>
      <div class="brief-row" style="margin-top:6px;"><span class="brief-key">OSO compliance (Step #9):</span><span class="brief-val">${osoChecked} / ${osoTotal} OSOs confirmed <span class="status-badge ${osoChecked === osoTotal ? 'badge-ok' : 'badge-warn'}">${osoChecked === osoTotal ? 'COMPLETE' : 'INCOMPLETE'}</span></span></div>
    </div>

    <div class="brief-section">
      <div class="brief-header">▸ 05 / WEATHER & AIRSPACE</div>
      <div class="brief-row"><span class="brief-key">Data source:</span><span class="brief-val">${window.smhiData ? (window.smhiData.manual ? 'Manually entered data / External links' : (window.smhiData.source || 'Auto-fetched API data') + ' · ' + (window.smhiData.validTimeStr || '')) : 'Manually entered data'}</span></div>
      <div class="brief-row"><span class="brief-key">Wind speed:</span><span class="brief-val ${wind > 8 ? 'danger' : 'ok'}">${v('w-wind')} m/s (${(wind / 0.51444).toFixed(1)} kt) ${v('w-winddir') !== '–' ? '(' + v('w-winddir') + '°)' : ''}</span></div>
      <div class="brief-row"><span class="brief-key">Visibility:</span><span class="brief-val">${v('w-vis')} km</span></div>
      <div class="brief-row"><span class="brief-key">Cloud cover:</span><span class="brief-val">${v('w-cloud')} oktas</span></div>
      <div class="brief-row"><span class="brief-key">Temperature:</span><span class="brief-val">${v('w-temp')} °C</span></div>
      <div class="brief-row"><span class="brief-key">Relative humidity:</span><span class="brief-val">${v('w-humid')} %</span></div>
      <div class="brief-row"><span class="brief-key">Precipitation intensity:</span><span class="brief-val">${v('w-precip-mm')} mm/h (${v('w-precip')})</span></div>
      <div class="brief-row"><span class="brief-key">Air pressure:</span><span class="brief-val">${v('w-pressure')} hPa</span></div>
      <div class="brief-row"><span class="brief-key">Icing risk:</span><span class="brief-val ${ice === 'yes' ? 'danger' : ''}">${v('w-ice')}</span></div>
      <div class="brief-row" style="margin-top:8px;"><span class="brief-key">Weather assessment:</span><span class="brief-val ${weatherClass}">${weatherStatus}</span></div>
      <div class="brief-row"><span class="brief-key">Weather warnings:</span><span class="brief-val">${v('la-smhi-warning') || 'No active warnings'}</span></div>
      <div class="brief-row" style="margin-top:8px;"><span class="brief-key">Airspace approval:</span><span class="brief-val">${v('la-ref') || 'Not entered'}</span></div>
      <div class="brief-row"><span class="brief-key">Active NOTAM:</span><span class="brief-val" style="white-space:pre-wrap;">${v('la-active-notam')}</span></div>
      <div class="brief-row"><span class="brief-key">Nearest ICAO:</span><span class="brief-val">${v('notam-icao') || 'Not entered'}</span></div>
      <div class="brief-row"><span class="brief-key">Local restrictions:</span><span class="brief-val" style="white-space:pre-wrap;">${v('local-restrictions') || 'No known'}</span></div>
    </div>

    ${window.buildNotamBriefSection ? window.buildNotamBriefSection() : ''}
    ${window.buildAvWxBriefSection ? window.buildAvWxBriefSection() : ''}
    ${window.buildRadioFreqBriefSection ? window.buildRadioFreqBriefSection() : ''}

    <div class="brief-section">
      <div class="brief-header">▸ 06 / CONTINGENCY & EMERGENCY PLAN</div>
      <div class="brief-row"><span class="brief-key">Emergency landing site (primary):</span><span class="brief-val">${v('em-land1')}</span></div>
      <div class="brief-row"><span class="brief-key">Emergency landing site (alt.):</span><span class="brief-val">${v('em-land2')}</span></div>
      <div class="brief-row"><span class="brief-key">RTL altitude:</span><span class="brief-val">${v('em-rth')}</span></div>
      <div class="brief-row"><span class="brief-key">Battery abort threshold:</span><span class="brief-val">${v('em-battery')}</span></div>
      <div class="brief-row"><span class="brief-key">On signal loss:</span><span class="brief-val" style="white-space:pre-wrap;">${v('em-signal') || '–'}</span></div>
      <div class="brief-row" style="margin-top:8px;"><span class="brief-key">Weather contingency:</span><span class="brief-val" style="white-space:pre-wrap;">${v('cont-weather') || '–'}</span></div>
      <div class="brief-row"><span class="brief-key">UAS intrusion (other UAS):</span><span class="brief-val" style="white-space:pre-wrap;">${v('cont-uas') || '–'}</span></div>
      <div class="brief-row"><span class="brief-key">Technical failure:</span><span class="brief-val" style="white-space:pre-wrap;">${v('cont-tech') || '–'}</span></div>
    </div>

    <div class="brief-section">
      <div class="brief-header">▸ 07 / ALERT CHAIN & REPORTING</div>
      <div class="brief-row"><span class="brief-key">Primary contact:</span><span class="brief-val">${v('em-contact1')}</span></div>
      <div class="brief-row"><span class="brief-key">Secondary contact:</span><span class="brief-val">${v('em-contact2')}</span></div>
      <div class="brief-row"><span class="brief-key">Emergency number:</span><span class="brief-val">${v('em-sos')}</span></div>
      <div class="brief-row"><span class="brief-key">Mandatory reporting:</span><span class="brief-val" style="white-space:pre-wrap;">${v('em-report')}</span></div>
      <div class="brief-row"><span class="brief-key">Safety reporting system:</span><span class="brief-val" style="white-space:pre-wrap;">${v('em-eccairs')}</span></div>
    </div>

    <div class="brief-section">
      <div class="brief-header">▸ 08 / THREATS AND ERROR MANAGEMENT (TEM)</div>
      
      <div class="brief-key" style="margin-bottom:4px;color:var(--accent);">THREATS</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px;">
        <tr style="background:var(--surface2);">
          <th style="padding:4px 8px;text-align:left;border:1px solid var(--border);width:35%;">Threat</th>
          <th style="padding:4px 8px;text-align:left;border:1px solid var(--border);width:45%;">Mitigation</th>
          <th style="padding:4px 8px;text-align:center;border:1px solid var(--border);width:10%;">Prob.</th>
          <th style="padding:4px 8px;text-align:center;border:1px solid var(--border);width:10%;">Sev.</th>
        </tr>
        ${temThreatsHtml}
      </table>

      <div class="brief-key" style="margin-bottom:4px;color:var(--accent2);">ERRORS</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <tr style="background:var(--surface2);">
          <th style="padding:4px 8px;text-align:left;border:1px solid var(--border);width:40%;">Error</th>
          <th style="padding:4px 8px;text-align:left;border:1px solid var(--border);width:60%;">Mitigation</th>
        </tr>
        ${temErrorsHtml}
      </table>
    </div>

    <div class="brief-section">
      <div class="brief-header">▸ 09 / AUTHORISATION</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:8px;">
        <div>
          <div class="brief-key" style="margin-bottom:24px;">Pilot Flying signature:</div>
          <div style="border-bottom:1px solid var(--border);padding-bottom:4px;">&nbsp;</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;">${v('pilot-name')} &nbsp;|&nbsp; ${v('op-date')}</div>
        </div>
        <div>
          <div class="brief-key" style="margin-bottom:24px;">Responsible operations manager:</div>
          <div style="border-bottom:1px solid var(--border);padding-bottom:4px;">&nbsp;</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;">${v('op-name')} &nbsp;|&nbsp; ${v('op-date')}</div>
        </div>
      </div>
      <div style="margin-top:20px;font-size:10px;color:var(--muted);line-height:1.8;">
        This document was generated by MissionDesk and is based on <strong>JARUS SORA version 2.5</strong>
        (JAR-doc-25, published 13.05.2024) and EASA ED Decision 2025/018/R (applicable from 29 September 2025).
        The risk assessment follows the 10-step process: Step #1 DOI → #2–#3 GRC → #4–#5 ARC → #6 TMPR → #7 SAIL → #8 Containment → #9 OSO → #10 CSP.
        The operator is responsible for ensuring all information is correct and that applicable national regulations (Swedish CAA (Transportstyrelsen TSFS) apply.
        This briefing document does not replace a formal authorisation from the competent authority, and does not constitute in itself a Comprehensive Safety Portfolio (CSP).
      </div>
    </div>
  `;

let chartsHtml = '';
  if (window.uploadedCharts && window.uploadedCharts.length > 0) {
    chartsHtml = `
    <div class="brief-section" style="page-break-before: always; border:none; margin-top:40px;">
      <div class="brief-header" style="margin-bottom:20px; font-size:14px;">▸ 10 / CHARTS & ANNEXES</div>
      ${window.uploadedCharts.map(chart => `
        <div style="margin-bottom: 24px; page-break-inside: avoid !important; text-align:center;">
          <div style="font-family:var(--mono); font-size:10px; color:var(--muted); margin-bottom:6px; font-weight:bold; text-align:left; page-break-after: avoid !important;">FILE: ${window.escHtml(chart.name)}</div>
          <img src="${chart.base64}" style="display:block; margin:0 auto; max-width:100%; border:1px solid var(--border); max-height:800px; object-fit:contain; page-break-inside: avoid !important;">
        </div>
      `).join('')}
    </div>`;
  }

  // NEW: Volume map in the Briefing (twice as large and on its own page when printing)
  const volumeMapHtml = `
    <div class="brief-section" style="page-break-before: always; page-break-inside: avoid; margin-top:40px; border:none;">
      <div class="brief-header" style="font-size:12px;">▸ 02c / OPERATIONAL VOLUME & SAFETY BUFFERS</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:12px;">
        <strong>Green:</strong> Flight Geography &nbsp;|&nbsp; <strong>Orange:</strong> Contingency Volume &nbsp;|&nbsp; <strong>Red:</strong> Ground Risk Buffer<br>
        <strong>Active Layers:</strong> LFV Airspace (CTR, TMA, RSTA, Heli) and SCB Demographics (Urban areas).
      </div>
      <div id="brief-volume-map" style="width:100%; height:720px; border:2px solid var(--border); border-radius:4px; background:#e9ecef;"></div>
    </div>
  `;

  document.getElementById('briefing-content').innerHTML =
    `<div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:28px;letter-spacing:1px;">
      OPERATIONS BRIEF – GENERATED <span id="brief-timestamp">${now.toLocaleDateString('en-GB')} at ${now.toLocaleTimeString('en-GB')}</span>
    </div>` + html + volumeMapHtml + chartsHtml;

  // Load the maps after the HTML has been rendered
  setTimeout(() => { 
    if (typeof window.initBriefMap === 'function') window.initBriefMap(); 
    if (typeof window.initBriefVolumeMap === 'function') window.initBriefVolumeMap();
  }, 100);
};

window.generateOFP = function() {
  const el = document.getElementById('ofp-content');
  if (!el) return;

  const v = id => window.escHtml(document.getElementById(id)?.value || '');

  const callsign  = v('drone-model') || 'UNY UAS';
  const fromField = v('op-location') || '';
  const opDate    = v('op-date')     || '';
  const takeoffUTC= v('op-time')     || ''; 
  const altM      = v('op-alt')      || '';
  
  const pf = v('pilot-name') || '';
  const pm = v('pilot-monitor') || '';
  let crewName = pf;
  if (pm && pm !== '–') crewName += ' / ' + pm;

  const cruiseMs  = parseFloat(document.getElementById('drone-cruise')?.value)  || 10;
  const gsDisplay = cruiseMs.toFixed(1) + ' m/s';

  const takeoffRate  = parseFloat(document.getElementById('nrg-takeoff')?.value)     || 5;   
  const cruiseRate   = parseFloat(document.getElementById('nrg-cruise')?.value)      || 3;   
  const descentRate  = parseFloat(document.getElementById('nrg-descent')?.value)     || 2.5; 
  const setupPct     = parseFloat(document.getElementById('nrg-setup')?.value)       || 2;   
  const takeoffMin   = parseFloat(document.getElementById('nrg-takeoff-min')?.value) || 1.5; 
  const descentMin   = parseFloat(document.getElementById('nrg-descent-min')?.value) || 1.5; 

  const wps = (window.waypoints || []).filter(wp => {
    const la = parseFloat(wp.lat), lo = parseFloat(wp.lon);
    return !isNaN(la) && !isNaN(lo) && (la !== 0 || lo !== 0);
  });

  let baseTakeoffSec = null;
  if (takeoffUTC.match(/^\d{2}:\d{2}$/)) {
    const [hh, mm] = takeoffUTC.split(':').map(Number);
    baseTakeoffSec = hh * 3600 + mm * 60;
  }

  function secToUTC(s) {
    const total = Math.round(s) % 86400;
    const hh = Math.floor(total / 3600).toString().padStart(2,'0');
    const mm = Math.floor((total % 3600) / 60).toString().padStart(2,'0');
    return `${hh}:${mm}`;
  }
  
  function secToMMSS(s) {
    const m = Math.floor(s / 60), sec = Math.round(s % 60);
    return m > 0 ? `${m}m${sec.toString().padStart(2,'0')}s` : `${sec}s`;
  }

  function distM(a, b) {
    const R=6371000, toR=x=>x*Math.PI/180;
    const dLat=toR(b.lat-a.lat), dLon=toR(b.lon-a.lon);
    const s=Math.sin(dLat/2)**2+Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLon/2)**2;
    return 2*R*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
  }

  const VERT_MS = 3;
  const rows = [];
  const takeoffEPct = setupPct + takeoffMin * takeoffRate;
  const takeoffSecs = takeoffMin * 60;

  let cumDistM = 0;
  let cumSec = takeoffSecs;
  let currentPlanPct = 100 - takeoffEPct;

  if (wps.length === 0) {
    el.innerHTML = '<div style="font-family:var(--mono);color:var(--warn);padding:20px;">⚠ No waypoints loaded. Load a mission file or add waypoints first.</div>';
    return;
  }

  rows.push({
    idx: 0,
    name: wps[0].name || 'DEP',
    lat: wps[0].lat, lon: wps[0].lon,
    distInt: 0, distAcc: 0,
    segSec: takeoffSecs, cumSec: cumSec,
    eto: baseTakeoffSec !== null ? secToUTC(baseTakeoffSec + cumSec) : '',
    eInt: takeoffEPct, planPct: currentPlanPct,  
    userLabel: wps[0].name || '',
    forceOfp: wps[0].forceOfp // <-- NY!
  });

  for (let i = 1; i < wps.length; i++) {
    const p1 = wps[i-1], p2 = wps[i];
    const d = distM(p1, p2);
    const altDiff = Math.abs((parseFloat(p2.alt)||0)-(parseFloat(p1.alt)||0));
    const segS = d / cruiseMs + altDiff / VERT_MS;
    const eInt = (segS / 60) * cruiseRate;
    
    cumDistM += d;
    cumSec   += segS;
    currentPlanPct -= eInt;
    
    const etaUTC = baseTakeoffSec !== null ? secToUTC(baseTakeoffSec + cumSec) : '';
    rows.push({
      idx: i,
      name: p2.name || `WP${i+1}`,
      lat: p2.lat, lon: p2.lon,
      distInt: d, distAcc: cumDistM, 
      segSec: segS, cumSec: cumSec,
      eto: etaUTC, eInt: eInt, planPct: currentPlanPct, 
      userLabel: p2.name || '',
      forceOfp: p2.forceOfp // <-- NY!
    });
  }

  const descentEPct = descentMin * descentRate;
  const totalFuelPct = (100 - currentPlanPct) + descentEPct;

  const minimumRequired = totalFuelPct;         
  const unusablePct     = 2;                    
  const extraPct        = 20;                   

  const ofpId = `OFP-${opDate.replace(/-/g,'')}-${callsign.replace(/\s/g,'').toUpperCase()}`;
  const toField = wps.length > 1 ? (wps[wps.length-1].name || '') : '';

  let displayRows = rows;
  if (rows.length > 10) {
    const must = new Set([0, 1, rows.length - 2, rows.length - 1]);
    
    // Force in all rows the user has ticked
    rows.forEach((r, i) => {
      if (r.forceOfp) must.add(i);
    });

    // Fill out with even spacing up to 10 rows (if there is space)
    const remaining = 10 - must.size;
    if (remaining > 0) {
      const middle = [];
      for (let i = 2; i < rows.length - 2; i++) {
        if (!must.has(i)) middle.push(i);
      }
      const step = middle.length / (remaining + 1);
      for (let j = 1; j <= remaining; j++) {
        const pick = middle[Math.round(j * step) - 1] || middle[middle.length - 1];
        if (pick !== undefined) must.add(pick);
      }
    }
    
    // (If the user has forced >10 rows, the app ignores the limit and shows all of them!)
    displayRows = [...must].sort((a,b) => a - b).map(i => rows[i]);
  }

  const wpRowsHtml = displayRows.map((r, idx) => {
    const isFirst = idx === 0;
    const isLast  = idx === displayRows.length - 1;
    const rowBg   = isFirst ? 'background:#e8f5e9;' : isLast ? 'background:#e3f2fd;' : '';
    
    // Dynamic intervals – calculates the distance/time from the PREVIOUS displayed row on the page
    const prevR = isFirst ? null : displayRows[idx - 1];
    const dynDistInt = isFirst ? 0 : r.distAcc - prevR.distAcc;
    const dynSecInt  = isFirst ? r.cumSec : r.cumSec - prevR.cumSec;
    const dynEInt    = isFirst ? r.eInt : prevR.planPct - r.planPct;

    const distIntTxt = isFirst ? '–' : (dynDistInt / 1000).toFixed(2);
    const distAccTxt = isFirst ? '0.00' : (r.distAcc / 1000).toFixed(2);
    const gsTxt      = isFirst ? '–' : gsDisplay;
    
    const tIntTxt = secToMMSS(dynSecInt);
    const tAccTxt = secToMMSS(r.cumSec);
    const eIntTxt = dynEInt.toFixed(1) + '%';
    const planTxt = r.planPct.toFixed(1) + '%';
    const planColor = r.planPct < 20 ? 'color:#c62828;font-weight:bold;' : r.planPct < 40 ? 'color:#e65100;' : '';

    // THESE ROWS WERE MISSING IN THE PREVIOUS UPDATE:
    const nameId = `ofp-wp-name-${idx}`;
    const retoId = `ofp-reto-${idx}`;
    const atoId = `ofp-ato-${idx}`;
    const actualId = `ofp-actual-${idx}`;

    const nameVal = window.ofpInputData[nameId] ?? window.escHtml(r.name);
    const retoVal = window.ofpInputData[retoId] ?? '';
    const atoVal = window.ofpInputData[atoId] ?? '';
    const actualVal = window.ofpInputData[actualId] ?? '';

    return `<tr style="${rowBg}">
      <td class="ofp-td-l">
        <input id="${nameId}" type="text" value="${nameVal}" oninput="window.saveOfpField(this.id, this.value)" class="ofp-input" style="min-width:60px;font-family:monospace;" title="Editable – enter place name or identifier">
      </td>
      <td class="ofp-td">${distIntTxt}</td>
      <td class="ofp-td">${distAccTxt}</td>
      <td class="ofp-td">${gsTxt}</td>
      <td class="ofp-td">${tIntTxt}</td>
      <td class="ofp-td">${tAccTxt}</td>
      <td class="ofp-td">${r.eto}</td>
      <td class="ofp-td-i"><input type="time" id="${retoId}" value="${retoVal}" class="ofp-input" style="width:64px;font-family:monospace;" title="RETO – Revised ETO" onchange="window.saveOfpField(this.id, this.value); window.ofpRecalcRETO(${idx})"></td>
      <td class="ofp-td-i"><input type="time" id="${atoId}" value="${atoVal}" class="ofp-input" style="width:64px;font-family:monospace;" title="ATO – Actual Time Over" onchange="window.saveOfpField(this.id, this.value); window.ofpRecalcRETO(${idx})"></td>
      <td class="ofp-td">${eIntTxt}</td>
      <td class="ofp-td" style="${planColor}">${planTxt}</td>
      <td class="ofp-td-i"><input type="number" min="0" max="100" step="0.1" id="${actualId}" value="${actualVal}" placeholder="–" class="ofp-input" style="width:40px;font-family:monospace;" title="Actual %" oninput="window.saveOfpField(this.id, this.value); window.ofpRecalcActual()"></td>
      <td class="ofp-td-i" id="ofp-diff-${idx}">–</td>
    </tr>`;
  }).join('');

  const emRows = [
    ['Take-off & climb',      (takeoffEPct).toFixed(1)+'%',  secToMMSS(takeoffMin*60)],
    ['En-route cruise',      ((100-currentPlanPct) - takeoffEPct).toFixed(1)+'%', secToMMSS(cumSec - takeoffMin*60)],
    ['Descent & landing',    descentEPct.toFixed(1)+'%',    secToMMSS(descentMin*60)],
    ['Reserve (mandatory)',  extraPct+'%',                  '–'],
    ['Unusable (cutoff)',     unusablePct+'%',               '–'],
  ].map(([label, pct, time]) => `<tr>
    <td class="ofp-td-l" style="background:#f9f9f9;">${label}</td>
    <td class="ofp-td">${pct}</td>
    <td class="ofp-td">${time}</td>
  </tr>`).join('');

  const totalRequired = minimumRequired + extraPct + unusablePct;
  const go_nogo = totalRequired <= 100
    ? `<span style="color:#2e7d32;font-weight:bold;">✓ GO (${(100-totalRequired).toFixed(1)}% margin)</span>`
    : `<span style="color:#c62828;font-weight:bold;">✗ NO-GO – insufficient energy (need ${totalRequired.toFixed(1)}%)</span>`;

  let notesContent = window.ofpInputData['ofp-notes-area'];
  if (notesContent === undefined) {
    notesContent = typeof window.buildAutoRadioNotes === 'function' ? window.buildAutoRadioNotes() : '';
  }

  el.innerHTML = `
      <div id="ofp-page" class="ofp-wrap">
        <style>
          .ofp-wrap { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; width: 100%; padding: 16px; font-size: 13px; }
          .ofp-wrap * { box-sizing: border-box; line-height: 1.2; }
          .ofp-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .ofp-th { padding: 8px 6px; border: 1px solid #333; background: #f0f0f0; font-weight: bold; text-align: center; white-space: nowrap; font-size: 0.85em; }
          .ofp-td { padding: 6px; border: 1px solid #ccc; text-align: center; font-family: monospace; font-size: 0.9em; }
          .ofp-td-l { padding: 6px; border: 1px solid #ccc; text-align: left; font-size: 0.9em; }
          .ofp-td-i { padding: 6px; border: 1px solid #ccc; background: #fff8e1; text-align: center; font-family: monospace; font-size: 0.9em; }
          .ofp-input { width: 100%; border: none; border-bottom: 1px dashed #aaa; font-family: inherit; font-size: inherit; background: transparent; padding: 2px; color: inherit; }
          .ofp-input:focus { border-bottom: 1px solid #0069b4; outline: none; background: rgba(0,105,180,0.05); }
          
          /* Hide clock icons and number arrows in OFP input fields */
          .ofp-input::-webkit-calendar-picker-indicator { display: none; -webkit-appearance: none; }
          .ofp-input::-webkit-inner-spin-button, .ofp-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type="number"].ofp-input { -moz-appearance: textfield; }
          
          .ofp-text-sm { font-size: 0.85em; color: #666; }
          .ofp-text-xs { font-size: 0.7em; color: #888; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px; }
          .ofp-title { font-size: 1.8em; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }
          @media print {
            .ofp-wrap { font-size: 8pt !important; padding: 0 !important; }
            .ofp-table { margin-bottom: 8pt !important; }
            .ofp-th { padding: 3pt 4pt !important; font-size: 7.5pt !important; border-width: 0.5pt !important; }
            .ofp-td, .ofp-td-l, .ofp-td-i { padding: 3pt 4pt !important; font-size: 7.5pt !important; border-width: 0.5pt !important; }
            .ofp-input { padding: 0 !important; border-bottom-width: 0.5pt !important; }
            .ofp-title { font-size: 14pt !important; margin-bottom: 2pt !important; }
            .ofp-text-sm { font-size: 7pt !important; }
            .ofp-text-xs { font-size: 6pt !important; }
          }
        </style>

        <table style="width:100%; border-bottom:2px solid #333; margin-bottom:12px; padding-bottom:6px;">
          <tr>
            <td style="vertical-align:bottom; width:40%; padding:0;">
              <div class="ofp-title">Flight plan UAS</div>
              <div class="ofp-text-sm" style="font-family:monospace;">${ofpId}</div>
            </td>
            <td style="vertical-align:bottom; width:60%; padding:0;">
              <table style="width:100%; text-align:left; border-spacing:8px 0;">
                <tr>
                  <td><div class="ofp-text-xs">OFF BLOCK (UTC)</div><input id="ofp-off-block" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-off-block'] || ''}" class="ofp-input" style="font-family:monospace; border:1px solid #bbb;" type="time"></td>
                  <td><div class="ofp-text-xs">TAKE OFF (UTC)</div><input class="ofp-input" style="font-family:monospace; border:1px solid #bbb; background:#fffde7;" value="${takeoffUTC}" type="time" oninput="window.ofpUpdateTakeoff(this.value)"></td>
                  <td><div class="ofp-text-xs">ON BLOCK (UTC)</div><input id="ofp-on-block" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-on-block'] || ''}" class="ofp-input" style="font-family:monospace; border:1px solid #bbb;" type="time"></td>
                  <td><div class="ofp-text-xs">LANDING (UTC)</div><input id="ofp-landing-time" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-landing-time'] || ''}" class="ofp-input" style="font-family:monospace; border:1px solid #bbb;" type="time"></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table style="width:100%; margin-bottom:12px; border-spacing:8px 0;">
          <tr>
            <td><div class="ofp-text-xs">Callsign</div><input id="ofp-callsign" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-callsign'] ?? window.escHtml(callsign)}" class="ofp-input" style="font-weight:bold; font-family:monospace;"></td>
            <td><div class="ofp-text-xs">From</div><input id="ofp-from" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-from'] ?? window.escHtml(fromField)}" class="ofp-input" style="font-family:monospace;"></td>
            <td><div class="ofp-text-xs">To</div><input id="ofp-to" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-to'] ?? (window.escHtml(document.getElementById('delivery-dest-loc')?.value) || window.escHtml(toField))}" class="ofp-input" style="font-family:monospace;"></td>
            <td><div class="ofp-text-xs">Alt (m AGL)</div><input id="ofp-alt" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-alt'] ?? window.escHtml(altM)}" class="ofp-input" style="font-family:monospace;"></td>
            <td><div class="ofp-text-xs">Block time</div><input id="ofp-block-time" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-block-time'] || ''}" class="ofp-input" style="font-family:monospace;" type="time"></td>
            <td><div class="ofp-text-xs">Airborne</div><input id="ofp-airborne" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-airborne'] || ''}" class="ofp-input" style="font-family:monospace;" type="time"></td>
          </tr>
        </table>

        <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
          <tr>
            <td style="width:50%; padding:0 6px 0 0; vertical-align:top;">
              <table style="width:100%; border:1px solid #ccc; border-collapse:collapse; margin-bottom:4px;">
                <tr><td style="padding:4px 6px;"><span class="ofp-text-xs">Dep info:</span> <input id="ofp-dep-info" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-dep-info'] || ''}" class="ofp-input" style="width:50%;"> <span class="ofp-text-xs">QNH:</span> <input id="ofp-dep-qnh" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-dep-qnh'] ?? v('w-pressure')}" class="ofp-input" style="font-family:monospace; width:40px;"></td></tr>
              </table>
              <table style="width:100%; border:1px solid #ccc; border-collapse:collapse;">
                <tr>
                  <td style="border-right:1px solid #ccc; padding:4px 6px; width:50%;"><div class="ofp-text-xs">TODR (m)</div><input id="ofp-todr" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-todr'] || ''}" class="ofp-input" style="font-family:monospace;"></td>
                  <td style="padding:4px 6px; width:50%;"><div class="ofp-text-xs">TODA (m)</div><input id="ofp-toda" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-toda'] || ''}" class="ofp-input" style="font-family:monospace;"></td>
                </tr>
              </table>
            </td>
            <td style="width:50%; padding:0 0 0 6px; vertical-align:top;">
              <table style="width:100%; border:1px solid #ccc; border-collapse:collapse; margin-bottom:4px;">
                <tr><td style="padding:4px 6px;"><span class="ofp-text-xs">Arr info:</span> <input id="ofp-arr-info" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-arr-info'] || ''}" class="ofp-input" style="width:50%;"> <span class="ofp-text-xs">QNH:</span> <input id="ofp-arr-qnh" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-arr-qnh'] || ''}" class="ofp-input" style="font-family:monospace; width:40px;"></td></tr>
              </table>
              <table style="width:100%; border:1px solid #ccc; border-collapse:collapse;">
                <tr>
                  <td style="border-right:1px solid #ccc; padding:4px 6px; width:50%;"><div class="ofp-text-xs">LDR (m)</div><input id="ofp-ldr" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-ldr'] || ''}" class="ofp-input" style="font-family:monospace;"></td>
                  <td style="padding:4px 6px; width:50%;"><div class="ofp-text-xs">LDA (m)</div><input id="ofp-lda" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-lda'] || ''}" class="ofp-input" style="font-family:monospace;"></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table style="width:100%; border:1px solid #ccc; border-collapse:collapse; margin-bottom:12px;">
          <tr>
            <td style="border-right:1px solid #ccc; padding:4px 6px; width:50%;"><span class="ofp-text-xs">Dep clearance:</span> <input id="ofp-dep-clearance" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-dep-clearance'] || ''}" class="ofp-input" style="width:70%;"></td>
            <td style="padding:4px 6px; width:50%;"><span class="ofp-text-xs">Arr clearance:</span> <input id="ofp-arr-clearance" oninput="window.saveOfpField(this.id, this.value)" value="${window.ofpInputData['ofp-arr-clearance'] || ''}" class="ofp-input" style="width:70%;"></td>
          </tr>
        </table>

        <table class="ofp-table">
          <thead>
            <tr>
              <th rowspan="2" class="ofp-th" style="text-align:left;">Waypoints</th>
              <th colspan="2" class="ofp-th">Distance (km)</th>
              <th rowspan="2" class="ofp-th">GS</th>
              <th colspan="5" class="ofp-th">Time in minutes</th>
              <th colspan="4" class="ofp-th">Energy quantity (%)</th>
            </tr>
            <tr>
              <th class="ofp-th">D. Int</th><th class="ofp-th">D. Acc</th>
              <th class="ofp-th">T. Int</th><th class="ofp-th">T. Acc</th><th class="ofp-th">ETO (UTC)</th>
              <th class="ofp-th" style="background:#fff8e1;">RETO</th><th class="ofp-th" style="background:#fff8e1;">ATO</th>
              <th class="ofp-th">E. Int</th><th class="ofp-th">Plan %</th><th class="ofp-th" style="background:#fff8e1;">Actual</th><th class="ofp-th" style="background:#fff8e1;">Diff</th>
            </tr>
          </thead>
          <tbody id="ofp-tbody">${wpRowsHtml}</tbody>
        </table>

        <table style="width:100%; border-collapse:collapse; margin-bottom:8px; page-break-inside:avoid;">
          <tr>
            <td style="width:38%; vertical-align:top; padding-right:12px;">
              <table class="ofp-table" style="margin-bottom:6px;">
                <tr><th colspan="3" class="ofp-th" style="text-align:left;">Energy management</th></tr>
                <tr><th class="ofp-th" style="text-align:left;">Phase</th><th class="ofp-th">Percentage</th><th class="ofp-th">Time</th></tr>
                ${emRows}
                <tr style="border-top:2px solid #333;"><td class="ofp-td-l" style="font-weight:bold;">Min req</td><td class="ofp-td" style="font-weight:bold;">${minimumRequired.toFixed(1)}%</td><td class="ofp-td">${secToMMSS(cumSec + descentMin*60)}</td></tr>
                <tr style="background:#f0f0f0; font-weight:bold;"><td class="ofp-td-l">Ramp req</td><td class="ofp-td" style="font-weight:bold;">${totalRequired.toFixed(1)}%</td><td class="ofp-td" style="font-family:monospace; font-size:0.85em;">100% full</td></tr>
              </table>
              <div style="padding:6px; background:#f5f5f5; border:1px solid #ccc; font-size:0.85em;">
                <strong>Go/No-Go:</strong> ${go_nogo}<br>
                <span style="color:#888; display:block; margin-top:4px;">Rates: TO ${takeoffRate}%/m (${takeoffMin}m) · Crz ${cruiseRate}%/m · Des ${descentRate}%/m (${descentMin}m) · Setup ${setupPct}%</span>
              </div>
            </td>
            <td style="width:62%; vertical-align:top;">
              <div style="padding:4px 8px; background:#f0f0f0; border:1px solid #333; border-bottom:none; font-weight:bold; font-size:0.9em;">Notes / Remarks</div>
              <textarea id="ofp-notes-area" oninput="window.saveOfpField(this.id, this.value)" style="width:100%; height:160px; border:1px solid #ccc; padding:8px; resize:none; font-size:0.95em; font-family:monospace; background:#fff;">${window.escHtml(notesContent)}</textarea>
            </td>
          </tr>
        </table>

        <table style="width:100%; border-top:1px solid #ccc; padding-top:6px; font-size:0.85em; color:#666; border-collapse:collapse; page-break-inside:avoid;">
          <tr>
            <td style="width:33%;">Rev 03 · ${opDate || new Date().toISOString().slice(0,10)}</td>
            <td style="width:33%; text-align:center;">Crew: <input id="ofp-crew" oninput="window.saveOfpField(this.id, this.value)" class="ofp-input" style="width:200px; text-align:center;" value="${window.ofpInputData['ofp-crew'] ?? window.escHtml(crewName)}"></td>
            <td style="width:33%; text-align:right;">Date: <input id="ofp-date" oninput="window.saveOfpField(this.id, this.value)" class="ofp-input" style="width:100px; font-family:monospace; text-align:right;" value="${window.ofpInputData['ofp-date'] ?? window.escHtml(opDate)}"></td>
          </tr>
        </table>
      </div>`;

      window._ofpRows = rows;
      
      // Reset any calculations if fields were filled in memory
      if (typeof window.ofpRecalcRETO === 'function') window.ofpRecalcRETO(0);
      if (typeof window.ofpRecalcActual === 'function') window.ofpRecalcActual();
    };

window.ofpCalcDiff = function(idx) {
  const rows = window._ofpRows;
  if (!rows) return;
  const r = rows[idx];
  const actualInput = document.querySelector(`#ofp-tbody tr:nth-child(${idx+1}) input[type=number]`);
  const diffCell = document.getElementById(`ofp-diff-${idx}`);
  if (!actualInput || !diffCell) return;
  const actual = parseFloat(actualInput.value);
  if (isNaN(actual)) { diffCell.textContent = '–'; return; }
  const planned = r.planPct;
  const diff = actual - planned;
  diffCell.textContent = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
  diffCell.style.color = diff < -5 ? '#c62828' : diff > 5 ? '#2e7d32' : '#333';
  diffCell.style.fontWeight = Math.abs(diff) > 10 ? 'bold' : 'normal';
};

window.ofpUpdateTakeoff = function(val) {
  const opTimeEl = document.getElementById('op-time');
  if (opTimeEl) opTimeEl.value = val;

  const rows = window._ofpRows;
  if (!rows || !val.match(/^\d{2}:\d{2}$/)) return;

  const [hh, mm] = val.split(':').map(Number);
  const baseTakeoffSec = hh * 3600 + mm * 60;

  function secToUTC(s) {
    const total = Math.round(s) % 86400;
    const H = Math.floor(total / 3600).toString().padStart(2,'0');
    const M = Math.floor((total % 3600) / 60).toString().padStart(2,'0');
    return `${H}:${M}`;
  }

  const tbody = document.getElementById('ofp-tbody');
  if (!tbody) return;
  const trows = tbody.querySelectorAll('tr');
  trows.forEach((tr, idx) => {
    const r = rows[idx];
    if (!r) return;
    
    // As r.cumSec now contains the correct total time (including the take-off climb)
    const etaUTC = secToUTC(baseTakeoffSec + r.cumSec);
    const tds = tr.querySelectorAll('td');
    if (tds.length > 6) {
      tds[6].textContent = etaUTC;
    }
    r.eto = etaUTC;
  });
  
  // Recalculate any RETO/ATO time offsets based on the new ETO times
  if (typeof window.ofpRecalcRETO === 'function') {
    window.ofpRecalcRETO(0);
  }
};

// Calculates time offsets (ATO/RETO vs ETO) and applies them downstream
window.ofpRecalcRETO = function(startIndex = 0) {
  const rows = window._ofpRows;
  if (!rows) return;

  function parseTime(t) {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }
  
  function formatTime(m) {
    let total = Math.round(m) % 1440;
    if (total < 0) total += 1440; // Handles transitions after midnight
    const hh = Math.floor(total / 60).toString().padStart(2, '0');
    const mm = (total % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  let currentDelta = 0; // Time offset in minutes

  // Loops through the table from top to bottom ("waterfall principle")
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const atoInput = document.getElementById(`ofp-ato-${i}`);
    const retoInput = document.getElementById(`ofp-reto-${i}`);
    
    const etoMin = parseTime(r.eto);
    if (etoMin === null) continue;

    let rowDelta = null;

    // 1. ATO (Actual time) has the absolute highest priority
    if (atoInput && atoInput.value) {
      rowDelta = parseTime(atoInput.value) - etoMin;
      atoInput.style.fontWeight = 'bold'; // Mark that ATO is locked/actual
    } else {
      if (atoInput) atoInput.style.fontWeight = 'normal';
      
      // 2. If no ATO exists but the user manually enters a RETO
      if (i === startIndex && retoInput && retoInput.value) {
        rowDelta = parseTime(retoInput.value) - etoMin;
        retoInput.style.color = ''; // Set standard colour for manual input
      }
    }

    // Update current time offset
    if (rowDelta !== null) {
      if (rowDelta < -720) rowDelta += 1440;
      if (rowDelta > 720) rowDelta -= 1440;
      currentDelta = rowDelta;
    }

    // 3. Apply the delay to all *upcoming* RETO fields
    if (i > startIndex) {
      if (retoInput && (!atoInput || !atoInput.value)) { // Do not overwrite fields that have already passed (ATO)
        if (currentDelta !== 0) {
          retoInput.value = formatTime(etoMin + currentDelta);
          retoInput.style.color = 'var(--accent)'; // Show in blue colour that it is auto-calculated
        } else {
          retoInput.value = '';
          retoInput.style.color = '';
        }
      }
    }
  }
};

// Calculates energy offsets (Actual vs Plan) and applies them downstream
window.ofpRecalcActual = function() {
  const rows = window._ofpRows;
  if (!rows) return;

  let currentDelta = null; // Battery percentage offset

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const actualInput = document.getElementById(`ofp-actual-${i}`);
    if (!actualInput) continue;

    const planned = r.planPct;
    const savedVal = window.ofpInputData[`ofp-actual-${i}`]; // Fetches from memory

    if (savedVal !== undefined && savedVal !== '') {
      // 1. The user has entered this value manually
      const actualNum = parseFloat(savedVal);
      if (!isNaN(actualNum)) {
        currentDelta = actualNum - planned;
        actualInput.value = savedVal;
        actualInput.style.color = ''; // Black colour
        actualInput.style.fontWeight = 'bold'; // Bold to indicate a measured value
      }
    } else {
      // 2. Waterfall calculation: no manual value, fill in forecast if ahead/behind plan
      if (currentDelta !== null) {
        const forecasted = planned + currentDelta;
        actualInput.value = forecasted.toFixed(1);
        actualInput.style.color = 'var(--accent)'; // Blue colour
        actualInput.style.fontWeight = 'normal';
      } else {
        actualInput.value = '';
        actualInput.style.color = '';
        actualInput.style.fontWeight = 'normal';
      }
    }
    // Also updates the Diff column
    window.ofpCalcDiff(i);
  }
};