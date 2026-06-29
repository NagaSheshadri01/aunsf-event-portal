const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let masterRecordsCache = [];
let activeViewMode = "registration"; // Options: "registration" or "attendance"
let activeFilterState = "All";       // Options: "All", "Pending", "Approved", "Rejected"

window.onload = () => {
  // Read local cache parameters immediately to ensure 0ms load speed profiles
  const storedLocalCacheData = localStorage.getItem('aunsf_dashboard_cache');
  if (storedLocalCacheData) {
    try {
      masterRecordsCache = JSON.parse(storedLocalCacheData);
      calculateMetrics(masterRecordsCache);
    } catch (e) { console.error("Cache trace log read failure: ", e); }
  }

  // Bind actionable logic tracking controls safely
  document.getElementById('refreshBtn').addEventListener('click', loadTableData);
  document.getElementById('viewToggleBtn').addEventListener('click', handleViewModeToggle);
  document.getElementById('searchInput').addEventListener('input', renderDashboardViewLayout);
  
  setupFilterTabActions();
  loadTableData(); // Trigger background sync execution loops
};

async function loadTableData() {
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.innerText = "🔄 Syncing...";
  refreshBtn.disabled = true;

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
    }
  } catch (error) {
    console.error("Network synchronization block error details: ", error);
  } finally {
    refreshBtn.innerText = "🔄 Refresh";
    refreshBtn.disabled = false;
    renderDashboardViewLayout();
  }
}

function calculateMetrics(records) {
  document.getElementById('countTotal').innerText = records.length;
  document.getElementById('countPending').innerText = records.filter(r => r.status === 'Pending').length;
  document.getElementById('countApproved').innerText = records.filter(r => r.status === 'Approved' || r.status === 'Checked-in').length;
  document.getElementById('countCheckedIn').innerText = records.filter(r => r.status === 'Checked-in').length;
}

function setupFilterTabActions() {
  const filterMappings = {
    'btnFilterAll': 'All',
    'btnFilterPending': 'Pending',
    'btnFilterApproved': 'Approved',
    'btnFilterRejected': 'Rejected'
  };

  Object.keys(filterMappings).forEach(btnId => {
    const btnElement = document.getElementById(btnId);
    if (!btnElement) return;
    
    btnElement.addEventListener('click', (e) => {
      // Restore passive layouts across all filters
      Object.keys(filterMappings).forEach(id => {
        document.getElementById(id).className = "filter-btn px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer bg-slate-800 text-slate-400 hover:bg-slate-700";
      });
      // Highlight active filter tab choice
      e.target.className = "filter-btn px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer bg-blue-600 text-white";
      
      activeFilterState = filterMappings[btnId];
      renderDashboardViewLayout();
    });
  });
}

function handleViewModeToggle() {
  const toggleBtn = document.getElementById('viewToggleBtn');
  const filterContainer = document.getElementById('filterRowContainer');

  if (activeViewMode === "registration") {
    activeViewMode = "attendance";
    toggleBtn.innerText = "📋 Switch to Registration View";
    filterContainer.classList.add('hidden'); // Clear tab bar in gate overview mode
  } else {
    activeViewMode = "registration";
    toggleBtn.innerText = "📊 Switch to Attendance Lookover";
    filterContainer.classList.remove('hidden');
  }
  renderDashboardViewLayout();
}

