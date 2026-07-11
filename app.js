// --- State ---
let rawSheetData = null;
let optimizedResults = null;
let beatSchedule = [];
let activeWeekLabel = null;
let activeDayName = null;
let map = null;
let markerLayer = null;
let routeLineLayer = null;

// --- Constants ---
const dayColors = {
    Monday: '#3b82f6',
    Tuesday: '#10b981',
    Wednesday: '#ef4444',
    Thursday: '#8b5cf6',
    Friday: '#f59e0b',
    Saturday: '#ec4899'
};
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// --- Calendar: all Mon-Sat days in a full month ---
function getWorkingDays(year, month) {
    const result = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    let allWeeks = [], weekDaysList = [];

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        const dow = date.getDay();
        if (dow === 0) {
            if (weekDaysList.length > 0) { allWeeks.push(weekDaysList); weekDaysList = []; }
        } else {
            weekDaysList.push({ date, dayName: DAY_NAMES[dow], dateStr: MONTH_NAMES[month - 1].slice(0, 3) + ' ' + d });
        }
    }
    if (weekDaysList.length > 0) allWeeks.push(weekDaysList);

    let beatIndex = 0;
    allWeeks.forEach((weekDays, wi) => {
        const weekLabel = 'Week ' + (wi + 1);
        const weekDates = weekDays[0].dateStr + ' - ' + weekDays[weekDays.length - 1].dateStr;
        weekDays.forEach(wd => {
            result.push({ weekLabel, weekDates, dayName: wd.dayName, date: wd.date, dateStr: wd.dateStr, beatIndex });
            beatIndex++;
        });
    });
    return result;
}

// --- Calendar: all Mon-Sat days in a specific date range ---
function getWorkingDaysInRange(startDate, endDate) {
    const result = [];
    let allWeeks = [], weekDaysList = [];
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (cur <= end) {
        const dow = cur.getDay();
        if (dow === 0) {
            // Sunday — close current week
            if (weekDaysList.length > 0) { allWeeks.push(weekDaysList); weekDaysList = []; }
        } else {
            // Mon-Sat
            const d = cur.getDate();
            const mon = cur.getMonth();
            weekDaysList.push({
                date: new Date(cur),
                dayName: DAY_NAMES[dow],
                dateStr: MONTH_NAMES[mon].slice(0, 3) + ' ' + d
            });
        }
        cur.setDate(cur.getDate() + 1);
    }
    if (weekDaysList.length > 0) allWeeks.push(weekDaysList);

    let beatIndex = 0;
    allWeeks.forEach((weekDays, wi) => {
        const weekLabel = 'Week ' + (wi + 1);
        const weekDates = weekDays[0].dateStr + ' - ' + weekDays[weekDays.length - 1].dateStr;
        weekDays.forEach(wd => {
            result.push({ weekLabel, weekDates, dayName: wd.dayName, date: wd.date, dateStr: wd.dateStr, beatIndex });
            beatIndex++;
        });
    });
    return result;
}

// --- Toggle planning mode UI ---
let currentPlanMode = 'full';
function setPlanMode(mode) {
    currentPlanMode = mode;
    const fullBtn = document.getElementById('mode-full-month');
    const rangeBtn = document.getElementById('mode-date-range');
    const fullInput = document.getElementById('input-full-month');
    const rangeInput = document.getElementById('input-date-range');
    if (mode === 'full') {
        fullBtn.classList.add('active'); rangeBtn.classList.remove('active');
        fullInput.classList.remove('hidden'); rangeInput.classList.add('hidden');
    } else {
        rangeBtn.classList.add('active'); fullBtn.classList.remove('active');
        rangeInput.classList.remove('hidden'); fullInput.classList.add('hidden');
    }
}

// --- Show/hide D2R-C2D sub-filter when Distributor is selected ---
function onCustTypeChange(radio) {
    const subFilter = document.getElementById('dist-subfilter');
    if (radio.value === 'DISTRIBUTOR') {
        subFilter.classList.remove('hidden');
    } else {
        subFilter.classList.add('hidden');
        // Reset: check both C2D and D2R when leaving distributor mode
        document.querySelectorAll('input[name="dist-channel"]').forEach(cb => { cb.checked = true; });
    }
}

