// ==========================================
// MISSIONDESK MAPS & LEAFLET LOGIC
// ==========================================

window._deliveryMap = null;
window._waypointMap = null;
window._briefMap    = null;

window.makeIcon = function(color, label) {
  const svg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 9.8 14 24 14 24S28 23.8 28 14C28 6.3 21.7 0 14 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <text x="14" y="18" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="#fff">${label}</text>
  </svg>`);
  return L.icon({ iconUrl: `data:image/svg+xml,${svg}`, iconSize: [28,38], iconAnchor: [14,38], popupAnchor: [0,-38] });
};

window.ICON_START  = () => window.makeIcon('#0069b4', '▶');
window.ICON_DEST   = () => window.makeIcon('#1b7a3c', '★');
window.ICON_WP     = (n) => window.makeIcon('#c94f10', n);
window.ICON_SINGLE = () => window.makeIcon('#0069b4', '●');

window.refreshAllMaps = function() {
  // Update the small maps
  if (window._deliveryMap)  { window._deliveryMap = window.safeRemoveMap(window._deliveryMap); window.updateDeliveryMap(); }
  if (window._waypointMap)  { window._waypointMap = window.safeRemoveMap(window._waypointMap); window.updateWaypointPreview(); }
  if (window._briefMap)     { window._briefMap = window.safeRemoveMap(window._briefMap); window.initBriefMap(); }

  // Force redraw of the large Volume map
  if (window._volumeMap) {
    window._volumeMap = window.safeRemoveMap(window._volumeMap);
    window._isTopoActive = false;
    window._airspaceLayer = null;
    window._lfvLayer = null;
    window._popLayer = null;

    // Reset the colours on the layer buttons in Step 2
    ['btn-layer-topo', 'btn-layer-aip', 'btn-layer-lfv', 'btn-layer-scb'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) { btn.style.background = ''; btn.style.color = ''; }
    });
    
    if (typeof window.calcVolumes === 'function') window.calcVolumes();
  }

  // Give the user a green blinking confirmation on the button
  const btn = document.querySelector('button[onclick="window.refreshAllMaps()"]');
  if (btn) {
    const oldTxt = btn.textContent;
    btn.textContent = '✓ MAPS REFRESHED';
    btn.style.background = 'var(--ok)';
    btn.style.color = '#fff';
    setTimeout(() => { 
      btn.textContent = oldTxt; 
      btn.style.background = ''; 
      btn.style.color = 'var(--accent)'; 
    }, 2000);
  }
};

window.addAirspaceTileLayers = function(map) {
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles © <a href="https://www.esri.com/">Esri</a> | © <a href="https://www.openaip.net">OpenAIP</a>', maxZoom: 18 }
  ).addTo(map);

  const apiKey = (localStorage.getItem('openaip_key') || document.getElementById('openaip-api-key')?.value || '').trim();
  if (apiKey) {
    L.tileLayer(
      `https://{s}.api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(apiKey)}`,
      {
        attribution: '© <a href="https://www.openaip.net">OpenAIP</a>',
        subdomains: ['1','2'],
        maxZoom: 14, minZoom: 4, opacity: 0.8, tileSize: 256,
        errorTileUrl: 'data:image/png;base64,iVBORw0KGgo=',
      }
    ).addTo(map);
  } else {
    L.tileLayer(
      'https://wms.chartbundle.com/tms/1.0.0/sec/{z}/{x}/{y}.png?type=google',
      {
        attribution: '© <a href="https://www.chartbundle.com">ChartBundle</a> FAA sectionals',
        maxZoom: 11, minZoom: 4, opacity: 0.5, tileSize: 256,
      }
    ).addTo(map);
  }
};

window.initLeafletMap = function(divId, centerLat, centerLon, zoom) {
  if (document.getElementById(divId)?._leaflet_id) return null;
  const div = document.getElementById(divId);
  if (!div) return null;
  div.style.display = 'block';
  if (div._leaflet_id) {
    const existing = Object.values(window._leafletMaps || {}).find(m => m.getContainer().id === divId);
    if (existing) { existing.setView([centerLat, centerLon], zoom); return existing; }
  }
  const map = L.map(divId, { zoomControl: true, scrollWheelZoom: false });
  window.addAirspaceTileLayers(map);
  map.setView([centerLat, centerLon], zoom);
  if (!window._leafletMaps) window._leafletMaps = {};
  window._leafletMaps[divId] = map;
  return map;
};

