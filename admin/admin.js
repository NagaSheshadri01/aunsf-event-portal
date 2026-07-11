const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycbxV5iYwbY8xBoMnki_N8qKosRk2mu9kukqm8Hqg4quYT6OtFLJyYiQi_rnXTEdjzTr9/exec"; 

let masterRecordsCache = [];
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

  const cachedLocalRecordDataString = localStorage.getItem('aunsf_master_system_cache');
  if (cachedLocalRecordDataString) {
    try {
      masterRecordsCache = JSON.parse(cachedLocalRecordDataString);
      calculateSystemMetricsAndDistributions();
      buildDynamicAlphaSortedFilterDropdowns();
      renderTargetedDataGrid();
    } catch (err) { console.error("Cache exception: ", err); }
  }

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

  synchronizeCloudLedger(false);
  setInterval(() => { synchronizeCloudLedger(true); }, 15000);
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
      masterRecordsCache = parsedResult.records;
      localStorage.setItem('aunsf_master_system_cache', JSON.stringify(masterRecordsCache));
      
      if (parsedResult.config) {
        systemConfigState = parsedResult.config;
        updateConfigFieldsInAdminUI();
      }
      
      buildDynamicAlphaSortedFilterDropdowns();
      calculateSystemMetricsAndDistributions();
      renderTargetedDataGrid();
    }
  } catch (error) { console.error("Sync error: ", error); }
  finally {
    if (!isSilentBackgroundPoll) {
      btn.innerText = "🔄 Refresh";
      btn.disabled = false;
    }
  }
}

