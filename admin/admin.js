const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycbxV5iYwbY8xBoMnki_N8qKosRk2mu9kukqm8Hqg4quYT6OtFLJyYiQi_rnXTEdjzTr9/exec"; 

let masterRecordsCache = [];
let lastDataHashStr = ""; // Direct memory block footprint to prevent UI resetting anomalies
let dashboardViewMode = "registration"; 
let activeAttendanceDomainTab = "Human Behaviour & Civic Innovation"; 
let expandedCollegesMap = {};           
let activeDayFilterScope = null;        

let systemConfigState = {
  regularPrice: 1000,
  earlyBirdPrice: 500,
  accommodationPrice: 300,
  earlyBirdModeActive: false
};

window.onload = () => {
  handleStructuralViewLayoutAlterators();

  // Instant Bootstrapping from Local Cache
  const cachedLocalRecordDataString = localStorage.getItem('aunsf_master_system_cache');
  if (cachedLocalRecordDataString) {
    try {
      masterRecordsCache = JSON.parse(cachedLocalRecordDataString);
      lastDataHashStr = localStorage.getItem('aunsf_master_hash') || "";
      calculateSystemMetricsAndDistributions();
      buildDynamicAlphaSortedFilterDropdowns();
      renderTargetedDataGrid();
    } catch (err) { console.error("Cache read bypassed: ", err); }
  }

  // Bind Event Listeners
  document.getElementById('refreshBtn').addEventListener('click', () => synchronizeCloudLedger(false));
  document.getElementById('exportCsvBtn').addEventListener('click', () => processCsvExportTask("GLOBAL_ALL"));
  document.getElementById('clearFiltersBtn').addEventListener('click', clearAllActiveFilters);
  document.getElementById('btnResetScopeBypass').addEventListener('click', clearDayTimelineScopeBypass);
  document.getElementById('saveConfigBtn').addEventListener('click', dispatchConfigUpdateToServer);

  setupModeButtonsViewRoutingControlEngine();
  setupAttendanceDomainTabEngine();

  ['searchInput', 'filterStatus', 'filterCollege', 'filterBranch', 'filterYear', 'filterDomain'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTargetedDataGrid);
    document.getElementById(id).addEventListener('input', renderTargetedDataGrid);
  });

  // Execute Immediate Foreground Sync Pipeline
  synchronizeCloudLedger(false);
  
  // Set Rapid 5-Second Background Poll (Sub-second delta rendering)
  setInterval(() => { synchronizeCloudLedger(true); }, 5000);
};

async function synchronizeCloudLedger(isSilentBackgroundPoll = false) {
  const btn = document.getElementById('refreshBtn');
  if (!isSilentBackgroundPoll) {
    btn.disabled = true;
    btn.innerText = "🔍 Syncing...";
  }
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "getRecords" })
    });
    const parsedResult = await response.json();
    if (parsedResult.status === "success") {
      
      // Compute footprint hash based on string size and array parameters
      const incomingDataHash = JSON.stringify(parsedResult.records).length + "_" + parsedResult.records.length;
      
      masterRecordsCache = parsedResult.records;
      localStorage.setItem('aunsf_master_system_cache', JSON.stringify(masterRecordsCache));
      localStorage.setItem('aunsf_master_hash', incomingDataHash);
      
      // FIXED CONFIG REVERTING BUG: Only pull price structures if a foreground refresh is requested 
      // or if you are not currently focusing on an editing operation
      if (parsedResult.config && (!isSilentBackgroundPoll || document.activeElement.tagName !== "INPUT")) {
        systemConfigState = parsedResult.config;
        updateConfigFieldsInAdminUI();
      }
      
      // SPEED FIX: Only force the browser to repaint the DOM elements if new data row entries exist
      if (incomingDataHash !== lastDataHashStr || !isSilentBackgroundPoll) {
        lastDataHashStr = incomingDataHash;
        buildDynamicAlphaSortedFilterDropdowns();
        calculateSystemMetricsAndDistributions();
        renderTargetedDataGrid();
      }
    }
  } catch (error) { console.error("Sync channel timeout latency: ", error); }
  finally {
    if (!isSilentBackgroundPoll) {
      btn.innerText = "🔄 Refresh";
      btn.disabled = false;
    }
  }
}