window.safeRemoveMap = function(ref) {
  if (!ref) return null;
  try { ref.eachLayer(function(l){try{ref.removeLayer(l);}catch(e){}}); ref.off(); ref.remove(); } catch(e) {}
  return null;
};

window.clearLeafletLayers = function(map) {
  if (!map) return;
  map.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.Polyline || layer instanceof L.Circle) {
      map.removeLayer(layer);
    }
  });
};

window.updateDeliveryMap = function() {
  const startRaw = document.getElementById('delivery-start-coords')?.value;
  const destRaw  = document.getElementById('delivery-dest-coords')?.value;
  const startPt  = typeof window.parseCoords === 'function' ? window.parseCoords(startRaw) : null;
  const destPt   = typeof window.parseCoords === 'function' ? window.parseCoords(destRaw) : null;
  const linksEl  = document.getElementById('delivery-map-links');
  const mapDiv   = document.getElementById('delivery-leaflet-map');

  if (!startPt && !destPt) {
    if (mapDiv) mapDiv.style.display = 'none';
    if (linksEl) linksEl.style.display = 'none';
    return;
  }

  const pts = [startPt, destPt].filter(Boolean);
  const centerLat = pts.reduce((a,p) => a+p.lat, 0) / pts.length;
  const centerLon = pts.reduce((a,p) => a+p.lon, 0) / pts.length;
  const zoom = pts.length === 2 ? 12 : 13;

  if (window._deliveryMap) {
    window._deliveryMap = window.safeRemoveMap(window._deliveryMap);
    if (window._leafletMaps) delete window._leafletMaps['delivery-leaflet-map'];
  }
  if (mapDiv) mapDiv._leaflet_id = undefined;
  window._deliveryMap = window.initLeafletMap('delivery-leaflet-map', centerLat, centerLon, zoom);
  if (!window._deliveryMap) return;

  if (startPt) {
    L.marker([startPt.lat, startPt.lon], {icon: window.ICON_START()})
      .bindPopup(`<b>START</b><br>${document.getElementById('delivery-start-loc')?.value || ''}<br>${startPt.lat.toFixed(6)}, ${startPt.lon.toFixed(6)}`)
      .addTo(window._deliveryMap);
  }
  if (destPt) {
    L.marker([destPt.lat, destPt.lon], {icon: window.ICON_DEST()})
      .bindPopup(`<b>DESTINATION</b><br>${document.getElementById('delivery-dest-loc')?.value || ''}<br>${destPt.lat.toFixed(6)}, ${destPt.lon.toFixed(6)}`)
      .addTo(window._deliveryMap);
  }
  if (startPt && destPt) {
    L.polyline([[startPt.lat, startPt.lon],[destPt.lat, destPt.lon]], {
      color: '#0069b4', weight: 3, dashArray: '8,5', opacity: 0.85
    }).addTo(window._deliveryMap);
    window._deliveryMap.fitBounds([[startPt.lat, startPt.lon],[destPt.lat, destPt.lon]], {padding:[40,40]});
  }

  if (linksEl) {
    const lat = centerLat.toFixed(4), lon = centerLon.toFixed(4);
    const sLat = startPt ? startPt.lat.toFixed(4) : lat;
    const sLon = startPt ? startPt.lon.toFixed(4) : lon;
    linksEl.style.display = 'flex';
    linksEl.innerHTML = typeof window.buildMapLinks === 'function' ? window.buildMapLinks(sLat, sLon, zoom) : '';
  }
};

