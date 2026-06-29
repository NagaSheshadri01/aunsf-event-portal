const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let masterRecordsCache = [];

window.onload = () => {
  loadTableData();
  document.getElementById('refreshBtn').addEventListener('click', loadTableData);
  document.getElementById('searchInput').addEventListener('input', handleSearch);
};

// FIX: Standardized regular function routing pipeline to prevent browser compile breaks
async function makeApiCall(payload) {
  const response = await fetch(BACKEND_API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return await response.json();
}

async function loadTableData() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-slate-500 animate-pulse font-medium">Fetching secure records from cloud database matrix...</td></tr>`;
  
  try {
    const response = await makeApiCall({ action: "getRecords" });
    if (response.status === "success") {
      masterRecordsCache = response.records;
      calculateMetrics(masterRecordsCache);
      renderTable(masterRecordsCache);
    } else {
      alert("Database Access Denied: " + response.message);
    }
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-rose-400 font-medium">Failed to connect to Google API infrastructure.</td></tr>`;
  }
}

function calculateMetrics(records) {
  document.getElementById('countTotal').innerText = records.length;
  document.getElementById('countPending').innerText = records.filter(r => r.status === 'Pending').length;
  document.getElementById('countApproved').innerText = records.filter(r => r.status === 'Approved').length;
  document.getElementById('countCheckedIn').innerText = records.filter(r => r.status === 'Checked-in').length;
}

function renderTable(records) {
  const tbody = document.getElementById('tableBody');
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-12 text-slate-500 font-medium">No matching registration data items found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(user => {
    let statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending</span>`;
    if (user.status === 'Approved') statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${user.regId}</span>`;
    if (user.status === 'Rejected') statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Rejected</span>`;
    if (user.status === 'Checked-in') statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Checked In</span>`;

    return `
      <tr class="hover:bg-slate-950/20 transition">
        <td class="px-6 py-4">
          <div class="font-bold text-slate-100">${user.fullName}</div>
          <div class="text-xs text-slate-400 mt-0.5">${user.college}</div>
        </td>
        <td class="px-6 py-4">
          <div>${user.branch}</div>
          <div class="text-xs text-slate-400 mt-0.5">Year ${user.year}</div>
        </td>
        <td class="px-6 py-4 font-mono text-xs tracking-wider text-slate-200">${user.utr}</td>
        <td class="px-6 py-4">
          <a href="${user.screenshot}" target="_blank" class="text-blue-400 hover:text-blue-300 font-semibold underline inline-flex items-center gap-1 text-xs">
            🖼️ View Image
          </a>
        </td>
        <td class="px-6 py-4">${statusBadge}</td>
        <td class="px-6 py-4 text-right space-x-2 whitespace-nowrap">
          ${user.status === 'Pending' ? `
            <button onclick="executeAction(${user.rowNumber}, 'approve')" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded transition shadow cursor-pointer">Approve</button>
            <button onclick="executeAction(${user.rowNumber}, 'reject')" class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded transition cursor-pointer">Reject</button>
          ` : `<span class="text-xs text-slate-500 font-mono select-none">Processed</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

async function executeAction(rowNumber, action) {
  if (!confirm(`Execute operational state modification [${action.toUpperCase()}] on record line #${rowNumber}?`)) return;
  
  try {
    const result = await makeApiCall({ action: action, rowNumber: rowNumber });
    alert(result.message);
    loadTableData(); 
  } catch (error) {
    alert("Operational Execution Failure Exception structural crash: " + error);
  }
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderTable(masterRecordsCache);
    return;
  }
  const filtered = masterRecordsCache.filter(r => 
    r.fullName.toLowerCase().includes(query) || 
    r.utr.toLowerCase().includes(query) || 
    (r.regId && r.regId.toLowerCase().includes(query))
  );
  renderTable(filtered);
}