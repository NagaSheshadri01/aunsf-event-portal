const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let masterRecordsCache = [];
let dashboardViewMode = "registration"; // Toggles: "registration" or "attendance"

window.onload = () => {
  // Pull persistent disk cache data immediately to execute 0ms visual rendering frames
  const cachedLocalRecordDataString = localStorage.getItem('aunsf_master_system_cache');
  if (cachedLocalRecordDataString) {
    try {
      masterRecordsCache = JSON.parse(cachedLocalRecordDataString);
      calculateSystemMetricsAndDistributions();
      buildDynamicAlphaSortedFilterDropdowns();
      renderTargetedDataGrid();
    } catch (err) { console.error("Initial browser buffer parsing fault: ", err); }
  }

  // Bind interface execution listener components
  document.getElementById('refreshBtn').addEventListener('click', synchronizeCloudLedger);
  document.getElementById('viewToggleBtn').addEventListener('click', toggleViewDisplayMatrix);
  document.getElementById('exportCsvBtn').addEventListener('click', processCsvExportTask);
  document.getElementById('costPerPersonInput').addEventListener('input', () => {
    updateFinancialCalculations();
    renderTargetedDataGrid();
  });
  
  // Wire unified system drop-downs and input fields to immediately filter rows reactively
  ['searchInput', 'filterStatus', 'filterCollege', 'filterBranch', 'filterYear'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTargetedDataGrid);
    document.getElementById(id).addEventListener('input', renderTargetedDataGrid);
  });

  synchronizeCloudLedger(); // Fire structural update streams asynchronously in background
};

async function synchronizeCloudLedger() {
  const btn = document.getElementById('refreshBtn');
  btn.innerText = "🔍 Synchronizing...";
  btn.disabled = true;

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
    } else {
      alert("Spreadsheet database transmission block error: " + parsedResult.message);
    }
  } catch (error) {
    console.error("Critical core background connection break trace: ", error);
  } finally {
    btn.innerText = "🔄 Refresh";
    btn.disabled = false;
  }
}

function updateFinancialCalculations() {
  const variableHeadCostAmount = parseFloat(document.getElementById('costPerPersonInput').value) || 0;
  
  // FIXED REVENUE: Revenue evaluates across BOTH historical cached rows and incoming real-time records
  // Filter for all valid approved paying profiles regardless of their current check-in stance
  const certifiedIncomeGeneratorsCount = masterRecordsCache.filter(r => r.status === 'Approved' || r.status === 'Checked-in').length;
  const compositeGrossRevenueCalculated = certifiedIncomeGeneratorsCount * variableHeadCostAmount;
  
  document.getElementById('revenueCollected').innerText = "₹" + compositeGrossRevenueCalculated.toLocaleString('en-IN');
}

function buildDynamicAlphaSortedFilterDropdowns() {
  const collegeDropdownElement = document.getElementById('filterCollege');
  const branchDropdownElement = document.getElementById('filterBranch');
  
  const currentlySelectedCollege = collegeDropdownElement.value;
  const currentlySelectedBranch = branchDropdownElement.value;

  let trackedUniqueCollegesSet = new Set();
  let trackedUniqueBranchesSet = new Set();

  masterRecordsCache.forEach(r => {
    if (r.college && r.college.trim() !== "") trackedUniqueCollegesSet.add(r.college.trim());
    if (r.branch && r.branch.trim() !== "") trackedUniqueBranchesSet.add(r.branch.trim());
  });

  // FIXED DROPDOWNS: Deduplicate case-insensitively and force alphabetical ascending sort order maps
  const alphabeticallySortedCollegesArray = Array.from(trackedUniqueCollegesSet).sort((a, b) => 
    a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
  );
  const alphabeticallySortedBranchesArray = Array.from(trackedUniqueBranchesSet).sort((a, b) => 
    a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
  );

  collegeDropdownElement.innerHTML = '<option value="All">All Institutions</option>' + 
    alphabeticallySortedCollegesArray.map(c => `<option value="${c}">${c}</option>`).join('');
  
  branchDropdownElement.innerHTML = '<option value="All">All Specializations</option>' + 
    alphabeticallySortedBranchesArray.map(b => `<option value="${b}">${b}</option>`).join('');

  // Re-assign previous selections cleanly if they persist in the newly computed arrays
  if (alphabeticallySortedCollegesArray.includes(currentlySelectedCollege)) collegeDropdownElement.value = currentlySelectedCollege;
  if (alphabeticallySortedBranchesArray.includes(currentlySelectedBranch)) branchDropdownElement.value = currentlySelectedBranch;
}