// --- Download blank template ---
function downloadTemplate() {
    const wb = XLSX.utils.book_new();

    // Row 1: Column headers
    const headers = [
        'Employee Name', 'Code', 'Customer Name', 'Customer Type',
        'Mobile', 'Shop Address', 'PIN Code', 'LAT LONG'
    ];

    // Row 2: Hints only — user fills from row 2 onward with real data
    const guidance = [
        'e.g. Rahul Sharma',
        'e.g. C-1001',
        'e.g. Sunrise Medical Store',
        'Retailer / Chemist / Stockist C2D / Stockist D2R / Stockist CRD',
        'e.g. 9876543210',
        'e.g. 12 MG Road, Bengaluru',
        'e.g. 560001',
        'e.g. 12.9716,77.5946  (optional — leave blank if unknown)'
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, guidance]);
    ws['!cols'] = [
        { wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 22 },
        { wch: 16 }, { wch: 38 }, { wch: 12 }, { wch: 42 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Customer List');

    // Instructions sheet
    const infoData = [
        ['BDE Beat Optimizer — Template Instructions'],
        [''],
        ['REQUIRED COLUMNS', 'Notes'],
        ['Employee Name', 'Name of the BDE/Sales Representative. Used to filter per employee.'],
        ['Code', 'Unique customer code (e.g. C-1001). Must be unique per customer.'],
        ['Customer Name', 'Full name of the shop or outlet.'],
        ['Customer Type', 'One of: Retailer, Chemist, Stockist C2D, Stockist D2R, Stockist CRD'],
        ['Mobile', '10-digit mobile number of the shop owner.'],
        ['Shop Address', 'Full address of the outlet. Used for map display.'],
        ['PIN Code', '6-digit postal PIN code. Used to estimate location if GPS is absent.'],
        ['LAT LONG', 'GPS coordinates as: LATITUDE,LONGITUDE  (e.g. 12.9716,77.5946). Optional.'],
        [''],
        ['CUSTOMER TYPE VALUES', 'Description'],
        ['Retailer', 'Retail chemist / general pharmacist (1 call weight)'],
        ['Chemist', 'Same as Retailer (1 call weight)'],
        ['Stockist C2D', 'Company-to-Distributor stockist (2 call weight)'],
        ['Stockist D2R', 'Distributor-to-Retailer stockist (2 call weight)'],
        ['Stockist CRD', 'Stockist with both C2D and D2R roles (2 call weight)'],
        [''],
        ['HOW TO FILL'],
        ['1. Row 1 is the header — do NOT change the column names.'],
        ['2. Row 2 shows hints — overwrite it with your first real customer record.'],
        ['3. Add one customer per row from Row 2 onward.'],
        ['4. LAT LONG is optional. If blank, the system uses the PIN Code to estimate location.'],
        ['5. Multiple BDEs can be in one sheet — use the Employee filter in the app to plan per BDE.'],
        ['6. Accepted file formats: .xlsx, .xls, .csv'],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
    wsInfo['!cols'] = [{ wch: 22 }, { wch: 75 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions');

    XLSX.writeFile(wb, 'BDE_BeatOptimizer_Template.xlsx');
}

// --- Map ---
function initMap() {
    map = L.map('map', { zoomControl: true, attributionControl: false }).setView([22.7262854, 88.4599546], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    routeLineLayer = L.layerGroup().addTo(map);
}

// --- Status ---
function setStatus(text, type, detail) {
    if (!type) type = 'ready';
    if (!detail) detail = '';
    const dot = document.getElementById('status-dot');
    dot.className = 'status-dot';
    if (type === 'active') dot.classList.add('active');
    if (type === 'error') dot.classList.add('error');
    document.getElementById('status-text').innerText = text;
    document.getElementById('status-detail').innerText = detail;
}

// --- Drag & Drop ---
function setupDragAndDrop(dropzoneId, fileInputId, fileNameId, callback) {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(fileInputId);
    const fileName = document.getElementById(fileNameId);
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => {
        e.preventDefault(); dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) { fileInput.files = e.dataTransfer.files; handleFile(fileInput.files[0], fileName, callback); }
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) handleFile(fileInput.files[0], fileName, callback);
    });
}

function handleFile(file, nameElement, callback) {
    nameElement.innerText = file.name;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws);
            if (json.length === 0) throw new Error('The sheet contains no data.');
            callback(json);
            populateEmployeeDropdown(json);
            checkReadyToOptimize();
        } catch (err) {
            nameElement.innerText = 'Error loading file';
            setStatus('File parse error', 'error', err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function populateEmployeeDropdown(data) {
    const sel = document.getElementById('employee-filter');
    sel.innerHTML = '<option value="__ALL__">All Employees</option>';
    const seen = {}, names = [];
    data.forEach(r => {
        const n = String(r['Employee Name'] || '').trim();
        if (n && !seen[n]) { seen[n] = true; names.push(n); }
    });
    names.sort().forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        sel.appendChild(opt);
    });
}

function checkReadyToOptimize() {
    const btn = document.getElementById('optimize-btn');
    if (rawSheetData) { btn.disabled = false; setStatus('Dataset loaded', 'active', 'Ready to optimize route beats.'); }
    else btn.disabled = true;
}

// --- Normalise ---
function cleanAndNormalize(data) {
    const parsedData = data.map(row => {
        let lat = 0, lon = 0, isImputed = true;
        const ll = String(row['LAT LONG'] || '').trim();
        if (ll && ll.indexOf(',') !== -1) {
            const p = ll.split(',');
            const pLat = parseFloat(p[0]) || 0;
            const pLon = parseFloat(p[1]) || 0;
            if (pLat !== 0 && pLon !== 0) { lat = pLat; lon = pLon; isImputed = false; }
        }
        let weight = 1;
        const ct = String(row['Customer Type'] || '').toUpperCase();
        if (ct.indexOf('STOCKIST') !== -1 || ct.indexOf('DISTRIBUTOR') !== -1 || ct.indexOf('CRD') !== -1) {
            weight = 2; // Max weightage is 2 for any stockist (C2D, D2R, or both)
        }
        return Object.assign({}, row, {
            latitude: lat, longitude: lon, is_imputed: isImputed, call_weight: weight,
            pin_code: String(row['PIN Code'] || '').trim(),
            mobile_clean: String(row['Mobile'] || '').replace(/\D/g, '').trim(),
            address_clean: String(row['Shop Address'] || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()
        });
    });

    const pinStats = {}, sL = { sumLat: 0 }, sO = { sumLon: 0 }, vc = { count: 0 };
    parsedData.forEach(r => {
        if (!r.is_imputed) {
            sL.sumLat += r.latitude; sO.sumLon += r.longitude; vc.count++;
            if (r.pin_code) {
                if (!pinStats[r.pin_code]) pinStats[r.pin_code] = { latSum: 0, lonSum: 0, count: 0 };
                pinStats[r.pin_code].latSum += r.latitude;
                pinStats[r.pin_code].lonSum += r.longitude;
                pinStats[r.pin_code].count++;
            }
        }
    });

    const centerLat = vc.count > 0 ? sL.sumLat / vc.count : 22.5726;
    const centerLon = vc.count > 0 ? sO.sumLon / vc.count : 88.3639;
    const pinCoords = {};
    Object.keys(pinStats).forEach(pin => {
        pinCoords[pin] = { lat: pinStats[pin].latSum / pinStats[pin].count, lon: pinStats[pin].lonSum / pinStats[pin].count };
    });

    return parsedData.map(r => {
        if (r.is_imputed) {
            r.latitude = (r.pin_code && pinCoords[r.pin_code]) ? pinCoords[r.pin_code].lat : centerLat;
            r.longitude = (r.pin_code && pinCoords[r.pin_code]) ? pinCoords[r.pin_code].lon : centerLon;
        }
        return r;
    });
}

// --- Dedup ---
function buildUniqueNodes(data) {
    const nodeMap = new Array(data.length).fill(-1);
    const nodes = [];
    let nextId = 0;

    for (let i = 0; i < data.length; i++) {
        if (nodeMap[i] !== -1) continue;
        const ri = data[i];
        const matches = [];
        for (let j = i; j < data.length; j++) {
            if (nodeMap[j] !== -1) continue;
            const rj = data[j];
            let hit = false;
            if (!ri.is_imputed && !rj.is_imputed && ri.latitude !== 0 && ri.longitude !== 0) {
                if (Math.abs(rj.latitude - ri.latitude) < 1e-4 && Math.abs(rj.longitude - ri.longitude) < 1e-4) hit = true;
            }
            if (ri.mobile_clean && ri.mobile_clean === rj.mobile_clean) hit = true;
            if (ri.address_clean && ri.address_clean === rj.address_clean) hit = true;
            if (hit) matches.push(j);
        }
        matches.forEach(idx => { nodeMap[idx] = nextId; });
        const rows = matches.map(idx => data[idx]);
        const avgLat = rows.reduce((s, r) => s + r.latitude, 0) / rows.length;
        const avgLon = rows.reduce((s, r) => s + r.longitude, 0) / rows.length;
        const uniq = arr => [...new Set(arr.filter(Boolean))].join('; ');
        nodes.push({
            node_id: nextId, latitude: avgLat, longitude: avgLon,
            call_weight: rows.reduce((s, r) => s + r.call_weight, 0),
            Code: uniq(rows.map(r => r['Code'])),
            CustomerName: [...new Set(rows.map(r => r['Customer Name']).filter(Boolean))].join(' / '),
            CustomerType: uniq(rows.map(r => r['Customer Type'])),
            Mobile: uniq(rows.map(r => r['Mobile'])),
            ShopAddress: [...new Set(rows.map(r => r['Shop Address']).filter(Boolean))].join(' | ')
        });
        nextId++;
    }
    return {
        combinedWithNodeId: data.map((r, i) => Object.assign({}, r, { node_id: nodeMap[i] })),
        uniqueNodes: nodes
    };
}

// --- KMeans ---
function runKMeans(nodes, k) {
    const valid = nodes.filter(n => n.latitude !== 0 && n.longitude !== 0);
    const n = valid.length;
    if (n === 0) return { nodeClusterMap: {}, centroids: [] };
    const shuffled = [...valid].sort(() => 0.5 - Math.random());
    let centroids = shuffled.slice(0, Math.min(k, n)).map(p => ({ lat: p.latitude, lon: p.longitude }));
    const assigns = new Array(n).fill(-1);
    let changed = true, iter = 0;
    while (changed && iter < 120) {
        changed = false; iter++;
        for (let i = 0; i < n; i++) {
            const p = valid[i];
            let minD = Infinity, best = 0;
            centroids.forEach((c, ci) => {
                const d = (p.latitude - c.lat) ** 2 + (p.longitude - c.lon) ** 2;
                if (d < minD) { minD = d; best = ci; }
            });
            if (assigns[i] !== best) { assigns[i] = best; changed = true; }
        }
        const sLat = new Array(k).fill(0), sLon = new Array(k).fill(0), cnt = new Array(k).fill(0);
        for (let i = 0; i < n; i++) { sLat[assigns[i]] += valid[i].latitude; sLon[assigns[i]] += valid[i].longitude; cnt[assigns[i]]++; }
        centroids = centroids.map((c, ci) => cnt[ci] > 0 ? { lat: sLat[ci] / cnt[ci], lon: sLon[ci] / cnt[ci] } : c);
    }
    const ncm = {};
    valid.forEach((node, i) => { ncm[node.node_id] = assigns[i]; });
    return { nodeClusterMap: ncm, centroids };
}

// --- Balance Clusters ---
function balanceClusters(nodes, initialMap, centroids, k) {
    const assigns = Object.assign({}, initialMap);
    const totalW = nodes.reduce((s, n) => s + n.call_weight, 0);
    const avgW = totalW / k;
    const tMin = Math.max(20, Math.floor(avgW - 3));
    const tMax = Math.max(25, Math.ceil(avgW + 3));

    for (let iter = 0; iter < 300; iter++) {
        const wts = new Array(k).fill(0);
        nodes.forEach(n => { if (assigns[n.node_id] !== undefined) wts[assigns[n.node_id]] += n.call_weight; });
        let maxC = 0, minC = 0;
        for (let c = 0; c < k; c++) { if (wts[c] > wts[maxC]) maxC = c; if (wts[c] < wts[minC]) minC = c; }
        if ((wts[minC] >= tMin && wts[maxC] <= tMax) || (wts[maxC] - wts[minC] <= 3)) break;

        const maxNodes = nodes.filter(n => assigns[n.node_id] === maxC);
        let bestId = null, bestC = null, bestInc = Infinity;
        maxNodes.forEach(node => {
            const dCur = (node.latitude - centroids[maxC].lat) ** 2 + (node.longitude - centroids[maxC].lon) ** 2;
            for (let c = 0; c < k; c++) {
                if (wts[c] < tMax) {
                    const dNew = (node.latitude - centroids[c].lat) ** 2 + (node.longitude - centroids[c].lon) ** 2;
                    if (dNew - dCur < bestInc) { bestInc = dNew - dCur; bestId = node.node_id; bestC = c; }
                }
            }
        });
        if (bestId !== null) {
            assigns[bestId] = bestC;
            for (let c = 0; c < k; c++) {
                const cn = nodes.filter(n => assigns[n.node_id] === c);
                if (cn.length) centroids[c] = { lat: cn.reduce((s, n) => s + n.latitude, 0) / cn.length, lon: cn.reduce((s, n) => s + n.longitude, 0) / cn.length };
            }
        } else break;
    }
    return { nodeClusterMap: assigns, centroids };
}

// --- TSP ---
function solveTSP(dayNodes) {
    if (dayNodes.length <= 1) return dayNodes;
    const unvisited = [...dayNodes];
    const path = [];
    let startIdx = 0;
    for (let i = 1; i < unvisited.length; i++) { if (unvisited[i].longitude < unvisited[startIdx].longitude) startIdx = i; }
    let cur = unvisited.splice(startIdx, 1)[0];
    path.push(cur);
    while (unvisited.length > 0) {
        let nearIdx = 0, minD = Infinity;
        unvisited.forEach((n, i) => {
            const d = (cur.latitude - n.latitude) ** 2 + (cur.longitude - n.longitude) ** 2;
            if (d < minD) { minD = d; nearIdx = i; }
        });
        cur = unvisited.splice(nearIdx, 1)[0];
        path.push(cur);
    }
    return path;
}

// --- Main Optimize ---
function optimizeRoutes() {
    setStatus('Running optimization...', 'active', 'Analysing date range and balancing daily capacities');

    // Determine beat schedule based on planning mode
    let periodLabel = '';
    if (currentPlanMode === 'full') {
        const monthInput = document.getElementById('beat-month').value;
        const [yearStr, monStr] = (monthInput || '').split('-');
        const year = parseInt(yearStr), mon = parseInt(monStr);
        if (!year || !mon) { setStatus('Missing month', 'error', 'Please select a planning month.'); return; }
        beatSchedule = getWorkingDays(year, mon);
        periodLabel = MONTH_NAMES[mon - 1] + ' ' + year;
    } else {
        const startVal = document.getElementById('beat-start-date').value;
        const endVal = document.getElementById('beat-end-date').value;
        if (!startVal || !endVal) { setStatus('Missing dates', 'error', 'Please select both a start and end date.'); return; }
        const startDate = new Date(startVal);
        const endDate = new Date(endVal);
        if (endDate < startDate) { setStatus('Invalid range', 'error', 'End date must be on or after start date.'); return; }
        beatSchedule = getWorkingDaysInRange(startDate, endDate);
        periodLabel = startVal + ' to ' + endVal;
    }

    const numBeats = beatSchedule.length;
    if (numBeats === 0) { setStatus('No working days', 'error', 'No Mon-Sat days found in the selected period.'); return; }

    // Filters
    const empFilter = document.getElementById('employee-filter').value;
    const custFilter = document.querySelector('input[name="cust-type-filter"]:checked').value;

    let filteredData = rawSheetData;
    if (empFilter !== '__ALL__') {
        filteredData = filteredData.filter(r => String(r['Employee Name'] || '').trim() === empFilter);
    }
    if (custFilter === 'RETAILER') {
        filteredData = filteredData.filter(r => {
            const ct = String(r['Customer Type'] || '').toUpperCase();
            return ct.indexOf('CHEMIST') !== -1 || ct.indexOf('RETAILER') !== -1;
        });
    } else if (custFilter === 'DISTRIBUTOR') {
        // First: keep only stockist/distributor rows
        filteredData = filteredData.filter(r => {
            const ct = String(r['Customer Type'] || '').toUpperCase();
            return ct.indexOf('STOCKIST') !== -1 || ct.indexOf('DISTRIBUTOR') !== -1;
        });

        // Second: collect which channels are checked (multi-select checkboxes)
        const checkedChannels = new Set(
            [...document.querySelectorAll('input[name="dist-channel"]:checked')].map(cb => cb.value)
        );

        // If neither is checked, treat as both selected (no further filter)
        if (checkedChannels.size > 0 && checkedChannels.size < 2) {
            filteredData = filteredData.filter(r => {
                const ct = String(r['Customer Type'] || '').toUpperCase();
                let match = false;
                if (checkedChannels.has('C2D')) {
                    // C2D = Company to Distributor: keyword C2D or CRD in Customer Type
                    if (ct.indexOf('C2D') !== -1 || ct.indexOf('CRD') !== -1) match = true;
                }
                if (checkedChannels.has('D2R')) {
                    // D2R = Distributor to Retailer: keyword D2R in Customer Type
                    if (ct.indexOf('D2R') !== -1) match = true;
                }
                return match;
            });
        }
        // Both checked (or none checked): include all distributor rows, no further filter
    }

    if (filteredData.length === 0) { setStatus('No data after filter', 'error', 'No records match the selected filters.'); return; }

    const normalised = cleanAndNormalize(filteredData);
    const { combinedWithNodeId, uniqueNodes } = buildUniqueNodes(normalised);
    const validNodes = uniqueNodes.filter(n => n.latitude !== 0 && n.longitude !== 0);
    const zeroNodes = uniqueNodes.filter(n => n.latitude === 0 || n.longitude === 0);

    if (validNodes.length === 0) { setStatus('Optimisation Error', 'error', 'No valid coordinates found.'); return; }

    const k = Math.min(numBeats, validNodes.length);
    let nodeClusterMap = {}, centroids = [];
    const coordSet = {};
    validNodes.forEach(n => { coordSet[n.latitude.toFixed(5) + ',' + n.longitude.toFixed(5)] = true; });

    if (Object.keys(coordSet).length < k) {
        validNodes.forEach((node, i) => { nodeClusterMap[node.node_id] = i % k; });
        centroids = new Array(k).fill(null).map((_, c) => {
            const cn = validNodes.filter(n => nodeClusterMap[n.node_id] === c);
            return cn.length ? { lat: cn.reduce((s, n) => s + n.latitude, 0) / cn.length, lon: cn.reduce((s, n) => s + n.longitude, 0) / cn.length } : { lat: 22.5726, lon: 88.3639 };
        });
    } else {
        const r1 = runKMeans(validNodes, k);
        const r2 = balanceClusters(validNodes, r1.nodeClusterMap, r1.centroids, k);
        nodeClusterMap = r2.nodeClusterMap;
        centroids = r2.centroids;
    }

    const centerLat = validNodes.reduce((s, n) => s + n.latitude, 0) / validNodes.length;
    const centerLon = validNodes.reduce((s, n) => s + n.longitude, 0) / validNodes.length;

    const clusterAngles = centroids.map((c, idx) => ({
        angle: Math.atan2(c.lat - centerLat, c.lon - centerLon), origIdx: idx
    })).sort((a, b) => a.angle - b.angle);

    const clusterToBeat = {};
    clusterAngles.forEach((ca, i) => { clusterToBeat[ca.origIdx] = beatSchedule[i % beatSchedule.length]; });

    const nodeWeekMap = {}, nodeDayMap = {}, nodeDateMap = {};
    validNodes.forEach(node => {
        const beat = clusterToBeat[nodeClusterMap[node.node_id]];
        if (beat) { nodeWeekMap[node.node_id] = beat.weekLabel; nodeDayMap[node.node_id] = beat.dayName; nodeDateMap[node.node_id] = beat.dateStr; }
    });
    zeroNodes.forEach(node => {
        nodeWeekMap[node.node_id] = beatSchedule[0].weekLabel;
        nodeDayMap[node.node_id] = beatSchedule[0].dayName;
        nodeDateMap[node.node_id] = beatSchedule[0].dateStr;
    });

    let finalNodes = uniqueNodes.map(n => Object.assign({}, n, {
        week: nodeWeekMap[n.node_id] || beatSchedule[0].weekLabel,
        beat_day: nodeDayMap[n.node_id] || beatSchedule[0].dayName,
        dateStr: nodeDateMap[n.node_id] || beatSchedule[0].dateStr,
        cluster: nodeClusterMap[n.node_id] !== undefined ? nodeClusterMap[n.node_id] : -1
    }));

    const sequenced = [];
    beatSchedule.forEach(beat => {
        const stops = finalNodes.filter(n => n.week === beat.weekLabel && n.beat_day === beat.dayName);
        solveTSP(stops).forEach((stop, i) => { stop.sequence_number = i + 1; sequenced.push(stop); });
    });
    zeroNodes.forEach(n => { n.sequence_number = 99; sequenced.push(n); });
    finalNodes = sequenced;

    const finalRecords = combinedWithNodeId.map(r => {
        const node = finalNodes.find(n => n.node_id === r.node_id);
        return Object.assign({}, r, {
            week: node ? node.week : beatSchedule[0].weekLabel,
            beat_day: node ? node.beat_day : beatSchedule[0].dayName,
            dateStr: node ? node.dateStr : beatSchedule[0].dateStr,
            cluster: node ? node.cluster : -1,
            sequence_number: node ? node.sequence_number : 99
        });
    });
    finalRecords.sort((a, b) => a.sequence_number - b.sequence_number);
    optimizedResults = { finalNodes, finalRecords };

    buildWeekDayTabs();
    document.getElementById('screen-upload').classList.add('hidden');
    document.getElementById('screen-browser').classList.remove('hidden');
    document.getElementById('month-display-badge').textContent = periodLabel + ' · ' + numBeats + ' working days';

    const totalW = validNodes.reduce((s, n) => s + n.call_weight, 0);
    const avgCalls = totalW / k;
    updateDashboard(finalNodes, finalRecords, avgCalls, numBeats);
    renderActiveSelection();
    setStatus('Optimization Complete', 'active', periodLabel + ' | ' + numBeats + ' beats | Avg ' + avgCalls.toFixed(1) + ' calls/day');
}

// --- Build week/day tabs dynamically ---
function buildWeekDayTabs() {
    const weeksMap = {};
    const weeksOrder = [];
    beatSchedule.forEach(b => {
        if (!weeksMap[b.weekLabel]) { weeksMap[b.weekLabel] = b.weekDates; weeksOrder.push(b.weekLabel); }
    });

    const weekTabsEl = document.getElementById('week-tabs-container');
    weekTabsEl.innerHTML = '';
    weeksOrder.forEach((wl, i) => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (i === 0 ? ' active' : '');
        btn.setAttribute('data-week', wl);
        btn.innerHTML = wl + '<span class="week-dates">' + weeksMap[wl] + '</span>';
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeWeekLabel = wl;
            const firstDay = beatSchedule.find(b => b.weekLabel === wl);
            if (firstDay) { activeDayName = firstDay.dayName; buildDayTabs(wl); }
            renderActiveSelection();
        });
        weekTabsEl.appendChild(btn);
    });

    activeWeekLabel = weeksOrder[0];
    buildDayTabs(activeWeekLabel);
}

