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
    (errorMessage) => { /* Silent background tracking */ }
  ).then(() => {
    hardwareCameraScanStreamIsActive = true;
  }).catch(err => {
    alert("Camera activation fault: " + err);
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
      renderGateVerificationResponseUI("SUCCESS", outcomeResult.message, outcomeResult.record);
      appendScanHistoryRow(ticketRegistrationIdToken, "✅ ADMITTED", "text-emerald-400");
    } else if (outcomeResult.status === "duplicate") {
      renderGateVerificationResponseUI("DUPLICATE", outcomeResult.message, outcomeResult.record);
      appendScanHistoryRow(ticketRegistrationIdToken, "⚠️ DUPLICATE PASS", "text-amber-400");
    } else {
      renderGateVerificationResponseUI("REJECTED", outcomeResult.message, null);
      appendScanHistoryRow(ticketRegistrationIdToken, "❌ DENIED", "text-rose-400");
    }
  } catch (error) {
    loaderBanner.classList.add('hidden');
    feedbackDeck.classList.remove('hidden');
    renderGateVerificationResponseUI("ERROR", "Connection timeout or primary ledger synchronization offline.", null);
    appendScanHistoryRow(ticketRegistrationIdToken, "💥 NETWORK FAULT", "text-rose-500");
  }
}

function renderGateVerificationResponseUI(scanStatusType, serverMessage, attendeeRecordObj = null) {
  const container = document.getElementById('feedbackContentContainer');
  
  if ((scanStatusType === "SUCCESS" || scanStatusType === "DUPLICATE") && attendeeRecordObj) {
    const cohortLabels = { "1": "Fresher (Year 1)", "2": "Sophomore (Year 2)", "3": "Junior (Year 3)", "4": "Senior (Year 4)" };
    const cleanCohortLabel = cohortLabels[attendeeRecordObj.year] || "Year " + attendeeRecordObj.year;

    // High contrast layout headers based on state outcomes
    let headerAlertMarkup = `
      <div class="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl text-center">
        <div class="text-xs font-black text-emerald-400 uppercase tracking-widest">ACCESS ACCREDITED</div>
        <div class="text-lg font-black text-white mt-1">${serverMessage}</div>
      </div>`;

    if (scanStatusType === "DUPLICATE") {
      headerAlertMarkup = `
        <div class="bg-gradient-to-b from-rose-700 to-rose-900 border-2 border-rose-500 p-5 rounded-2xl text-center shadow-xl animate-pulse">
          <div class="text-2xl font-black text-white uppercase tracking-tight">⚠️ DUPLICATE SCAN DETECTED</div>
          <div class="text-xs font-bold text-rose-200 mt-1 uppercase tracking-wide">This ticket pass has already been scanned at gates!</div>
        </div>`;
    }

    // Dynamic track color styling tags
    let domainContainerStyle = "bg-purple-900/40 border-purple-500/60 text-purple-300";
    if (attendeeRecordObj.domainSelection.indexOf("Blue Economy") > -1) {
      domainContainerStyle = "bg-blue-900/40 border-blue-500/60 text-blue-300";
    } else if (attendeeRecordObj.domainSelection.indexOf("Arts") > -1) {
      domainContainerStyle = "bg-emerald-900/40 border-emerald-500/60 text-emerald-300";
    }

    let foodColorStyle = attendeeRecordObj.foodPreference === "VEG" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    let referralRowHtml = attendeeRecordObj.referredBy ? `
      <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
        <span class="text-slate-500 font-bold uppercase tracking-wider">Referred By:</span>
        <span class="font-extrabold text-purple-400 uppercase">${attendeeRecordObj.referredBy}</span>
      </div>` : "";

    // Hyperlinked Aadhaar Document verification field mapping logic
    let hasAccom = attendeeRecordObj.accommodation === 'YES';
    let docVerificationRowHtml = "";
    if (hasAccom) {
      docVerificationRowHtml = `
        <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
          <span class="text-slate-500 font-bold uppercase tracking-wider">Accommodation Files:</span>
          <span>
            ${attendeeRecordObj.aadhaarLink ? `<a href="${attendeeRecordObj.aadhaarLink}" target="_blank" class="bg-teal-600 hover:bg-teal-500 text-white font-bold px-2.5 py-1 rounded text-[10px] uppercase tracking-wide transition shadow">📄 View Aadhaar Doc</a>` : `<span class="text-rose-400 font-black uppercase">[File Missing]</span>`}
          </span>
        </div>`;
    }

    container.innerHTML = `
      <div class="space-y-4 animate-fade-in text-slate-200">
        
        <!-- Verification Header Alert -->
        ${headerAlertMarkup}

        <!-- High Visibility Theme Track Title -->
        <div class="${domainContainerStyle} border-2 p-4 rounded-xl text-center shadow-inner">
          <div class="text-[10px] font-black uppercase tracking-widest opacity-80">ASSIGNED EVENT THEME TRACK</div>
          <div class="text-xl font-black text-white uppercase tracking-wide mt-0.5">${attendeeRecordObj.domainSelection || "UNASSIGNED"}</div>
        </div>
        
        <!-- Master Metadata Deck Layout -->
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
            <span class="text-slate-500 font-bold uppercase tracking-wider">Institution Profile:</span>
            <span class="font-extrabold text-slate-200 uppercase">${attendeeRecordObj.college}</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Branch & Cohort:</span>
            <span class="font-bold text-slate-300 uppercase">${attendeeRecordObj.branch} <span class="text-slate-500">[${cleanCohortLabel}]</span></span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">College ID Card Number:</span>
            <span class="font-mono font-bold text-slate-200 select-all">${attendeeRecordObj.idCardNumber || "N/A"}</span>
          </div>
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Food Catering Choice:</span>
            <span class="font-black px-2.5 py-0.5 rounded text-[10px] tracking-wide uppercase ${foodColorStyle}">${attendeeRecordObj.foodPreference || "VEG"}</span>
          </div>
          ${referralRowHtml}
          <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Housing Accommodation:</span>
            <span class="font-black px-2 py-0.5 rounded text-[10px] ${hasAccom ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}">${attendeeRecordObj.accommodation || "NO"}</span>
          </div>
          ${docVerificationRowHtml}
          <div class="flex items-center justify-between">
            <span class="text-slate-500 font-bold uppercase tracking-wider">Original Arrival Check In:</span>
            <span class="font-mono font-black text-emerald-400">${attendeeRecordObj.checkInTime || "Just Logged"}</span>
          </div>
        </div>
        
        <button onclick="dismissGateVerificationOverlay()" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-3 rounded-xl transition cursor-pointer">Dismiss Dashboard</button>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="space-y-4 animate-fade-in">
        <div class="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-5 rounded-xl text-center space-y-2">
          <div class="text-lg font-black uppercase tracking-wider">ACCESS DENIED</div>
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