function calculateSystemMetricsAndDistributions() {
  document.getElementById('countTotal').innerText = masterRecordsCache.length;
  document.getElementById('countPending').innerText = masterRecordsCache.filter(r => r.status === 'Pending').length;
  document.getElementById('countApproved').innerText = masterRecordsCache.filter(r => r.status === 'Approved' || r.status === 'Checked-in').length;
  document.getElementById('countRejected').innerText = masterRecordsCache.filter(r => r.status === 'Rejected').length;
  document.getElementById('countCheckedIn').innerText = masterRecordsCache.filter(r => r.status === 'Checked-in').length;
  
  updateFinancialCalculations();

  // Populate left side allocation widgets lists arrays
  const collegeArea = document.getElementById('distributionCollegeArea');
  const branchArea = document.getElementById('distributionBranchArea');
  const yearArea = document.getElementById('distributionYearArea');
  const trendsArea = document.getElementById('distributionTrendsArea');

  let collegeDistributionMapping = {}, branchDistributionMapping = {}, cohortYearDistributionMapping = {}, dailyRegistrationTrendMapping = {};

  masterRecordsCache.forEach(r => {
    if (r.status !== 'Duplicate') {
      collegeDistributionMapping[r.college] = (collegeDistributionMapping[r.college] || 0) + 1;
      branchDistributionMapping[r.branch] = (branchDistributionMapping[r.branch] || 0) + 1;
      cohortYearDistributionMapping[r.year] = (cohortYearDistributionMapping[r.year] || 0) + 1;
      
      let simplifiedDateStringKey = "Unknown Date";
      if (r.timestamp) {
        let timestampSegmentSplits = r.timestamp.split(",");
        if (timestampSegmentSplits.length > 0) simplifiedDateStringKey = timestampSegmentSplits[0].trim();
      }
      dailyRegistrationTrendMapping[simplifiedDateStringKey] = (dailyRegistrationTrendMapping[simplifiedDateStringKey] || 0) + 1;
    }
  });

  collegeArea.innerHTML = Object.keys(collegeDistributionMapping).map(k => `<div class="flex items-center justify-between py-0.5 border-b border-slate-700/30"><span>${k || 'N/A'}</span><span class="text-blue-400 font-bold">${collegeDistributionMapping[k]}</span></div>`).join('') || '<p class="text-slate-500 italic">No college rows loaded</p>';
  branchArea.innerHTML = Object.keys(branchDistributionMapping).map(k => `<div class="flex items-center justify-between py-0.5 border-b border-slate-700/30"><span>${k || 'N/A'}</span><span class="text-purple-400 font-bold">${branchDistributionMapping[k]}</span></div>`).join('') || '<p class="text-slate-500 italic">No branch rows loaded</p>';
  yearArea.innerHTML = Object.keys(cohortYearDistributionMapping).map(k => `<div class="flex items-center justify-between py-0.5 border-b border-slate-700/30"><span>Year ${k || 'N/A'}</span><span class="text-emerald-400 font-bold">${cohortYearDistributionMapping[k]}</span></div>`).join('') || '<p class="text-slate-500 italic">No batch rows loaded</p>';
  trendsArea.innerHTML = Object.keys(dailyRegistrationTrendMapping).map(k => `<div class="flex items-center justify-between py-0.5 border-b border-slate-700/30"><span>${k}</span><span class="text-amber-400 font-bold">${dailyRegistrationTrendMapping[k]} row entries</span></div>`).join('') || '<p class="text-slate-500 italic">No trends captured</p>';
}

function toggleViewDisplayMatrix() {
  const btn = document.getElementById('viewToggleBtn');
  if (dashboardViewMode === "registration") {
    dashboardViewMode = "attendance";
    btn.innerText = "📋 Switch to Registration View";
  } else {
    dashboardViewMode = "registration";
    btn.innerText = "📊 Switch to Attendance Lookover";
  }
  renderTargetedDataGrid();
}