window.updateWaypointPreview = function() {
  if (!window.waypoints) return;
  window.waypoints.forEach(wp => {
    const latN = parseFloat(wp.lat), lonN = parseFloat(wp.lon);
    if (!isNaN(latN) && !isNaN(lonN)) {
      wp.lat = latN; wp.lon = lonN;
    } else {
      const p = (typeof window.parseCoordFull === 'function' ? window.parseCoordFull(wp.coords || '') : null) || 
                (typeof window.parseCoords === 'function' ? window.parseCoords(wp.coords || '') : null);
      if (p) { wp.lat = p.lat; wp.lon = p.lon; }
      else { wp.lat = null; wp.lon = null; }
    }
  });

  const valid  = window.waypoints.filter(wp => wp.lat != null && wp.lon != null && !isNaN(wp.lat) && !isNaN(wp.lon));
  const linksEl = document.getElementById('waypoint-map-links');
  const mapDiv  = document.getElementById('waypoint-leaflet-map');

  if (valid.length === 0) {
    if (mapDiv)  mapDiv.style.display = 'none';
    if (linksEl) linksEl.style.display = 'none';
    return;
  }

  if (mapDiv) mapDiv.style.display = 'block';

  const lats = valid.map(w => parseFloat(w.lat));
  const lons = valid.map(w => parseFloat(w.lon));
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

  if (window._waypointMap) {
    window._waypointMap = window.safeRemoveMap(window._waypointMap);
  }
  if (window._leafletMaps) delete window._leafletMaps['waypoint-leaflet-map'];
  const wDiv = document.getElementById('waypoint-leaflet-map');
  if (wDiv) wDiv._leaflet_id = undefined;

  window._waypointMap = window.initLeafletMap('waypoint-leaflet-map', centerLat, centerLon, valid.length === 1 ? 13 : 11);
  if (!window._waypointMap) return;

  const latLngs = [];
  valid.forEach((wp, i) => {
    const lat = parseFloat(wp.lat), lon = parseFloat(wp.lon);
    latLngs.push([lat, lon]);
    const isFirst = i === 0, isLast = i === valid.length - 1;
    const icon = isFirst ? window.ICON_START() : isLast ? window.ICON_DEST() : window.ICON_WP(i+1);
    const label = wp.name || (isFirst ? 'Home / Start' : isLast ? 'End' : `WP${i+1}`);
    L.marker([lat, lon], {icon})
      .bindPopup(`<b>${label}</b><br>${lat.toFixed(6)}, ${lon.toFixed(6)}${wp.alt ? `<br>Alt AGL: ${wp.alt} m` : ''}`)
      .addTo(window._waypointMap);
  });
  if (latLngs.length > 1) {
    L.polyline(latLngs, {color:'#0069b4', weight:3, dashArray:'8,5', opacity:0.85}).addTo(window._waypointMap);
    window._waypointMap.fitBounds(latLngs, {padding:[40,40]});
  } else {
    window._waypointMap.setView(latLngs[0], 13);
  }

  if(typeof window.renderFenceOnMap === 'function') window.renderFenceOnMap(window._waypointMap, latLngs);
  if(typeof window.renderRallyOnMap === 'function') window.renderRallyOnMap(window._waypointMap);

  if (linksEl && typeof window.buildMapLinks === 'function') {
    const lat = centerLat.toFixed(4), lon = centerLon.toFixed(4);
    linksEl.style.display = 'flex';
    linksEl.innerHTML = window.buildMapLinks(lat, lon, 12);
  }

  const statsEl = document.getElementById('waypoint-stats');
  if (statsEl && valid.length >= 2) {
    let totalDist = 0;
    for (let i = 1; i < valid.length; i++) {
      const p1 = {lat:parseFloat(valid[i-1].lat),lon:parseFloat(valid[i-1].lon)};
      const p2 = {lat:parseFloat(valid[i].lat),lon:parseFloat(valid[i].lon)};
      const R=6371000, dLat=(p2.lat-p1.lat)*Math.PI/180, dLon=(p2.lon-p1.lon)*Math.PI/180;
      const a=Math.sin(dLat/2)**2+Math.cos(p1.lat*Math.PI/180)*Math.cos(p2.lat*Math.PI/180)*Math.sin(dLon/2)**2;
      totalDist += 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    const alts = valid.map(w=>parseFloat(w.alt)).filter(a=>!isNaN(a));
    const maxAlt = alts.length?Math.max(...alts):null;
    statsEl.style.display = 'flex';
    statsEl.innerHTML = `<span>📍 ${valid.length} waypoints</span>
      <span>📏 Total route: <strong>${Math.round(totalDist)} m (${window.fmt(totalDist/1000, 2)} km)</strong></span>
      ${maxAlt!==null?`<span>⬆ Max altitude: <strong>${maxAlt} m AGL</strong></span>`:''}`;
    if(typeof window.recalcFlightTime === 'function') window.recalcFlightTime();
  } else if (statsEl) {
    statsEl.style.display = 'none';
  }
};

window.initBriefMap = function() {
  if (!window._briefMapPoints) return;
  const pts = window._briefMapPoints;
  const div = document.getElementById('brief-leaflet-map');
  if (!div || pts.length === 0) return;

  const centerLat = pts.reduce((a,p)=>a+p.lat,0)/pts.length;
  const centerLon = pts.reduce((a,p)=>a+p.lon,0)/pts.length;
  const zoom = pts.length === 1 ? 13 : 11;

  window._briefMap = window.safeRemoveMap(window._briefMap);
  if (window._leafletMaps) delete window._leafletMaps['brief-leaflet-map'];
  div._leaflet_id = undefined;

  window._briefMap = L.map('brief-leaflet-map', {zoomControl:true, scrollWheelZoom:false});
  window.addAirspaceTileLayers(window._briefMap);
  window._briefMap.setView([centerLat, centerLon], zoom);

  const latLngs = [];
  pts.forEach((p, i) => {
    const isStart = p.type === 'start' || i === 0;
    const isDest  = p.type === 'dest';
    const icon    = isDest ? window.ICON_DEST() : isStart && i === 0 ? window.ICON_START() : window.ICON_WP(i+1);
    latLngs.push([p.lat, p.lon]);
    L.marker([p.lat, p.lon], {icon})
      .bindPopup(`<b>${p.name}</b><br>${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}${p.alt?'<br>Alt: '+p.alt+' m AGL':''}`)
      .addTo(window._briefMap);
  });

  const radius = parseFloat(document.getElementById('op-radius')?.value);
  if (pts.length === 1 && radius > 0) {
    L.circle([pts[0].lat, pts[0].lon], {radius, color:'#0069b4', fillOpacity:0.08, dashArray:'6,4'}).addTo(window._briefMap);
  }
  const buffer = parseFloat(document.getElementById('op-buffer')?.value);
  if (pts.length === 1 && buffer > 0) {
    L.circle([pts[0].lat, pts[0].lon], {radius:buffer, color:'#c94f10', fillOpacity:0.04, dashArray:'3,6', weight:1}).addTo(window._briefMap);
  }

  if (latLngs.length > 1) {
    const color = pts.some(p=>p.type==='dest') ? '#0069b4' : '#c94f10';
    L.polyline(latLngs, {color, weight:3, dashArray:'8,5', opacity:0.85}).addTo(window._briefMap);
    window._briefMap.fitBounds(latLngs, {padding:[50,50]});
  }

  if(typeof window.renderFenceOnMap === 'function') window.renderFenceOnMap(window._briefMap, latLngs);
  if(typeof window.renderRallyOnMap === 'function') window.renderRallyOnMap(window._briefMap);
  if(typeof window.buildBriefAirspaceLinks === 'function') window.buildBriefAirspaceLinks();
  
  // Force Leaflet to update the size so the map does not collapse in PDF
  setTimeout(() => { window._briefMap.invalidateSize(); }, 500);
};

window.buildMapLinks = function(lat, lon, zoom) {
  const z = Math.min(zoom+1, 16);
  const lfvUrl = `https://dronechart.lfv.se#${lat},${lon},${z}`;
  const aipUrl = `https://www.openaip.net`; // <-- FIXED DNS
  const svUrl  = `https://skyvector.com/?ll=${lat},${lon}&chart=301&zoom=2`;
  return `
    <a href="${lfvUrl}" target="_blank" rel="noopener" class="btn btn-secondary" style="border-color:var(--accent);color:var(--accent);font-size:10px;padding:6px 12px;margin-right:8px;display:inline-block;text-decoration:none;font-weight:bold;">🗺 CAA MAP ↗</a>
    <a href="${aipUrl}" target="_blank" rel="noopener" class="btn btn-secondary" style="border-color:var(--accent);color:var(--accent);font-size:10px;padding:6px 12px;margin-right:8px;display:inline-block;text-decoration:none;font-weight:bold;">✈ OPENAIP AIRSPACE ↗</a>
    <a href="${svUrl}"  target="_blank" rel="noopener" class="btn btn-secondary" style="border-color:var(--accent);color:var(--accent);font-size:10px;padding:6px 12px;display:inline-block;text-decoration:none;font-weight:bold;">📡 SKYVECTOR ↗</a>
  `;
};

window.renderFenceOnMap = function(map, routeLatLngs) {
  if (!map || !window.fencePoints || window.fencePoints.length < 3) return;
  const fenceLatLngs = window.fencePoints.map(p => [p.lat, p.lon]);

  L.polygon(fenceLatLngs, {
    color: '#c94f10', weight: 2.5, opacity: 0.9,
    fillColor: '#c94f10', fillOpacity: 0.08,
  }).bindPopup(
    `<b>Geofence</b><br>${window.fencePoints.length} vertices<br>` +
    `<span style="font-size:10px;color:#5a6a82;">ArduPilot FENCE_POINT (cmd 5001)</span>`
  ).addTo(map);

  window.fencePoints.forEach((p, i) => {
    L.circleMarker([p.lat, p.lon], {
      radius: 5, color: '#c94f10', weight: 1.5,
      fillColor: '#fff', fillOpacity: 1
    }).bindTooltip(`F${i+1}`, {permanent: false, direction: 'top'})
      .addTo(map);
  });

  const allPts = [...(routeLatLngs || []), ...fenceLatLngs];
  if (allPts.length > 1) {
    try { map.fitBounds(allPts, {padding:[40,40]}); } catch(e) {}
  }
};

window.renderRallyOnMap = function(map) {
  if (!map || !window.rallyPoints || window.rallyPoints.length === 0) return;
  const RALLY_COLOR = '#1b7a3c';
  window.rallyPoints.forEach((p, i) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34">
      <path d="M14 0 C6.3 0 0 6.3 0 14 C0 22 14 34 14 34 C14 34 28 22 28 14 C28 6.3 21.7 0 14 0Z"
        fill="${RALLY_COLOR}" stroke="#fff" stroke-width="1.5"/>
      <text x="14" y="18" text-anchor="middle" dominant-baseline="middle"
        font-family="monospace" font-size="10" font-weight="bold" fill="#fff">R${i+1}</text>
    </svg>`;
    const icon = L.divIcon({
      html: svg, iconSize:[28,34], iconAnchor:[14,34], popupAnchor:[0,-34], className:''
    });
    const altText = p.alt != null ? `<br>Alt: ${p.alt} m AGL` : '';
    L.marker([p.lat, p.lon], {icon})
      .bindPopup(
        `<b>Rally Point R${i+1}</b>${altText}<br>` +
        `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}<br>` +
        `<span style="font-size:10px;color:#5a6a82;">MAV_CMD_NAV_RALLY_POINT (cmd 5100)</span>`
      ).addTo(map);
  });
};

window.getBaseCoords = function() {
  const raw = document.getElementById('op-coords')?.value || '';
  const p = typeof window.parseCoords === 'function' ? window.parseCoords(raw) : null;
  return p ? { lat: p.lat.toFixed(4), lon: p.lon.toFixed(4) } : { lat: '59.3293', lon: '18.0686' };
};

window.toggleMapEmbed = function() {
  const container = document.getElementById('map-embed-container');
  const btn = document.getElementById('map-embed-btn');
  const iframe = document.getElementById('map-iframe');
  if (container.style.display === 'none') {
    const { lat, lon } = window.getBaseCoords();
    const l = parseFloat(lon), t = parseFloat(lat);
    // Replace the broken OpenAIP server with a standard map via OSM
    iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${l-0.2},${t-0.1},${l+0.2},${t+0.1}&layer=mapnik`;
    container.style.display = 'block';
    btn.textContent = 'HIDE MAP';
  } else {
    container.style.display = 'none';
    iframe.src = '';
    btn.textContent = 'SHOW MAP';
  }
};

