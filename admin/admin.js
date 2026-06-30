const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let masterRecordsCache = [];
let dashboardViewMode = "registration"; // Options: "registration", "attendance", "revenue"
let expandedCollegesMap = {};           // State tracker map for sidebars expands
let activeDayFilterScope = null;        // Active interactive timeline constraint parameter

window.onload = () => {
  // FIX: Force initial view shell structure setups immediately on load before any network calls run
  handleStructuralViewLayoutAlterators();

  const cachedLocalRecordDataString = localStorage.getItem('aunsf_master_system_cache');
  if (cachedLocalRecordDataString) {
    try {
      masterRecordsCache = JSON.parse(cachedLocalRecordDataString);
      calculateSystemMetricsAndDistributions();
      buildDynamicAlphaSortedFilterDropdowns();
      renderTargetedDataGrid();
    } catch (err) { console.error("Initial buffer read trace error: ", err); }
  }

  // Bind active DOM button interaction event loops listeners
  document.getElementById('refreshBtn').addEventListener('click', () => synchronizeCloudLedger(false));
  document.getElementById('exportCsvBtn').addEventListener('click', processCsvExportTask);
  document.getElementById('clearFiltersBtn').addEventListener('click', clearAllActiveFilters);
  document.getElementById('btnResetScopeBypass').addEventListener('click', clearDayTimelineScopeBypass);
  document.getElementById('costPerPersonInput').addEventListener('input', () => {
    calculateSystemMetricsAndDistributions();
    renderTargetedDataGrid();
  });
  
  setupModeButtonsViewRoutingControlEngine();

  // Wire select elements to filter reactively on entry adjustments
  ['searchInput', 'filterStatus', 'filterCollege', 'filterBranch', 'filterYear'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTargetedDataGrid);
    document.getElementById(id).addEventListener('input', renderTargetedDataGrid);
  });

  // Initial data grid pull loop invocation
  synchronizeCloudLedger(false);

  // FIX: 10-Second Automated Silent Background Polling Heartbeat for Multi-Admin Support
  setInterval(() => {
    synchronizeCloudLedger(true); // Passes true to update database completely silently
  }, 10000);
};

async function synchronizeCloudLedger(isSilentBackgroundPoll = false) {
  const btn = document.getElementById('refreshBtn');
  
  // Visual indicators update only if called by a physical user click path action
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
      buildDynamicAlphaSortedFilterDropdowns();
      calculateSystemMetricsAndDistributions();
      renderTargetedDataGrid();
    }
  } catch (error) {
    console.error("Background data polling exception: ", error);
  } finally {
    if (!isSilentBackgroundPoll) {
      btn.innerText = "🔄 Refresh";
      btn.disabled = false;
    }
  }
}

function setupModeButtonsViewRoutingControlEngine() {
  const routingMap = {
    'btnRegMode': 'registration',
    'btnLookoverMode': 'attendance',
    'btnRevenueMode': 'revenue'
  };

  Object.keys(routingMap).forEach(btnId => {
    document.getElementById(btnId).addEventListener('click', (e) => {
      Object.keys(routingMap).forEach(id => {
        document.getElementById(id).className = "view-mode-btn bg-slate-800 text-slate-400 hover:bg-slate-700 font-bold text-xs px-4 py-3 rounded-xl transition tracking-wide cursor-pointer whitespace-nowrap";
      });
      e.target.className = "view-mode-btn bg-blue-600 text-white font-bold text-xs px-4 py-3 rounded-xl shadow transition tracking-wide cursor-pointer whitespace-nowrap";
      
      dashboardViewMode = routingMap[btnId];
      handleStructuralViewLayoutAlterators();
    });
  });
}

