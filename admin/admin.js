const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let masterRecordsCache = [];
let activeViewMode = "registration"; // "registration" or "attendance"
let activeFilterState = "All";       // "All", "Pending", "Approved", "Rejected"

window.onload = () => {
  // Load local persistent cache data strings for accelerated initial painting cycles
  const savedCache = localStorage.getItem('aunsf_dashboard_cache');
  if (savedCache) {
    try {
      masterRecordsCache = JSON.parse(savedCache);
      calculateMetrics(masterRecordsCache);
      refreshViewDisplay();
    } catch (e) { console.error(e); }
  }

  loadTableData();

  // Bind interface element execution listeners
  document.getElementById('refreshBtn').addEventListener('click', loadTableData);
  document.getElementById('viewToggleBtn').addEventListener('click', toggleViewModeContext);
  document.getElementById('searchInput').addEventListener('input', handleLiveSearchFilter);
  
  setupFilterButtonHandlers();
};

async function loadTableData() {
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "getRecords" })
    });
    const data = await response.json();
    
    if (data.status === "success") {
      masterRecordsCache = data.records;
      localStorage.setItem('aunsf_dashboard_cache', JSON.stringify(masterRecordsCache));
      calculateMetrics(masterRecordsCache);
      refreshViewDisplay();
    }
  } catch (error) {
    console.error("Cloud database communication breakdown: ", error);
  }
}

function calculateMetrics(records) {
  document.getElementById('countTotal').innerText = records.length;
  document.getElementById('countPending').innerText = records.filter(r => r.status === 'Pending').length;
  document.getElementById('countApproved').innerText = records.filter(r => r.status === 'Approved' || r.status === 'Checked-in').length;
  document.getElementById('countCheckedIn').innerText = records.filter(r => r.status === 'Checked-in').length;
}

function toggleViewModeContext() {
  const btn = document.getElementById('viewToggleBtn');
  const filterRow = document.getElementById('filterButtonGroup');
  
  if (activeViewMode === "registration") {
    activeViewMode = "attendance";
    btn.innerText = "📋 Switch to Registration View";
    filterRow.classList.add('hidden'); // Hide state selectors in global gate lookup view
  } else {
    activeViewMode = "registration";
    btn.innerText = "📊 Switch to Attendance Lookover";
    filterRow.classList.remove('hidden');
  }
  refreshViewDisplay();
}

function setupFilterButtonHandlers() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      buttons.forEach(b => b.className = "filter-btn px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer bg-slate-800 text-slate-400 hover:bg-slate-700");
      e.target.className = "filter-btn px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer bg-blue-600 text-white";
      activeFilterState = e.target.getAttribute('data-filter');
      refreshViewDisplay();
    });
  });
}

function refreshViewDisplay() {
  renderTableHeader();
  let datasetToDisplay = [...masterRecordsCache];

  if (activeViewMode === "registration") {
    // Apply state filter choices
    if (activeFilterState !== "All") {
      datasetToDisplay = datasetToDisplay.filter(r => r.status === activeFilterState || (activeFilterState === "Approved" && r.status === "Checked-in"));
    }
  } else {
    // Attendance View Sorting Logic: Place checked-in records on top sorted by time
    datasetToDisplay.sort((a, b) => {
      let aChecked = a.status === "Checked-in" || a.checkInTime !== "null";
      let bChecked = b.status === "Checked-in" || b.checkInTime !== "null";
      
      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      if (aChecked && bChecked) {
        return new Date(b.checkInTime) - new Date(a.checkInTime); // Newest check-ins at the very top
      }
      return a.rowNumber - b.rowNumber; // Keep sequential ordering for un-checked guests
    });
  }

  renderTableRows(datasetToDisplay);
  handleLiveSearchFilter(); // Re-apply existing search filters if inputs have values
}

function renderTableHeader() {
  const header = document.getElementById('tableHeaderElement');
  if (activeViewMode === "registration") {
    header.innerHTML = `
      <tr>
        <th class="px-6 py-4">Ticket ID</th>
        <th class="px-6 py-4">Participant Details</th>
        <th class="px-6 py-4">Branch & Year</th>
        <th class="px-6 py-4">UTR Reference</th>
        <th class="px-6 py-4">Receipt</th>
        <th class="px-6 py-4">Ticket Status</th>
        <th class="px-6 py-4 text-right">Actions</th>
      </tr>
    `;
  } else {
    header.innerHTML = `
      <tr>
        <th class="px-6 py-4">Ticket ID</th>
        <th class="px-6 py-4">Participant Details</th>
        <th class="px-6 py-4">Branch & Year</th>
        <th class="px-6 py-4">Status</th>
        <th class="px-6 py-4">Checked-In Timestamp</th>
      </tr>
    `;
  }
}