function updateConfigFieldsInAdminUI() {
  const regInput = document.getElementById('regularPriceInput');
  const ebInput = document.getElementById('earlyBirdPriceInput');
  const accomInput = document.getElementById('accommodationPriceInput');
  const toggleInput = document.getElementById('earlyBirdModeToggle');

  if (document.activeElement !== regInput) regInput.value = systemConfigState.regularPrice;
  if (document.activeElement !== ebInput) ebInput.value = systemConfigState.earlyBirdPrice;
  if (document.activeElement !== accomInput) accomInput.value = systemConfigState.accommodationPrice;
  if (document.activeElement !== toggleInput) toggleInput.checked = systemConfigState.earlyBirdModeActive;
}

async function dispatchConfigUpdateToServer() {
  const saveBtn = document.getElementById('saveConfigBtn');
  saveBtn.disabled = true;
  saveBtn.innerText = "Saving...";

  const payload = {
    action: "updateConfig",
    regularPrice: parseInt(document.getElementById('regularPriceInput').value, 10) || 0,
    earlyBirdPrice: parseInt(document.getElementById('earlyBirdPriceInput').value, 10) || 0,
    accommodationPrice: parseInt(document.getElementById('accommodationPriceInput').value, 10) || 0,
    earlyBirdModeActive: document.getElementById('earlyBirdModeToggle').checked
  };

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.status === "success") {
      alert("✨ Price structure updated and flushed to core sheets!");
      synchronizeCloudLedger(false);
    }
  } catch (error) { alert("Config Save Exception: " + error.toString()); }
  finally { saveBtn.disabled = false; saveBtn.innerText = "💾 Save Configurations"; }
}

function setupModeButtonsViewRoutingControlEngine() {
  const routingMap = { 'btnRegMode': 'registration', 'btnLookoverMode': 'attendance', 'btnRevenueMode': 'revenue' };
  Object.keys(routingMap).forEach(btnId => {
    document.getElementById(btnId).addEventListener('click', (e) => {
      Object.keys(routingMap).forEach(id => {
        document.getElementById(id).className = "view-mode-btn bg-slate-800 text-slate-400 hover:bg-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl transition tracking-wide cursor-pointer whitespace-nowrap";
      });
      e.target.className = "view-mode-btn bg-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition tracking-wide cursor-pointer whitespace-nowrap";
      dashboardViewMode = routingMap[btnId];
      handleStructuralViewLayoutAlterators();
    });
  });
}

function setupAttendanceDomainTabEngine() {
  const buttonsMap = {
    'btnDomainBlueEco': 'Blue Economy',
    'btnDomainMindspace': 'Human Behaviour & Civic Innovation',
    'btnDomainArtsCulture': 'Arts & Culture'
  };

  Object.keys(buttonsMap).forEach(id => {
    document.getElementById(id).addEventListener('click', (e) => {
      Object.keys(buttonsMap).forEach(bId => {
        document.getElementById(bId).className = "bg-slate-800 text-slate-400 hover:bg-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap";
      });
      e.target.className = "bg-purple-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition cursor-pointer whitespace-nowrap";
      activeAttendanceDomainTab = buttonsMap[id];
      renderTargetedDataGrid();
    });
  });

  document.getElementById('exportCsvBlueEcoBtn').addEventListener('click', () => processCsvExportTask("Blue Economy"));
  document.getElementById('exportCsvMindspaceBtn').addEventListener('click', () => processCsvExportTask("Human Behaviour & Civic Innovation"));
  document.getElementById('exportCsvArtsCultureBtn').addEventListener('click', () => processCsvExportTask("Arts & Culture"));
}