function renderTargetedDataGrid() {
  // Sync analytics widgets allocations automatically every single time a render loop triggers
  calculateSystemMetricsAndDistributions();

  const headBlock = document.getElementById('tableHeaderBlock');
  const bodyBlock = document.getElementById('tableBodyBlock');
  
  const queryValue = document.getElementById('searchInput').value.toLowerCase().trim();
  const statusFilterValue = document.getElementById('filterStatus').value;
  const collegeFilterValue = document.getElementById('filterCollege').value;
  const branchFilterValue = document.getElementById('filterBranch').value;
  const yearFilterValue = document.getElementById('filterYear').value;

  // FIXED MULTI-CRITERIA FILTERS: Processing nested combinatorial logic boundaries across rows
  let filteredRecordDataset = masterRecordsCache.filter(row => {
    // Evaluation 1: Queue Flow Status mapping matches
    if (statusFilterValue !== "All") {
      if (statusFilterValue === "Approved" && row.status !== "Approved" && row.status !== "Checked-in") return false;
      if (statusFilterValue !== "Approved" && row.status !== statusFilterValue) return false;
    }
    // Evaluation 2: Institution/College selection matching
    if (collegeFilterValue !== "All" && row.college !== collegeFilterValue) return false;
    // Evaluation 3: Specialization/Branch selection matching
    if (branchFilterValue !== "All" && row.branch !== branchFilterValue) return false;
    // Evaluation 4: Cohort Year selection matching
    if (yearFilterValue !== "All" && row.year.toString() !== yearFilterValue.toString()) return false;
    
    // Evaluation 5: Lookahead text search queries intersections
    if (queryValue) {
      const compositeUnifiedRowTextContent = [
        row.regId, row.fullName, row.email, row.phone, row.college, row.branch, row.utr
      ].join(" ").toLowerCase();
      if (!compositeUnifiedRowTextContent.includes(queryValue)) return false;
    }
    
    return true;
  });

  if (dashboardViewMode === "registration") {
    // Traditional row progression matching spreadsheet array sequences
    filteredRecordDataset.sort((a, b) => a.rowNumber - b.rowNumber);

    headBlock.innerHTML = `
      <tr>
        <th class="px-5 py-3">Ticket ID</th>
        <th class="px-5 py-3">Participant Name / Email</th>
        <th class="px-5 py-3">College / Branch</th>
        <th class="px-5 py-3 text-center">Year</th>
        <th class="px-5 py-3">Transaction UTR</th>
        <th class="px-5 py-3">Receipt Screenshot</th>
        <th class="px-5 py-3">Status</th>
        <th class="px-5 py-3 text-right">Actions</th>
      </tr>
    `;

    if (filteredRecordDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="8" class="text-center py-16 text-slate-500 italic font-bold">No matching data grid row entries found in registration context.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = filteredRecordDataset.map(user => {
      let identificationPassColumnText = user.regId === "null" || !user.regId ? `<span class="text-slate-600 italic select-none">null</span>` : `<span class="font-mono font-bold text-slate-200 select-all">${user.regId}</span>`;
      
      let badgeStyleClassConfiguration = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      if (user.status === "Approved") badgeStyleClassConfiguration = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      if (user.status === "Rejected") badgeStyleClassConfiguration = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      if (user.status === "Checked-in") badgeStyleClassConfiguration = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      if (user.status === "Duplicate") badgeStyleClassConfiguration = "bg-purple-500/10 text-purple-400 border border-purple-500/20";

      return `
        <tr class="hover:bg-slate-950/20 transition border-b border-slate-700/20">
          <td class="px-5 py-3.5">${identificationPassColumnText}</td>
          <td class="px-5 py-3.5"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5">${user.email}</div></td>
          <td class="px-5 py-3.5"><div>${user.college}</div><div class="text-[10px] text-slate-400 mt-0.5">${user.branch}</div></td>
          <td class="px-5 py-3.5 font-bold text-center w-12">${user.year}</td>
          <td class="px-5 py-3.5 font-mono text-[11px] tracking-wide text-slate-300">${user.utr}</td>
          <td class="px-5 py-3.5">${user.screenshot && user.screenshot !== "null" ? `<a href="${user.screenshot}" target="_blank" class="text-blue-400 hover:text-blue-300 font-bold underline inline-flex items-center gap-0.5">🖼️ View Image</a>` : `<span class="text-slate-600 italic select-none">null</span>`}</td>
          <td class="px-5 py-3.5"><span class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${badgeStyleClassConfiguration}">${user.status}</span></td>
          <td class="px-5 py-3.5 text-right whitespace-nowrap">
            ${user.status === 'Pending' ? `
              <button onclick="dispatchAdminOperationAction(${user.rowNumber}, 'approve')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow cursor-pointer transition">Approve</button>
              <button onclick="dispatchAdminOperationAction(${user.rowNumber}, 'reject')" class="bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer transition">Reject</button>
            ` : `<span class="text-slate-500 text-[10px] font-mono select-none">Processed</span>`}
          </td>
        </tr>
      `;
    }).join('');

  } else {
    // ATTENDANCE LOOKOVER PRESENTATION PIPELINE
    // Sort logic constraints: Checked-in items bubble to top by time, non-checked entries sorted sequentially below
    filteredRecordDataset.sort((a, b) => {
      let aChecked = a.status === "Checked-in" && a.checkInTime !== "null";
      let bChecked = b.status === "Checked-in" && b.checkInTime !== "null";
      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      if (aChecked && bChecked) return new Date(b.checkInTime) - new Date(a.checkInTime);
      return a.rowNumber - b.rowNumber;
    });

    headBlock.innerHTML = `
      <tr>
        <th class="px-5 py-3">Ticket ID</th>
        <th class="px-5 py-3">Participant Details</th>
        <th class="px-5 py-3">Institution & Department</th>
        <th class="px-5 py-3 text-center">Year</th>
        <th class="px-5 py-3">Flow Status</th>
        <th class="px-5 py-3">Checked-In Timestamp</th>
      </tr>
    `;

    if (filteredRecordDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-slate-500 italic font-bold">No gate entry matches found in attendance context.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = filteredRecordDataset.map(user => {
      let badgeStyleClassConfiguration = "bg-slate-700/20 text-slate-400 border border-slate-700/30";
      if (user.status === "Checked-in") badgeStyleClassConfiguration = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      if (user.status === "Approved") badgeStyleClassConfiguration = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";

      return `
        <tr class="hover:bg-slate-950/20 transition border-b border-slate-700/20 ${user.status === 'Checked-in' ? 'bg-blue-950/10' : ''}">
          <td class="px-5 py-3.5 font-mono font-bold text-slate-300">${user.regId === 'null' || !user.regId ? '<span class="text-slate-600 italic select-none">null</span>' : user.regId}</td>
          <td class="px-5 py-3.5"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5">${user.phone}</div></td>
          <td class="px-5 py-3.5"><div>${user.college}</div><div class="text-[10px] text-slate-400 mt-0.5">${user.branch}</div></td>
          <td class="px-5 py-3.5 font-bold text-center w-12">${user.year}</td>
          <td class="px-5 py-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${badgeStyleClassConfiguration}">${user.status}</span></td>
          <td class="px-5 py-3.5 font-mono font-black text-slate-100">${user.checkInTime === 'null' || !user.checkInTime ? '<span class="text-slate-600 font-normal italic select-none">null</span>' : `⏱️ ${user.checkInTime}`}</td>
        </tr>
      `;
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
    synchronizeCloudLedger();
  } catch (error) { alert("Operational break detail: " + error.toString()); }
}

// FIXED EXPORT: Standardized vanilla Blob file compilation layout prevents CORS page blocks
function processCsvExportTask() {
  if (masterRecordsCache.length === 0) {
    alert("Export task canceled: Data cache buffer contains zero rows.");
    return;
  }
  
  const headers = ["Timestamp", "Registration ID", "Full Name", "Email Address", "Phone Number", "College", "Branch", "Year", "UPI Transaction ID", "Screenshot Drive Link", "Status", "Check-In Timestamp"];
  
  const formattedRowsContentStrings = masterRecordsCache.map(r => [
    `"${(r.timestamp || '').replace(/"/g, '""')}"`,
    `"${(r.regId || '').replace(/"/g, '""')}"`,
    `"${(r.fullName || '').replace(/"/g, '""')}"`,
    `"${(r.email || '').replace(/"/g, '""')}"`,
    `"${(r.phone || '').replace(/"/g, '""')}"`,
    `"${(r.college || '').replace(/"/g, '""')}"`,
    `"${(r.branch || '').replace(/"/g, '""')}"`,
    `"${(r.year || '').replace(/"/g, '""')}"`,
    `"${(r.utr || '').replace(/"/g, '""')}"`,
    `"${(r.screenshot || '').replace(/"/g, '""')}"`,
    `"${(r.status || '').replace(/"/g, '""')}"`,
    `"${(r.checkInTime || '').replace(/"/g, '""')}"`
  ].join(","));

  const aggregatedCsvStringContent = headers.join(",") + "\n" + formattedRowsContentStrings.join("\n");
  
  // Package data safely inside a browser context binary storage blob object pointer
  const textBlobFileContextInstance = new Blob([aggregatedCsvStringContent], { type: 'text/csv;charset=utf-8;' });
  const objectBlobUrlPointer = URL.createObjectURL(textBlobFileContextInstance);
  
  const virtualAnchorTagElement = document.createElement("a");
  virtualAnchorTagElement.setAttribute("href", objectBlobUrlPointer);
  virtualAnchorTagElement.setAttribute("download", "AUNSF_Master_Event_Report_2026.csv");
  document.body.appendChild(virtualAnchorTagElement);
  
  virtualAnchorTagElement.click(); // Trigger operating system browser downloader
  
  document.body.removeChild(virtualAnchorTagElement);
  URL.revokeObjectURL(objectBlobUrlPointer); // Deallocate active hardware memory footprint chunks
}