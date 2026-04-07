// ==========================================
// MISSIONDESK STATIC DATA & DATABASES
// ==========================================

window.UAS_MODELS = {
  mavic3:   { desc: 'DJI Mavic 3 Enterprise, 4/3 CMOS 20MP, 56x zoom, RTK, max wind 12 m/s, ~45 min flight, 249g class', maxWind: 12, flightMin: 45 },
  mavic3t:  { desc: 'DJI Mavic 3 Thermal, FLIR thermal + wide camera, RTK, max wind 12 m/s, ~45 min', maxWind: 12, flightMin: 45 },
  m30t:     { desc: 'DJI Matrice 30T, wide+zoom+thermal+laser, IP55, max wind 15 m/s, ~41 min, ADS-B', maxWind: 15, flightMin: 41 },
  m300:     { desc: 'DJI Matrice 300 RTK, triple payload, IP45, max wind 15 m/s, ~55 min, ADS-B, hot-swap battery', maxWind: 15, flightMin: 55 },
  m350:     { desc: 'DJI Matrice 350 RTK, triple payload, IP55, max wind 12 m/s, ~55 min, ADS-B, hot-swap battery', maxWind: 12, flightMin: 55 },
  flycart:  { desc: 'DJI FlyCart 30, Heavy cargo drone, dual battery, 30kg payload capacity, max wind 12 m/s', maxWind: 12, flightMin: 18 },
  mini4:    { desc: 'DJI Mini 4 Pro, 1/1.3" CMOS 48MP, <249g (C0), max wind 10.7 m/s, ~34 min', maxWind: 10.7, flightMin: 34 },
  air3:     { desc: 'DJI Air 3, dual camera wide+tele, <249g option, max wind 12 m/s, ~46 min', maxWind: 12, flightMin: 46 },
  avata2:   { desc: 'DJI Avata 2, FPV drone, 1/1.3" CMOS, max wind 10.7 m/s, ~23 min, goggles required', maxWind: 10.7, flightMin: 23 },
  evo2:     { desc: 'Autel EVO II Pro V3, 1" CMOS 6K, max wind 12 m/s, ~42 min, ADS-B', maxWind: 12, flightMin: 42 },
  evomax:   { desc: 'Autel EVO Max 4T, wide+zoom+thermal+laser, max wind 12 m/s, ~42 min, ADS-B', maxWind: 12, flightMin: 42 },
  skydiox10:{ desc: 'Skydio X10, advanced AI obstacle avoidance, thermal/RGB, IP55, max wind 12 m/s, ~40 min', maxWind: 12, flightMin: 40 },
  skydiox2: { desc: 'Skydio X2, enterprise AI, thermal/RGB, max wind 10 m/s, ~35 min', maxWind: 10, flightMin: 35 },
  yuneec850:{ desc: 'Yuneec H850-RTK, hexacopter, dual battery, max wind 15 m/s, ~65 min', maxWind: 15, flightMin: 65 },
  atlaspro: { desc: 'AtlasPRO UAV, tactical tricopter, mesh network, IP53, max wind 15 m/s, ~32 min', maxWind: 15, flightMin: 32 },
  anafi:    { desc: 'Parrot ANAFI Ai, 48MP, 4G LTE, max wind 14 m/s, ~32 min, Made in EU', maxWind: 14, flightMin: 32 },
  schiebel: { desc: 'Schiebel Camcopter S-100, VTOL rotary-wing UAS, max payload 50kg, endurance 6h, max wind 20 m/s', maxWind: 20, flightMin: 360 },
};