function handleStructuralViewLayoutAlterators() {
  const sidebar = document.getElementById('sidebarArea');
  const metricsGrid = document.getElementById('metricsCountersGrid');
  const toolbarContainer = document.getElementById('filterToolbarContainer');

  if (dashboardViewMode === "revenue") {
    sidebar.classList.remove('hidden'); 
    metricsGrid.classList.add('hidden'); 
    toolbarContainer.classList.add('hidden'); 
  } else if (dashboardViewMode === "attendance") {
    sidebar.classList.add('hidden'); 
    metricsGrid.classList.remove('hidden');
    toolbarContainer.classList.remove('hidden');
  } else {
    sidebar.classList.add('hidden'); 
    metricsGrid.classList.remove('hidden');
    toolbarContainer.classList.remove('hidden');
  }
  renderTargetedDataGrid();
}

function filterByRegistrationDateTimelineScope(targetDateKey) {
  activeDayFilterScope = targetDateKey;
  renderTargetedDataGrid();
}

function clearDayTimelineScopeBypass() {
  activeDayFilterScope = null;
  renderTargetedDataGrid();
}

function clearAllActiveFilters() {
  document.getElementById('searchInput').value = "";
  document.getElementById('filterStatus').value = "All";
  document.getElementById('filterCollege').value = "All";
  document.getElementById('filterBranch').value = "All";
  document.getElementById('filterYear').value = "All";
  activeDayFilterScope = null;
  renderTargetedDataGrid();
}

function buildDynamicAlphaSortedFilterDropdowns() {
  const collegeDropdownElement = document.getElementById('filterCollege');
  const branchDropdownElement = document.getElementById('filterBranch');
  
  const currentlySelectedCollege = collegeDropdownElement.value;
  const currentlySelectedBranch = branchDropdownElement.value;

  let trackedUniqueCollegesSet = new Set();
  let trackedUniqueBranchesSet = new Set();

  masterRecordsCache.forEach(r => {
    if (r.college && r.college.trim() !== "") trackedUniqueCollegesSet.add(r.college.trim().toUpperCase());
    if (r.branch && r.branch.trim() !== "") trackedUniqueBranchesSet.add(r.branch.trim().toUpperCase());
  });

  const sortedCollegesArray = Array.from(trackedUniqueCollegesSet).sort((a, b) => a.localeCompare(b));
  const sortedBranchesArray = Array.from(trackedUniqueBranchesSet).sort((a, b) => a.localeCompare(b));

  collegeDropdownElement.innerHTML = '<option value="All">All Institutions</option>' + 
    sortedCollegesArray.map(c => `<option value="${c}">${c}</option>`).join('');
  
  branchDropdownElement.innerHTML = '<option value="All">All Specializations</option>' + 
    sortedBranchesArray.map(b => `<option value="${b}">${b}</option>`).join('');

  if (sortedCollegesArray.includes(currentlySelectedCollege)) collegeDropdownElement.value = currentlySelectedCollege;
  if (sortedBranchesArray.includes(currentlySelectedBranch)) branchDropdownElement.value = currentlySelectedBranch;
}

function toggleCollegeDrilldownView(collegeKey) {
  expandedCollegesMap[collegeKey] = !expandedCollegesMap[collegeKey];
  calculateSystemMetricsAndDistributions();
}

