const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycbxV5iYwbY8xBoMnki_N8qKosRk2mu9kukqm8Hqg4quYT6OtFLJyYiQi_rnXTEdjzTr9/exec";

let html5QrCodeScannerInstance = null;
let hardwareCameraScanStreamIsActive = false;

window.onload = () => {
  document.getElementById('startScannerBtn').addEventListener('click', toggleHardwareLensScanningPipeline);
  document.getElementById('manualCheckInBtn').addEventListener('click', executeManualInputIdCheckIn);
};

function toggleHardwareLensScanningPipeline() {
  if (hardwareCameraScanStreamIsActive) {
    terminateCameraStreamBypass();
  } else {
    initializeCameraScanningStream();
  }
}

function initializeCameraScanningStream() {
  const triggerBtn = document.getElementById('startScannerBtn');
  triggerBtn.innerText = "🛑 Stop QR Scanner";
  triggerBtn.className = "w-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm py-4 px-6 rounded-xl shadow-lg transition tracking-wide cursor-pointer flex items-center justify-center gap-2";
  
  document.getElementById('cameraLensPlaceholderBox').classList.add('hidden');
  document.getElementById('readerSurfaceBoundary').classList.remove('hidden');

  html5QrCodeScannerInstance = new Html5Qrcode("readerSurfaceBoundary");
  html5QrCodeScannerInstance.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (decodedText) => {
      terminateCameraStreamBypass();
      dispatchCheckInTicketPayload(decodedText.trim());
    },
    (errorMessage) => { /* Silent background framing log catch boundaries */ }
  ).then(() => {
    hardwareCameraScanStreamIsActive = true;
  }).catch(err => {
    alert("Camera interface activation fault: " + err);
    terminateCameraStreamBypass();
  });
}

function terminateCameraStreamBypass() {
  if (html5QrCodeScannerInstance) {
    html5QrCodeScannerInstance.stop().then(() => {
      html5QrCodeScannerInstance = null;
      resetCameraUILayoutElements();
    }).catch(err => {
      console.error(err);
      resetCameraUILayoutElements();
    });
  } else {
    resetCameraUILayoutElements();
  }
}

function resetCameraUILayoutElements() {
  hardwareCameraScanStreamIsActive = false;
  const triggerBtn = document.getElementById('startScannerBtn');
  triggerBtn.innerText = "📷 Start QR Scanner";
  triggerBtn.className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-4 px-6 rounded-xl shadow-lg transition tracking-wide cursor-pointer flex items-center justify-center gap-2";
  
  document.getElementById('cameraLensPlaceholderBox').classList.remove('hidden');
  document.getElementById('readerSurfaceBoundary').classList.add('hidden');
}

function executeManualInputIdCheckIn() {
  const inputField = document.getElementById('manualRegIdInput');
  const targetIdString = inputField.value.trim().toUpperCase();
  if (!targetIdString) {
    alert("Please enter a valid Registration Ticket ID.");
    return;
  }
  inputField.value = "";
  dispatchCheckInTicketPayload(targetIdString);
}

async function dispatchCheckInTicketPayload(ticketRegistrationIdToken) {
  const statusOverlay = document.getElementById('statusVerificationOverlay');
  const loaderBanner = document.getElementById('loaderProcessingBanner');
  const feedbackDeck = document.getElementById('scannerFeedbackDeck');
  
  statusOverlay.classList.remove('hidden');
  loaderBanner.classList.remove('hidden');
  feedbackDeck.classList.add('hidden');

  // Push immediate verification token metric log to history timeline
  appendScanHistoryRow(ticketRegistrationIdToken, "Verifying credentials...⌛");

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: "checkin", regId: ticketRegistrationIdToken })
    });
    
    const outcomeResult = await response.json();
    loaderBanner.classList.add('hidden');
    feedbackDeck.classList.remove('hidden');

    if (outcomeResult.status === "success") {
      renderGateVerificationResponseUI(true, outcomeResult.message, outcomeResult.record);
      appendScanHistoryRow(ticketRegistrationIdToken, "✅ ADMITTED", "text-emerald-400");
    } else if (outcomeResult.status === "duplicate") {
      renderGateVerificationResponseUI(false, outcomeResult.message, null, "DUPLICATE");
      appendScanHistoryRow(ticketRegistrationIdToken, "⚠️ DUPLICATE PASS", "text-amber-400");
    } else {
      renderGateVerificationResponseUI(false, outcomeResult.message, null, "REJECTED");
      appendScanHistoryRow(ticketRegistrationIdToken, "❌ DENIED", "text-rose-400");
    }
  } catch (error) {
    loaderBanner.classList.add('hidden');
    feedbackDeck.classList.remove('hidden');
    renderGateVerificationResponseUI(false, "Transmission Breakdown: Connection timeout or primary ledger synchronizer offline.", null, "ERROR");
    appendScanHistoryRow(ticketRegistrationIdToken, "💥 NETWORK FAULT", "text-rose-500");
  }
}

