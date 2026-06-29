const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let masterRecordsCache = [];
let dashboardViewMode = "registration"; // Configuration parameters: "registration" or "attendance"

window.onload = () => {
  const cachedLocalRecordDataString = localStorage.getItem('aunsf_master_system_cache');
  if (cachedLocalRecordDataString) {
    try {
      masterRecordsCache = JSON.parse(cachedLocalRecordDataString);
      calculateSystemMetricsAndDistributions();
      buildDynamicAlphaSortedFilterDropdowns();
      renderTargetedDataGrid();
    } catch (err) { console.error("Initial buffer read trace error: ", err); }
  }

  // Bind active control listeners
  document.getElementById('refreshBtn').addEventListener('click', synchronizeCloudLedger);
  document.getElementById('viewToggleBtn').addEventListener('click', toggleViewDisplayMatrix);
  document.getElementById('exportCsvBtn').addEventListener('click', processCsvExportTask);
  document.getElementById('clearFiltersBtn').addEventListener('click', clearAllActiveFilters);
  document.getElementById('costPerPersonInput').addEventListener('input', () => {
    calculateSystemMetricsAndDistributions();
    renderTargetedDataGrid();
  });
  
  // Wire unified filter controls to immediately re-evaluate table rows dynamically
  ['searchInput', 'filterStatus', 'filterCollege', 'filterBranch', 'filterYear'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTargetedDataGrid);
    document.getElementById(id).addEventListener('input', renderTargetedDataGrid);
  });

  synchronizeCloudLedger(); // Launch cloud sync loops asynchronously on layout bootup
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