function updateConfigFieldsInAdminUI() {
  document.getElementById('regularPriceInput').value = systemConfigState.regularPrice;
  document.getElementById('earlyBirdPriceInput').value = systemConfigState.earlyBirdPrice;
  document.getElementById('accommodationPriceInput').value = systemConfigState.accommodationPrice;
  document.getElementById('earlyBirdModeToggle').checked = systemConfigState.earlyBirdModeActive;
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
      body: JSON.stringify({ action: "updateConfig", ...payload })
    });
    const result = await response.json();
    if (result.status === "success") {
      alert("✨ " + result.message);
      synchronizeCloudLedger(false);
    }
  } catch (error) {
    alert("Configuration fault: " + error.toString());
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = "💾 Save Configurations";
  }
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
    'btnDomainMindspace': 'Human Behaviour & Civic Innovation', // Renamed Target Tab Selector
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
    sidebar.classList.add('hidden'); metricsGrid.classList.remove('hidden'); toolbarContainer.classList.remove('hidden'); attendanceTabsBlock.classList.remove('hidden');
  } else {
    sidebar.classList.add('hidden'); metricsGrid.classList.remove('hidden'); toolbarContainer.classList.remove('hidden'); attendanceTabsBlock.classList.add('hidden');
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
  let trackedUniqueCollegesSet = new Set(); let trackedUniqueBranchesSet = new Set();
  masterRecordsCache.forEach(r => {
    if (r.college && r.college.trim() !== "") trackedUniqueCollegesSet.add(r.college.trim().toUpperCase());
    if (r.branch && r.branch.trim() !== "") trackedUniqueBranchesSet.add(r.branch.trim().toUpperCase());
  });
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
  const pendingCount = masterRecordsCache.filter(r => r.status === 'Pending').length;
  const approvedCount = masterRecordsCache.filter(r => r.status === 'Approved' || r.status === 'Checked-in').length;
  const rejectedCount = masterRecordsCache.filter(r => r.status === 'Rejected').length;
  const checkedInCount = masterRecordsCache.filter(r => r.status === 'Checked-in').length;

  document.getElementById('countTotal').innerText = totalCount;
  document.getElementById('countPending').innerText = pendingCount;
  document.getElementById('countApproved').innerText = approvedCount;
  document.getElementById('countRejected').innerText = rejectedCount;
  document.getElementById('countCheckedIn').innerText = checkedInCount;
  
  let aggregateRevenueCalculated = 0;
  masterRecordsCache.forEach(r => {
    if (r.status === 'Approved' || r.status === 'Checked-in') {
      aggregateRevenueCalculated += (r.amountReceived || 0);
    }
  });
  document.getElementById('revenueCollected').innerText = "₹" + aggregateRevenueCalculated.toLocaleString('en-IN');

  const collegeArea = document.getElementById('distributionCollegeArea');
  const branchArea = document.getElementById('distributionBranchArea');
  const yearArea = document.getElementById('distributionYearArea');
  const domainArea = document.getElementById('distributionDomainArea'); 
  const trendsArea = document.getElementById('distributionTrendsArea');

  let colCountMap = {}, brCountMap = {}, yrCountMap = {}, domCountMap = {}, trendTotalMap = {}, trendApprovedMap = {};
  let colRevMap = {}, brRevMap = {}, yrRevMap = {}, domRevMap = {};
  
  let nestedBranchRevPool = {}; 
  let nestedYearRevPool = {};   

  masterRecordsCache.forEach(r => {
    if (r.status !== 'Duplicate') {
      const cleanColKey = (r.college || 'N/A').trim().toUpperCase();
      const cleanBrKey = (r.branch || 'N/A').trim().toUpperCase();
      const cleanYrKey = "YEAR " + (r.year || 'N/A').toString().trim().toUpperCase();
      const cleanDomKey = (r.domainSelection || 'UNASSIGNED').trim();
      const isApprovedUser = (r.status === 'Approved' || r.status === 'Checked-in');
      const userInstanceCost = (r.amountReceived || 0);

      if (isApprovedUser) {
        colCountMap[cleanColKey] = (colCountMap[cleanColKey] || 0) + 1;
        brCountMap[cleanBrKey] = (brCountMap[cleanBrKey] || 0) + 1;
        yrCountMap[cleanYrKey] = (yrCountMap[cleanYrKey] || 0) + 1;
        domCountMap[cleanDomKey] = (domCountMap[cleanDomKey] || 0) + 1;

        colRevMap[cleanColKey] = (colRevMap[cleanColKey] || 0) + userInstanceCost;
        brRevMap[cleanBrKey] = (brRevMap[cleanBrKey] || 0) + userInstanceCost;
        yrRevMap[cleanYrKey] = (yrRevMap[cleanYrKey] || 0) + userInstanceCost;
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
  });

  collegeArea.innerHTML = Object.keys(colRevMap).sort().map(colKey => {
    const isExpanded = !!expandedCollegesMap[colKey];
    let drilldownHtml = "";
    if (isExpanded && nestedBranchRevPool[colKey]) {
      drilldownHtml = `<div class="bg-slate-900/60 p-2 mt-1 rounded-xl border border-slate-700/40 space-y-1.5 text-[10px] text-slate-400">`;
      Object.keys(nestedBranchRevPool[colKey]).sort().forEach(branchKey => {
        let branchTotalSum = nestedBranchRevPool[colKey][branchKey] || 0;
        drilldownHtml += `<div class="font-bold border-b border-slate-800/60 pb-0.5 text-slate-300 flex justify-between"><span>📌 ${branchKey}</span><span class="text-purple-400">₹${branchTotalSum.toLocaleString('en-IN')}</span></div>`;
        ["YEAR 1", "YEAR 2", "YEAR 3", "YEAR 4"].forEach(yText => {
          const compKey = `${colKey}_${branchKey}_${yText}`;
          if (nestedYearRevPool[compKey]) {
            drilldownHtml += `<div class="flex items-center justify-between pl-3 opacity-80 text-[9px]"><span>${yText.toLowerCase()}</span><span class="text-emerald-400 font-medium">₹${nestedYearRevPool[compKey].toLocaleString('en-IN')}</span></div>`;
          }
        });
      });
      drilldownHtml += `</div>`;
    }
    return `
      <div class="border-b border-slate-700/30 py-1.5 last:border-none">
        <div onclick="toggleCollegeDrilldownView('${colKey}')" class="flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-700/30 p-1 rounded transition">
          <span class="truncate max-w-[130px] font-bold text-slate-300 inline-flex items-center gap-1">${isExpanded ? '▼' : '▶'} ${colKey}</span>
          <span class="text-blue-400 font-bold">₹${colRevMap[colKey].toLocaleString('en-IN')}</span>
        </div>
        ${drilldownHtml}
      </div>`;
  }).join('') || '<p class="text-slate-500 italic">No cleared transactions</p>';

  branchArea.innerHTML = Object.keys(brCountMap).sort().map(k => `<div class="flex items-center justify-between py-1 border-b border-slate-700/30 gap-2"><span class="truncate max-w-[120px] font-bold text-slate-300">${k}</span><span class="text-purple-400 font-bold">₹${brRevMap[k].toLocaleString('en-IN')}</span></div>`).join('') || '<p class="text-slate-500 italic">No approved data</p>';
  yearArea.innerHTML = Object.keys(yrCountMap).sort().map(k => `<div class="flex items-center justify-between py-1 border-b border-slate-700/30 gap-2"><span class="font-bold text-slate-300">${k}</span><span class="text-emerald-400 font-bold">₹${yrRevMap[k].toLocaleString('en-IN')}</span></div>`).join('') || '<p class="text-slate-500 italic">No approved data</p>';
  domainArea.innerHTML = Object.keys(domRevMap).sort().map(k => `<div class="flex items-center justify-between py-1 border-b border-slate-700/30 gap-2"><span class="font-bold text-slate-300 uppercase truncate max-w-[140px] text-[10px]">${k}</span><span class="text-purple-400 font-bold">₹${domRevMap[k].toLocaleString('en-IN')}</span></div>`).join('') || '<p class="text-slate-500 italic">No assigned domains</p>';

  trendsArea.innerHTML = Object.keys(trendTotalMap).map(k => `
    <div onclick="filterByRegistrationDateTimelineScope('${k}')" class="flex items-center justify-between py-1.5 px-1 border-b border-slate-700/30 hover:bg-slate-700/40 rounded cursor-pointer transition">
      <span class="font-bold text-slate-300 underline">${k}</span>
      <span class="text-right text-[10px]"><span class="text-slate-400">Inbound: <strong>${trendTotalMap[k]}</strong></span> | <span class="text-emerald-400 font-bold">₹${(trendApprovedMap[k] || 0).toLocaleString('en-IN')}</span></span>
    </div>`).join('') || '<p class="text-slate-500 italic">No historical entries</p>';
}

function renderTargetedDataGrid() {
  const headBlock = document.getElementById('tableHeaderBlock');
  const bodyBlock = document.getElementById('tableBodyBlock');
  const banner = document.getElementById('activeScopeBanner');
  const bannerText = document.getElementById('activeScopeText');
  
  const queryValue = document.getElementById('searchInput').value.toLowerCase().trim();
  const statusFilterValue = document.getElementById('filterStatus').value;
  const collegeFilterValue = document.getElementById('filterCollege').value;
  const branchFilterValue = document.getElementById('filterBranch').value;
  const yearFilterValue = document.getElementById('filterYear').value;
  const domainFilterValue = document.getElementById('filterDomain').value;

  if (activeDayFilterScope) {
    bannerText.innerText = `Displaying profiles filed on date segment: ${activeDayFilterScope}`;
    banner.classList.remove('hidden');
  } else { banner.classList.add('hidden'); }

  let filteredRecordDataset = masterRecordsCache.filter(row => {
    if (activeDayFilterScope && row.dateOfReg !== activeDayFilterScope) return false;
    
    if (dashboardViewMode === "attendance") {
      if (row.status !== "Approved" && row.status !== "Checked-in") return false;
      if (row.domainSelection !== activeAttendanceDomainTab) return false;
    } else if (dashboardViewMode === "revenue") {
      return row.status === "Approved" || row.status === "Checked-in";
    } else {
      if (statusFilterValue !== "All") {
        if (statusFilterValue === "Approved" && row.status !== "Approved" && row.status !== "Checked-in") return false;
        if (statusFilterValue !== "Approved" && row.status !== statusFilterValue) return false;
      }
    }
    if (collegeFilterValue !== "All" && (row.college || '').trim().toUpperCase() !== collegeFilterValue) return false;
    if (branchFilterValue !== "All" && (row.branch || '').trim().toUpperCase() !== branchFilterValue) return false;
    if (yearFilterValue !== "All" && row.year.toString() !== yearFilterValue.toString()) return false;
    if (domainFilterValue !== "All" && row.domainSelection !== domainFilterValue) return false;
    
    if (queryValue) {
      const rowSearchString = [
        row.regId, row.fullName, row.email, row.phone, row.college, row.branch, row.utr,
        row.referredBy, row.idCardNumber, row.foodPreference
      ].join(" ").toLowerCase();
      if (!rowSearchString.includes(queryValue)) return false;
    }
    return true;
  });

  const cohortLabels = { "1": "FRESHER", "2": "SOPHOMORE", "3": "JUNIOR", "4": "SENIOR" };

  if (dashboardViewMode === "revenue") {
    headBlock.innerHTML = `
      <tr class="whitespace-nowrap text-left bg-slate-900/40">
        <th class="px-4 py-3.5">Ticket ID</th>
        <th class="px-4 py-3.5">Paying Participant</th>
        <th class="px-4 py-3.5">Institution Profile</th>
        <th class="px-4 py-3.5 w-16 text-center">Year</th>
        <th class="px-4 py-3.5">Domain Selection</th>
        <th class="px-4 py-3.5 text-center">Accom.</th>
        <th class="px-4 py-3.5">Transaction UTR</th>
        <th class="px-4 py-3.5">Date of Reg</th>
        <th class="px-4 py-3.5 text-right pr-6">Amount Collected</th>
      </tr>`;

    if (filteredRecordDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="9" class="text-center py-16 text-slate-500 italic font-bold">No verified financial data entries found.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = filteredRecordDataset.map(user => `
      <tr class="hover:bg-slate-950/20 transition duration-100 border-b border-slate-700/20 text-xs whitespace-nowrap">
        <td class="px-4 py-3.5 font-mono font-bold text-slate-200 select-all">${user.regId}</td>
        <td class="px-4 py-3.5"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5">${user.email}</div></td>
        <td class="px-4 py-3.5 font-bold text-slate-300 uppercase">${user.college} <span class="text-slate-500 font-normal text-xs">[${user.branch}]</span></td>
        <td class="px-4 py-3.5 text-center font-bold">${cohortLabels[user.year] || "UNKNOWN"} [Y${user.year}]</td>
        <td class="px-4 py-3.5 font-semibold text-slate-300 max-w-[150px] truncate" title="${user.domainSelection}">${user.domainSelection || "N/A"}</td>
        <td class="px-4 py-3.5 text-center font-bold ${user.accommodation === 'YES' ? 'text-emerald-400' : 'text-slate-500'}">${user.accommodation || "NO"}</td>
        <td class="px-4 py-3.5 font-mono text-[11px] text-slate-300">${user.utr}</td>
        <td class="px-4 py-3.5 font-medium text-slate-400 whitespace-nowrap">${user.dateOfReg}</td>
        <td class="px-4 py-3.5 text-right font-mono font-black text-purple-400 pr-6">₹${(user.amountReceived || 0).toLocaleString('en-IN')}</td>
      </tr>`).join('');

  } else if (dashboardViewMode === "registration") {
    headBlock.innerHTML = `
      <tr class="whitespace-nowrap text-left bg-slate-900/40 select-none">
        <th class="px-4 py-3.5">Ticket ID</th>
        <th class="px-4 py-3.5">Participant Details</th>
        <th class="px-4 py-3.5">College / Branch / Year</th>
        <th class="px-4 py-3.5">Domain Selection</th>
        <th class="px-4 py-3.5 text-center">Accom.</th>
        <th class="px-4 py-3.5">Transaction UTR / Vault Documentation Links</th>
        <th class="px-4 py-3.5 text-center bg-slate-900/20 text-blue-400 font-black">Date of Reg</th>
        <th class="px-4 py-3.5 text-center bg-slate-900/20 text-blue-400 font-black">Early Bird</th>
        <th class="px-4 py-3.5 text-center bg-slate-900/20 text-blue-400 font-black">Payment</th>
        <th class="px-4 py-3.5 text-center">Status</th>
        <th class="px-4 py-3.5 text-right pr-6">Actions</th>
      </tr>`;

    if (filteredRecordDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="11" class="text-center py-16 text-slate-500 italic font-bold">No records found.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = filteredRecordDataset.map(user => {
      var trID = (!user.regId || user.regId === "null" || user.regId === "") ? `<span class="text-slate-600 italic select-none">null</span>` : `<span class="font-mono font-bold text-slate-200 select-all whitespace-nowrap">${user.regId}</span>`;
      var badgeStyleClass = user.status === "Approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : (user.status === "Rejected" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : (user.status === "Checked-in" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"));
      if (user.status === "Duplicate") badgeStyleClass = "bg-purple-500/10 text-purple-400 border border-purple-500/20";

      var birdValue = user.earlyBird ? user.earlyBird.toString().trim().toUpperCase() : "NULL";
      var birdBtnHtml = "";
      
      if (birdValue === "YES") {
        birdBtnHtml = `<button onclick="dispatchEarlyBirdToggleState(${user.rowNumber}, 'NO', '${user.accommodation}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] px-3 py-1 rounded transition whitespace-nowrap cursor-pointer shadow-sm">YES</button>`;
      } else if (birdValue === "NO") {
        birdBtnHtml = `<button onclick="dispatchEarlyBirdToggleState(${user.rowNumber}, 'YES', '${user.accommodation}')" class="bg-slate-700 hover:bg-slate-600 text-slate-300 font-extrabold text-[10px] px-3 py-1 rounded transition whitespace-nowrap cursor-pointer shadow-sm">NO</button>`;
      } else {
        birdBtnHtml = `
          <div class="inline-flex gap-1 bg-slate-950/40 p-1 rounded-lg border border-slate-700/40">
            <button onclick="dispatchEarlyBirdToggleState(${user.rowNumber}, 'YES', '${user.accommodation}')" class="bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-400 text-[10px] font-black px-2 py-0.5 rounded transition cursor-pointer">Y</button>
            <button onclick="dispatchEarlyBirdToggleState(${user.rowNumber}, 'NO', '${user.accommodation}')" class="bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 text-[10px] font-black px-2 py-0.5 rounded transition cursor-pointer">N</button>
          </div>`;
      }

      var financialColumnRenderText = (user.status === "Pending" || user.amountReceived === "") ? `<span class="text-slate-500 italic font-mono select-none">Unearned</span>` : `<span class="font-mono font-bold text-slate-200 whitespace-nowrap">₹${user.amountReceived || 0}</span>`;
      
      let baseTicketRate = (birdValue === "YES" || (birdValue === "NULL" && systemConfigState.earlyBirdModeActive)) ? systemConfigState.earlyBirdPrice : systemConfigState.regularPrice;
      let hostAccomodationRate = (user.accommodation === "YES") ? systemConfigState.accommodationPrice : 0;
      let finalLiveSuggestedPrice = baseTicketRate + hostAccomodationRate;

      let actionColumnHtml = `<span class="text-slate-500 text-[10px] font-mono select-none">Processed</span>`;
      if (user.status.toLowerCase() === "pending") {
        actionColumnHtml = `
          <button onclick="dispatchApprovalActionWithLockedPrice(${user.rowNumber}, ${finalLiveSuggestedPrice})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow cursor-pointer transition">Approve (₹${finalLiveSuggestedPrice})</button>
          <button onclick="dispatchAdminOperationAction(${user.rowNumber}, 'reject')" class="bg-rose-600/10 hover:bg-rose-600 text-rose-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition">Reject</button>
        `;
      }

      let foodColorClass = user.foodPreference === "VEG" ? "text-emerald-400" : "text-amber-500";
      let referredBySnippet = user.referredBy ? ` | <span class="text-purple-300 font-medium">Ref: ${user.referredBy}</span>` : "";

      // BUGFIX: Display the pulled 'user.idCardNumber' property cleanly under the college department row block layout
      return `
        <tr class="hover:bg-slate-950/20 transition duration-100 border-b border-slate-700/20 text-xs whitespace-nowrap">
          <td class="px-4 py-3.5">${trID}</td>
          <td class="px-4 py-3.5">
            <div class="font-bold text-slate-100 max-w-[130px] truncate" title="${user.fullName}">${user.fullName}</div>
            <div class="text-[10px] text-slate-400 font-mono mt-0.5 max-w-[130px] truncate">${user.email}</div>
            <div class="text-[9px] text-blue-400 font-bold tracking-wider uppercase mt-0.5">
              ${user.gender || "UNKNOWN"} <span class="text-white font-black font-mono ml-2 select-all">${user.phone || ""}</span>
              <span class="${foodColorClass} font-black ml-2">[${user.foodPreference || "VEG"}]</span>${referredBySnippet}
            </div>
          </td>
          <td class="px-4 py-3.5">
            <div class="uppercase font-bold text-slate-300 max-w-[130px] truncate" title="${user.college}">${user.college}</div>
            <div class="uppercase text-[10px] text-slate-400 mt-0.5 max-w-[130px] truncate">
              ${user.branch} <span class="text-slate-500 font-normal">[${cohortLabels[user.year] || "UNKNOWN"} - <span class="text-white font-black">Y${user.year}</span>]</span>
            </div>
            <div class="text-[10px] text-slate-400 font-mono mt-0.5">ID: <span class="text-slate-200 font-bold select-all">${user.idCardNumber || "N/A"}</span></div>
          </td>
          <td class="px-4 py-3.5 font-semibold text-slate-300 max-w-[140px] truncate" title="${user.domainSelection}">${user.domainSelection || "Unassigned"}</td>
          <td class="px-4 py-3.5 text-center font-extrabold ${user.accommodation === 'YES' ? 'text-emerald-400' : 'text-slate-600'}">${user.accommodation || "NO"}</td>
          <td class="px-4 py-3.5 space-y-0.5">
            <div class="font-mono text-[11px] tracking-wide text-slate-300 select-all">UTR: ${user.utr}</div>
            <div class="flex items-center gap-2 text-[10px] font-bold">
              ${user.screenshot ? `<a href="${user.screenshot}" target="_blank" class="text-blue-400 hover:text-blue-300 underline">Receipt</a>` : `<span class="text-slate-600 font-normal italic">No Receipt</span>`}
              ${user.idCardLink ? ` | <a href="${user.idCardLink}" target="_blank" class="text-indigo-400 hover:text-indigo-300 underline">College ID</a>` : ``}
              ${user.aadhaarLink ? ` | <a href="${user.aadhaarLink}" target="_blank" class="text-teal-400 hover:text-teal-300 underline">Aadhaar</a>` : ``}
            </div>
          </td>
          
          <td class="px-4 py-3.5 text-center font-bold text-slate-200 bg-slate-900/10">${user.dateOfReg}</td>
          <td class="px-4 py-3.5 text-center bg-slate-900/10">${birdBtnHtml}</td>
          <td class="px-4 py-3.5 text-center bg-slate-900/10">${financialColumnRenderText}</td>
          
          <td class="px-4 py-3.5 text-center"><span class="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${badgeStyleClass}">${user.status}</span></td>
          <td class="px-4 py-3.5 text-right pr-6">${actionColumnHtml}</td>
        </tr>`;
    }).join('');

  } else {
    headBlock.innerHTML = `
      <tr class="whitespace-nowrap text-left bg-slate-900/40">
        <th class="px-4 py-3.5">Ticket ID</th>
        <th class="px-4 py-3.5">Participant Details</th>
        <th class="px-4 py-3.5">Institution & Department</th>
        <th class="px-4 py-3.5 text-center w-12">Year</th>
        <th class="px-4 py-3.5 text-center">Date of Reg</th>
        <th class="px-4 py-3.5">Flow Status</th>
        <th class="px-4 py-3.5 text-right pr-6">Gate Operations / Arrival Time</th>
      </tr>`;

    if (filteredRecordDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-slate-500 italic font-bold">No valid entries identified.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = filteredRecordDataset.map(user => {
      let isCheckedIn = (user.status === "Checked-in");
      let badgeStyleClass = isCheckedIn ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      
      return `
        <tr class="hover:bg-slate-950/20 transition duration-100 border-b border-slate-700/20 ${isCheckedIn ? 'bg-blue-950/10' : ''}">
          <td class="px-4 py-3.5 font-mono font-bold text-slate-300 whitespace-nowrap">${user.regId}</td>
          <td class="px-4 py-3.5"><div class="font-bold text-slate-100 max-w-[200px] truncate" title="${user.fullName}">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">${user.phone}</div></td>
          <td class="px-4 py-3.5"><div class="uppercase font-bold text-slate-300 max-w-[200px] truncate" title="${user.college}">${user.college}</div><div class="uppercase text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate" title="${user.branch}">${user.branch}</div></td>
          <td class="px-4 py-3.5 font-black text-center whitespace-nowrap">${cohortLabels[user.year] || "UNKNOWN"} [Y${user.year}]</td>
          <td class="px-4 py-3.5 text-center font-medium text-slate-400 whitespace-nowrap">${user.dateOfReg}</td>
          <td class="px-4 py-3.5 whitespace-nowrap"><span class="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${badgeStyleClass}">${isCheckedIn ? 'Checked In' : 'Unchecked'}</span></td>
          <td class="px-4 py-3.5 text-right pr-6 whitespace-nowrap">
            ${!isCheckedIn ? `
              <button onclick="dispatchManualAttendanceCheckIn(${user.rowNumber}, '${user.fullName}')" class="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg shadow cursor-pointer transition">✅ Mark Attendance</button>
            ` : `<span class="font-mono font-black text-emerald-400 text-[11px]">⏱️ ${user.checkInTime}</span>`}
          </td>
        </tr>`;
    }).join('');
  }
}

async function dispatchApprovalActionWithLockedPrice(rowNumber, directCalculatedSuggestedPriceValue) {
  if (!confirm(`Verify registration payment and lock record entry reference row #${rowNumber} at calculated rate tier of ₹${directCalculatedSuggestedPriceValue}?`)) return;
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "approve", rowNumber: rowNumber, costPerHead: directCalculatedSuggestedPriceValue })
    });
    const result = await response.json();
    alert(result.message);
    synchronizeCloudLedger(false);
  } catch (error) { alert("Approval pipeline fault: " + error.toString()); }
}