window.autoFillDeliveryCoords = function() {
  const statusEl = document.getElementById('delivery-autofill-status');
  function setStatus(msg, ok) {
    if (!statusEl) return;
    statusEl.style.display = 'block';
    statusEl.style.background = ok ? 'rgba(0,150,60,0.07)' : 'rgba(198,40,40,0.07)';
    statusEl.style.border = ok ? '1px solid var(--ok)' : '1px solid var(--danger)';
    statusEl.style.color  = ok ? 'var(--ok)' : 'var(--danger)';
    statusEl.textContent  = msg;
    if (ok) setTimeout(() => statusEl.style.display = 'none', 6000);
  }

  if (!window.waypoints || window.waypoints.length < 1) {
    setStatus('⚠ No mission file loaded. Load a .waypoints/.plan/.csv file first.', false);
    return;
  }

  const validWps = window.waypoints.filter(wp => wp.lat !== 0 || wp.lon !== 0);
  if (validWps.length < 1) {
    setStatus('⚠ Mission contains no valid navigation waypoints.', false);
    return;
  }

  const startWp = validWps[0];
  const destWp  = validWps[validWps.length - 1];
  const fmtCoord = (wp) => `${wp.lat.toFixed(6)}, ${wp.lon.toFixed(6)}`;

  // Start point
  const startCoordsEl = document.getElementById('delivery-start-coords');
  const startLocEl = document.getElementById('delivery-start-loc');
  if (startCoordsEl) {
    startCoordsEl.value = fmtCoord(startWp);
    startCoordsEl.style.borderColor = 'rgba(0,150,60,0.5)';
    if (startLocEl && startWp.name) startLocEl.value = startWp.name;
  }

  // Destination point
  const destCoordsEl = document.getElementById('delivery-dest-coords');
  const destLocEl = document.getElementById('delivery-dest-loc');
  if (destCoordsEl) {
    if (validWps.length > 1) {
      destCoordsEl.value = fmtCoord(destWp);
      destCoordsEl.style.borderColor = 'rgba(0,150,60,0.5)';
      if (destLocEl && destWp.name) destLocEl.value = destWp.name;
    } else {
      destCoordsEl.value = fmtCoord(startWp); // If only 1 waypoint, set the same
      if (destLocEl && startWp.name) destLocEl.value = startWp.name;
    }
  }

  const opCoordsEl = document.getElementById('op-coords');
  if (opCoordsEl && !opCoordsEl.value.trim()) opCoordsEl.value = fmtCoord(startWp);

  if (typeof window.updateDeliveryMap === 'function') window.updateDeliveryMap();
  if (typeof window.calcDeliveryDistance === 'function') window.calcDeliveryDistance();
  if (typeof window.recalcFlightTime === 'function') window.recalcFlightTime();

  const n = validWps.length;
  setStatus(`✓ Filled from mission (${n} waypoint${n!==1?'s':''})`, true);
};

