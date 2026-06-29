const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let masterRecordsCache = [];

window.onload = () => {
  // 1. INSTANT INITIAL LOAD: Try loading records from browser storage cache immediately
  const savedCache = localStorage.getItem('aunsf_dashboard_cache');
  if (savedCache) {
    try {
      masterRecordsCache = JSON.parse(savedCache);
      calculateMetrics(masterRecordsCache);
      renderTableInitial(masterRecordsCache);
    } catch (e) {
      console.error("Cache parsing exception: ", e);
    }
  } else {
    // Initial fallback if browser has absolutely no local history saved yet
    document.getElementById('tableBody').innerHTML = `<tr><td colspan="6" class="text-center py-12 text-slate-500 animate-pulse font-medium">Fetching secure records...</td></tr>`;
  }

  // 2. AUTOMATIC SYNC: Check for fresh database updates silently in background on boot
  loadTableData();

  document.getElementById('refreshBtn').addEventListener('click', loadTableData);
  document.getElementById('searchInput').addEventListener('input', handleSearch);
};

async function makeApiCall(payload) {
  const response = await fetch(BACKEND_API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return await response.json();
}

async function loadTableData() {
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.innerText = "🔄 Syncing...";
  refreshBtn.disabled = true;
  
  try {
    const data = await makeApiCall({ action: "getRecords" });
    if (data.status === "success") {
      const newRecords = data.records;
      
      // SURGICAL ENGINE: Mutate only the specific cells that changed on the spreadsheet
      updateTableSurgically(newRecords);
      
      // Update our variables and sync the local persistent browser storage cache
      masterRecordsCache = newRecords;
      localStorage.setItem('aunsf_dashboard_cache', JSON.stringify(newRecords));
      calculateMetrics(masterRecordsCache);
    } else {
      console.error("Database response fault: " + data.message);
    }
  } catch (error) {
    console.error("Network infrastructure exception: ", error);
  } finally {
    refreshBtn.innerText = "🔄 Refresh";
    refreshBtn.disabled = false;
  }
}

function calculateMetrics(records) {
  document.getElementById('countTotal').innerText = records.length;
  document.getElementById('countPending').innerText = records.filter(r => r.status === 'Pending').length;
  document.getElementById('countApproved').innerText = records.filter(r => r.status === 'Approved').length;
  document.getElementById('countCheckedIn').innerText = records.filter(r => r.status === 'Checked-in').length;
}

// Core Row Content Template Builder
function buildRowMarkup(user) {
  let statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>`;
  if (user.status === 'Approved') statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${user.regId}</span>`;
  if (user.status === 'Rejected') statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Rejected</span>`;
  if (user.status === 'Checked-in') statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Checked In</span>`;

  let actionButtons = `<span class="text-xs text-slate-500 font-mono select-none">Processed</span>`;
  if (user.status === 'Pending') {
    actionButtons = `
      <button onclick="executeAction(${user.rowNumber}, 'approve')" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded cursor-pointer">Approve</button>
      <button onclick="executeAction(${user.rowNumber}, 'reject')" class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 text-xs font-bold px-3 py-1.5 rounded cursor-pointer">Reject</button>
    `;
  }

  return `
    <td class="px-6 py-4">
      <div class="font-bold text-slate-100">${user.fullName}</div>
      <div class="text-xs text-slate-400 mt-0.5">${user.college}</div>
    </td>
    <td class="px-6 py-4"><div>${user.branch}</div><div class="text-xs text-slate-400 mt-0.5">Year ${user.year}</div></td>
    <td class="px-6 py-4 font-mono text-xs text-slate-200">${user.utr}</td>
    <td class="px-6 py-4"><a href="${user.screenshot}" target="_blank" class="text-blue-400 underline text-xs">🖼️ View Image</a></td>
    <td class="px-6 py-4 status-cell">${statusBadge}</td>
    <td class="px-6 py-4 text-right whitespace-nowrap action-cell">${actionButtons}</td>
  `;
}

function renderTableInitial(records) {
  const tbody = document.getElementById('tableBody');
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-slate-500 font-medium">No registrations logged yet.</td></tr>`;
    return;
  }
  // Assign explicit row number IDs directly into the DOM structure for precise targeting
  tbody.innerHTML = records.map(user => {
    return `<tr id="row-${user.rowNumber}" data-status="${user.status}" class="hover:bg-slate-950/20 transition">${buildRowMarkup(user)}</tr>`;
  }).join('');
}

// THE CORE FIX: Surgical DOM Diffing loop updates layout nodes instead of rendering whole strings
function updateTableSurgically(newRecords) {
  const tbody = document.getElementById('tableBody');
  
  if (newRecords.length > 0 && tbody.querySelector('td[colspan]')) {
    tbody.innerHTML = ''; // Wipe loading/empty text placeholders if actual rows exist
  }

  newRecords.forEach(user => {
    const existingDomRow = document.getElementById(`row-${user.rowNumber}`);

    if (!existingDomRow) {
      // Case A: This entry is completely brand new! Append it cleanly to the end of table.
      const tr = document.createElement('tr');
      tr.id = `row-${user.rowNumber}`;
      tr.setAttribute('data-status', user.status);
      tr.className = "hover:bg-slate-950/20 transition";
      tr.innerHTML = buildRowMarkup(user);
      tbody.appendChild(tr);
    } else {
      // Case B: Row exists! Check if its spreadsheet status changed since our last cached check
      const currentDomStatus = existingDomRow.getAttribute('data-status');
      if (currentDomStatus !== user.status) {
        existingDomRow.setAttribute('data-status', user.status);
        
        // Mutate ONLY the specific affected cells inside this row, leaving the text fields intact!
        const templateContainer = document.createElement('tr');
        templateContainer.innerHTML = buildRowMarkup(user);
        
        existingDomRow.querySelector('.status-cell').innerHTML = templateContainer.querySelector('.status-cell').innerHTML;
        existingDomRow.querySelector('.action-cell').innerHTML = templateContainer.querySelector('.action-cell').innerHTML;
        
        // Flash a subtle blue background fade effect to show exactly what row was altered live
        existingDomRow.classList.add('bg-blue-500/10');
        setTimeout(() => existingDomRow.classList.remove('bg-blue-500/10'), 2000);
      }
    }
  });
}

async function executeAction(rowNumber, action) {
  if (!confirm(`Execute state modification [${action.toUpperCase()}] on row line #${rowNumber}?`)) return;
  try {
    const result = await makeApiCall({ action: action, rowNumber: rowNumber });
    alert(result.message);
    loadTableData(); 
  } catch (error) {
    alert("Action processing break: " + error);
  }
}

// Clean DOM search filters: prevents key input matching from causing slow re-renders
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  const rows = document.getElementById('tableBody').querySelectorAll('tr');

  rows.forEach(row => {
    if (row.querySelector('td[colspan]')) return; // Ignore blank placeholder elements
    const text = row.innerText.toLowerCase();
    if (text.includes(query)) {
      row.classList.remove('hidden');
    } else {
      row.classList.add('hidden');
    }
  });
}