function buildDayTabs(weekLabel) {
    const daysInWeek = beatSchedule.filter(b => b.weekLabel === weekLabel);
    const dayTabsEl = document.getElementById('day-tabs-container');
    dayTabsEl.innerHTML = '';
    daysInWeek.forEach((beat, i) => {
        const btn = document.createElement('button');
        btn.className = 'day-btn' + (i === 0 ? ' active' : '');
        btn.setAttribute('data-week', beat.weekLabel);
        btn.setAttribute('data-day', beat.dayName);
        btn.textContent = beat.dayName.slice(0, 3) + ' ' + beat.date.getDate();
        btn.addEventListener('click', () => {
            document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeDayName = beat.dayName;
            activeWeekLabel = beat.weekLabel;
            renderActiveSelection();
        });
        dayTabsEl.appendChild(btn);
    });
    if (!activeDayName && daysInWeek.length > 0) activeDayName = daysInWeek[0].dayName;
}

// --- Dashboard ---
function updateDashboard(nodes, records, avgCalls, workingDays) {
    document.getElementById('stat-total-records').innerText = records.length;
    document.getElementById('stat-unique-stops').innerText = nodes.length;
    document.getElementById('stat-avg-calls').innerText = avgCalls.toFixed(1);
    document.getElementById('stat-working-days').innerText = workingDays;
    document.getElementById('dashboard-panel').style.display = 'flex';
}