async function dispatchEarlyBirdToggleState(rowNumber, targetValueString, userAccomodationTagValue) {
  let ticketRateComponent = (targetValueString === "YES") ? systemConfigState.earlyBirdPrice : systemConfigState.regularPrice;
  let accomodationRateComponent = (userAccomodationTagValue === "YES") ? systemConfigState.accommodationPrice : 0;
  
  const finalizedRecalculatedPriceSum = ticketRateComponent + accomodationRateComponent;

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        action: "toggleEarlyBird", 
        rowNumber: rowNumber, 
        earlyBirdValue: targetValueString,
        calculatedPrice: finalizedRecalculatedPriceSum 
      })
    });
    const result = await response.json();
    if (result.status === "success") {
      synchronizeCloudLedger(true);
    }
  } catch (error) { console.error("Toggle error exception: ", error); }
}

async function dispatchManualAttendanceCheckIn(rowNumber, attendeeName) {
  if (!confirm(`Manually log gate attendance entry for ${attendeeName.toUpperCase()}?`)) return;
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "checkin", rowNumber: parseInt(rowNumber, 10) }) 
    });
    const result = await response.json();
    alert(result.message);
    synchronizeCloudLedger(false);
  } catch (error) { alert("Gate sync error: " + error.toString()); }
}