function renderTableRows(records) {
  const tbody = document.getElementById('tableBody');
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-slate-500 font-medium">No system records available matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(user => {
    // FIX ID DISPLAY FORMAT RULES
    let displayId = `<span class="font-bold text-slate-200 font-mono">${user.regId}</span>`;
    if (!user.regId || user.regId === "" || user.regId === "null") {
      displayId = `<span class="text-slate-600 italic select-none">null</span>`;
    }

    // Status mapping components
    let statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>`;
    if (user.status === 'Approved') statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span>`;
    if (user.status === 'Rejected') statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Rejected</span>`;
    if (user.status === 'Checked-in') statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Checked In</span>`;

    // Time-based check logic constraints
    let displayTime = `<span class="text-slate-600 italic">null</span>`;
    if (user.checkInTime && user.checkInTime !== "null" && user.checkInTime !== "") {
      displayTime = `<span class="text-blue-400 font-mono font-bold">${user.checkInTime}</span>`;
    }

    if (activeViewMode === "registration") {
      return `
        <tr class="hover:bg-slate-950/20 transition border-b border-slate-700/30">
          <td class="px-6 py-4">${displayId}</td>
          <td class="px-6 py-4"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-xs text-slate-400 mt-0.5">${user.college}</div></td>
          <td class="px-6 py-4"><div>${user.branch}</div><div class="text-xs text-slate-400 mt-0.5">Year ${user.year}</div></td>
          <td class="px-6 py-4 font-mono text-xs text-slate-300">${user.utr}</td>
          <td class="px-6 py-4"><a href="${user.screenshot}" target="_blank" class="text-blue-400 underline text-xs">View Link</a></td>
          <td class="px-6 py-4">${statusBadge}</td>
          <td class="px-6 py-4 text-right whitespace-nowrap">
            ${user.status === 'Pending' ? `
              <button onclick="executeAction(${user.rowNumber}, 'approve')" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer transition">Verify & Approve</button>
              <button onclick="executeAction(${user.rowNumber}, 'reject')" class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 text-xs font-bold px-3 py-1.5 rounded cursor-pointer transition">Reject</button>
            ` : `<span class="text-xs text-slate-500 font-mono">Processed</span>`}
          </td>
        </tr>
      `;
    } else {
      // Return Lookover Attendance Format View Row Structure
      return `
        <tr class="hover:bg-slate-950/20 transition border-b border-slate-700/30 ${user.status === 'Checked-in' ? 'bg-blue-950/10' : ''}">
          <td class="px-6 py-4">${displayId}</td>
          <td class="px-6 py-4"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-xs text-slate-400 mt-0.5">${user.college}</div></td>
          <td class="px-6 py-4"><div>${user.branch}</div><div class="text-xs text-slate-400 mt-0.5">Year ${user.year}</div></td>
          <td class="px-6 py-4">${statusBadge}</td>
          <td class="px-6 py-4">${displayTime}</td>
        </tr>
      `;
    }
  }).join('');
}

async function executeAction(rowNumber, action) {
  if (!confirm(`Execute state modification [${action.toUpperCase()}] on entry row line #${rowNumber}?`)) return;
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: action, rowNumber: rowNumber })
    });
    const result = await response.json();
    alert(result.message);
    loadTableData(); 
  } catch (error) { alert("Action break: " + error); }
}

// FIX: Bulletproof string search loop matching layout elements precisely
function handleLiveSearchFilter() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const rows = document.getElementById('tableBody').querySelectorAll('tr');

  rows.forEach(row => {
    if (row.cells.length < 3) return; // Skip error/empty placeholders rows
    
    const rowText = row.innerText.toLowerCase();
    if (rowText.includes(query)) {
      row.classList.remove('hidden');
    } else {
      row.classList.add('hidden');
    }
  });
}