function handleStructuralViewLayoutAlterators() {
  const sidebar = document.getElementById('sidebarArea');
  const metricsGrid = document.getElementById('metricsCountersGrid');
  const toolbarContainer = document.getElementById('filterToolbarContainer');
  const attendanceTabsBlock = document.getElementById('attendanceDomainTabsContainer');

  if (dashboardViewMode === "revenue") {
    sidebar.classList.remove('hidden'); metricsGrid.classList.add('hidden'); toolbarContainer.classList.add('hidden'); attendanceTabsBlock.classList.add('hidden');
  } else if (dashboardViewMode === "attendance") {
    sidebar.classList.add('hidden'); metricsGrid.classList.remove('hidden'); toolbarContainer.className = toolbarContainer.className.replace("hidden", "").trim(); attendanceTabsBlock.classList.remove('hidden');
  } else {
    sidebar.classList.add('hidden'); metricsGrid.classList.remove('hidden'); toolbarContainer.className = toolbarContainer.className.replace("hidden", "").trim(); attendanceTabsBlock.classList.add('hidden');
  }
  renderTargetedDataGrid();
}

function filterByRegistrationDateTimelineScope(targetDateKey) { activeDayFilterScope = targetDateKey; renderTargetedDataGrid(); }
function clearDayTimelineScopeBypass() { activeDayFilterScope = null; renderTargetedDataGrid(); }
function clearAllActiveFilters() {
  document.getElementById('searchInput').value = ""; document.getElementById('filterStatus').value = "All";
  document.getElementById('filterCollege').value = "All"; document.getElementById('filterBranch').value = "All";
  document.getElementById('filterYear').value = "All"; document.getElementById('filterDomain').value = "All";
  activeDayFilterScope = null; renderTargetedDataGrid();
}

function buildDynamicAlphaSortedFilterDropdowns() {
  const collegeDropdownElement = document.getElementById('filterCollege');
  const branchDropdownElement = document.getElementById('filterBranch');
  const currentlySelectedCollege = collegeDropdownElement.value;
  const currentlySelectedBranch = branchDropdownElement.value;
  
  let trackedUniqueCollegesSet = new Set(); 
  let trackedUniqueBranchesSet = new Set();
  
  for (let i = 0; i < masterRecordsCache.length; i++) {
    let r = masterRecordsCache[i];
    if (r.college) trackedUniqueCollegesSet.add(r.college.trim().toUpperCase());
    if (r.branch) trackedUniqueBranchesSet.add(r.branch.trim().toUpperCase());
  }

  const sortedCollegesArray = Array.from(trackedUniqueCollegesSet).sort((a, b) => a.localeCompare(b));
  const sortedBranchesArray = Array.from(trackedUniqueBranchesSet).sort((a, b) => a.localeCompare(b));
  
  collegeDropdownElement.innerHTML = '<option value="All">All Institutions</option>' + sortedCollegesArray.map(c => `<option value="${c}">${c}</option>`).join('');
  branchDropdownElement.innerHTML = '<option value="All">All Specializations</option>' + sortedBranchesArray.map(b => `<option value="${b}">${b}</option>`).join('');
  
  if (sortedCollegesArray.includes(currentlySelectedCollege)) collegeDropdownElement.value = currentlySelectedCollege;
  if (sortedBranchesArray.includes(currentlySelectedBranch)) branchDropdownElement.value = currentlySelectedBranch;
}

function toggleCollegeDrilldownView(collegeKey) { expandedCollegesMap[collegeKey] = !expandedCollegesMap[collegeKey]; calculateSystemMetricsAndDistributions(); }