function calculateSystemMetricsAndDistributions() {
  const costPerHead = parseFloat(document.getElementById('costPerPersonInput').value) || 0;

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
  
  const aggregateRevenueCalculated = approvedCount * costPerHead;
  document.getElementById('revenueCollected').innerText = "₹" + aggregateRevenueCalculated.toLocaleString('en-IN');

  const collegeArea = document.getElementById('distributionCollegeArea');
  const branchArea = document.getElementById('distributionBranchArea');
  const yearArea = document.getElementById('distributionYearArea');
  const trendsArea = document.getElementById('distributionTrendsArea');

  let colCountMap = {}, brCountMap = {}, yrCountMap = {}, trendTotalMap = {}, trendApprovedMap = {};
  let colRevMap = {}, brRevMap = {}, yrRevMap = {};
  let treeStructure = {};

  masterRecordsCache.forEach(r => {
    if (r.status !== 'Duplicate') {
      const cleanColKey = (r.college || 'N/A').trim().toUpperCase();
      const cleanBrKey = (r.branch || 'N/A').trim().toUpperCase();
      const cleanYrKey = "YEAR " + (r.year || 'N/A').toString().trim().toUpperCase();
      
      const countsAsRevenueTicket = (r.status === 'Approved' || r.status === 'Checked-in');

      if (countsAsRevenueTicket) {
        colCountMap[cleanColKey] = (colCountMap[cleanColKey] || 0) + 1;
        brCountMap[cleanBrKey] = (brCountMap[cleanBrKey] || 0) + 1;
        yrCountMap[cleanYrKey] = (yrCountMap[cleanYrKey] || 0) + 1;

        colRevMap[cleanColKey] = (colRevMap[cleanColKey] || 0) + costPerHead;
        brRevMap[cleanBrKey] = (brRevMap[cleanBrKey] || 0) + costPerHead;
        yrRevMap[cleanYrKey] = (yrRevMap[cleanYrKey] || 0) + costPerHead;

        if (!treeStructure[cleanColKey]) treeStructure[cleanColKey] = {};
        if (!treeStructure[cleanColKey][cleanBrKey]) treeStructure[cleanColKey][cleanBrKey] = {};
        treeStructure[cleanColKey][cleanBrKey][cleanYrKey] = (treeStructure[cleanColKey][cleanBrKey][cleanYrKey] || 0) + 1;
      }

      let dateKey = "Unknown Date";
      if (r.timestamp) {
        let splits = r.timestamp.split(",");
        if (splits.length > 0) dateKey = splits[0].trim();
      }
      trendTotalMap[dateKey] = (trendTotalMap[dateKey] || 0) + 1;
      if (countsAsRevenueTicket) {
        trendApprovedMap[dateKey] = (trendApprovedMap[dateKey] || 0) + 1;
      }
    }
  });

  collegeArea.innerHTML = Object.keys(colCountMap).sort().map(colKey => {
    const isExpanded = !!expandedCollegesMap[colKey];
    let drilldownHtml = "";

    if (isExpanded && treeStructure[colKey]) {
      drilldownHtml = `<div class="bg-slate-900/60 p-2 mt-1 rounded-lg border border-slate-700/40 space-y-1 text-[10px] text-slate-400">`;
      Object.keys(treeStructure[colKey]).sort().forEach(branchKey => {
        Object.keys(treeStructure[colKey][branchKey]).sort().forEach(yearKey => {
          const quantity = treeStructure[colKey][branchKey][yearKey];
          drilldownHtml += `
            <div class="flex items-center justify-between border-b border-slate-800/40 py-0.5">
              <span class="truncate max-w-[95px]" title="${branchKey} (${yearKey})">${branchKey} (${yearKey.replace("YEAR ","Y")})</span>
              <span>x${quantity} <span class="text-purple-400 font-bold">₹${(quantity * costPerHead).toLocaleString('en-IN')}</span></span>
            </div>`;
        });
      });
      drilldownHtml += `</div>`;
    }

    return `
      <div class="border-b border-slate-700/30 py-1.5 last:border-none">
        <div onclick="toggleCollegeDrilldownView('${colKey}')" class="flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-700/30 p-1 rounded transition">
          <span class="truncate max-w-[110px] font-bold text-slate-300 inline-flex items-center gap-1" title="${colKey}">${isExpanded ? '▼' : '▶'} ${colKey}</span>
          <span class="whitespace-nowrap text-right"><span class="text-slate-500 font-bold">x${colCountMap[colKey]}</span> <span class="text-blue-400 font-bold">₹${colRevMap[colKey].toLocaleString('en-IN')}</span></span>
        </div>
        ${drilldownHtml}
      </div>
    `;
  }).join('') || '<p class="text-slate-500 italic">No cleared transactions</p>';

  branchArea.innerHTML = Object.keys(brCountMap).sort().map(k => `<div class="flex items-center justify-between py-1 border-b border-slate-700/30 gap-2"><span class="truncate max-w-[120px] font-bold text-slate-300" title="${k}">${k}</span><span class="whitespace-nowrap"><span class="text-slate-500 font-bold">x${brCountMap[k]}</span> <span class="text-purple-400 font-bold">₹${brRevMap[k].toLocaleString('en-IN')}</span></span></div>`).join('') || '<p class="text-slate-500 italic">No approved data</p>';
  yearArea.innerHTML = Object.keys(yrCountMap).sort().map(k => `<div class="flex items-center justify-between py-1 border-b border-slate-700/30 gap-2"><span class="font-bold text-slate-300">${k}</span><span class="whitespace-nowrap"><span class="text-slate-500 font-bold">x${yrCountMap[k]}</span> <span class="text-emerald-400 font-bold">₹${yrRevMap[k].toLocaleString('en-IN')}</span></span></div>`).join('') || '<p class="text-slate-500 italic">No approved data</p>';

  trendsArea.innerHTML = Object.keys(trendTotalMap).map(k => `
    <div onclick="filterByRegistrationDateTimelineScope('${k}')" class="flex items-center justify-between py-1.5 px-1 border-b border-slate-700/30 hover:bg-slate-700/40 rounded cursor-pointer transition">
      <span class="font-bold text-slate-300 underline">${k}</span>
      <span class="text-right text-[10px]"><span class="text-slate-400">Total: <strong>${trendTotalMap[k]}</strong></span> | <span class="text-emerald-400">Approved: <strong>${trendApprovedMap[k] || 0}</strong></span></span>
    </div>
  `).join('') || '<p class="text-slate-500 italic">No historical entries</p>';
}

