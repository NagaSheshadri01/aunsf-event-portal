const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let html5Qrcode;
let isScannerActive = false;
let executionSessionLogs = [];

window.onload = function() {
  html5Qrcode = new Html5Qrcode("reader");
  document.getElementById('scanTriggerBtn').addEventListener('click', toggleScannerEngine);
};

function toggleScannerEngine() {
  if (isScannerActive) return; // Prevent double clicks
  
  const placeholder = document.getElementById('scannerPlaceholder');
  const readerElement = document.getElementById('reader');
  const triggerBtn = document.getElementById('scanTriggerBtn');
  
  placeholder.classList.add('hidden');
  readerElement.classList.remove('hidden');
  
  triggerBtn.disabled = true;
  triggerBtn.className = "w-full bg-slate-700 font-bold py-3 px-4 rounded-xl cursor-not-allowed select-none transition";
  triggerBtn.innerText = "🔍 Scanner Lens Active...";

  html5Qrcode.start(
    { facingMode: "environment" },
    { fps: 12, qrbox: { width: 230, height: 230 } },
    onScanMatched
  ).then(() => {
    isScannerActive = true;
  }).catch(err => {
    placeholder.classList.remove('hidden');
    readerElement.classList.add('hidden');
    triggerBtn.disabled = false;
    triggerBtn.className = "w-full bg-blue-600 hover:bg-blue-500 font-bold py-3 px-4 rounded-xl cursor-pointer shadow";
    triggerBtn.innerText = "📷 Engage Lens Scanner";
    alert("Camera Initialization Blocked: Check permission keys. " + err);
  });
}

async function onScanMatched(decodedText) {
  isScannerActive = false;
  
  // Instantly suspend camera lens parsing processing loop
  try {
    await html5Qrcode.stop();
  } catch (e) { console.error("Lens stop fault override: ", e); }

  document.getElementById('reader').classList.add('hidden');
  document.getElementById('scannerPlaceholder').classList.remove('hidden');

  const box = document.getElementById('resultBox');
  const msg = document.getElementById('resultMessage');
  const triggerBtn = document.getElementById('scanTriggerBtn');

  box.className = "p-4 rounded-xl text-sm font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20";
  msg.innerText = "Processing Cloud Ledger Updates for ID: " + decodedText;
  box.classList.remove('hidden');

  let logStatusStyle = "text-rose-400";
  let executionResultMessage = "";

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "checkin", regId: decodedText })
    });
    
    const result = await response.json();
    executionResultMessage = result.message;

    if (result.status === "success") {
      box.className = "p-4 rounded-xl text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-bounce";
      logStatusStyle = "text-emerald-400";
    } else if (result.status === "duplicate") {
      box.className = "p-4 rounded-xl text-sm font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 ring-4 ring-amber-500/20";
      logStatusStyle = "text-amber-400";
    } else {
      box.className = "p-4 rounded-xl text-sm font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40";
    }
    
    msg.innerText = result.message;

  } catch (error) {
    executionResultMessage = "Network communication block timeout event frame.";
    box.className = "p-4 rounded-xl text-sm font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40";
    msg.innerText = "Transmission Fault: " + error.toString();
  } finally {
    // Restore primary trigger buttons interactive parameters
    triggerBtn.disabled = false;
    triggerBtn.className = "w-full bg-blue-600 hover:bg-blue-500 font-bold py-3 px-4 rounded-xl cursor-pointer shadow";
    triggerBtn.innerText = "📷 Engage Lens Scanner";

    // Append output metrics objects safely to window history array log frames list
    var localTime = new Date().toLocaleTimeString();
    executionSessionLogs.unshift({
      time: localTime,
      id: decodedText,
      msg: executionResultMessage,
      style: logStatusStyle
    });

    renderSessionHistoryLogs();
  }
}

function renderSessionHistoryLogs() {
  const container = document.getElementById('logHistoryContainer');
  container.innerHTML = executionSessionLogs.map(item => `
    <div class="py-2 border-b border-slate-800/40 flex flex-col space-y-0.5">
      <div class="flex items-center justify-between text-[11px]">
        <span class="text-slate-400 font-bold">${item.id}</span>
        <span class="text-slate-500">${item.time}</span>
      </div>
      <p class="${item.style} text-[11px] leading-tight font-medium">${item.msg}</p>
    </div>
  `).join('');
}