function renderDashboardViewLayout() {
  const headBlock = document.getElementById('tableHeaderBlock');
  const bodyBlock = document.getElementById('tableBodyBlock');
  const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();

  // 1. Process Filtering Rules Data Array Constraints
  let recordsDataset = [...masterRecordsCache];

  if (activeViewMode === "registration") {
    if (activeFilterState !== "All") {
      recordsDataset = recordsDataset.filter(r => {
        if (activeFilterState === "Approved") return r.status === "Approved" || r.status === "Checked-in";
        return r.status === activeFilterState;
      });
    }
    // Maintain raw sheet array progression index sequence matching spreadsheet rows
    recordsDataset.sort((a, b) => a.rowNumber - b.rowNumber);
  } else {
    // Attendance View Sorting Logic: Place arrival validation profiles on top sorted by time
    recordsDataset.sort((a, b) => {
      let aChecked = a.status === "Checked-in" && a.checkInTime !== "null";
      let bChecked = b.status === "Checked-in" && b.checkInTime !== "null";
      if (aChecked && !bChecked) return -1;
      if (!aChecked && bChecked) return 1;
      if (aChecked && bChecked) return new Date(b.checkInTime) - new Date(a.checkInTime);
      return a.rowNumber - b.rowNumber;
    });
  }

  // 2. Process Search Queries
  if (searchQuery) {
    recordsDataset = recordsDataset.filter(r => 
      r.fullName.toLowerCase().includes(searchQuery) || 
      r.utr.toLowerCase().includes(searchQuery) || 
      (r.regId && r.regId.toLowerCase().includes(searchQuery)) ||
      r.college.toLowerCase().includes(searchQuery)
    );
  }

  // 3. Render Header Columns Dynamically
  if (activeViewMode === "registration") {
    headBlock.innerHTML = `
      <tr>
        <th class="px-6 py-4">Ticket ID</th>
        <th class="px-6 py-4">Participant Details</th>
        <th class="px-6 py-4">Branch & Year</th>
        <th class="px-6 py-4">UTR Reference</th>
        <th class="px-6 py-4">Receipt</th>
        <th class="px-6 py-4">Status</th>
        <th class="px-6 py-4 text-right">Actions</th>
      </tr>
    `;
  } else {
    headBlock.innerHTML = `
      <tr>
        <th class="px-6 py-4">Ticket ID</th>
        <th class="px-6 py-4">Participant Details</th>
        <th class="px-6 py-4">Branch & Year</th>
        <th class="px-6 py-4">Status</th>
        <th class="px-6 py-4">Checked-In Timestamp</th>
      </tr>
    `;
  }

  // 4. Render Table Grid Rows Content Elements Data Blocks
  if (recordsDataset.length === 0) {
    bodyBlock.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-slate-500 font-medium">No matching ledger records identified.</td></tr>`;
    return;
  }

  bodyBlock.innerHTML = recordsDataset.map(user => {
    // Format identification codes rules matching instructions setup criteria
    let formattedRegId = `<span class="font-bold text-slate-200 font-mono select-all">${user.regId}</span>`;
    if (!user.regId || user.regId === "null" || user.regId === "") {
      formattedRegId = `<span class="text-slate-600 italic select-none">null</span>`;
    }

    // Status components layout badges mapping choices
    let badgeMarkup = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>`;
    if (user.status === 'Approved') badgeMarkup = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span>`;
    if (user.status === 'Rejected') badgeMarkup = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Rejected</span>`;
    if (user.status === 'Checked-in') badgeMarkup = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Checked In</span>`;

    // Time-stamp validation checks rules string output format structures
    let checkInTimeDisplay = `<span class="text-slate-600 italic select-none">null</span>`;
    if (user.checkInTime && user.checkInTime !== "null" && user.checkInTime !== "") {
      checkInTimeDisplay = `<span class="text-blue-400 font-mono font-bold">${user.checkInTime}</span>`;
    }

    if (activeViewMode === "registration") {
      return `
        <tr class="hover:bg-slate-950/20 transition border-b border-slate-700/30">
          <td class="px-6 py-4">${formattedRegId}</td>
          <td class="px-6 py-4"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-xs text-slate-400 mt-0.5">${user.college}</div></td>
          <td class="px-6 py-4"><div>${user.branch}</div><div class="text-xs text-slate-400 mt-0.5">Year ${user.year}</div></td>
          <td class="px-6 py-4 font-mono text-xs text-slate-300 tracking-wide">${user.utr}</td>
          <td class="px-6 py-4"><a href="${user.screenshot}" target="_blank" class="text-blue-400 underline text-xs font-semibold">View Image</a></td>
          <td class="px-6 py-4">${badgeMarkup}</td>
          <td class="px-6 py-4 text-right whitespace-nowrap">
            ${user.status === 'Pending' ? `
              <button onclick="commitAdminAction(${user.rowNumber}, 'approve')" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer transition shadow">Approve</button>
              <button onclick="commitAdminAction(${user.rowNumber}, 'reject')" class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 text-xs font-bold px-3 py-1.5 rounded cursor-pointer transition">Reject</button>
            ` : `<span class="text-xs text-slate-500 font-mono select-none">Processed</span>`}
          </td>
        </tr>
      `;
    } else {
      return `
        <tr class="hover:bg-slate-950/20 transition border-b border-slate-700/30 ${user.status === 'Checked-in' ? 'bg-blue-950/10' : ''}">
          <td class="px-6 py-4">${formattedRegId}</td>
          <td class="px-6 py-4"><div class="font-bold text-slate-100">${user.fullName}</div><div class="text-xs text-slate-400 mt-0.5">${user.college}</div></td>
          <td class="px-6 py-4"><div>${user.branch}</div><div class="text-xs text-slate-400 mt-0.5">Year ${user.year}</div></td>
          <td class="px-6 py-4">${badgeMarkup}</td>
          <td class="px-6 py-4">${checkInTimeDisplay}</td>
        </tr>
      `;
    }
  }).join('');
}

async function commitAdminAction(rowNumber, action) {
  if (!confirm(`Execute operational state modification [${action.toUpperCase()}] on record line #${rowNumber}?`)) return;
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: action, rowNumber: rowNumber })
    });
    const result = await response.json();
    alert(result.message);
    loadTableData(); 
  } catch (error) { alert("Operational break detail summary logs: " + error); }
}