function calculateSystemMetricsAndDistributions() {
  const totalCount = masterRecordsCache.length;
  let pendingCount = 0, approvedCount = 0, rejectedCount = 0, checkedInCount = 0, aggregateRevenueCalculated = 0;

  let colRevMap = {}, brCountMap = {}, yrCountMap = {}, domRevMap = {}, trendTotalMap = {}, trendApprovedMap = {};
  let nestedBranchRevPool = {}, nestedYearRevPool = {};   

  for (let i = 0; i < masterRecordsCache.length; i++) {
    let r = masterRecordsCache[i];
    if (r.status === 'Duplicate') continue;

    if (r.status === 'Pending') pendingCount++;
    if (r.status === 'Approved' || r.status === 'Checked-in') approvedCount++;
    if (r.status === 'Rejected') rejectedCount++;
    if (r.status === 'Checked-in') checkedInCount++;

    const cleanColKey = (r.college || 'N/A').trim().toUpperCase();
    const cleanBrKey = (r.branch || 'N/A').trim().toUpperCase();
    const cleanYrKey = "YEAR " + (r.year || 'N/A').toString().trim().toUpperCase();
    const cleanDomKey = (r.domainSelection || 'UNASSIGNED').trim();
    const isApprovedUser = (r.status === 'Approved' || r.status === 'Checked-in');
    const userInstanceCost = parseInt(r.amountReceived, 10) || 0;

    if (isApprovedUser) {
      aggregateRevenueCalculated += userInstanceCost;
      colRevMap[cleanColKey] = (colRevMap[cleanColKey] || 0) + userInstanceCost;
      brCountMap[cleanBrKey] = (brCountMap[cleanBrKey] || 0) + userInstanceCost;
      yrCountMap[cleanYrKey] = (yrCountMap[cleanYrKey] || 0) + userInstanceCost;
      domRevMap[cleanDomKey] = (domRevMap[cleanDomKey] || 0) + userInstanceCost;

      if (!nestedBranchRevPool[cleanColKey]) nestedBranchRevPool[cleanColKey] = {};
      nestedBranchRevPool[cleanColKey][cleanBrKey] = (nestedBranchRevPool[cleanColKey][cleanBrKey] || 0) + userInstanceCost;

      const compositeYearKey = `${cleanColKey}_${cleanBrKey}_${cleanYrKey}`;
      nestedYearRevPool[compositeYearKey] = (nestedYearRevPool[compositeYearKey] || 0) + userInstanceCost;
    }

    let dateKey = r.dateOfReg || "N/A";
    trendTotalMap[dateKey] = (trendTotalMap[dateKey] || 0) + 1;
    if (isApprovedUser) {
      trendApprovedMap[dateKey] = (trendApprovedMap[dateKey] || 0) + userInstanceCost;
    }
  }

  document.getElementById('countTotal').innerText = totalCount;
  document.getElementById('countPending').innerText = pendingCount;
  document.getElementById('countApproved').innerText = approvedCount;
  document.getElementById('countCheckedIn').innerText = checkedInCount;
  document.getElementById('revenueCollected').innerText = "₹" + aggregateRevenueCalculated.toLocaleString('en-IN');

  document.getElementById('distributionCollegeArea').innerHTML = Object.keys(colRevMap).sort().map(colKey => {
    const isExpanded = !!expandedCollegesMap[colKey];
    let drilldownHtml = "";
    if (isExpanded && nestedBranchRevPool[colKey]) {
      drilldownHtml = `<div class="bg-slate-900/60 p-2 mt-1 rounded-xl border border-slate-700/40 space-y-1 text-[10px]">`;
      Object.keys(nestedBranchRevPool[colKey]).sort().forEach(branchKey => {
        drilldownHtml += `<div class="font-bold border-b border-slate-800/40 text-slate-300 flex justify-between"><span>📌 ${branchKey}</span><span class="text-purple-400">₹${nestedBranchRevPool[colKey][branchKey]}</span></div>`;
      });
      drilldownHtml += `</div>`;
    }
    return `<div class="border-b border-slate-700/30 py-1"><div onclick="toggleCollegeDrilldownView('${colKey}')" class="flex justify-between cursor-pointer text-slate-300 text-xs"><span>${isExpanded ? '▼' : '▶'} ${colKey}</span><span class="text-blue-400 font-bold">₹${colRevMap[colKey]}</span></div>${drilldownHtml}</div>`;
  }).join('');

  document.getElementById('distributionBranchArea').innerHTML = Object.keys(brCountMap).sort().map(k => `<div class="flex justify-between py-0.5 text-slate-300"><span>${k}</span><span class="text-purple-400">₹${brCountMap[k]}</span></div>`).join('');
  document.getElementById('distributionYearArea').innerHTML = Object.keys(yrCountMap).sort().map(k => `<div class="flex justify-between py-0.5 text-slate-300"><span>${k}</span><span class="text-emerald-400">₹${yrCountMap[k]}</span></div>`).join('');
  document.getElementById('distributionDomainArea').innerHTML = Object.keys(domRevMap).sort().map(k => `<div class="flex justify-between py-0.5 text-slate-300 uppercase text-[10px]"><span>${k}</span><span class="text-purple-400 font-bold">₹${domRevMap[k]}</span></div>`).join('');
  document.getElementById('distributionTrendsArea').innerHTML = Object.keys(trendTotalMap).map(k => `<div onclick="filterByRegistrationDateTimelineScope('${k}')" class="flex justify-between py-1 border-b border-slate-700/20 cursor-pointer text-slate-300"><span>${k} (${trendTotalMap[k]})</span><span class="text-emerald-400">₹${trendApprovedMap[k] || 0}</span></div>`).join('');
}

