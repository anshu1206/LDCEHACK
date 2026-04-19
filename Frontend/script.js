const BASE_URL = "http://127.0.0.1:5000";

// Navigation
function goTo(page) {
    window.location.href = page;
}
function downloadFile() {
    const type = document.getElementById("exportType").value;
    
    window.open(`${BASE_URL}/export/${type}`, "_blank");
}
// Analyze
async function analyze() {
    const text = document.getElementById("complaint").value;

    // ❌ old (wrong)
    // const city = document.getElementById("city")?.value;

    // ✅ new (correct)
    const city = selectedCityValue;

    const area = document.getElementById("area")?.value;

    const res = await fetch(`${BASE_URL}/analyze`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ complaint: text, city, area })
    });

    const data = await res.json();

    document.getElementById("result").innerHTML = `
        <div class="card">
            <h3>Result</h3>
            Category: ${data.category}<br>
            Priority: <span class="${data.priority.toLowerCase()}">${data.priority}</span><br>
            SLA: ${data.sla}<br>
            City: ${data.city || "-"}<br>
            Area: ${data.area || "-"}<br>
            Recommendation: ${data.recommendation}
        </div>
    `;
}
// Load complaints
async function loadComplaints() {
    const res = await fetch(`${BASE_URL}/complaints`);
    const data = await res.json();

    let html = "";

    if (!Array.isArray(data) || data.length === 0) {
        html = "<p>No complaints found</p>";
    } else {
        data.forEach(c => {
            try {
                const isResolved = c.status === "Resolved";

                html += `
                <div class="card">
                    <p>${c.text || "-"}</p>

                    <p>
                        Category: ${c.category || "-"}
                    </p>

                    <p>
                        Priority: 
                        <span class="${(c.priority || '').toLowerCase()}">
                            ${c.priority || "-"}
                        </span>
                    </p>

                    <p>SLA: ${c.sla || "-"}</p>

                    <p>City: ${c.city || "-"}</p>
                    <p>Area: ${c.area || "-"}</p>

                    <p>
                        Status: 
                        <span class="status ${isResolved ? 'resolved' : 'pending'}">
                            ${c.status || "-"}
                        </span>
                    </p>

                    <p>Recommendation: ${c.recommendation || "-"}</p>

                    <button class="${isResolved ? 'secondary' : 'primary'}"
                        onclick="toggleStatus('${c._id || ""}', '${c.status}')">
                        ${isResolved ? 'Reopen Complaint' : 'Mark Resolved'}
                    </button>
                </div>
                `;
            } catch (err) {
                console.error("Render error:", err, c);
            }
        });
    }

    document.getElementById("list").innerHTML = html;
}
// Update status
async function markResolved(text) {
    await fetch(`${BASE_URL}/update-status`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ text, status: "Resolved" })
    });

    loadComplaints();
}

// Stats