async function dispatchAdminOperationAction(rowNumber, actionName) {
  if (!confirm(`Execute state modification [${actionName.toUpperCase()}] on row line reference #${rowNumber}?`)) return;
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: actionName, rowNumber: rowNumber })
    });
    const result = await response.json();
    alert(result.message);
    synchronizeCloudLedger(false);
  } catch (error) { alert("API execution error: " + error.toString()); }
}

function processCsvExportTask(filterDomainScopeName = "GLOBAL_ALL") {
  let targetExportList = masterRecordsCache;
  let compiledFileName = "AUNSF_Master_Event_Ledger_2026.csv";

  if (filterDomainScopeName !== "GLOBAL_ALL") {
    targetExportList = masterRecordsCache.filter(r => 
      (r.status === "Approved" || r.status === "Checked-in") && r.domainSelection === filterDomainScopeName
    );
    compiledFileName = `AUNSF_Attendance_Ledger_${filterDomainScopeName.replace(/\s+/g, '_')}_2026.csv`;
  }

  if (targetExportList.length === 0) {
    alert("Export Cancelled: No rows matched your selected scope filters.");
    return;
  }

  const csvHeadersRow = [
    "Timestamp", "Registration ID", "Full Name", "Email Address", "Phone Number", 
    "Gender", "College", "Branch", "Year", "Domain Selection", 
    "Accommodation", "UPI Transaction ID", "Payment Screenshot Link", "Date of Registration", 
    "Early Bird Status", "Amount Received", "Status", "Check-In Timestamp",
    "Referred By", "Food Preference", "College ID Card Number", "College ID Card Link", "Aadhaar Card Link"
  ];

  const escapeCellString = (val, forceTextLiteral = false) => {
    if (val === undefined || val === null || val === "null") return '""';
    let cleanStr = val.toString().replace(/"/g, '""'); 
    if (forceTextLiteral) {
      return `"\t${cleanStr}"`; 
    }
    return `"${cleanStr}"`;
  };

  const sanitizedStringRowsArray = targetExportList.map(r => [
    escapeCellString(r.timestamp),
    escapeCellString(r.regId, true), 
    escapeCellString(r.fullName),
    escapeCellString(r.email),
    escapeCellString(r.phone, true), 
    escapeCellString(r.gender),
    escapeCellString(r.college),
    escapeCellString(r.branch),
    escapeCellString(r.year),
    escapeCellString(r.domainSelection),
    escapeCellString(r.accommodation),
    escapeCellString(r.utr, true),   
    escapeCellString(r.screenshot),
    escapeCellString(r.dateOfReg),   
    escapeCellString(r.earlyBird),   
    r.amountReceived !== "" ? (parseInt(r.amountReceived, 10) || 0) : 0, 
    escapeCellString(r.status),
    escapeCellString(r.checkInTime),
    escapeCellString(r.referredBy),
    escapeCellString(r.foodPreference),
    escapeCellString(r.idCardNumber, true),
    escapeCellString(r.idCardLink),
    escapeCellString(r.aadhaarLink)
  ].join(","));

  const fullCsvStringContent = "\uFEFF" + csvHeadersRow.join(",") + "\n" + sanitizedStringRowsArray.join("\n");
  const binaryMemoryBlob = new Blob([fullCsvStringContent], { type: 'text/csv;charset=utf-8;' });
  const temporaryBlobDownloadUrlPointer = URL.createObjectURL(binaryMemoryBlob);
  const anchorDownloadLink = document.createElement("a");
  
  anchorDownloadLink.setAttribute("href", temporaryBlobDownloadUrlPointer);
  anchorDownloadLink.setAttribute("download", compiledFileName);
  document.body.appendChild(anchorDownloadLink);
  anchorDownloadLink.click(); 
  document.body.removeChild(anchorDownloadLink);
}