function renderGateVerificationResponseUI(isSuccess, serverMessage, attendeeRecordObj = null, errorType = "") {
  const container = document.getElementById('feedbackContentContainer');
  
  if (isSuccess && attendeeRecordObj) {
    container.innerHTML = `
      <div class="space-y-4 animate-fade-in">
        <div class="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-center">
          <div class="text-xs font-black text-emerald-400 uppercase tracking-widest">ACCESS ACCREDITED</div>
          <div class="text-lg font-black text-white mt-1">${serverMessage}</div>
        </div>
        
        <div class="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Ticket Pass ID:</span>
            <span class="font-mono font-black text-blue-400 text-sm select-all">${attendeeRecordObj.regId}</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Participant Name:</span>
            <span class="font-extrabold text-slate-200 uppercase">${attendeeRecordObj.fullName}</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Email Address:</span>
            <span class="font-mono text-slate-300 font-medium lowercase select-all">${attendeeRecordObj.email}</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Institution Profile:</span>
            <span class="font-extrabold text-slate-200 uppercase">${attendeeRecordObj.college}</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Branch & Cohort:</span>
            <span class="font-bold text-slate-300 uppercase">${attendeeRecordObj.branch} <span class="text-slate-500">[Year ${attendeeRecordObj.year}]</span></span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Theme Domain Track:</span>
            <span class="font-black text-purple-400 uppercase tracking-wide">${attendeeRecordObj.domainSelection || "NOT SELECTED"}</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Housing Accomodation:</span>
            <span class="font-black px-2 py-0.5 rounded text-[10px] ${attendeeRecordObj.accommodation === 'YES' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}">${attendeeRecordObj.accommodation || "NO"}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Arrival Checked In:</span>
            <span class="font-mono font-bold text-emerald-400">${attendeeRecordObj.checkInTime}</span>
          </div>
        </div>
        
        <button onclick="dismissGateVerificationOverlay()" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-3 rounded-xl transition cursor-pointer">Dismiss Dashboard</button>
      </div>`;
  } else {
    let alertClass = "bg-rose-500/10 border-rose-500/30 text-rose-400";
    if (errorType === "DUPLICATE") alertClass = "bg-amber-500/10 border-amber-500/30 text-amber-400";

    container.innerHTML = `
      <div class="space-y-4 animate-fade-in">
        <div class="${alertClass} border p-5 rounded-xl text-center space-y-2">
          <div class="text-lg font-black uppercase tracking-wider">ACCESS DENIED SYSTEM FAULT</div>
          <p class="text-xs font-semibold text-slate-300 leading-relaxed">${serverMessage}</p>
        </div>
        <button onclick="dismissGateVerificationOverlay()" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-3 rounded-xl transition cursor-pointer">Dismiss Dashboard</button>
      </div>`;
  }
}

function dismissGateVerificationOverlay() {
  document.getElementById('statusVerificationOverlay').classList.add('hidden');
}

function appendScanHistoryRow(regIdValue, resultStatusText, colorTextClass = "text-slate-400") {
  const logContainer = document.getElementById('sessionScanHistoryLogsContainer');
  const timestampText = new Date().toLocaleTimeString();
  
  const targetRowHtml = `
    <div class="flex items-center justify-between border-b border-slate-800/40 py-2 text-[11px] font-medium last:border-none animate-slide-down">
      <div class="space-y-0.5">
        <div class="font-mono font-bold text-slate-300 select-all uppercase">${regIdValue || "MANUAL FIELD INPUT"}</div>
        <div class="text-[9px] text-slate-500 font-mono">${timestampText}</div>
      </div>
      <span class="font-mono font-black ${colorTextClass} tracking-wide text-right">${resultStatusText}</span>
    </div>`;
    
  logContainer.insertAdjacentHTML('afterbegin', targetRowHtml);
}