function renderTargetedDataGrid() {
  const headBlock = document.getElementById('tableHeaderBlock');
  const bodyBlock = document.getElementById('tableBodyBlock');
  
  const queryValue = document.getElementById('searchInput').value.toLowerCase().trim();
  const statusFilterValue = document.getElementById('filterStatus').value;
  const collegeFilterValue = document.getElementById('filterCollege').value;
  const branchFilterValue = document.getElementById('filterBranch').value;
  const yearFilterValue = document.getElementById('filterYear').value;
  const domainFilterValue = document.getElementById('filterDomain').value;

  let filteredRecordDataset = masterRecordsCache.filter(row => {
    if (activeDayFilterScope && row.dateOfReg !== activeDayFilterScope) return false;
    if (dashboardViewMode === "attendance") {
      if (row.status !== "Approved" && row.status !== "Checked-in") return false;
      if (row.domainSelection !== activeAttendanceDomainTab) return false;
    } else if (dashboardViewMode === "revenue") {
      if (row.status !== "Approved" && row.status !== "Checked-in") return false;
    } else {
      if (statusFilterValue !== "All") {
        if (statusFilterValue === "Approved" && row.status !== "Approved" && row.status !== "Checked-in") return false;
        if (statusFilterValue !== "Approved" && row.status !== statusFilterValue) return false;
      }
    }
    if (collegeFilterValue !== "All" && row.college !== collegeFilterValue) return false;
    if (branchFilterValue !== "All" && row.branch !== branchFilterValue) return false;
    if (yearFilterValue !== "All" && row.year.toString() !== yearFilterValue.toString()) return false;
    if (domainFilterValue !== "All" && row.domainSelection !== domainFilterValue) return false;
    
    if (queryValue) {
      return [row.regId, row.fullName, row.email, row.phone, row.college, row.branch, row.utr, row.idCardNumber]
        .join(" ").toLowerCase().includes(queryValue);
    }
    return true;
  });

  const cohortLabels = { "1": "FRESHER", "2": "SOPHOMORE", "3": "JUNIOR", "4": "SENIOR" };

  if (dashboardViewMode === "revenue") {
    headBlock.innerHTML = `<tr class="bg-slate-900/40 text-slate-400 text-[11px] font-bold"><th class="px-4 py-3">Ticket ID</th><th class="px-4 py-3">Paying Participant</th><th class="px-4 py-3">Institution</th><th class="px-4 py-3 text-center">Year</th><th class="px-4 py-3">Domain Track</th><th class="px-4 py-3 text-center">Accom.</th><th class="px-4 py-3">Transaction UTR</th><th class="px-4 py-3 text-right pr-6">Amount</th></tr>`;
    bodyBlock.innerHTML = filteredRecordDataset.map(user => `
      <tr class="hover:bg-slate-950/20 border-b border-slate-800/40 text-xs">
        <td class="px-4 py-3 font-mono font-bold text-slate-200 select-all">${user.regId}</td>
        <td class="px-4 py-3"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono">${user.email}</div></td>
        <td class="px-4 py-3 uppercase font-bold">${user.college} <span class="text-slate-500 font-normal">[${user.branch}]</span></td>
        <td class="px-4 py-3 text-center font-bold">${cohortLabels[user.year] || "UNKNOWN"}</td>
        <td class="px-4 py-3 truncate max-w-[150px]">${user.domainSelection}</td>
        <td class="px-4 py-3 text-center ${user.accommodation === 'YES' ? 'text-emerald-400' : 'text-slate-500'}">${user.accommodation}</td>
        <td class="px-4 py-3 font-mono select-all">${user.utr}</td>
        <td class="px-4 py-3 text-right font-mono text-purple-400 font-black pr-6">₹${user.amountReceived}</td>
      </tr>`).join('');

  } else if (dashboardViewMode === "registration") {
    headBlock.innerHTML = `<tr class="bg-slate-900/40 text-slate-400 text-[11px] font-bold"><th class="px-4 py-3">Ticket ID</th><th class="px-4 py-3">Participant Details</th><th class="px-4 py-3">College / Year</th><th class="px-4 py-3">Domain Selection</th><th class="px-4 py-3 text-center">Accom.</th><th class="px-4 py-3">UTR / Verification Links</th><th class="px-4 py-3 text-center">Date</th><th class="px-4 py-3 text-center">EarlyBird</th><th class="px-4 py-3 text-center">Fees</th><th class="px-4 py-3 text-center">Status</th><th class="px-4 py-3 text-right pr-6">Actions</th></tr>`;
    bodyBlock.innerHTML = filteredRecordDataset.map(user => {
      let trID = user.regId ? `<span class="font-mono font-bold text-slate-200 select-all">${user.regId}</span>` : `<span class="text-slate-600 italic">Unassigned</span>`;
      let badgeStyleClass = user.status === "Approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : (user.status === "Rejected" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : (user.status === "Checked-in" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"));
      
      let birdValue = user.earlyBird ? user.earlyBird.toString().trim().toUpperCase() : "NO";
      let birdBtnHtml = `<button onclick="dispatchEarlyBirdToggleState(${user.rowNumber}, '${birdValue === 'YES' ? 'NO' : 'YES'}', '${user.accommodation}')" class="text-[10px] px-2 py-0.5 font-bold rounded cursor-pointer ${birdValue === 'YES' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}">${birdValue}</button>`;

      let baseTicketRate = (birdValue === "YES" || systemConfigState.earlyBirdModeActive) ? systemConfigState.earlyBirdPrice : systemConfigState.regularPrice;
      let hostAccomodationRate = (user.accommodation === "YES") ? systemConfigState.accommodationPrice : 0;
      let finalLiveSuggestedPrice = baseTicketRate + hostAccomodationRate;

      let actionColumnHtml = user.status === "Pending" ? `
        <button onclick="dispatchApprovalActionWithLockedPrice(${user.rowNumber}, ${finalLiveSuggestedPrice})" class="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer transition">Approve (₹${finalLiveSuggestedPrice})</button>
        <button onclick="dispatchAdminOperationAction(${user.rowNumber}, 'reject')" class="bg-rose-600/20 text-rose-400 text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer transition ml-1">Reject</button>
      ` : `<span class="text-slate-500 text-[10px] font-mono select-none">Processed</span>`;

      return `
        <tr class="hover:bg-slate-950/20 border-b border-slate-800/40 text-xs">
          <td class="px-4 py-3">${trID}</td>
          <td class="px-4 py-3"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-[10px] text-blue-400 font-mono font-bold">${user.phone} <span class="text-slate-500">[${user.foodPreference}]</span></div></td>
          <td class="px-4 py-3"><div class="font-bold uppercase text-slate-300 max-w-[130px] truncate">${user.college}</div><div class="text-[10px] text-slate-400">Y${user.year} - ${user.branch}</div><div class="text-[9px] text-slate-500 font-mono font-bold">ID: <span class="select-all text-slate-300">${user.idCardNumber || 'N/A'}</span></div></td>
          <td class="px-4 py-3 truncate max-w-[130px] font-semibold">${user.domainSelection}</td>
          <td class="px-4 py-3 text-center font-extrabold ${user.accommodation === 'YES' ? 'text-emerald-400' : 'text-slate-600'}">${user.accommodation}</td>
          <td class="px-4 py-3 font-mono text-[11px] select-all"><div>UTR: ${user.utr}</div><div class="flex gap-1.5 text-[9px] font-bold mt-0.5">${user.screenshot ? `<a href="${user.screenshot}" target="_blank" class="text-blue-400 underline">Receipt</a>` : ''}${user.idCardLink ? ` | <a href="${user.idCardLink}" target="_blank" class="text-indigo-400 underline">College ID</a>` : ''}${user.aadhaarLink ? ` | <a href="${user.aadhaarLink}" target="_blank" class="text-teal-400 underline">Aadhaar</a>` : ''}</div></td>
          <td class="px-4 py-3 text-center text-slate-400 whitespace-nowrap">${user.dateOfReg}</td>
          <td class="px-4 py-3 text-center">${birdBtnHtml}</td>
          <td class="px-4 py-3 text-center font-bold text-slate-200">${user.amountReceived ? '₹' + user.amountReceived : '—'}</td>
          <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded text-[9px] font-black uppercase ${badgeStyleClass}">${user.status}</span></td>
          <td class="px-4 py-3 text-right whitespace-nowrap">${actionColumnHtml}</td>
        </tr>`;
    }).join('');

  } else {
    headBlock.innerHTML = `<tr class="bg-slate-900/40 text-slate-400 text-[11px] font-bold"><th class="px-4 py-3">Ticket ID</th><th class="px-4 py-3">Participant Details</th><th class="px-4 py-3">Institution & Department</th><th class="px-4 py-3 text-center">Cohort Year</th><th class="px-4 py-3 text-center">Date</th><th class="px-4 py-3">Flow Status</th><th class="px-4 py-3 text-right pr-6">Gate Operations</th></tr>`;
    bodyBlock.innerHTML = filteredRecordDataset.map(user => {
      let isCheckedIn = (user.status === "Checked-in");
      return `
        <tr class="hover:bg-slate-950/20 border-b border-slate-800/40 text-xs ${isCheckedIn ? 'bg-blue-950/10' : ''}">
          <td class="px-4 py-3 font-mono font-bold text-slate-300">${user.regId}</td>
          <td class="px-4 py-3"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-[10px] text-slate-500 font-mono">${user.phone}</div></td>
          <td class="px-4 py-3"><div class="uppercase font-bold text-slate-300">${user.college}</div><div class="text-[10px] text-slate-400">${user.branch}</div></td>
          <td class="px-4 py-3 text-center font-bold">${cohortLabels[user.year] || "UNKNOWN"}</td>
          <td class="px-4 py-3 text-center text-slate-500">${user.dateOfReg}</td>
          <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[9px] font-black uppercase ${isCheckedIn ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}">${user.status}</span></td>
          
          <!-- FIXED ADMIN ROW ID MANUAL CHECKIN ATTENDANCE INTEGRATION HOOK -->
          <td class="px-4 py-3 text-right pr-6">
            ${!isCheckedIn ? `
              <button onclick="dispatchManualAttendanceCheckIn(${user.rowNumber}, '${user.fullName}')" class="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg cursor-pointer transition shadow">Mark Gate Entry</button>
            ` : `<span class="font-mono text-emerald-400 text-[11px] font-bold">⏱️ ${user.checkInTime}</span>`}
          </td>
        </tr>`;
    }).join('');
  }
}