function toggleViewDisplayMatrix() {
  renderTargetedDataGrid();
}

function renderTargetedDataGrid() {
  const headBlock = document.getElementById('tableHeaderBlock');
  const bodyBlock = document.getElementById('tableBodyBlock');
  const costValue = parseFloat(document.getElementById('costPerPersonInput').value) || 0;
  
  const banner = document.getElementById('activeScopeBanner');
  const bannerText = document.getElementById('activeScopeText');
  
  const queryValue = document.getElementById('searchInput').value.toLowerCase().trim();
  const statusFilterValue = document.getElementById('filterStatus').value;
  const collegeFilterValue = document.getElementById('filterCollege').value;
  const branchFilterValue = document.getElementById('filterBranch').value;
  const yearFilterValue = document.getElementById('filterYear').value;

  if (activeDayFilterScope) {
    bannerText.innerText = `Displaying participants registered on date timeline: ${activeDayFilterScope}`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }

  let filteredRecordDataset = masterRecordsCache.filter(row => {
    if (activeDayFilterScope) {
      let rDate = "Unknown Date";
      if (row.timestamp) {
        let splits = row.timestamp.split(",");
        if (splits.length > 0) rDate = splits[0].trim();
      }
      if (rDate !== activeDayFilterScope) return false;
    }

    if (dashboardViewMode === "revenue") {
      return row.status === "Approved" || row.status === "Checked-in";
    } else if (dashboardViewMode === "attendance") {
      if (row.status === "Rejected" || row.status === "Duplicate") return false;
    } else {
      if (statusFilterValue !== "All") {
        if (statusFilterValue === "Approved" && row.status !== "Approved" && row.status !== "Checked-in") return false;
        if (statusFilterValue !== "Approved" && row.status !== statusFilterValue) return false;
      }
    }
    
    if (collegeFilterValue !== "All" && (row.college || '').trim().toUpperCase() !== collegeFilterValue) return false;
    if (branchFilterValue !== "All" && (row.branch || '').trim().toUpperCase() !== branchFilterValue) return false;
    if (yearFilterValue !== "All" && row.year.toString() !== yearFilterValue.toString()) return false;
    
    if (queryValue) {
      const rowSearchString = [row.regId, row.fullName, row.email, row.phone, row.college, row.branch, row.utr].join(" ").toLowerCase();
      if (!rowSearchString.includes(queryValue)) return false;
    }
    return true;
  });

  if (dashboardViewMode === "revenue") {
    filteredRecordDataset.sort((a, b) => a.rowNumber - b.rowNumber);
    
    headBlock.innerHTML = `
      <tr class="whitespace-nowrap">
        <th class="px-4 py-3.5 w-40">Ticket ID</th>
        <th class="px-4 py-3.5 w-64">Paying Participant</th>
        <th class="px-4 py-3.5 w-64">Normalized College Mapping</th>
        <th class="px-4 py-3.5 w-48">Branch Code</th>
        <th class="px-4 py-3.5 text-center w-20">Cohort Year</th>
        <th class="px-4 py-3.5 w-44">Transaction UTR Reference</th>
        <th class="px-4 py-3.5 text-right w-40">Amount Collected</th>
      </tr>
    `;

    if (filteredRecordDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="7" class="text-center py-16 text-slate-500 italic font-bold">No verified financial data entries found.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = filteredRecordDataset.map(user => `
      <tr class="hover:bg-slate-950/20 transition duration-100 border-b border-slate-700/20">
        <td class="px-4 py-3.5 font-mono font-bold text-slate-200 select-all">${user.regId}</td>
        <td class="px-4 py-3.5"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5">${user.email}</div></td>
        <td class="px-4 py-3.5 font-bold text-slate-300 uppercase">${user.college}</td>
        <td class="px-4 py-3.5 uppercase font-semibold text-slate-400">${user.branch}</td>
        <td class="px-4 py-3.5 text-center font-bold">${user.year}</td>
        <td class="px-4 py-3.5 font-mono text-[11px] text-slate-300">${user.utr}</td>
        <td class="px-4 py-3.5 text-right font-mono font-black text-purple-400">₹${costValue.toLocaleString('en-IN')}</td>
      </tr>`).join('');

  } else if (dashboardViewMode === "registration") {
    filteredRecordDataset.sort((a, b) => a.rowNumber - b.rowNumber);

    headBlock.innerHTML = `
      <tr class="whitespace-nowrap">
        <th class="px-4 py-3.5">Ticket ID</th>
        <th class="px-4 py-3.5">Participant Details</th>
        <th class="px-4 py-3.5">College / Branch</th>
        <th class="px-4 py-3.5 text-center w-12">Year</th>
        <th class="px-4 py-3.5">Transaction UTR</th>
        <th class="px-4 py-3.5">Receipt</th>
        <th class="px-4 py-3.5">Status</th>
        <th class="px-4 py-3.5 text-right">Actions</th>
      </tr>
    `;

    if (filteredRecordDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="8" class="text-center py-16 text-slate-500 italic font-bold">No matching entries found.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = filteredRecordDataset.map(user => {
      let trID = user.regId === "null" || !user.regId ? `<span class="text-slate-600 italic select-none">null</span>` : `<span class="font-mono font-bold text-slate-200 select-all whitespace-nowrap">${user.regId}</span>`;
      let badgeStyleClass = user.status === "Approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : (user.status === "Rejected" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : (user.status === "Checked-in" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"));
      if (user.status === "Duplicate") badgeStyleClass = "bg-purple-500/10 text-purple-400 border border-purple-500/20";

      return `
        <tr class="hover:bg-slate-950/20 transition duration-100 border-b border-slate-700/20">
          <td class="px-4 py-3.5 font-medium whitespace-nowrap">${trID}</td>
          <td class="px-4 py-3.5"><div class="font-bold text-slate-100 whitespace-nowrap max-w-[200px] truncate" title="${user.fullName}">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap max-w-[200px] truncate" title="${user.email}">${user.email}</div></td>
          <td class="px-4 py-3.5"><div class="uppercase font-bold text-slate-300 whitespace-nowrap max-w-[200px] truncate">${user.college}</div><div class="uppercase text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate">${user.branch}</div></td>
          <td class="px-4 py-3.5 font-black text-center whitespace-nowrap">${user.year}</td>
          <td class="px-4 py-3.5 font-mono text-[11px] tracking-wide text-slate-300 whitespace-nowrap">${user.utr}</td>
          <td class="px-4 py-3.5 whitespace-nowrap">${user.screenshot && user.screenshot !== "null" ? `<a href="${user.screenshot}" target="_blank" class="text-blue-400 font-bold underline">View Image</a>` : `<span class="text-slate-600 italic select-none">null</span>`}</td>
          <td class="px-4 py-3.5 whitespace-nowrap"><span class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${badgeStyleClass}">${user.status === 'Checked-in' ? 'Checked In' : user.status}</span></td>
          <td class="px-4 py-3.5 text-right whitespace-nowrap">
            ${user.status === 'Pending' ? `
              <button onclick="dispatchAdminOperationAction(${user.rowNumber}, 'approve')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow cursor-pointer transition">Approve</button>
              <button onclick="dispatchAdminOperationAction(${user.rowNumber}, 'reject')" class="bg-rose-600/10 hover:bg-rose-600 text-rose-400 text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition inline-block">Reject</button>
            ` : `<span class="text-slate-500 text-[10px] font-mono select-none">Processed</span>`}
          </td>
        </tr>`;
    }).join('');

  } else {
    filteredRecordDataset.sort((a, b) => {
      let aChecked = a.status === "Checked-in" && a.checkInTime !== "null";
      let bChecked = b.status === "Checked-in" && b.checkInTime !== "null";
      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      if (aChecked && bChecked) return new Date(b.checkInTime) - new Date(a.checkInTime);
      return a.rowNumber - b.rowNumber;
    });

    headBlock.innerHTML = `
      <tr class="whitespace-nowrap">
        <th class="px-4 py-3.5">Ticket ID</th>
        <th class="px-4 py-3.5">Participant Details</th>
        <th class="px-4 py-3.5">Institution & Department</th>
        <th class="px-4 py-3.5 text-center w-12">Year</th>
        <th class="px-4 py-3.5">Flow Status</th>
        <th class="px-4 py-3.5">Checked-In Arrival Time</th>
        <th class="px-4 py-3.5 text-right">Gate Operations</th>
      </tr>
    `;

    if (filteredRecordDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-slate-500 italic font-bold">No valid attendance entries identified.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = filteredRecordDataset.map(user => {
      let badgeStyleClass = user.status === "Checked-in" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";

      return `
        <tr class="hover:bg-slate-950/20 transition duration-100 border-b border-slate-700/20 ${user.status === 'Checked-in' ? 'bg-blue-950/10' : ''}">
          <td class="px-4 py-3.5 font-mono font-bold text-slate-300 whitespace-nowrap">${user.regId}</td>
          <td class="px-4 py-3.5"><div class="font-bold text-slate-100 whitespace-nowrap max-w-[200px] truncate" title="${user.fullName}">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">${user.phone}</div></td>
          <td class="px-4 py-3.5"><div class="uppercase font-bold text-slate-300 max-w-[200px] truncate" title="${user.college}">${user.college}</div><div class="uppercase text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate" title="${user.branch}">${user.branch}</div></td>
          <td class="px-4 py-3.5 font-black text-center whitespace-nowrap">${user.year}</td>
          <td class="px-4 py-3.5 whitespace-nowrap"><span class="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${badgeStyleClass}">${user.status === 'Checked-in' ? 'Checked In' : 'Unchecked'}</span></td>
          <td class="px-4 py-3.5 font-mono font-black text-slate-100 whitespace-nowrap">${user.checkInTime === 'null' || !user.checkInTime ? '<span class="text-slate-600 font-normal italic select-none">null</span>' : `⏱️ ${user.checkInTime}`}</td>
          <td class="px-4 py-3.5 text-right whitespace-nowrap">
            ${user.status !== 'Checked-in' ? `
              <button onclick="dispatchManualAttendanceCheckIn(${user.rowNumber}, '${user.fullName}')" class="bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg shadow cursor-pointer transition">✅ Mark Attendance</button>
            ` : `<span class="text-emerald-500 font-bold font-mono text-[10px] uppercase bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">Admitted</span>`}
          </td>
        </tr>`;
    }).join('');
  }
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