function clearAllActiveFilters() {
  document.getElementById('searchInput').value = "";
  document.getElementById('filterStatus').value = "All";
  document.getElementById('filterCollege').value = "All";
  document.getElementById('filterBranch').value = "All";
  document.getElementById('filterYear').value = "All";
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

  let colCountMap = {}, brCountMap = {}, yrCountMap = {}, trendCountMap = {};
  let colRevMap = {}, brRevMap = {}, yrRevMap = {};

  masterRecordsCache.forEach(r => {
    if (r.status !== 'Duplicate') {
      const cleanColKey = (r.college || 'N/A').trim().toUpperCase();
      const cleanBrKey = (r.branch || 'N/A').trim().toUpperCase();
      const cleanYrKey = "YEAR " + (r.year || 'N/A').toString().trim().toUpperCase();
      
      const earnsRevenue = (r.status === 'Approved' || r.status === 'Checked-in');

      colCountMap[cleanColKey] = (colCountMap[cleanColKey] || 0) + 1;
      brCountMap[cleanBrKey] = (brCountMap[cleanBrKey] || 0) + 1;
      yrCountMap[cleanYrKey] = (yrCountMap[cleanYrKey] || 0) + 1;

      if (earnsRevenue) {
        colRevMap[cleanColKey] = (colRevMap[cleanColKey] || 0) + costPerHead;
        brRevMap[cleanBrKey] = (brRevMap[cleanBrKey] || 0) + costPerHead;
        yrRevMap[cleanYrKey] = (yrRevMap[cleanYrKey] || 0) + costPerHead;
      }

      let dateKey = "Unknown Date";
      if (r.timestamp) {
        let splits = r.timestamp.split(",");
        if (splits.length > 0) dateKey = splits[0].trim();
      }
      trendCountMap[dateKey] = (trendCountMap[dateKey] || 0) + 1;
    }
  });

  collegeArea.innerHTML = Object.keys(colCountMap).sort().map(k => `
    <div class="flex items-center justify-between py-1 border-b border-slate-700/30 gap-2">
      <span class="truncate max-w-[120px] font-bold text-slate-300" title="${k}">${k}</span>
      <span class="whitespace-nowrap"><span class="text-slate-500">x${colCountMap[k]}</span> <span class="text-blue-400 font-bold">₹${(colRevMap[k] || 0).toLocaleString('en-IN')}</span></span>
    </div>
  `).join('') || '<p class="text-slate-500 italic">No college entries</p>';

  branchArea.innerHTML = Object.keys(brCountMap).sort().map(k => `
    <div class="flex items-center justify-between py-1 border-b border-slate-700/30 gap-2">
      <span class="truncate max-w-[120px] font-bold text-slate-300" title="${k}">${k}</span>
      <span class="whitespace-nowrap"><span class="text-slate-500">x${brCountMap[k]}</span> <span class="text-purple-400 font-bold">₹${(brRevMap[k] || 0).toLocaleString('en-IN')}</span></span>
    </div>
  `).join('') || '<p class="text-slate-500 italic">No branch entries</p>';

  yearArea.innerHTML = Object.keys(yrCountMap).sort().map(k => `
    <div class="flex items-center justify-between py-1 border-b border-slate-700/30 gap-2">
      <span class="font-bold text-slate-300">${k}</span>
      <span class="whitespace-nowrap"><span class="text-slate-500">x${yrCountMap[k]}</span> <span class="text-emerald-400 font-bold">₹${(yrRevMap[k] || 0).toLocaleString('en-IN')}</span></span>
    </div>
  `).join('') || '<p class="text-slate-500 italic">No year entries</p>';

  trendsArea.innerHTML = Object.keys(trendCountMap).map(k => `
    <div class="flex items-center justify-between py-1 border-b border-slate-700/30">
      <span>${k}</span>
      <span class="text-amber-400 font-bold">${trendCountMap[k]} entries</span>
    </div>
  `).join('') || '<p class="text-slate-500 italic">No daily trends</p>';
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
  calculateSystemMetricsAndDistributions();

  const headBlock = document.getElementById('tableHeaderBlock');
  const bodyBlock = document.getElementById('tableBodyBlock');
  
  const queryValue = document.getElementById('searchInput').value.toLowerCase().trim();
  const statusFilterValue = document.getElementById('filterStatus').value;
  const collegeFilterValue = document.getElementById('filterCollege').value;
  const branchFilterValue = document.getElementById('filterBranch').value;
  const yearFilterValue = document.getElementById('filterYear').value;

  let filteredRecordDataset = masterRecordsCache.filter(row => {
    if (statusFilterValue !== "All") {
      if (statusFilterValue === "Approved" && row.status !== "Approved" && row.status !== "Checked-in") return false;
      if (statusFilterValue !== "Approved" && row.status !== statusFilterValue) return false;
    }
    if (collegeFilterValue !== "All" && (row.college || '').trim().toUpperCase() !== collegeFilterValue) return false;
    if (branchFilterValue !== "All" && (row.branch || '').trim().toUpperCase() !== branchFilterValue) return false;
    if (yearFilterValue !== "All" && row.year.toString() !== yearFilterValue.toString()) return false;
    
    if (queryValue) {
      const rowSearchString = [
        row.regId, row.fullName, row.email, row.phone, row.college, row.branch, row.utr
      ].join(" ").toLowerCase();
      if (!rowSearchString.includes(queryValue)) return false;
    }
    return true;
  });

  if (dashboardViewMode === "registration") {
    filteredRecordDataset.sort((a, b) => a.rowNumber - b.rowNumber);

    headBlock.innerHTML = `
      <tr class="whitespace-nowrap">
        <th class="px-4 py-3.5">Ticket ID</th>
        <th class="px-4 py-3.5">Participant Name / Email</th>
        <th class="px-4 py-3.5">College / Branch</th>
        <th class="px-4 py-3.5 text-center w-12">Year</th>
        <th class="px-4 py-3.5">Transaction UTR</th>
        <th class="px-4 py-3.5">Receipt</th>
        <th class="px-4 py-3.5">Status</th>
        <th class="px-4 py-3.5 text-right">Actions</th>
      </tr>
    `;

    if (filteredRecordDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="8" class="text-center py-16 text-slate-500 italic font-bold">No matching data grid row entries found.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = filteredRecordDataset.map(user => {
      let trID = user.regId === "null" || !user.regId ? `<span class="text-slate-600 italic select-none">null</span>` : `<span class="font-mono font-bold text-slate-200 select-all whitespace-nowrap">${user.regId}</span>`;
      
      let badgeStyleClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      if (user.status === "Approved") badgeStyleClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      if (user.status === "Rejected") badgeStyleClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      if (user.status === "Checked-in") badgeStyleClass = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      if (user.status === "Duplicate") badgeStyleClass = "bg-purple-500/10 text-purple-400 border border-purple-500/20";

      return `
        <tr class="hover:bg-slate-950/20 transition duration-100 border-b border-slate-700/20">
          <td class="px-4 py-3.5 font-medium whitespace-nowrap">${trID}</td>
          <td class="px-4 py-3.5"><div class="font-bold text-slate-100 whitespace-nowrap max-w-[200px] truncate" title="${user.fullName}">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap max-w-[200px] truncate" title="${user.email}">${user.email}</div></td>
          <td class="px-4 py-3.5"><div class="uppercase font-bold text-slate-300 whitespace-nowrap max-w-[200px] truncate" title="${user.college}">${user.college}</div><div class="uppercase text-[10px] text-slate-400 mt-0.5 whitespace-nowrap max-w-[200px] truncate" title="${user.branch}">${user.branch}</div></td>
          <td class="px-4 py-3.5 font-black text-center whitespace-nowrap">${user.year}</td>
          <td class="px-4 py-3.5 font-mono text-[11px] tracking-wide text-slate-300 whitespace-nowrap">${user.utr}</td>
          <td class="px-4 py-3.5 whitespace-nowrap">${user.screenshot && user.screenshot !== "null" ? `<a href="${user.screenshot}" target="_blank" class="text-blue-400 hover:text-blue-300 font-bold underline inline-flex items-center gap-0.5">View Image</a>` : `<span class="text-slate-600 italic select-none">null</span>`}</td>
          <td class="px-4 py-3.5 whitespace-nowrap"><span class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${badgeStyleClass}">${user.status === 'Checked-in' ? 'Checked In' : user.status}</span></td>
          <td class="px-4 py-3.5 text-right whitespace-nowrap">
            ${user.status === 'Pending' ? `
              <button onclick="dispatchAdminOperationAction(${user.rowNumber}, 'approve')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow cursor-pointer transition inline-block">Approve</button>
              <button onclick="dispatchAdminOperationAction(${user.rowNumber}, 'reject')" class="bg-rose-600/10 hover:bg-rose-600 text-rose-400 text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition inline-block">Reject</button>
            ` : `<span class="text-slate-500 text-[10px] font-mono select-none">Processed</span>`}
          </td>
        </tr>
      `;
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
      </tr>
    `;

    if (filteredRecordDataset.length === 0) {
      bodyBlock.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-slate-500 italic font-bold">No entry verification matches found.</td></tr>`;
      return;
    }

    bodyBlock.innerHTML = filteredRecordDataset.map(user => {
      let badgeStyleClass = "bg-slate-700/20 text-slate-400 border border-slate-700/30";
      if (user.status === "Checked-in") badgeStyleClass = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      if (user.status === "Approved") badgeStyleClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";

      return `
        <tr class="hover:bg-slate-950/20 transition duration-100 border-b border-slate-700/20 ${user.status === 'Checked-in' ? 'bg-blue-950/10' : ''}">
          <td class="px-4 py-3.5 font-mono font-bold text-slate-300 whitespace-nowrap">${user.regId === 'null' || !user.regId ? '<span class="text-slate-600 italic select-none">null</span>' : user.regId}</td>
          <td class="px-4 py-3.5"><div class="font-bold text-slate-100 whitespace-nowrap max-w-[200px] truncate" title="${user.fullName}">${user.fullName}</div><div class="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap max-w-[200px] truncate">${user.phone}</div></td>
          <td class="px-4 py-3.5"><div class="uppercase font-bold text-slate-300 whitespace-nowrap max-w-[200px] truncate" title="${user.college}">${user.college}</div><div class="uppercase text-[10px] text-slate-400 mt-0.5 whitespace-nowrap max-w-[200px] truncate" title="${user.branch}">${user.branch}</div></td>
          <td class="px-4 py-3.5 font-black text-center whitespace-nowrap">${user.year}</td>
          <td class="px-4 py-3.5 whitespace-nowrap"><span class="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${badgeStyleClass}">${user.status === 'Checked-in' ? 'Checked In' : user.status}</span></td>
          <td class="px-4 py-3.5 font-mono font-black text-slate-100 whitespace-nowrap">${user.checkInTime === 'null' || !user.checkInTime ? '<span class="text-slate-600 font-normal italic select-none">null</span>' : `⏱️ ${user.checkInTime}`}</td>
        </tr>
      `;
    }).join('');
  }
}

async function dispatchAdminOperationAction(rowNumber, actionName) {
  if (!confirm(`Execute system validation state change [${actionName.toUpperCase()}] on record reference entry #${rowNumber}?`)) return;
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: actionName, rowNumber: rowNumber })
    });
    const result = await response.json();
    alert(result.message);
    synchronizeCloudLedger();
  } catch (error) { alert("API execution crash logs: " + error.toString()); }
}

function processCsvExportTask() {
  if (masterRecordsCache.length === 0) {
    alert("Export task canceled: Memory buffer contains zero rows.");
    return;
  }
  
  const csvHeadersRow = ["Timestamp", "Registration ID", "Full Name", "Email Address", "Phone Number", "College", "Branch", "Year", "UPI Transaction ID", "Screenshot Drive Link", "Status", "Check-In Timestamp"];
  
  const sanitizedStringRowsArray = masterRecordsCache.map(r => [
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