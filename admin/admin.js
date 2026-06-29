const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let masterRecordsCache = [];
let dashboardViewMode = "registration"; // Config toggles: "registration" or "attendance"

window.onload = () => {
  // Read local browser storage arrays instantly to remove visual flash overhead
  const localCacheString = localStorage.getItem('aunsf_master_system_cache');
  if (localCacheString) {
    try {
      masterRecordsCache = JSON.parse(localCacheString);
      calculateSystemMetricsAndDistributions();
    } catch (err) { console.error("Cache buffer execution failure: ", err); }
  }

  // Bind active DOM interactive event loops listeners
  document.getElementById('refreshBtn').addEventListener('click', synchronizeCloudLedger);
  document.getElementById('viewToggleBtn').addEventListener('click', toggleViewDisplayMatrix);
  document.getElementById('exportCsvBtn').addEventListener('click', processCsvExportTask);
  document.getElementById('costPerPersonInput').addEventListener('input', updateFinancialCalculations);
  
  // Wire unified reactive select filters elements
  ['searchInput', 'filterStatus', 'filterCollege', 'filterBranch', 'filterYear'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTargetedDataGrid);
    document.getElementById(id).addEventListener('input', renderTargetedDataGrid);
  });

  synchronizeCloudLedger(); // Launch cloud sync loops asynchronously on boot
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
      populateDynamicFilterDropdownOptions();
      calculateSystemMetricsAndDistributions();
    } else {
      alert("Spreadsheet connection rejected: " + parsedResult.message);
    }
  } catch (error) {
    console.error("Fatal API architecture connection crash trace: ", error);
  } finally {
    btn.innerText = "🔄 Refresh";
    btn.disabled = false;
    renderTargetedDataGrid();
  }
}

function updateFinancialCalculations() {
  const headCost = parseFloat(document.getElementById('costPerPersonInput').value) || 0;
  // Financial metrics calculations are strictly based on confirmed/admitted entries (Approved + Checked-in)
  const incomeGenerators = masterRecordsCache.filter(r => r.status === 'Approved' || r.status === 'Checked-in').length;
  const netEarningsSum = incomeGenerators * headCost;
  
  document.getElementById('revenueCollected').innerText = "₹" + netEarningsSum.toLocaleString('en-IN');
}

function calculateSystemMetricsAndDistributions() {
  // 1. Assign Basic Counters
  document.getElementById('countTotal').innerText = masterRecordsCache.length;
  document.getElementById('countPending').innerText = masterRecordsCache.filter(r => r.status === 'Pending').length;
  document.getElementById('countApproved').innerText = masterRecordsCache.filter(r => r.status === 'Approved' || r.status === 'Checked-in').length;
  document.getElementById('countRejected').innerText = masterRecordsCache.filter(r => r.status === 'Rejected').length;
  document.getElementById('countCheckedIn').innerText = masterRecordsCache.filter(r => r.status === 'Checked-in').length;
  
  updateFinancialCalculations();

  // 2. Clear out allocation data areas
  const collegeArea = document.getElementById('distributionCollegeArea');
  const branchArea = document.getElementById('distributionBranchArea');
  const yearArea = document.getElementById('distributionYearArea');
  const trendsArea = document.getElementById('distributionTrendsArea');

  let colMap = {}, brMap = {}, yrMap = {}, trendMap = {};

  masterRecordsCache.forEach(r => {
    if (r.status !== 'Duplicate') {
      // Demographics map accumulation parameters
      colMap[r.college] = (colMap[r.college] || 0) + 1;
      brMap[r.branch] = (brMap[r.branch] || 0) + 1;
      yrMap[r.year] = (yrMap[r.year] || 0) + 1;
      
      // Compute daily trends indices mapping plain date sequences from Timestamp strings
      let entryDateStr = "Unknown Date";
      if (r.timestamp) {
        let blankSplits = r.timestamp.split(",");
        if (blankSplits.length > 0) entryDateStr = blankSplits[0].trim();
      }
      trendMap[entryDateStr] = (trendMap[entryDateStr] || 0) + 1;
    }
  });

  // 3. Render analytical metrics cards inner tracking data list items
  collegeArea.innerHTML = Object.keys(colMap).map(k => `<div class="flex items-center justify-between py-0.5 border-b border-slate-700/30"><span>${k || 'N/A'}</span><span class="text-blue-400 font-bold">${colMap[k]}</span></div>`).join('') || '<p class="text-slate-500 italic">No entries parsed</p>';
  branchArea.innerHTML = Object.keys(brMap).map(k => `<div class="flex items-center justify-between py-0.5 border-b border-slate-700/30"><span>${k || 'N/A'}</span><span class="text-purple-400 font-bold">${brMap[k]}</span></div>`).join('') || '<p class="text-slate-500 italic">No entries parsed</p>';
  yearArea.innerHTML = Object.keys(yrMap).map(k => `<div class="flex items-center justify-between py-0.5 border-b border-slate-700/30"><span>Year ${k || 'N/A'}</span><span class="text-emerald-400 font-bold">${yrMap[k]}</span></div>`).join('') || '<p class="text-slate-500 italic">No entries parsed</p>';
  trendsArea.innerHTML = Object.keys(trendMap).map(k => `<div class="flex items-center justify-between py-0.5 border-b border-slate-700/30"><span>${k}</span><span class="text-amber-400 font-bold">${trendMap[k]} applicants</span></div>`).join('') || '<p class="text-slate-500 italic">No trends captured</p>';
}