window.DRONE_DB = [
  // --- DJI Mini-serien ---
  { key:'dji mini 1',        name:'DJI Mavic Mini (Gen 1)',  dim:0.21, mtom:0.249, maxSpeed:13,  cruiseSpeed:8,  euClass:'C0',  nrg:{setup:2.0, takeoff:5.5, cruise:3.5, descent:2.8, takeoffMin:1.0, descentMin:1.0, note:'First gen Mini'} },
  { key:'dji mini 2',        name:'DJI Mini 2',          dim:0.26, mtom:0.249, maxSpeed:16,  cruiseSpeed:10, euClass:'C0',  nrg:{setup:2.0, takeoff:5.5, cruise:3.5, descent:2.8, takeoffMin:1.0, descentMin:1.0, note:'Est. ~30Wh battery, 31min hover'} },
  { key:'dji mini 2 se',     name:'DJI Mini 2 SE',       dim:0.26, mtom:0.249, maxSpeed:16,  cruiseSpeed:10, euClass:'C0',  nrg:{setup:2.0, takeoff:5.5, cruise:3.5, descent:2.8, takeoffMin:1.0, descentMin:1.0, note:'Est. ~30Wh battery, 31min hover'} },
  { key:'dji mini 3',        name:'DJI Mini 3',          dim:0.30, mtom:0.249, maxSpeed:16,  cruiseSpeed:10, euClass:'C0',  nrg:{setup:2.0, takeoff:5.5, cruise:3.5, descent:2.8, takeoffMin:1.0, descentMin:1.0, note:'Est. ~38Wh battery, 38min hover'} },
  { key:'dji mini 3 pro',    name:'DJI Mini 3 Pro',      dim:0.30, mtom:0.249, maxSpeed:16,  cruiseSpeed:10, euClass:'C0',  nrg:{setup:2.0, takeoff:5.5, cruise:3.5, descent:2.8, takeoffMin:1.0, descentMin:1.0, note:'Est. ~47Wh battery, 34min hover'} },
  { key:'dji mini 4 pro',    name:'DJI Mini 4 Pro',      dim:0.30, mtom:0.249, maxSpeed:16,  cruiseSpeed:10, euClass:'C0',  nrg:{setup:2.0, takeoff:5.5, cruise:3.5, descent:2.8, takeoffMin:1.0, descentMin:1.0, note:'Est. ~47Wh battery, 34min hover'} },
  
  // --- DJI Air-serien ---
  { key:'dji mavic air',     name:'DJI Mavic Air (Gen 1)',dim:0.21, mtom:0.430, maxSpeed:19,  cruiseSpeed:10, euClass:'C1',  nrg:{setup:2.0, takeoff:5.5, cruise:3.5, descent:2.8, takeoffMin:1.0, descentMin:1.0, note:'First gen Air'} },
  { key:'dji air 2',         name:'DJI Mavic Air 2',     dim:0.30, mtom:0.570, maxSpeed:19,  cruiseSpeed:12, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'Mavic Air 2'} },
  { key:'dji air 2s',        name:'DJI Air 2S',          dim:0.47, mtom:0.595, maxSpeed:19,  cruiseSpeed:12, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'Est. ~40Wh battery, 31min hover'} },
  { key:'dji air 3',         name:'DJI Air 3',           dim:0.47, mtom:0.720, maxSpeed:21,  cruiseSpeed:13, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'Est. ~46Wh battery, 46min hover'} },
  { key:'dji air 3s',        name:'DJI Air 3S',          dim:0.47, mtom:0.750, maxSpeed:21,  cruiseSpeed:13, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'Est. ~46Wh battery, 46min hover'} },
  
  // --- DJI Mavic-serien ---
  { key:'dji mavic pro',     name:'DJI Mavic Pro (Gen 1)',dim:0.33, mtom:0.734, maxSpeed:18, cruiseSpeed:10, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'First gen Mavic Pro'} },
  { key:'dji mavic pro plat',name:'DJI Mavic Pro Platinum',dim:0.33, mtom:0.734, maxSpeed:18, cruiseSpeed:10, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:2.8, descent:2.4, takeoffMin:1.5, descentMin:1.5, note:'Platinum edition'} },
  { key:'dji mavic 2 pro',   name:'DJI Mavic 2 Pro',     dim:0.45, mtom:0.907, maxSpeed:20,  cruiseSpeed:12, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'Est. ~59Wh battery, 31min hover'} },
  { key:'dji mavic 2 zoom',  name:'DJI Mavic 2 Zoom',    dim:0.45, mtom:0.905, maxSpeed:20,  cruiseSpeed:12, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'Est. ~59Wh battery, 31min hover'} },
  { key:'dji mavic 2 ent',   name:'DJI Mavic 2 Enterprise',dim:0.45, mtom:0.905, maxSpeed:20, cruiseSpeed:12, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'M2E Dual/Advanced'} },
  { key:'dji mavic 3',       name:'DJI Mavic 3',         dim:0.38, mtom:0.895, maxSpeed:21,  cruiseSpeed:14, euClass:'C1',  nrg:{setup:2.0, takeoff:4.8, cruise:2.9, descent:2.4, takeoffMin:1.5, descentMin:1.5, note:'IEEE 2022: hover 73.5W / cruise 80.2W. 77Wh battery, 46min hover'} },
  { key:'dji mavic 3 classic',name:'DJI Mavic 3 Classic',dim:0.38, mtom:0.895, maxSpeed:21,  cruiseSpeed:14, euClass:'C1',  nrg:{setup:2.0, takeoff:4.8, cruise:2.9, descent:2.4, takeoffMin:1.5, descentMin:1.5, note:'IEEE 2022: hover 73.5W / cruise 80.2W. 77Wh battery, 40min hover'} },
  { key:'dji mavic 3 pro',   name:'DJI Mavic 3 Pro',     dim:0.38, mtom:0.958, maxSpeed:21,  cruiseSpeed:14, euClass:'C1',  nrg:{setup:2.0, takeoff:4.8, cruise:2.9, descent:2.4, takeoffMin:1.5, descentMin:1.5, note:'Est. similar to Mavic 3. 77Wh battery, 43min hover'} },
  { key:'dji mavic 3 enterprise',name:'DJI Mavic 3 Enterprise',dim:0.38,mtom:0.915,maxSpeed:21,cruiseSpeed:14,euClass:'C1', nrg:{setup:2.0, takeoff:4.8, cruise:3.1, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'45min hover (standard battery). Enterprise sensors add ~5-10% draw'} },
  { key:'dji mavic 3 thermal',name:'DJI Mavic 3 Thermal',dim:0.38, mtom:0.920, maxSpeed:21,  cruiseSpeed:14, euClass:'C1', nrg:{setup:2.0, takeoff:4.8, cruise:3.1, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'45min hover. Thermal sensor adds minor draw'} },
  
  // --- DJI Phantom ---
  { key:'dji phantom 3',     name:'DJI Phantom 3',       dim:0.59, mtom:1.280, maxSpeed:16,  cruiseSpeed:12, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Legacy Phantom 3'} },
  { key:'dji phantom 4 pro', name:'DJI Phantom 4 Pro',   dim:0.65, mtom:1.375, maxSpeed:20,  cruiseSpeed:14, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Est. 89.2Wh battery, 30min hover. ~3.0 Wh/min hover'} },
  { key:'dji phantom 4 rtk', name:'DJI Phantom 4 RTK',   dim:0.65, mtom:1.391, maxSpeed:16,  cruiseSpeed:10, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.9, descent:2.3, takeoffMin:1.5, descentMin:1.5, note:'Est. 89.2Wh battery, 30min hover. RTK adds minor draw'} },
  
  // --- DJI Inspire ---
  { key:'dji inspire 1',     name:'DJI Inspire 1 / Pro', dim:0.58, mtom:3.500, maxSpeed:22,  cruiseSpeed:13, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Legacy Inspire 1'} },
  { key:'dji inspire 2',     name:'DJI Inspire 2',       dim:0.91, mtom:4.250, maxSpeed:26,  cruiseSpeed:15, euClass:'C3',  nrg:{setup:2.0, takeoff:4.0, cruise:2.5, descent:2.0, takeoffMin:2.0, descentMin:2.0, note:'Est. 2×97Wh batteries, 27min hover'} },
  { key:'dji inspire 3',     name:'DJI Inspire 3',       dim:1.05, mtom:4.290, maxSpeed:26,  cruiseSpeed:15, euClass:'C3',  nrg:{setup:2.0, takeoff:4.0, cruise:2.5, descent:2.0, takeoffMin:2.0, descentMin:2.0, note:'Est. 2×97Wh batteries, 28min hover'} },
  
  // --- DJI Matrice ---
  { key:'dji matrice 100',   name:'DJI Matrice 100',     dim:0.65, mtom:3.600, maxSpeed:22,  cruiseSpeed:12, euClass:'C3',  nrg:{setup:2.0, takeoff:4.0, cruise:2.5, descent:2.0, takeoffMin:1.5, descentMin:1.5, note:'Legacy M100 platform'} },
  { key:'dji matrice 200',   name:'DJI Matrice 200 / 210',dim:0.88, mtom:6.140, maxSpeed:23,  cruiseSpeed:14, euClass:'C3',  nrg:{setup:2.0, takeoff:3.5, cruise:2.2, descent:1.8, takeoffMin:2.0, descentMin:2.0, note:'Legacy M200/M210 series'} },
  { key:'dji matrice 600',   name:'DJI Matrice 600 Pro', dim:1.66, mtom:15.500,maxSpeed:18,  cruiseSpeed:10, euClass:'C3',  nrg:{setup:2.0, takeoff:3.0, cruise:2.0, descent:1.8, takeoffMin:2.0, descentMin:2.0, note:'Heavy lifter hexacopter. 6 batteries.'} },
  { key:'dji matrice 30',    name:'DJI Matrice 30',      dim:0.67, mtom:3.770, maxSpeed:23,  cruiseSpeed:14, euClass:'C3',  nrg:{setup:2.0, takeoff:3.5, cruise:2.2, descent:1.8, takeoffMin:2.0, descentMin:2.0, note:'Est. 131Wh battery, 41min hover. ~3.2 Wh/min hover'} },
  { key:'dji matrice 30t',   name:'DJI Matrice 30T',     dim:0.67, mtom:3.810, maxSpeed:23,  cruiseSpeed:14, euClass:'C3',  nrg:{setup:2.0, takeoff:3.5, cruise:2.3, descent:1.9, takeoffMin:2.0, descentMin:2.0, note:'Est. 131Wh battery, 39min hover. Thermal sensor adds minor draw'} },
  { key:'dji matrice 300',   name:'DJI Matrice 300 RTK', dim:0.89, mtom:9.000, maxSpeed:23,  cruiseSpeed:14, euClass:'C3',  nrg:{setup:2.0, takeoff:3.0, cruise:1.9, descent:1.6, takeoffMin:2.0, descentMin:2.0, note:'Est. 274Wh battery, 55min hover. ~5.0 Wh/min hover'} },
  { key:'dji matrice 350',   name:'DJI Matrice 350 RTK', dim:0.89, mtom:6.470, maxSpeed:23,  cruiseSpeed:14, euClass:'C3',  nrg:{setup:2.0, takeoff:3.0, cruise:1.9, descent:1.6, takeoffMin:2.0, descentMin:2.0, note:'Est. 274Wh battery, 55min hover'} },
  
  // --- DJI FlyCart ---
  { key:'dji flycart 30',    name:'DJI FlyCart 30',      dim:2.80, mtom:65.000,maxSpeed:20,  cruiseSpeed:15, euClass:'other',nrg:{setup:2.0, takeoff:3.0, cruise:2.0, descent:1.8, takeoffMin:2.0, descentMin:2.0, note:'Heavy cargo drone. Values highly dependent on payload weight.'} },
  
  // --- AtlasPRO ---
  { key:'atlaspro',          name:'AtlasPRO UAV',        dim:0.50, mtom:1.700, maxSpeed:20,  cruiseSpeed:14, euClass:'C2',  nrg:{setup:2.0, takeoff:4.0, cruise:2.5, descent:2.0, takeoffMin:1.5, descentMin:1.5, note:'Tactical tricopter, 32 min endurance'} },
  
  // --- Skydio ---
  { key:'skydio r1',         name:'Skydio R1',           dim:0.40, mtom:1.000, maxSpeed:11,  cruiseSpeed:8,  euClass:'C2',  nrg:{setup:2.0, takeoff:5.0, cruise:3.5, descent:2.5, takeoffMin:1.0, descentMin:1.0, note:'Legacy Skydio R1'} },
  { key:'skydio 2',          name:'Skydio 2 / 2+',       dim:0.28, mtom:0.800, maxSpeed:16,  cruiseSpeed:11, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'Skydio 2/2+ series, ~43Wh battery'} },
  { key:'skydio x2',         name:'Skydio X2',           dim:0.65, mtom:1.325, maxSpeed:12.5,cruiseSpeed:10, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Skydio Enterprise X2'} },
  { key:'skydio x10',        name:'Skydio X10',          dim:0.80, mtom:2.100, maxSpeed:20,  cruiseSpeed:12, euClass:'C2',  nrg:{setup:2.0, takeoff:4.0, cruise:2.5, descent:2.0, takeoffMin:1.5, descentMin:1.5, note:'Skydio Enterprise X10, IP55'} },
  
  // --- Yuneec ---
  { key:'yuneec typhoon h',  name:'Yuneec Typhoon H',    dim:0.52, mtom:1.950, maxSpeed:13.5,cruiseSpeed:10, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Typhoon H hexacopter'} },
  { key:'yuneec typhoon h plus',name:'Yuneec Typhoon H Plus',dim:0.52, mtom:1.995, maxSpeed:13.5,cruiseSpeed:10, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Typhoon H Plus / H3'} },
  { key:'yuneec h520',       name:'Yuneec H520',         dim:0.52, mtom:1.900, maxSpeed:17,  cruiseSpeed:12, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Commercial hexacopter'} },
  { key:'yuneec h520e',      name:'Yuneec H520E',        dim:0.52, mtom:2.000, maxSpeed:20,  cruiseSpeed:14, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Upgraded H520E'} },
  { key:'yuneec h850',       name:'Yuneec H850-RTK',     dim:0.85, mtom:5.800, maxSpeed:20,  cruiseSpeed:15, euClass:'C3',  nrg:{setup:2.0, takeoff:3.5, cruise:2.2, descent:1.8, takeoffMin:2.0, descentMin:2.0, note:'Heavy enterprise hexacopter'} },
  { key:'yuneec mantis',     name:'Yuneec Mantis Q / G', dim:0.25, mtom:0.500, maxSpeed:20,  cruiseSpeed:10, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'Folding travel drone'} },
  
  // --- Autel ---
  { key:'autel evo lite',    name:'Autel EVO Lite+',     dim:0.38, mtom:0.835, maxSpeed:18,  cruiseSpeed:11, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.2, descent:2.6, takeoffMin:1.5, descentMin:1.5, note:'Est. ~40Wh battery, 40min hover'} },
  { key:'autel evo ii',      name:'Autel EVO II Pro',    dim:0.52, mtom:1.150, maxSpeed:20,  cruiseSpeed:12, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Est. 72Wh battery, 42min hover'} },
  { key:'autel evo max 4t',  name:'Autel EVO Max 4T',    dim:0.50, mtom:1.490, maxSpeed:23,  cruiseSpeed:14, euClass:'C2',  nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Est. 79Wh battery, 42min hover'} },
  
  // --- Parrot / Custom ---
  { key:'parrot anafi',      name:'Parrot ANAFI',         dim:0.32, mtom:0.320, maxSpeed:15,  cruiseSpeed:10, euClass:'C1',  nrg:{setup:2.0, takeoff:5.5, cruise:3.5, descent:2.8, takeoffMin:1.0, descentMin:1.0, note:'Est. 26Wh battery, 26min hover'} },
  { key:'parrot anafi ai',   name:'Parrot ANAFI AI',      dim:0.44, mtom:0.915, maxSpeed:15,  cruiseSpeed:10, euClass:'C1',  nrg:{setup:2.0, takeoff:5.0, cruise:3.0, descent:2.5, takeoffMin:1.5, descentMin:1.5, note:'Est. ~56Wh battery, 32min hover'} },
  { key:'custom ardupilot',  name:'Custom / ArduPilot build',  dim:0.60, mtom:2.000, maxSpeed:15, cruiseSpeed:10, euClass:'other', nrg:{setup:2.0, takeoff:4.5, cruise:2.8, descent:2.2, takeoffMin:1.5, descentMin:1.5, note:'Generic multirotor estimate'} },
  
  // --- Fixed-wing ---
  { key:'sensefly ebee x',   name:'senseFly eBee X',           dim:1.16, mtom:1.500, maxSpeed:30,  cruiseSpeed:15, euClass:'C3', type:'fixed-wing', nrg:{setup:1.5, takeoff:8.0, cruise:1.2, descent:1.0, takeoffMin:0.5, descentMin:0.5, note:'Est. ~60Wh battery, 90min endurance. Fixed-wing cruise very efficient'} },
  { key:'ebee geo',          name:'senseFly eBee Geo',         dim:1.16, mtom:1.100, maxSpeed:25,  cruiseSpeed:14, euClass:'C2', type:'fixed-wing', nrg:{setup:1.5, takeoff:8.0, cruise:1.3, descent:1.1, takeoffMin:0.5, descentMin:0.5, note:'Est. ~50Wh battery, 45min endurance'} },
  { key:'ageagle ebee x',    name:'AgEagle eBee X',            dim:1.16, mtom:1.500, maxSpeed:30,  cruiseSpeed:15, euClass:'C3', type:'fixed-wing', nrg:{setup:1.5, takeoff:8.0, cruise:1.2, descent:1.0, takeoffMin:0.5, descentMin:0.5, note:'Same airframe as senseFly eBee X'} },
  { key:'delair ux11',       name:'Delair UX11',               dim:1.10, mtom:1.600, maxSpeed:22,  cruiseSpeed:15, euClass:'C3', type:'fixed-wing', nrg:{setup:1.5, takeoff:7.5, cruise:1.3, descent:1.1, takeoffMin:0.5, descentMin:0.5, note:'Est. ~65Wh battery, 59-80min endurance'} },
  
  // --- VTOL Fixed-wing ---
  { key:'wingtraone',        name:'WingtraOne Gen II (VTOL)',   dim:1.25, mtom:4.800, maxSpeed:18,  cruiseSpeed:16, euClass:'C3', type:'fixed-wing-vtol', nrg:{setup:2.0, takeoff:9.0, cruise:1.5, descent:7.0, takeoffMin:1.0, descentMin:1.0, note:'2×99Wh batteries. VTOL hover ~18%/min'} },
  { key:'wingtraone gen ii', name:'WingtraOne Gen II (VTOL)',   dim:1.25, mtom:4.800, maxSpeed:18,  cruiseSpeed:16, euClass:'C3', type:'fixed-wing-vtol', nrg:{setup:2.0, takeoff:9.0, cruise:1.5, descent:7.0, takeoffMin:1.0, descentMin:1.0, note:'2×99Wh batteries. VTOL hover ~18%/min'} },
  { key:'wingtraray',        name:'WingtraRAY (VTOL)',          dim:1.60, mtom:7.500, maxSpeed:20,  cruiseSpeed:17, euClass:'C3', type:'fixed-wing-vtol', nrg:{setup:2.0, takeoff:8.0, cruise:1.3, descent:6.0, takeoffMin:1.0, descentMin:1.0, note:'Larger VTOL mapper. Estimated values'} },
  { key:'autel dragonfish lite',    name:'Autel Dragonfish Lite',  dim:1.29, mtom:7.500, maxSpeed:30,  cruiseSpeed:20, euClass:'C3', type:'fixed-wing-vtol', nrg:{setup:2.0, takeoff:6.0, cruise:1.2, descent:5.0, takeoffMin:1.5, descentMin:1.5, note:'Tilt-rotor: high power at transition'} },
  { key:'autel dragonfish standard',name:'Autel Dragonfish Standard',dim:1.29,mtom:9.000,maxSpeed:30,  cruiseSpeed:20, euClass:'C3', type:'fixed-wing-vtol', nrg:{setup:2.0, takeoff:6.0, cruise:1.2, descent:5.0, takeoffMin:1.5, descentMin:1.5, note:'Est. ~260Wh combined, 126min endurance'} },
  { key:'autel dragonfish pro',     name:'Autel Dragonfish Pro',   dim:1.29, mtom:9.000, maxSpeed:30,  cruiseSpeed:20, euClass:'C3', type:'fixed-wing-vtol', nrg:{setup:2.0, takeoff:6.0, cruise:1.2, descent:5.0, takeoffMin:1.5, descentMin:1.5, note:'Est. ~260Wh combined, 158-179min endurance'} },
  
  // --- Tactical Fixed-wing / PENGUIN ---
  { key:'penguin b',         name:'Penguin B',                  dim:3.30, mtom:15.00, maxSpeed:30,  cruiseSpeed:18, euClass:'C3', type:'fixed-wing', nrg:{setup:1.0, takeoff:5.0, cruise:1.8, descent:1.5, takeoffMin:2.0, descentMin:2.0, note:'Petrol (EFI) engine: values are fuel-burn indicative.'} },
  { key:'penguin be',        name:'Penguin BE',                 dim:3.30, mtom:21.50, maxSpeed:30,  cruiseSpeed:20, euClass:'C4', type:'fixed-wing', nrg:{setup:1.5, takeoff:6.0, cruise:1.2, descent:1.5, takeoffMin:2.0, descentMin:2.0, note:'Electric propulsion. Endurance ~2 hours.'} },
  { key:'penguin c',         name:'Penguin C',                  dim:3.30, mtom:22.50, maxSpeed:32,  cruiseSpeed:20, euClass:'C4', type:'fixed-wing', nrg:{setup:1.0, takeoff:5.0, cruise:1.5, descent:1.2, takeoffMin:2.0, descentMin:2.0, note:'Petrol (EFI) engine, catapult launch.'} },
  { key:'penguin c mk2',     name:'Penguin C Mk2',              dim:3.30, mtom:22.50, maxSpeed:32,  cruiseSpeed:20, euClass:'C4', type:'fixed-wing', nrg:{setup:1.0, takeoff:5.0, cruise:1.5, descent:1.2, takeoffMin:2.0, descentMin:2.0, note:'Petrol engine, pneumatic catapult.'} },
  { key:'penguin c mk2x',    name:'Penguin C Mk2X',             dim:3.30, mtom:25.00, maxSpeed:32,  cruiseSpeed:22, euClass:'C4', type:'fixed-wing', nrg:{setup:1.0, takeoff:5.0, cruise:1.4, descent:1.1, takeoffMin:2.0, descentMin:2.0, note:'Petrol engine. Values indicative'} },
  { key:'penguin c mk2 vtol',name:'Penguin C Mk2 VTOL',         dim:3.30, mtom:32.00, maxSpeed:32,  cruiseSpeed:20, euClass:'C4', type:'fixed-wing-vtol', nrg:{setup:1.0, takeoff:5.5, cruise:1.5, descent:5.0, takeoffMin:2.0, descentMin:2.0, note:'Hybrid VTOL: petrol cruise + electric lift rotors.'} },
  { key:'custom fixed wing', name:'Custom fixed-wing (ArduPlane)', dim:1.50, mtom:3.000, maxSpeed:25, cruiseSpeed:18, euClass:'other', type:'fixed-wing', nrg:{setup:1.5, takeoff:7.0, cruise:1.5, descent:1.2, takeoffMin:1.0, descentMin:1.0, note:'Generic estimate for electric fixed-wing.'} },
  { key:'custom vtol',       name:'Custom VTOL fixed-wing',     dim:1.50, mtom:5.000, maxSpeed:25,  cruiseSpeed:18, euClass:'other', type:'fixed-wing-vtol', nrg:{setup:2.0, takeoff:8.0, cruise:1.5, descent:6.0, takeoffMin:1.0, descentMin:1.0, note:'Generic VTOL estimate. Hover phases are energy-intensive'} },
];

window.EU_CLASS_MAP = {
  'C0': {maxMtom:0.250, label:'C0 (<250g)'},
  'C1': {maxMtom:0.900, label:'C1 (<900g)'},
  'C2': {maxMtom:4.000, label:'C2 (<4kg)'},
  'C3': {maxMtom:25.0,  label:'C3 (<25kg)'},
  'C4': {maxMtom:25.0,  label:'C4 (<25kg legacy)'},
};

window.osoData = {
  technical: [
    { num: '01', minSail: 'II',  text: 'Operator is competent and/or proven. Checklist, maintenance plan, training programme, defined responsibilities. SAIL IV+: SMS in line with ICAO Annex 19.' },
    { num: '02', minSail: 'III', text: 'UAS manufactured by a competent and/or proven entity. Manufacturing procedures incl. material requirements, traceability, inspection, configuration control.' },
    { num: '03', minSail: 'I',   text: 'UAS maintained by a competent and/or proven entity. Maintenance instructions, log system, qualified personnel, release-to-service.' },
    { num: '04', minSail: 'IV',  text: 'Safety-critical UAS components designed to Airworthiness Design Standard (ADS) e.g. EASA SC-Light-UAS, STANAG 4703 or JARUS CS-LUAS.' },
    { num: '05', minSail: 'I',   text: 'UAS designed with regard to system safety and reliability. Includes former OSO#10 (flight envelope protection). Failure mode analysis, redundancy, safe-state on failure.' },
    { num: '06', minSail: 'II',  text: 'C3 link characteristics (performance, spectrum) are adequate for operationsen. Range, latency, countermeasures against interference, link-loss procedure.' },
    { num: '07', minSail: 'I',   text: 'Configuration control of the UAS completed before each flight. Software version control, hardware inspections, sensor calibration.' },
    { num: '08', minSail: 'I',   text: 'Operational procedures defined, validated and followed. Normal operation, emergency procedures, contingency, pre/post-flight checklists.' },
    { num: '09', minSail: 'I',   text: 'Remote crew is trained and current. Pilot, observer and technicians hold relevant competency certificates, operations-specific training and current validation status.' },
  ],
  org: [
    { num: '13', minSail: 'II',  text: 'External services supporting the UAS operation are adequate (e.g. weather data, UTM services, external power supply). Service Level Agreement (SLA) where applicable.' },
    { num: '16', minSail: 'III', text: 'Multi-crew coordination (MCC). If more than one person is involved in flight operations: defined roles, communication procedures, CRM training.' },
    { num: '17', minSail: 'I',   text: 'Remote crew is fit to operate. Control of rest, health, and fitness for duty. Fitness-for-duty procedure.' },
  ],
  human: [
    { num: '18', minSail: 'III', text: 'Automatic flight envelope protection against human error (e.g. max altitude,eofencing, attitude-restriction). Active system preventing exceedance.' },
    { num: '19', minSail: 'II',  text: 'Safe recovery from human errors. Procedures and/or automation enabling the operator to correct an error without catastrophe (e.g. RTL, hover mode).' },
    { num: '20', minSail: 'III', text: 'Human Factors evaluation completed and HMI (Human-Machine Interface) evaluated as appropriate for the mission. Workload, alerts, display layout.' },
  ],
  environment: [
    { num: '23', minSail: 'I',   text: 'Environmental conditions for safe operation defined, measurable and followeded. Max wind, temperature, humidity, visibility, precipitation limits documented and enforced.' },
    { num: '24', minSail: 'III', text: 'UAS designed and qualified for adverse environmental conditions (e.g. adequate sensors, DO-160 qualification for temperature, vibration, humidity, EMC).' },
  ],
};

window.sailOrder = ['I','II','III','IV','V','VI'];

window.airportRadioDb = {
  // --- STOCKHOLM / MÄLARDALEN ---
  'ESSA': { name: 'Stockholm Arlanda', lat: 59.6519, lon: 17.9186, twr: '118.500', app: '120.600', gnd: '121.650', atis: '118.005', tel: '+46 10 190 40 20' },
  'ESSB': { name: 'Stockholm Bromma', lat: 59.3544, lon: 17.9397, twr: '118.175', app: '120.600', gnd: '121.800', atis: '126.375', tel: '+46 10 190 40 30' },
  'ESKN': { name: 'Stockholm Skavsta', lat: 58.7886, lon: 16.9122, twr: '118.350', app: '119.100', atis: '125.725', tel: '+46 155 28 04 00' },
  'ESOW': { name: 'Stockholm Västerås', lat: 59.5894, lon: 16.6333, twr: '118.275', app: '119.200', atis: '130.550', tel: '+46 21 80 56 00' },
  'ESCM': { name: 'Uppsala/Ärna (Mil)', lat: 59.8975, lon: 17.5886, twr: '119.225', app: '124.150', mil: '119.225' },
  'ESKC': { name: 'Uppsala/Sundbro', lat: 59.9219, lon: 17.5369, info: '123.400' },
  'ESSX': { name: 'Västerås/Johannisberg', lat: 59.5750, lon: 16.4678, info: '123.600' },
  'ESQO': { name: 'Arboga', lat: 59.3886, lon: 15.9233, info: '123.400' },
  'ESSU': { name: 'Eskilstuna/Kjula', lat: 59.3506, lon: 16.7083, info: '123.400' },

  // --- GÖTEBORG / VÄSTKUSTEN ---
  'ESGG': { name: 'Göteborg Landvetter', lat: 57.6628, lon: 12.2797, twr: '118.575', app: '120.575', gnd: '121.700', atis: '128.325', tel: '+46 10 190 40 40' },
  'ESGP': { name: 'Göteborg/Säve', lat: 57.7711, lon: 11.8697, info: '118.100', tel: '+46 31 92 60 00' },
  'ESGT': { name: 'Trollhättan/Vänersborg', lat: 58.3228, lon: 12.3439, info: '118.475', tel: '+46 520 47 47 00' },
  'ESGU': { name: 'Uddevalla/Rörkärr', lat: 58.3589, lon: 12.0406, info: '123.400' },
  'ESGA': { name: 'Backamo', lat: 58.1833, lon: 11.9833, info: '123.400' },
  'ESGQ': { name: 'Borås', lat: 57.6953, lon: 12.8467, info: '123.400' },
  'ESGV': { name: 'Varberg', lat: 57.1428, lon: 12.2319, info: '123.400' },
  'ESGF': { name: 'Falkenberg/Morup', lat: 56.9381, lon: 12.5519, info: '123.400' },
  'ESGL': { name: 'Lidköping/Hovby', lat: 58.4633, lon: 13.1742, info: '123.400' },
  'ESGR': { name: 'Skövde', lat: 58.4558, lon: 13.8825, info: '123.400' },

  // --- SÖDRA SVERIGE ---
  'ESMS': { name: 'Malmö Airport', lat: 55.5293, lon: 13.3667, twr: '118.100', app: '127.275', gnd: '121.700', atis: '127.950', tel: '+46 10 190 40 50' },
  'ESMK': { name: 'Kristianstad', lat: 55.9175, lon: 14.0886, twr: '118.650', info: '118.650' },
  'ESMT': { name: 'Halmstad', lat: 56.6911, lon: 12.8203, twr: '118.050', app: '119.550', tel: '+46 35 18 34 00' },
  'ESTA': { name: 'Ängelholm', lat: 56.2961, lon: 12.8472, twr: '118.800', app: '119.850' },
  'ESMI': { name: 'Söderslätt', lat: 55.4525, lon: 13.0644, info: '123.400' },
  'ESMN': { name: 'Lund/Hasslanda', lat: 55.6797, lon: 13.2103, info: '123.400' },
  'ESME': { name: 'Eslöv', lat: 55.8472, lon: 13.3333, info: '123.400' },
  'ESMG': { name: 'Ljungbyhed', lat: 56.0825, lon: 13.2128, info: '123.400' },
  'ESFA': { name: 'Hässleholm/Bokeberg', lat: 56.1814, lon: 13.6842, info: '123.400' },
  'ESTL': { name: 'Ljungby/Feringe', lat: 56.9189, lon: 13.9214, info: '123.400' },
  'ESMX': { name: 'Växjö/Småland', lat: 56.9242, lon: 14.7317, twr: '118.050' },
  'ESMQ': { name: 'Kalmar', lat: 56.6853, lon: 16.2872, twr: '118.325', info: '118.325', tel: '+46 480 881 10' },
  'ESDF': { name: 'Ronneby (Mil)', lat: 56.2667, lon: 15.2650, twr: '118.350', mil: '119.100', tel: '+46 457 16 30 00' },
  'ESSF': { name: 'Hultsfred', lat: 57.5258, lon: 15.8231, info: '123.400' },

  // --- ÖSTRA / MELLERSTA SVERIGE ---
  'ESSL': { name: 'Linköping/Saab', lat: 58.4017, lon: 15.6822, twr: '118.450', app: '127.800', tel: '+46 13 18 28 00' },
  'ESCF': { name: 'Linköping/Malmen (Mil)', lat: 58.3986, lon: 15.5228, twr: '118.200', mil: '118.200' },
  'ESSP': { name: 'Norrköping/Kungsängen', lat: 58.5853, lon: 16.2503, twr: '118.300', tel: '+46 11 19 27 00' },
  'ESOE': { name: 'Örebro', lat: 59.2238, lon: 15.0394, twr: '118.900', app: '124.350' },
  'ESOK': { name: 'Karlstad', lat: 59.4447, lon: 13.3364, twr: '119.450' },
  'ESSD': { name: 'Borlänge', lat: 60.4219, lon: 15.4394, twr: '118.550' },
  'ESSK': { name: 'Gävle/Sandviken', lat: 60.5931, lon: 16.9536, info: '122.450' },
  'ESMO': { name: 'Oskarshamn', lat: 57.3506, lon: 16.4950, info: '122.050' },
  'ESSV': { name: 'Visby', lat: 57.6628, lon: 18.3461, twr: '118.150', app: '120.450' },
  'ESIB': { name: 'Bunge (Gotland)', lat: 57.8500, lon: 19.0303, info: '123.400' },
  'ESMA': { name: 'Emmaboda', lat: 57.5750, lon: 15.5861, info: '123.400' },

  // --- NORRA SVERIGE ---
  'ESNN': { name: 'Sundsvall-Härnösand', lat: 62.5322, lon: 17.4439, twr: '118.550', info: '118.550', tel: '+46 60 19 80 00' },
  'ESNZ': { name: 'Östersund', lat: 63.1931, lon: 14.5022, twr: '118.050', app: '128.800' },
  'ESNU': { name: 'Umeå', lat: 63.7917, lon: 20.2828, twr: '118.500', app: '119.400', atis: '128.575', tel: '+46 90 14 45 00' },
  'ESNK': { name: 'Kramfors', lat: 63.0483, lon: 17.7686, info: '118.700' },
  'ESND': { name: 'Sveg', lat: 62.0483, lon: 14.4231, info: '122.150' },
  'ESNL': { name: 'Lycksele', lat: 64.5483, lon: 18.7161, twr: '118.800' },
  'ESNV': { name: 'Vilhelmina', lat: 65.5833, lon: 15.8000, info: '122.150' },
  'ESUT': { name: 'Hemavan', lat: 65.8117, lon: 15.0828, info: '122.150' },
  'ESPA': { name: 'Luleå/Kallax (Mil)', lat: 65.5436, lon: 22.1219, twr: '118.250', app: '119.400', atis: '123.650', mil: '118.250', tel: '+46 920 28 71 00' },
  'ESPE': { name: 'Vidsel (Mil)', lat: 65.8758, lon: 20.1508, twr: '122.150', mil: '122.150' },
  'ESNX': { name: 'Arvidsjaur', lat: 65.5900, lon: 19.2819, twr: '118.800' },
  'ESPC': { name: 'Gällivare', lat: 67.1325, lon: 20.8142, info: '122.500' },
  'ESNQ': { name: 'Kiruna', lat: 67.8222, lon: 20.3361, twr: '118.300', app: '119.700', atis: '126.650', tel: '+46 980 121 10' },
  'ESUP': { name: 'Pajala', lat: 67.2411, lon: 23.3931, info: '122.150' },
  'ESUK': { name: 'Kalixfors', lat: 67.7611, lon: 20.2525, info: '123.400' },
  'ESNJ': { name: 'Jokkmokk (Mil)', lat: 66.5653, lon: 19.6736, twr: '118.500' },

  // --- NORDISKA HUVUDFLYGPLATSER ---
  'ENGM': { name: 'Oslo Gardermoen', lat: 60.1939, lon: 11.1004, twr: '118.300', app: '119.200', gnd: '121.600', atis: '127.775', tel: '+47 64 81 20 00' },
  'ENBR': { name: 'Bergen Flesland', lat: 60.2933, lon: 5.2181, twr: '118.300', app: '120.100', gnd: '121.700', atis: '124.300', tel: '+47 67 03 15 00' },
  'EKCH': { name: 'Copenhagen Kastrup', lat: 55.6181, lon: 12.6561, twr: '118.100', app: '119.800', gnd: '121.900', atis: '132.025', tel: '+45 32 47 47 47' },
  'EFHK': { name: 'Helsinki-Vantaa', lat: 60.3172, lon: 24.9633, twr: '118.600', app: '119.100', gnd: '121.800', atis: '135.075', tel: '+358 20 708 2000' }
};