async function dispatchApprovalActionWithLockedPrice(rowNumber, Price) {
  if (!confirm(`Approve line reference row #${rowNumber} at locked tier price of ₹${Price}?`)) return;
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "approve", rowNumber: rowNumber, costPerHead: Price })
    });
    const result = await response.json(); alert(result.message); synchronizeCloudLedger(false);
  } catch (error) { alert("Fault: " + error.toString()); }
}

async function dispatchEarlyBirdToggleState(rowNumber, targetValueString, userAccomodationTagValue) {
  let ticketRateComponent = (targetValueString === "YES") ? systemConfigState.earlyBirdPrice : systemConfigState.regularPrice;
  let accomodationRateComponent = (userAccomodationTagValue === "YES") ? systemConfigState.accommodationPrice : 0;
  
  try {
    await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        action: "toggleEarlyBird", 
        rowNumber: rowNumber, 
        earlyBirdValue: targetValueString,
        calculatedPrice: ticketRateComponent + accomodationRateComponent 
      })
    });
    synchronizeCloudLedger(true);
  } catch (error) { console.error(error); }
}

async function dispatchManualAttendanceCheckIn(rowNumber, attendeeName) {
  if (!confirm(`Log manual entry gate confirmation for ${attendeeName}?`)) return;
  try {
    // PASSES EXPLICIT ROWhUMBER PROPERTY TO BACKEND INSTANT PROCESSING ENGINE
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "checkin", rowNumber: parseInt(rowNumber, 10) }) 
    });
    const result = await response.json(); 
    alert(result.message); 
    synchronizeCloudLedger(false);
  } catch (error) { alert("Error updating row attendance: " + error.toString()); }
}