function populateDynamicFilterDropdownOptions() {
  const colDropdown = document.getElementById('filterCollege');
  const brDropdown = document.getElementById('filterBranch');
  
  const selectedCol = colDropdown.value;
  const selectedBr = brDropdown.value;

  let unifiedColleges = new Set(), unifiedBranches = new Set();
  masterRecordsCache.forEach(r => {
    if (r.college) unifiedColleges.add(r.college.trim());
    if (r.branch) unifiedBranches.add(r.branch.trim());
  });

  colDropdown.innerHTML = '<option value="All">All Institutions</option>' + Array.from(unifiedColleges).map(c => `<option value="${c}">${c}</option>`).join('');
  brDropdown.innerHTML = '<option value="All">All Specializations</option>' + Array.from(unifiedBranches).map(b => `<option value="${b}">${b}</option>`).join('');

  colDropdown.value = selectedCol;
  brDropdown.value = selectedBr;
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
  const headerBlock = document.getElementById('tableHeaderBlock');
  const bodyBlock = document.getElementById('tableBodyBlock');
  
  // Extract state tracking filters values
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const statusFilter = document.getElementById('filterStatus').value;
  const collegeFilter = document.getElementById('filterCollege').value;
  const branchFilter = document.getElementById('filterBranch').value;
  const yearFilter = document.getElementById('filterYear').value;

  // 1. Process dataset filtering boundaries
  let workingDataset = [...masterRecordsCache];

  if (statusFilter !== "All") {
    workingDataset = workingDataset.filter(r => r.status === statusFilter || (statusFilter === "Approved" && r.status === "Checked-in"));
  }
  if (collegeFilter !== "All") {
    workingDataset = workingDataset.filter(r => r.college === collegeFilter);
  }
  if (branchFilter !== "All") {
    workingDataset = workingDataset.filter(r => r.branch === branchFilter);
  }
  if (yearFilter !== "All") {
    workingDataset = workingDataset.filter(r => r.year === yearFilter);
  }

  // Apply lookahead query matching parameters
  if (query) {
    workingDataset = workingDataset.filter(r => 
      r.fullName.toLowerCase().includes(query) ||
      r.utr.toLowerCase().includes(query) ||
      r.regId.toLowerCase().includes(query) ||
      r.email.toLowerCase().includes(query) ||
      r.phone.includes(query) ||
      r.college.toLowerCase().includes(query)
    );
  }

  // 2. Select display format route pipeline
  if (dashboardViewMode === "registration") {
    // Sequential presentation matching original sheet entry row index arrays sequence
    workingDataset.sort((a, b) => a.rowNumber - b.rowNumber);

    headerBlock.innerHTML = `
      <tr>
        <th class="px-5 py-3">Registration ID</th>
        <th class="px-5 py-3">Participant Name / Email</th>
        <th class="px-5 py-3">College / Branch</th>
        <th class="px-5 py-3">Year</th>
        <th class="px-5 py-3">Transaction UTR</th>
        <th class="px-5 py-3">Receipt Screenshot</th>
        <th class="px-5 py-3">Status</th>
        <th class="px-5 py-3 text-right">Actions</th>
      </tr>
    `;

    if (workingDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="8" class="text-center py-12 text-slate-500 italic font-bold">No matching records found in this view context.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = workingDataset.map(user => {
      let trID = user.regId === "null" || !user.regId ? `<span class="text-slate-600 italic">null</span>` : `<span class="font-mono font-bold text-slate-200 select-all">${user.regId}</span>`;
      
      let badgeStyle = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      if (user.status === "Approved") badgeStyle = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      if (user.status === "Rejected") badgeStyle = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      if (user.status === "Checked-in") badgeStyle = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      if (user.status === "Duplicate") badgeStyle = "bg-purple-500/10 text-purple-400 border border-purple-500/20";

      return `
        <tr class="hover:bg-slate-950/20 transition duration-100 border-b border-slate-700/20">
          <td class="px-5 py-3.5">${trID}</td>
          <td class="px-5 py-3.5"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5">${user.email}</div></td>
          <td class="px-5 py-3.5"><div>${user.college}</div><div class="text-[10px] text-slate-400 mt-0.5">${user.branch}</div></td>
          <td class="px-5 py-3.5 font-bold text-center w-12">${user.year}</td>
          <td class="px-5 py-3.5 font-mono text-[11px] tracking-wide text-slate-300">${user.utr}</td>
          <td class="px-5 py-3.5">${user.screenshot && user.screenshot !== "null" ? `<a href="${user.screenshot}" target="_blank" class="text-blue-400 hover:text-blue-300 font-bold underline inline-flex items-center gap-0.5">🖼️ View Image</a>` : `<span class="text-slate-600 italic">null</span>`}</td>
          <td class="px-5 py-3.5"><span class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${badgeStyle}">${user.status}</span></td>
          <td class="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
            ${user.status === 'Pending' ? `
              <button onclick="dispatchAction(${user.rowNumber}, 'approve')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow cursor-pointer transition">Approve</button>
              <button onclick="dispatchAction(${user.rowNumber}, 'reject')" class="bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer transition">Reject</button>
            ` : `<span class="text-slate-500 text-[10px] font-mono select-none">Processed</span>`}
          </td>
        </tr>
      `;
    }).join('');

  } else {
    // ATTENDANCE LOOKOVER PROCESSING PIPELINE
    // Chronological sorting layer constraints: Checked-in profiles bubble up to the top by date/time
    workingDataset.sort((a, b) => {
      let aChecked = a.status === "Checked-in" && a.checkInTime !== "null";
      let bChecked = b.status === "Checked-in" && b.checkInTime !== "null";
      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      if (aChecked && bChecked) return new Date(b.checkInTime) - new Date(a.checkInTime);
      return a.rowNumber - b.rowNumber;
    });

    headerBlock.innerHTML = `
      <tr>
        <th class="px-5 py-3">Registration ID</th>
        <th class="px-5 py-3">Participant Details</th>
        <th class="px-5 py-3">Institution & Department</th>
        <th class="px-5 py-3">Year</th>
        <th class="px-5 py-3">Flow Status</th>
        <th class="px-5 py-3">Checked-In Arrival Time</th>
      </tr>
    `;

    if (workingDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-slate-500 italic font-bold">No gate entry matches identified.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = workingDataset.map(user => {
      let badgeStyle = "bg-slate-700/20 text-slate-400 border border-slate-700/30";
      if (user.status === "Checked-in") badgeStyle = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      if (user.status === "Approved") badgeStyle = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";

      return `
        <tr class="hover:bg-slate-950/20 transition duration-100 border-b border-slate-700/20 ${user.status === 'Checked-in' ? 'bg-blue-950/10' : ''}">
          <td class="px-5 py-3.5 font-mono font-bold text-slate-300">${user.regId === 'null' || !user.regId ? '<span class="text-slate-600 italic">null</span>' : user.regId}</td>
          <td class="px-5 py-3.5"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5">${user.phone}</div></td>
          <td class="px-5 py-3.5"><div>${user.college}</div><div class="text-[10px] text-slate-400 mt-0.5">${user.branch}</div></td>
          <td class="px-5 py-3.5 font-bold text-center w-12">${user.year}</td>
          <td class="px-5 py-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${badgeStyle}">${user.status}</span></td>
          <td class="px-5 py-3.5 font-mono font-black text-slate-100">${user.checkInTime === 'null' || !user.checkInTime ? '<span class="text-slate-600 font-normal italic">null</span>' : `⏱️ ${user.checkInTime}`}</td>
        </tr>
      `;
    }).join('');
  }
}