async function loadStats() {
    const res = await fetch(`${BASE_URL}/stats`);
    const data = await res.json();
    
    // Update counters (YOUR existing code)
    document.getElementById("totalCount").innerText = data.total;
    document.getElementById("resolvedCount").innerText = data.status.resolved;
    document.getElementById("pendingCount").innerText = data.status.pending;
    
    // 🔴 PRIORITY CHART - CYBERPUNK DOUGHNUT
    new Chart(document.getElementById("priorityChart"), {
        type: "doughnut",
        data: {
            labels: ["High 🔥", "Medium ⚠️", "Low ✅"],
            datasets: [{
                data: [
                    data.priority.high,
                    data.priority.medium,
                    data.priority.low
                ],
                backgroundColor: [
                    "rgba(231, 76, 60, 0.9)",   // Red
                    "rgba(243, 156, 18, 0.9)",  // Orange  
                    "rgba(46, 204, 113, 0.9)"   // Green
                ],
                borderColor: "#ffffff",
                borderWidth: 4,
                hoverOffset: 12,
                cutout: '60%'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        font: {
                            family: 'Orbitron, monospace',
                            size: 14,
                            weight: '700'
                        },
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10,10,10,0.95)',
                    titleColor: '#00f5ff',
                    bodyColor: '#ffffff',
                    borderColor: '#00f5ff',
                    borderWidth: 2,
                    cornerRadius: 12,
                    displayColors: true
                }
            },
            animation: {
                animateRotate: true,
                duration: 2000
            }
        }
    });

    // 🏙️ CITY CHART - NEON BAR CHART
    new Chart(document.getElementById("cityChart"), {
        type: "bar",
        data: {
            labels: Object.keys(data.city),
            datasets: [{
                label: "Complaints",
                data: Object.values(data.city),
                backgroundColor: "rgba(52, 152, 219, 0.85)",
                borderColor: "#3498db",
                borderWidth: 3,
                borderRadius: 12,
                borderSkipped: false,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#b0b0b0',
                        font: { family: 'Orbitron', size: 12 }
                    },
                    grid: {
                        color: 'rgba(255,255,255,0.1)',
                        lineWidth: 1
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff',
                        font: { family: 'Orbitron', size: 13, weight: '600' }
                    },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#00f5ff',
                        font: { family: 'Orbitron', size: 15, weight: '700' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10,10,10,0.95)',
                    titleColor: '#00f5ff',
                    bodyColor: '#ffffff',
                    borderColor: '#3498db',
                    borderWidth: 2,
                    cornerRadius: 12
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            }
        }
    });

    // 📊 CATEGORY CHART - SPECTRUM PIE
    new Chart(document.getElementById("categoryChart"), {
        type: "pie",
        data: {
            labels: Object.keys(data.category),
            datasets: [{
                data: Object.values(data.category),
                backgroundColor: [
                    "#1abc9c", "#2ecc71", "#3498db", "#9b59b6", "#34495e",
                    "#f1c40f", "#e67e22", "#e74c3c", "#95a5a6", "#16a085"
                ],
                borderColor: "#ffffff",
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#ffffff',
                        font: {
                            family: 'Orbitron',
                            size: 13,
                            weight: '600'
                        },
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10,10,10,0.95)',
                    titleColor: '#ff00ff',
                    bodyColor: '#ffffff',
                    borderColor: '#ff00ff',
                    borderWidth: 2,
                    cornerRadius: 12,
                    displayColors: true
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 2000
            }
            
        }
    });

    // ✅ STATUS CHART - CLEAN DOUGHNUT
    new Chart(document.getElementById("statusChart"), {
        type: "doughnut",
        data: {
            labels: ["✅ Resolved", "⏳ Pending"],
            datasets: [{
                data: [
                    data.status.resolved,
                    data.status.pending
                ],
                backgroundColor: [
                    "rgba(46, 204, 113, 0.9)",  // Green
                    "rgba(231, 76, 60, 0.85)"   // Red
                ],
                borderColor: "#ffffff",
                borderWidth: 4,
                hoverOffset: 12,
                cutout: '65%'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        font: {
                            family: 'Orbitron',
                            size: 14,
                            weight: '700'
                        },
                        padding: 25,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10,10,10,0.95)',
                    titleColor: '#00ff88',
                    bodyColor: '#ffffff',
                    borderColor: '#00ff88',
                    borderWidth: 2,
                    cornerRadius: 12
                }
            },
            animation: {
                animateRotate: true,
                duration: 1800
            }
        }
    });
}
async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === "Resolved" ? "Pending" : "Resolved";

    await fetch(`${BASE_URL}/update-status`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: id,
            status: newStatus
        })
    });

    loadComplaints();
}

function startVoiceInput() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Speech Recognition not supported");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";

  recognition.onresult = function (event) {
    const text = event.results[0][0].transcript;

    // put text into textarea or input
    document.getElementById("voiceText").value = text;
  };

  recognition.start();
}

function toggleDropdown() {
    document.getElementById("dropdownOptions").classList.toggle("show");
}

function selectOption(value) {
    document.querySelector(".selected").innerText = value;

    // 🎤 Start voice when Call Summary selected
    if (value === "Call Summary") {
        startVoice();
    }

    document.getElementById("dropdownOptions").classList.remove("show");
}

// Close dropdown when clicking outside
document.addEventListener("click", function(e) {
    if (!e.target.closest(".custom-dropdown")) {
        document.getElementById("dropdownOptions").classList.remove("show");
    }
});
let selectedCityValue = "";

function toggleCity() {
    document.getElementById("cityOptions").classList.toggle("show");
}

function selectCity(city) {
    selectedCityValue = city; // 👈 IMPORTANT (used in backend)
    document.getElementById("selectedCity").innerText = city;

    document.getElementById("cityOptions").classList.remove("show");
}
document.addEventListener("click", function(e) {
    if (!e.target.closest(".custom-dropdown")) {
        document.getElementById("dropdownOptions")?.classList.remove("show");
        document.getElementById("cityOptions")?.classList.remove("show");
    }
});
function exportAll() {
    window.open($`{BASE_URL}/export/csv`, "_blank");
    window.open($`{BASE_URL}/export/pdf`, "_blank");
}
function exportCSV() {
    window.location.href = $`{BASE_URL}/export/csv`;
}

// PDF
function exportPDF() {
    window.location.href = $`{BASE_URL}/export/pdf`;
}

// 🖨️ PRINT
function printPage() {
    window.print();
}


function startVoice() {
    // Check support
    if (!('webkitSpeechRecognition' in window)) {
        alert("Voice recognition not supported. Use Google Chrome.");
        return;
    }

    const recognition = new webkitSpeechRecognition();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true; // 👈 live typing

    recognition.onstart = () => {
        console.log("🎙️ Listening...");
    };

    recognition.onresult = (event) => {
        let transcript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }

        // Live update text box
        document.getElementById("complaint").value = transcript;
    };

    recognition.onerror = (event) => {
        console.error("Voice error:", event.error);
        alert("Error: " + event.error);
    };

    recognition.onend = () => {
        console.log("🎤 Stopped listening");
    };

    recognition.start();
}