// --- Render active day ---
function renderActiveSelection() {
    if (!optimizedResults || !activeWeekLabel || !activeDayName) return;
    const nodes = optimizedResults.finalNodes;
    const filtered = nodes.filter(n => n.week === activeWeekLabel && n.beat_day === activeDayName)
        .sort((a, b) => a.sequence_number - b.sequence_number);

    markerLayer.clearLayers();
    routeLineLayer.clearLayers();
    const oldLegend = document.querySelector('.map-legend');
    if (oldLegend) oldLegend.remove();

    const bounds = [], lineCoords = [];
    const color = dayColors[activeDayName] || '#6b7280';

    filtered.forEach(node => {
        if (node.latitude === 0 || node.longitude === 0) return;
        const icon = L.divIcon({
            html: '<div style="background-color:' + color + ';width:26px;height:26px;border-radius:50%;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,.2);display:flex;justify-content:center;align-items:center;font-size:11px;font-weight:700;color:white;">' + node.sequence_number + '</div>',
            className: 'custom-leaflet-icon',
            iconSize: [26, 26]
        });
        const popupHtml =
            '<div style="font-family:Outfit,sans-serif;font-size:.85rem;color:#1e293b;">' +
            '<h4 style="margin-bottom:4px;color:' + color + ';font-weight:600;">Stop #' + node.sequence_number + ': ' + node.CustomerName + '</h4>' +
            '<p><b>Code:</b> ' + node.Code + '</p>' +
            '<p><b>Type:</b> ' + node.CustomerType + '</p>' +
            '<p><b>Call Weight:</b> ' + node.call_weight + ' calls</p>' +
            '<p><b>Date:</b> ' + (node.dateStr || activeDayName) + '</p>' +
            '<p><b>Address:</b> ' + (node.ShopAddress || 'N/A') + '</p></div>';

        markerLayer.addLayer(L.marker([node.latitude, node.longitude], { icon }).bindPopup(popupHtml));
        bounds.push([node.latitude, node.longitude]);
        lineCoords.push([node.latitude, node.longitude]);
    });

    if (lineCoords.length > 1) {
        routeLineLayer.addLayer(L.polyline(lineCoords, { color, weight: 3, opacity: 0.6, dashArray: '5, 8' }));
    }
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });

    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML =
            '<strong style="display:block;margin-bottom:6px;font-size:12px;color:#1e293b;">' + activeWeekLabel + ' - ' + activeDayName + '</strong>' +
            '<div class="legend-item"><span class="legend-color" style="background-color:' + color + ';"></span>' +
            '<span style="color:#64748b;">' + activeDayName + ' (' + filtered.length + ' Stops)</span></div>' +
            '<div style="font-size:10px;color:#94a3b8;margin-top:4px;border-top:1px solid #f1f5f9;padding-top:4px;">Start: Stop #1 | End: Stop #' + filtered.length + '</div>';
        return div;
    };
    legend.addTo(map);

    const list = document.getElementById('stops-list');
    list.innerHTML = '';
    let totalCalls = 0;
    filtered.forEach((node, idx) => {
        totalCalls += node.call_weight;
        const c2 = dayColors[node.beat_day] || color;
        const isStart = idx === 0, isEnd = idx === filtered.length - 1;
        let badge = '';
        if (isStart) badge = '<span style="background:#22c55e;color:white;padding:1px 6px;border-radius:4px;font-size:.65rem;font-weight:700;margin-right:6px;">STARTING CALL</span>';
        if (isEnd) badge = '<span style="background:#ef4444;color:white;padding:1px 6px;border-radius:4px;font-size:.65rem;font-weight:700;margin-right:6px;">ENDING CALL</span>';
        const card = document.createElement('div');
        card.className = 'stop-item-card';
        card.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span style="font-weight:700;color:' + c2 + ';font-size:.9rem;">#' + node.sequence_number + '</span><div>' + badge + '</div></div>' +
            '<div class="stop-item-title">' + node.CustomerName + '</div>' +
            '<div class="stop-item-meta"><span>Code: ' + node.Code + '</span>' +
            '<span class="stop-item-badge" style="background:' + c2 + '15;color:' + c2 + ';">' + node.CustomerType + '</span></div>' +
            '<div style="font-size:.75rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 ' + (node.ShopAddress || 'No Address') + '</div>' +
            '<div style="font-size:.75rem;font-weight:600;color:' + c2 + ';">📞 Call Weight: ' + node.call_weight + '</div>';
        list.appendChild(card);
    });
    document.getElementById('stops-count').innerText = filtered.length;
    document.getElementById('calls-count').innerText = totalCalls;
}