async function dispatchAdminOperationAction(rowNumber, actionName) {
  if (!confirm(`Execute action: [${actionName.toUpperCase()}] on row index line reference #${rowNumber}?`)) return;
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: actionName, rowNumber: rowNumber })
    });
    const result = await response.json(); alert(result.message); synchronizeCloudLedger(false);
  } catch (error) { alert("Error: " + error.toString()); }
}

function processCsvExportTask(filterDomainScopeName = "GLOBAL_ALL") {
  let targetExportList = masterRecordsCache;
  let compiledFileName = "AUNSF_Master_Event_Ledger_2026.csv";

  if (filterDomainScopeName !== "GLOBAL_ALL") {
    targetExportList = masterRecordsCache.filter(r => (r.status === "Approved" || r.status === "Checked-in") && r.domainSelection === filterDomainScopeName);
    compiledFileName = `AUNSF_Ledger_${filterDomainScopeName.replace(/\s+/g, '_')}_2026.csv`;
  }

  if (targetExportList.length === 0) { alert("No synchronized rows matched criteria scope."); return; }

  const csvHeadersRow = ["Timestamp", "Registration ID", "Full Name", "Email Address", "Phone Number", "Gender", "College", "Branch", "Year", "Domain Selection", "Accommodation", "UPI Transaction ID", "Payment Screenshot Link", "Date of Registration", "Early Bird Status", "Amount Received", "Status", "Check-In Timestamp", "Referred By", "Food Preference", "College ID Card Number", "College ID Card Link", "Aadhaar Card Link"];
  const escapeCellString = (val, forceTextLiteral = false) => { if (val === undefined || val === null || val === "null") return '""'; let cleanStr = val.toString().replace(/"/g, '""'); return forceTextLiteral ? `"\t${cleanStr}"` : `"${cleanStr}"`; };

  const sanitizedStringRowsArray = targetExportList.map(r => [escapeCellString(r.timestamp), escapeCellString(r.regId, true), escapeCellString(r.fullName), escapeCellString(r.email), escapeCellString(r.phone, true), escapeCellString(r.gender), escapeCellString(r.college), escapeCellString(r.branch), escapeCellString(r.year), escapeCellString(r.domainSelection), escapeCellString(r.accommodation), escapeCellString(r.utr, true), escapeCellString(r.screenshot), escapeCellString(r.dateOfReg), escapeCellString(r.earlyBird), r.amountReceived || 0, escapeCellString(r.status), escapeCellString(r.checkInTime), escapeCellString(r.referredBy), escapeCellString(r.foodPreference), escapeCellString(r.idCardNumber, true), escapeCellString(r.idCardLink), escapeCellString(r.aadhaarLink)].join(","));
  const fullCsvStringContent = "\uFEFF" + csvHeadersRow.join(",") + "\n" + sanitizedStringRowsArray.join("\n");
  const binaryMemoryBlob = new Blob([fullCsvStringContent], { type: 'text/csv;charset=utf-8;' });
  const temporaryBlobDownloadUrlPointer = URL.createObjectURL(binaryMemoryBlob);
  const anchorDownloadLink = document.createElement("a");
  
  anchorDownloadLink.setAttribute("href", temporaryBlobDownloadUrlPointer);
  anchorDownloadLink.setAttribute("download", compiledFileName);
  document.body.appendChild(anchorDownloadLink); anchorDownloadLink.click(); document.body.removeChild(anchorDownloadLink);
}