const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let html5Qrcode;
let isScannerRunning = false;
let sessionScanHistory = [];

window.onload = function() {
  html5Qrcode = new Html5Qrcode("reader");
  document.getElementById('scanTriggerBtn').addEventListener('click', manageScannerState);
};

function manageScannerState() {
  if (isScannerRunning) return;
  
  const placeholder = document.getElementById('scannerPlaceholder');
  const readerElement = document.getElementById('reader');
  const btn = document.getElementById('scanTriggerBtn');
  
  placeholder.classList.add('hidden');
  readerElement.classList.remove('hidden');
  
  btn.disabled = true;
  btn.className = "w-full bg-slate-700 font-bold py-3 px-4 rounded-xl cursor-not-allowed text-slate-400 select-none transition";
  btn.innerText = "🔍 Camera Viewport Engaged...";

  html5Qrcode.start(
    { facingMode: "environment" },
    { fps: 12, qrbox: { width: 235, height: 235 } },
    onQrCodeRead
  ).then(() => {
    isScannerRunning = true;
  }).catch(err => {
    placeholder.classList.remove('hidden');
    readerElement.classList.add('hidden');
    btn.disabled = false;
    btn.className = "w-full bg-blue-600 hover:bg-blue-500 font-bold py-3 px-4 rounded-xl cursor-pointer shadow";
    btn.innerText = "📷 Start QR Scanner";
    alert("Camera Corrupted: " + err);
  });
}

async function onQrCodeRead(decodedText) {
  isScannerRunning = false;
  
  try {
    await html5Qrcode.stop();
  } catch (e) { console.error(e); }

  document.getElementById('reader').classList.add('hidden');
  document.getElementById('scannerPlaceholder').classList.remove('hidden');

  const box = document.getElementById('resultBox');
  const msg = document.getElementById('resultMessage');
  const title = document.getElementById('resultTitle');
  const badge = document.getElementById('pStatusBadge');
  const details = document.getElementById('verticalDetailsContainer');
  const btn = document.getElementById('scanTriggerBtn');

  // Reset and hide container cleanly before loading to avoid abrupt structural layout pops
  details.classList.add('hidden');
  box.className = "p-4 rounded-xl text-sm font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 text-left space-y-3 opacity-0 transition-all duration-200";
  badge.className = "hidden";
  title.innerText = "Verifying Ticket Pass...";
  msg.innerText = "Querying ledger database rows for: " + decodedText;
  box.classList.remove('hidden');
  
  // Smoothly fade in the loading state box
  setTimeout(() => { box.classList.remove('opacity-0'); }, 50);

  let rowColorClass = "text-rose-400";
  let statusSummaryText = "Verification failed.";

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "checkin", regId: decodedText })
    });
    
    const result = await response.json();
    statusSummaryText = result.message;

    if (result.status === "success" || result.status === "duplicate") {
      const user = result.participant;
      
      document.getElementById('pRegId').innerText = user.regId;
      document.getElementById('pFullName').innerText = user.fullName;
      document.getElementById('pCollege').innerText = user.college;
      document.getElementById('pBranch').innerText = user.branch;
      document.getElementById('pYear').innerText = "Year " + user.year;
      document.getElementById('pCheckInTime').innerText = user.checkInTime;
      
      details.classList.remove('hidden');
      msg.innerText = ""; 
      
      if (result.status === "success") {
        box.className = "p-4 rounded-xl text-sm font-bold bg-emerald-950/40 text-emerald-400 border-2 border-emerald-500 text-left space-y-3 shadow-lg shadow-emerald-500/10 transition-all duration-300";
        badge.className = "px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
        badge.innerText = "ACCESS GRANTED";
        title.innerText = "ADMISSION CONFIRMED";
        rowColorClass = "text-emerald-400";
      } else {
        box.className = "p-4 rounded-xl text-sm font-bold bg-amber-950/40 text-amber-400 border-2 border-amber-500 text-left space-y-3 shadow-lg shadow-amber-500/10 transition-all duration-300";
        badge.className = "px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30";
        badge.innerText = "DUPLICATE TICKET";
        title.innerText = "RE-ENTRY WARNING";
        rowColorClass = "text-amber-400";
      }
    } else {
      box.className = "p-4 rounded-xl text-sm font-bold bg-rose-950/40 text-rose-400 border-2 border-rose-500 text-left space-y-3 shadow-lg shadow-rose-500/10 transition-all duration-300";
      badge.className = "px-2 py-0.5 rounded text-[9px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30";
      badge.innerText = "DENIED";
      title.innerText = "INVALID ACCREDITATION";
      msg.innerText = result.message;
    }

  } catch (error) {
    statusSummaryText = "API network link communication timeout.";
    box.className = "p-4 rounded-xl text-sm font-bold bg-rose-950/40 text-rose-400 border-2 border-rose-500 text-left space-y-3";
    msg.innerText = "Transmission Breakdown: " + error.toString();
  } finally { // Fixed typo here from 'final' to 'finally'
    btn.disabled = false;
    btn.className = "w-full bg-blue-600 hover:bg-blue-500 font-bold py-3 px-4 rounded-xl cursor-pointer shadow";
    btn.innerText = "📷 Start QR Scanner";

    sessionScanHistory.unshift({
      time: new Date().toLocaleTimeString(),
      id: decodedText,
      msg: statusSummaryText,
      style: rowColorClass
    });

    renderLocalLedgerTable();
  }
}

function renderLocalLedgerTable() {
  const container = document.getElementById('logHistoryContainer');
  container.innerHTML = sessionScanHistory.map(row => `
    <div class="py-2 border-b border-slate-800/40 flex flex-col space-y-0.5 select-none">
      <div class="flex items-center justify-between text-[11px]">
        <span class="text-slate-400 font-bold">${row.id}</span>
        <span class="text-slate-500">${row.time}</span>
      </div>
      <p class="${row.style} text-[11px] leading-tight font-medium">${row.msg}</p>
    </div>`).join('');
}