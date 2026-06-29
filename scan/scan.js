// PASTED GOOGLE APPS SCRIPT WEB APP API URL GOES HERE (SAME AS ADMIN URL)
const BACKEND_API_URL = "https://script.google.com/macros/s/AKfycby5bz0GI20VxLh_FQOESgzX9V1N54KaPxHuDKlSZT_uu7rswK8QfU0gbxW4k3BSCfqpXQ/exec"; 

let html5QrcodeScanner;
let gateProcessingLock = false;

window.onload = function() {
  html5QrcodeScanner = new Html5Qrcode("reader");
  
  html5QrcodeScanner.start(
    { facingMode: "environment" }, // Standard primary back-facing optics preference definition
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onScanSuccess
  ).catch(err => {
    // Graceful rendering UI overrides for browser hardware intercept blocks
    const box = document.getElementById('resultBox');
    const msg = document.getElementById('resultMessage');
    box.className = "p-4 rounded-xl text-sm font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40";
    msg.innerHTML = "📷 <strong>Hardware Block:</strong> Browser camera access privileges denied. Tap the address bar permission lock icon and switch to <strong>'Allow'</strong>, then refresh.";
    box.classList.remove('hidden');
  });
};

async function onScanSuccess(decodedText) {
  if (gateProcessingLock) return; // Prevent multi frame double processing race conditions
  gateProcessingLock = true;

  const box = document.getElementById('resultBox');
  const msg = document.getElementById('resultMessage');

  box.className = "p-4 rounded-xl text-sm font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20";
  msg.innerText = "Processing Ticket ID: " + decodedText + "...";
  box.classList.remove('hidden');

  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: "checkin", regId: decodedText })
    });
    
    const result = await response.json();

    if (result.status === "success") {
      box.className = "p-4 rounded-xl text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 scale-102 transition duration-150";
    } else if (result.status === "duplicate") {
      box.className = "p-4 rounded-xl text-sm font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 ring-4 ring-amber-500/30 animate-pulse";
    } else {
      box.className = "p-4 rounded-xl text-sm font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40";
    }
    
    msg.innerText = result.message;

  } catch (error) {
    box.className = "p-4 rounded-xl text-sm font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40";
    msg.innerText = "Network Communication Breakdown: " + error.toString();
  } finally {
    // Release processing lock down after operational validation cycle hold parameters cool off
    setTimeout(() => { gateProcessingLock = false; }, 3500);
  }
}