// FIX: Optimistic UI 2-way mutation instantly flips check-in badge local text values before hitting network channels
async function dispatchManualAttendanceCheckIn(rowNumber, attendeeName) {
  if (!confirm(`Manually verify ticket credentials and log gate attendance entry for ${attendeeName.toUpperCase()}?`)) return;
  
  // 1. Mutate local array element state instantly
  const matchedCacheIndex = masterRecordsCache.findIndex(r => r.rowNumber === parseInt(rowNumber));
  if (matchedCacheIndex !== -1) {
    masterRecordsCache[matchedCacheIndex].status = "Checked-in";
    masterRecordsCache[matchedCacheIndex].checkInTime = new Date().toLocaleTimeString();
    
    // 2. Re-render display layers immediately to give instantaneous visual feedback
    calculateSystemMetricsAndDistributions();
    renderTargetedDataGrid();
  }

  try {
    // 3. Dispatch the write to Google Sheets in the background to handle server sync
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "checkin", rowNumber: rowNumber })
    });
    const result = await response.json();
    console.log("Server Synchronization Callback Confirmed:", result.message);
  } catch (error) { 
    console.error("Delayed transmission sync fault: " + error.toString()); 
  }
}

function processCsvExportTask() {
  if (masterRecordsCache.length === 0) {
    alert("Export task canceled: Memory buffer contains zero rows.");
    return;
  }
  
  const csvHeadersRow = ["Timestamp", "Registration ID", "Full Name", "Email Address", "Phone Number", "College", "Branch", "Year", "UPI Transaction ID", "Screenshot Drive Link", "Status", "Check-In Timestamp"];
  const sanitizedStringRowsArray = masterRecordsCache.map(r => [
    `"${(r.timestamp || '').replace(/"/g, '""')}"`, `"${(r.regId || '').replace(/"/g, '""')}"`,
    `"${(r.fullName || '').replace(/"/g, '""')}"`, `"${(r.email || '').replace(/"/g, '""')}"`,
    `"${(r.phone || '').replace(/"/g, '""')}"`, `"${(r.college || '').replace(/"/g, '""')}"`,
    `"${(r.branch || '').replace(/"/g, '""')}"`, `"${(r.year || '').replace(/"/g, '""')}"`,
    `"${(r.utr || '').replace(/"/g, '""')}"`, `"${(r.screenshot || '').replace(/"/g, '""')}"`,
    `"${(r.status || '').replace(/"/g, '""')}"`, `"${(r.checkInTime || '').replace(/"/g, '""')}"`
  ].join(","));

  const fullCsvStringContent = csvHeadersRow.join(",") + "\n" + sanitizedStringRowsArray.join("\n");
  const binaryMemoryBlob = new Blob([fullCsvStringContent], { type: 'text/csv;charset=utf-8;' });
  const temporaryBlobDownloadUrlPointer = URL.createObjectURL(binaryMemoryBlob);
  
  const anchorDownloadLink = document.createElement("a");
  anchorDownloadLink.setAttribute("href", temporaryBlobDownloadUrlPointer);
  anchorDownloadLink.setAttribute("download", "AUNSF_Master_Event_Report_2026.csv");
  document.body.appendChild(anchorDownloadLink);
  anchorDownloadLink.click(); 
  document.body.removeChild(anchorDownloadLink);
  URL.revokeObjectURL(temporaryBlobDownloadUrlPointer); 
}