// --- Download Excel ---
function downloadExcel() {
    if (!optimizedResults) return;
    const wb = XLSX.utils.book_new();
    const rows = optimizedResults.finalRecords.map(r => {
        const out = Object.assign({}, r);
        ['latitude', 'longitude', 'mobile_clean', 'address_clean', 'is_imputed'].forEach(k => delete out[k]);
        const aliases = { node_id: 'Node ID', week: 'Week Cycle', beat_day: 'Beat Day', dateStr: 'Beat Date', cluster: 'Cluster ID', call_weight: 'Call Weight', sequence_number: 'Daily Call Sequence' };
        const mapped = {};
        Object.keys(out).forEach(key => { mapped[aliases[key] || key] = out[key]; });
        return mapped;
    });

    const beatOrder = {};
    beatSchedule.forEach((b, i) => { beatOrder[b.weekLabel + '|' + b.dayName] = i; });
    rows.sort((a, b) => {
        const oA = beatOrder[(a['Week Cycle'] || '') + '|' + (a['Beat Day'] || '')] || 999;
        const oB = beatOrder[(b['Week Cycle'] || '') + '|' + (b['Beat Day'] || '')] || 999;
        return oA !== oB ? oA - oB : ((a['Daily Call Sequence'] || 0) - (b['Daily Call Sequence'] || 0));
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Optimized Beats');

    const seen = {}, summaryRows = [];
    beatSchedule.forEach(b => {
        const key = b.weekLabel + '|' + b.dayName;
        if (seen[key]) return; seen[key] = true;
        const dayNodes = optimizedResults.finalNodes.filter(n => n.week === b.weekLabel && n.beat_day === b.dayName);
        summaryRows.push({ Week: b.weekLabel, Date: b.dateStr, Day: b.dayName, Stops: dayNodes.length, 'Total Calls': dayNodes.reduce((s, n) => s + n.call_weight, 0) });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Daily Summary');

    const mp = document.getElementById('beat-month').value.split('-');
    const mname = MONTH_NAMES[parseInt(mp[1]) - 1] || 'Month';
    XLSX.writeFile(wb, 'BDE_BeatPlan_' + mname + '_' + mp[0] + '.xlsx');
}

// --- Event Wiring ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setStatus('Ready', 'ready', 'Upload files to begin');

    const now = new Date();
    const yy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    document.getElementById('beat-month').value = yy + '-' + mm;

    // Default date range = first to last day of current month
    const firstDay = new Date(yy, now.getMonth(), 1);
    const lastDay = new Date(yy, now.getMonth() + 1, 0);
    const toISO = d => d.toISOString().slice(0, 10);
    document.getElementById('beat-start-date').value = toISO(firstDay);
    document.getElementById('beat-end-date').value = toISO(lastDay);

    setupDragAndDrop('beat-dropzone', 'beat-file', 'beat-file-name', data => { rawSheetData = data; });
    document.getElementById('optimize-btn').addEventListener('click', optimizeRoutes);
    document.getElementById('download-btn').addEventListener('click', downloadExcel);

    document.getElementById('back-upload-btn').addEventListener('click', () => {
        document.getElementById('screen-browser').classList.add('hidden');
        document.getElementById('dashboard-panel').style.display = 'none';
        document.getElementById('screen-upload').classList.remove('hidden');

        rawSheetData = null; optimizedResults = null; beatSchedule = [];
        activeWeekLabel = null; activeDayName = null;
        document.getElementById('beat-file-name').innerText = 'No file loaded';
        document.getElementById('beat-file').value = '';
        document.getElementById('optimize-btn').disabled = true;
        document.getElementById('employee-filter').innerHTML = '<option value="__ALL__">All Employees</option>';
        const allRadio = document.querySelector('input[name="cust-type-filter"][value="ALL"]');
        if (allRadio) allRadio.checked = true;

        setStatus('Ready', 'ready', 'Upload files to begin');
        markerLayer.clearLayers();
        routeLineLayer.clearLayers();
        const ol = document.querySelector('.map-legend');
        if (ol) ol.remove();
    });
});