window.calcDeliveryDistance = function() {
  const sc = typeof window.parseCoords === 'function' ? window.parseCoords(document.getElementById('delivery-start-coords')?.value) : null;
  const dc = typeof window.parseCoords === 'function' ? window.parseCoords(document.getElementById('delivery-dest-coords')?.value) : null;
  const distEl = document.getElementById('delivery-distance');
  const hintEl = document.getElementById('delivery-dist-hint');
  
  if (sc && dc && typeof window.haversineM === 'function') {
    const m = Math.round(window.haversineM(sc, dc));
    if(distEl) distEl.value = m;
    if(hintEl) {
      hintEl.textContent = `≈ ${Math.round(m).toLocaleString('en-GB')} m (${window.fmt(m/1000,2)} km) straight-line distance`;
      hintEl.style.color = 'var(--ok)';
    }
  } else if (hintEl) {
    hintEl.textContent = 'Fill in coordinates above for auto-calculation';
    hintEl.style.color = 'var(--muted)';
  }
};

window.initBriefVolumeMap = function() {
  const divId = 'brief-volume-map';
  const el = document.getElementById(divId);
  if (!el || !window._briefMapPoints || window._briefMapPoints.length === 0) return;

  // Clean up if there is an old one
  if (window._briefVolMap) {
    window._briefVolMap = window.safeRemoveMap(window._briefVolMap);
    if (window._leafletMaps) delete window._leafletMaps[divId];
  }
  el._leaflet_id = undefined;

  const pts = window._briefMapPoints;
  const centerLat = pts.reduce((a,p)=>a+p.lat,0)/pts.length;
  const centerLon = pts.reduce((a,p)=>a+p.lon,0)/pts.length;
  const zoom = pts.length === 1 ? 14 : 12;

  window._briefVolMap = L.map(divId, {zoomControl: false, scrollWheelZoom: false, dragging: false});
  
  // Base map (Topo/ESRI)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }).addTo(window._briefVolMap);

  // LFV Airspace (Forced active on the briefing map)
  L.tileLayer.wms('https://daim.lfv.se/geoserver/wms', {
    layers: 'mais:CTR,mais:TIZ,mais:ATZ,mais:RSTA,mais:DNGA,DAIM_TOPO:HKP1K,DAIM_TOPO:RWY5K', 
    format: 'image/png', transparent: true, opacity: 0.55
  }).addTo(window._briefVolMap);

  // SCB Demographics (Forced active on the briefing map)
  L.tileLayer.wms('https://geodata.scb.se/geoserver/stat/wms', {
    layers: 'stat:Tatorter', format: 'image/png', transparent: true, opacity: 0.5
  }).addTo(window._briefVolMap);

  // Calculate radii from the forms
  const v = parseFloat(document.getElementById('vol-speed')?.value) || 15;
  const w = parseFloat(document.getElementById('vol-wind')?.value) || 8;
  const h = parseFloat(document.getElementById('vol-height')?.value) || 50;
  const gps = parseFloat(document.getElementById('vol-gps')?.value) || 3;
  const t_r = parseFloat(document.getElementById('vol-reaction')?.value) || 3;
  const t_l = parseFloat(document.getElementById('vol-latency')?.value) || 1;
  const fts = document.getElementById('vol-fts')?.value || 'ballistic';

  const fg_margin = gps;
  const cv_margin = (v + w) * (t_r + t_l);
  let grb_margin = 0;
  if (fts === 'ballistic') grb_margin = h;
  else if (fts === 'parachute') grb_margin = w * (h / 4);
  else if (fts === 'glide') grb_margin = h * 3;

  const fg_km = Math.max(fg_margin / 1000, 0.001);
  const cv_km = Math.max((fg_margin + cv_margin) / 1000, 0.001);
  const grb_km = Math.max((fg_margin + cv_margin + grb_margin) / 1000, 0.001);

  // Draw the route
  const validWps = (window.waypoints || []).filter(wp => !isNaN(parseFloat(wp.lat)) && !isNaN(parseFloat(wp.lon)));
  let geojson = null;

  if (validWps.length > 1) {
    const coords = validWps.map(wp => [parseFloat(wp.lon), parseFloat(wp.lat)]);
    geojson = turf.lineString(coords);
  } else if (validWps.length === 1) {
    geojson = turf.point([parseFloat(validWps[0].lon), parseFloat(validWps[0].lat)]);
  } else if (pts.length > 0) {
    geojson = turf.point([pts[0].lon, pts[0].lat]);
  }

  if (geojson) {
    const pathLayer = L.geoJSON(geojson, { style: { color: '#111', weight: 3 } }).addTo(window._briefVolMap);
    
    try {
      // Turf.buffer (red = GRB, orange = CV, green = FG)
      L.geoJSON(turf.buffer(geojson, grb_km, {units: 'kilometers', steps: 32}), { style: { color: '#c62828', weight: 1, fillOpacity: 0.15 } }).addTo(window._briefVolMap);
      L.geoJSON(turf.buffer(geojson, cv_km, {units: 'kilometers', steps: 32}), { style: { color: '#e65100', weight: 1, fillOpacity: 0.2, dashArray: '5, 5' } }).addTo(window._briefVolMap);
      L.geoJSON(turf.buffer(geojson, fg_km, {units: 'kilometers', steps: 32}), { style: { color: '#2e7d32', weight: 1, fillOpacity: 0.3 } }).addTo(window._briefVolMap);
      
      // Zoom in so the buffers fill the screen neatly
      window._briefVolMap.setView([centerLat, centerLon], zoom);
      setTimeout(() => { window._briefVolMap.fitBounds(pathLayer.getBounds(), { padding: [50, 50] }); }, 500);
    } catch(e) { console.error("Turf error in brief:", e); }
  }
};