async function dispatchAction(rowNumber, actionName) {
  if (!confirm(`Execute system validation state change [${actionName.toUpperCase()}] on record reference entry #${rowNumber}?`)) return;
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: actionName, rowNumber: rowNumber })
    });
    const result = await response.json();
    alert(result.message);
    synchronizeCloudLedger();
  } catch (error) {
    alert("API operational update fault: " + error.toString());
  }
}

function processCsvExportTask() {
  if (masterRecordsCache.length === 0) {
    alert("Export denied: Core memory buffer dataset is completely empty.");
    return;
  }
  
  // Format column layout indices matching core specifications sheet metrics
  const headers = ["Timestamp", "Registration ID", "Full Name", "Email", "Phone", "College", "Branch", "Year", "UTR ID", "Receipt URL", "Status", "Check-In Time"];
  
  let csvContent = "data:text/csv;charset=utf-8," 
    + headers.join(",") + "\n"
    + masterRecordsCache.map(r => [
        `"${r.timestamp}"`, `"${r.regId}"`, `"${r.fullName}"`, `"${r.email}"`, 
        `"${r.phone}"`, `"${r.college}"`, `"${r.branch}"`, `"${r.year}"`, 
        `"${r.utr}"`, `"${r.screenshot}"`, `"${r.status}"`, `"${r.checkInTime}"`
      ].join(",")).join("\n");
      
  const linkDecoder = encodeURI(csvContent);
  const anchorTagElement = document.createElement("a");
  anchorTagElement.setAttribute("href", linkDecoder);
  anchorTagElement.setAttribute("download", `AUNSF_Master_Event_Report_2026.csv`);
  document.body.appendChild(anchorTagElement);
  anchorTagElement.click();
  document.body.removeChild(anchorTagElement);
}