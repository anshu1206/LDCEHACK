// ═══════════════════════════════════════════════════════
//  ResolveBot AI — script.js
//  Handles: Analyzer, Complaints list, Stats dashboard
// ═══════════════════════════════════════════════════════

const BASE_URL = "http://127.0.0.1:5000";
let citiesData = [];
let recognitionInstance = null;

// ──────────────────────────────────────────────
// City & Area Data Loader
// ──────────────────────────────────────────────
(function initCityData() {
    // Only load if on the index/analyzer page (which has #cityOptions)
    if (!document.getElementById("cityOptions")) return;
    
    fetch("cities.json")
        .then(res => res.json())
        .then(data => {
            citiesData = data.cities;
            populateCityDropdown();
        })
        .catch(err => console.error("Error loading cities.json:", err));

    // Handle manual input in area to hide the auto tag
    document.getElementById("area")?.addEventListener("input", () => {
        hideAutoTag("areaAutoTag");
    });
})();

function populateCityDropdown() {
    const cityOptions = document.getElementById("cityOptions");
    if (!cityOptions) return;
    
    cityOptions.innerHTML = "";
    citiesData.forEach(city => {
        const item = document.createElement("div");
        item.innerHTML = `🏙️ ${city.name}`;
        item.onclick = () => {
            selectCity(city.name);
            hideAutoTag("cityAutoTag"); // Hide auto-detected tag on manual select
        };
        cityOptions.appendChild(item);
    });
}

function populateAreas(cityName) {
    const city = citiesData.find(c => c.name.toLowerCase() === cityName.toLowerCase());
    const areaList = document.getElementById("areaList");
    const areaHint = document.getElementById("areaHint");
    if (!areaList) return;

    areaList.innerHTML = "";
    if (city && city.areas) {
        city.areas.sort().forEach(area => {
            const opt = document.createElement("option");
            opt.value = area;
            areaList.appendChild(opt);
        });
        if (areaHint) areaHint.textContent = `Showing areas in ${city.name}`;
    } else {
        if (areaHint) areaHint.textContent = "Select a city first to see area suggestions";
    }
}

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────

function goTo(page) {
    window.location.href = page;
}

/** Format ISO timestamp to human-readable "X ago" */
function timeAgo(isoString) {
    if (!isoString) return "—";
    const now  = new Date();
    const then = new Date(isoString);
    const diff = Math.floor((now - then) / 1000); // seconds

    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return then.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Show a toast notification */
function showToast(msg, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ──────────────────────────────────────────────
// Custom cursor (shared across pages)
// ──────────────────────────────────────────────
(function initCursor() {
    const cursor = document.getElementById("cursor");
    if (!cursor) return;
    document.addEventListener("mousemove", (e) => {
        cursor.style.left = e.clientX + "px";
        cursor.style.top  = e.clientY + "px";
    });
    document.body.addEventListener("mouseenter", (e) => {
        if (e.target.closest && e.target.closest("button, a, .selected, .options div")) {
            cursor.classList.add("hover");
        }
    }, true);
    document.body.addEventListener("mouseleave", (e) => {
        if (e.target.closest && e.target.closest("button, a, .selected, .options div")) {
            cursor.classList.remove("hover");
        }
    }, true);
})();

// ──────────────────────────────────────────────
// Particle system (shared)
// ──────────────────────────────────────────────
(function initParticles() {
    const container = document.querySelector(".particles");
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        p.style.left              = Math.random() * 100 + "%";
        p.style.animationDelay    = Math.random() * 25 + "s";
        p.style.animationDuration = (Math.random() * 15 + 15) + "s";
        container.appendChild(p);
    }
})();

// ──────────────────────────────────────────────
// Dropdown helpers (index.html)
// ──────────────────────────────────────────────
function toggleDropdown() {
    document.getElementById("dropdownOptions")?.classList.toggle("show");
}

function selectOption(value) {
    const el = document.querySelector("#inputType .selected");
    if (el) {
        if (value === "Text") el.innerHTML = "✏️ Text";
        else if (value === "Email") el.innerHTML = "✉️ Email";
        else if (value === "Call Summary") el.innerHTML = "📞 Call Summary (Voice)";
        else el.innerText = value;
    }

    const emailFields = document.getElementById("emailFields");
    const descLabel = document.getElementById("descriptionLabel");
    const descTextarea = document.getElementById("complaint");
    
    if (value === "Email") {
        if (emailFields) emailFields.style.display = "block";
        if (descLabel) descLabel.innerText = "Email Body";
        if (descTextarea) descTextarea.placeholder = "Paste the email body here...";
    } else {
        if (emailFields) emailFields.style.display = "none";
        if (descLabel) descLabel.innerText = "Complaint Description";
        if (value === "Call Summary") {
            if (descTextarea) descTextarea.placeholder = "Call transcript will appear here. Speak now...";
            startVoice();
        } else {
            if (descTextarea) descTextarea.placeholder = "Describe the issue in detail... (e.g., 'The safety seal on my wellness supplement bottle was torn and open when I received the delivery today.')";
        }
    }
    document.getElementById("dropdownOptions")?.classList.remove("show");
}

let selectedCityValue = "";

function toggleCity() {
    document.getElementById("cityOptions")?.classList.toggle("show");
}

function selectCity(city) {
    selectedCityValue = city;
    const el = document.getElementById("selectedCityText");
    if (el) el.innerText = city;
    
    // populate area autocomplete list
    populateAreas(city);
    
    document.getElementById("cityOptions")?.classList.remove("show");
}

// Close dropdowns when clicking outside — single unified listener
document.addEventListener("click", function (e) {
    if (!e.target.closest(".custom-dropdown")) {
        document.getElementById("dropdownOptions")?.classList.remove("show");
        document.getElementById("cityOptions")?.classList.remove("show");
    }
});

// ──────────────────────────────────────────────
// Character counter for textarea
// ──────────────────────────────────────────────
(function initCharCounter() {
    const textarea = document.getElementById("complaint");
    const counter  = document.getElementById("charCounter");
    if (!textarea || !counter) return;

    const MAX = 2000;
    textarea.addEventListener("input", () => {
        const len = textarea.value.length;
        counter.textContent = `${len} / ${MAX}`;
        counter.style.color = len > MAX * 0.9 ? "#f87171" : "var(--text-secondary)";
    });
})();

// ──────────────────────────────────────────────
// Analyze complaint
// ──────────────────────────────────────────────
async function analyze() {
    const text   = document.getElementById("complaint")?.value?.trim() ?? "";
    const city   = selectedCityValue;
    const area   = document.getElementById("area")?.value?.trim() ?? "";
    const btn    = document.querySelector("button.primary[onclick*='analyze']");
    const result = document.getElementById("result");

    if (!text) {
        showToast("Please enter a complaint first!", "error");
        return;
    }

    const inputTypeEl = document.querySelector("#inputType .selected");
    const rawType = inputTypeEl ? inputTypeEl.innerText.trim() : "✏️ Text";
    let type = "Text";
    if (rawType.includes("Email")) type = "Email";
    else if (rawType.includes("Call Summary")) type = "Call Summary";

    const sender = document.getElementById("emailSender")?.value?.trim() ?? "";
    const subject = document.getElementById("emailSubject")?.value?.trim() ?? "";

    // Loading state
    const originalText = btn ? btn.innerHTML : "";
    if (btn) {
        btn.innerHTML  = `<span class="btn-spinner"></span> Analyzing...`;
        btn.disabled   = true;
    }
    if (result) result.innerHTML = "";

    try {
        const res = await fetch(`${BASE_URL}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ complaint: text, city, area, type, sender, subject }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Server error");
        }

        const priorityClass = (data.priority || "low").toLowerCase();
        const priorityEmoji = { high: "🔴", medium: "🟡", low: "🟢" }[priorityClass] || "⚪";
        const slaStatusClass = (data.sla_status || "Compliant").toLowerCase();
        const slaStatusEmoji = slaStatusClass === "breached" ? "❌" : "✓";

        if (result) {
            let emailMetaHtml = "";
            if (data.type === "Email") {
                emailMetaHtml = `
                    <div class="result-item" style="grid-column: span 2;">
                        <span class="result-label">✉️ Sender</span>
                        <span class="result-value">${data.sender || "—"}</span>
                    </div>
                    <div class="result-item" style="grid-column: span 2;">
                        <span class="result-label">📧 Subject</span>
                        <span class="result-value">${data.subject || "—"}</span>
                    </div>
                `;
            }

            result.innerHTML = `
                <div class="result-inner" style="animation: fadeInUp 0.4s ease;">
                    <div class="result-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="result-title">✅ Analysis Complete</span>
                        <div style="display:flex; gap:8px;">
                            <span class="badge ${priorityClass}">${priorityEmoji} ${data.priority}</span>
                            <span class="badge ${slaStatusClass}">${slaStatusEmoji} ${data.sla_status}</span>
                        </div>
                    </div>
                    <div class="result-grid">
                        <div class="result-item">
                            <span class="result-label">📂 Category</span>
                            <span class="result-value">${data.category || "—"}</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">⏱️ SLA Limit</span>
                            <span class="result-value">${data.sla || "—"}</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">📍 City</span>
                            <span class="result-value">${data.city || "—"}</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">🗺️ Area</span>
                            <span class="result-value">${data.area || "—"}</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">🔌 Channel</span>
                            <span class="result-value">${data.type || "—"}</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">📈 SLA Status</span>
                            <span class="result-value" style="font-weight:bold; color:${slaStatusClass === 'breached' ? '#f87171' : '#4ade80'};">${data.sla_status || "—"}</span>
                        </div>
                        ${emailMetaHtml}
                    </div>
                    <div class="result-recommendation" style="margin-top: 16px;">
                        <span class="result-label">💡 Recommended Action Plan</span>
                        <p>${data.recommendation || "—"}</p>
                    </div>
                </div>
            `;
        }

        showToast("Complaint analyzed & saved!", "success");

    } catch (err) {
        console.error("Analyze error:", err);
        if (result) {
            result.innerHTML = `
                <div class="error-box">
                    ❌ <strong>Error:</strong> ${err.message || "Could not connect to server. Is the backend running?"}
                </div>
            `;
        }
        showToast(err.message || "Analysis failed", "error");
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled  = false;
        }
    }
}

// ──────────────────────────────────────────────
// Clear form
// ──────────────────────────────────────────────
function clearForm() {
    const fields = ["complaint", "voiceText", "area", "emailSender", "emailSubject"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    selectedCityValue = "";
    const cityLabel = document.getElementById("selectedCityText");
    if (cityLabel) cityLabel.innerText = "Select City";

    const resultDiv = document.getElementById("result");
    if (resultDiv) resultDiv.innerHTML = "";

    const counter = document.getElementById("charCounter");
    if (counter) counter.textContent = "0 / 2000";

    const inputTypeEl = document.querySelector("#inputType .selected");
    if (inputTypeEl) inputTypeEl.innerHTML = "✏️ Text";

    const emailFields = document.getElementById("emailFields");
    if (emailFields) emailFields.style.display = "none";

    const descLabel = document.getElementById("descriptionLabel");
    if (descLabel) descLabel.innerText = "Complaint Description";

    hideAutoTag("cityAutoTag");
    hideAutoTag("areaAutoTag");

    const areaHint = document.getElementById("areaHint");
    if (areaHint) areaHint.textContent = "Select a city first to see area suggestions";

    const areaList = document.getElementById("areaList");
    if (areaList) areaList.innerHTML = "";

    showToast("Form cleared", "success");
}

function hideAutoTag(id) {
    const tag = document.getElementById(id);
    if (tag) tag.style.display = "none";
}

// ──────────────────────────────────────────────
// Complaints list
// ──────────────────────────────────────────────
let currentPage   = 1;
let currentFilter = { category: "", priority: "", status: "", search: "" };
let statsRefreshTimer = null;

async function loadComplaints(page = 1) {
    currentPage = page;
    const listEl  = document.getElementById("list");
    const pagerEl = document.getElementById("pager");
    if (!listEl) return;

    listEl.innerHTML = `<div class="loading-spinner-wrap"><div class="loading-spinner"></div><p>Loading complaints...</p></div>`;

    try {
        const params = new URLSearchParams({
            page:     page,
            limit:    10,
            category: currentFilter.category,
            priority: currentFilter.priority,
            status:   currentFilter.status,
            search:   currentFilter.search,
        });

        const res  = await fetch(`${BASE_URL}/complaints?${params}`);
        const json = await res.json();

        const data  = json.data  || [];
        const total = json.total || 0;
        const pages = json.pages || 1;

        if (data.length === 0) {
            listEl.innerHTML = `<div class="empty-state">📭 <p>No complaints found</p><span>Try adjusting your filters</span></div>`;
            if (pagerEl) pagerEl.innerHTML = "";
            return;
        }

        listEl.innerHTML = data.map(c => {
            const priorityClass = (c.priority || "low").toLowerCase();
            const priorityEmoji = { high: "🔴", medium: "🟡", low: "🟢" }[priorityClass] || "⚪";
            
            const statusOptions = ["Pending", "In Progress", "Resolved"].map(st => {
                const selected = c.status === st ? "selected" : "";
                return `<option value="${st}" ${selected}>${st}</option>`;
            }).join("");

            const channelIcon = {
                "Text": "✏️ Text",
                "Email": "✉️ Email",
                "Call Summary": "📞 Call"
            }[c.type || "Text"] || "✏️ Text";

            const slaStatusClass = (c.sla_status || "Compliant").toLowerCase();
            const slaStatusEmoji = slaStatusClass === "breached" ? "⚠️ Breached" : "✓ Met";

            let emailCardMeta = "";
            if (c.type === "Email" && (c.sender || c.subject)) {
                emailCardMeta = `
                <div class="complaint-email-meta" style="font-size:12px; opacity:0.8; margin-bottom:8px; border-left:2px solid var(--neon-cyan); padding-left:8px; margin-top: 8px;">
                    <strong>From:</strong> ${c.sender || "—"} | <strong>Subject:</strong> ${c.subject || "—"}
                </div>
                `;
            }

            return `
            <div class="complaint-item" id="item-${c._id}" style="animation: fadeInUp 0.3s ease;">
                <div class="complaint-top">
                    <div class="complaint-meta">
                        <span class="badge ${priorityClass}">${priorityEmoji} ${c.priority || "—"}</span>
                        <span class="category-tag">${c.category || "—"}</span>
                        <span class="channel-tag" style="background:rgba(255,255,255,0.08); padding:4px 8px; border-radius:4px; font-size:11px; margin-left:8px;">${channelIcon}</span>
                    </div>
                    <div class="complaint-actions-top" style="display:flex; align-items:center;">
                        <span class="sla-badge ${slaStatusClass}" style="margin-right:12px; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; background:${slaStatusClass === 'breached' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}; color:${slaStatusClass === 'breached' ? '#f87171' : '#34d399'};">
                            ${slaStatusEmoji}
                        </span>
                        <select class="status-select-dropdown" onchange="updateStatusDropdown('${c._id}', this.value)" style="background:rgba(10,10,10,0.8); color:#fff; border:1px solid rgba(255,255,255,0.2); padding:4px 8px; border-radius:4px; font-size:12px; cursor:pointer;">
                            ${statusOptions}
                        </select>
                    </div>
                </div>

                ${emailCardMeta}
                <p class="complaint-text" style="margin-top: 10px;">${c.text || "—"}</p>

                <div class="complaint-details">
                    <span>📍 ${c.city || "—"} ${c.area ? "· " + c.area : ""}</span>
                    <span>⏱️ SLA: ${c.sla || "—"}</span>
                    <span>🕒 ${timeAgo(c.timestamp)}</span>
                </div>

                ${c.recommendation ? `<p class="complaint-recommendation" style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:8px; margin-top:8px;">💡 <strong>Action Recommendation:</strong> ${c.recommendation}</p>` : ""}

                <div class="complaint-buttons" style="margin-top:12px; justify-content:flex-end;">
                    <button class="btn-delete" onclick="deleteComplaint('${c._id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>`;
        }).join("");

        // Pagination
        if (pagerEl && pages > 1) {
            let pagerHTML = `<div class="pagination">`;
            if (page > 1)     pagerHTML += `<button class="page-btn" onclick="loadComplaints(${page - 1})">← Prev</button>`;
            pagerHTML += `<span class="page-info">Page ${page} of ${pages} · ${total} complaints</span>`;
            if (page < pages) pagerHTML += `<button class="page-btn" onclick="loadComplaints(${page + 1})">Next →</button>`;
            pagerHTML += `</div>`;
            pagerEl.innerHTML = pagerHTML;
        } else if (pagerEl) {
            pagerEl.innerHTML = `<div class="pagination"><span class="page-info">${total} complaint${total !== 1 ? "s" : ""}</span></div>`;
        }

    } catch (err) {
        console.error("Load complaints error:", err);
        listEl.innerHTML = `<div class="error-box">❌ Failed to load complaints. Is the backend running?</div>`;
    }
}

function applyFilters() {
    currentFilter.category = document.getElementById("filterCategory")?.value ?? "";
    currentFilter.priority = document.getElementById("filterPriority")?.value ?? "";
    currentFilter.status   = document.getElementById("filterStatus")?.value ?? "";
    currentFilter.search   = document.getElementById("searchInput")?.value ?? "";
    loadComplaints(1);
}

function resetFilters() {
    ["filterCategory", "filterPriority", "filterStatus", "searchInput"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    currentFilter = { category: "", priority: "", status: "", search: "" };
    loadComplaints(1);
}

async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === "Resolved" ? "Pending" : "Resolved";
    try {
        const res = await fetch(`${BASE_URL}/update-status`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ id, status: newStatus }),
        });
        if (!res.ok) throw new Error("Failed to update status");
        showToast(`Marked as ${newStatus}!`, "success");
        loadComplaints(currentPage);
    } catch (err) {
        showToast("Failed to update status", "error");
    }
}

async function updateStatusDropdown(id, newStatus) {
    try {
        const res = await fetch(`${BASE_URL}/update-status`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ id, status: newStatus }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update status");
        showToast(`Status updated to ${newStatus}!`, "success");
        loadComplaints(currentPage);
    } catch (err) {
        showToast(err.message || "Failed to update status", "error");
    }
}

async function deleteComplaint(id) {
    if (!confirm("Are you sure you want to delete this complaint?")) return;
    try {
        const res = await fetch(`${BASE_URL}/complaints/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        showToast("Complaint deleted", "success");
        // Animate item out
        const item = document.getElementById(`item-${id}`);
        if (item) {
            item.style.transition = "all 0.4s ease";
            item.style.opacity    = "0";
            item.style.transform  = "translateX(-40px)";
            setTimeout(() => loadComplaints(currentPage), 400);
        } else {
            loadComplaints(currentPage);
        }
    } catch (err) {
        showToast("Failed to delete complaint", "error");
    }
}

// ──────────────────────────────────────────────
// Export functions
// ──────────────────────────────────────────────
function downloadFile() {
    const type = document.getElementById("exportType")?.value;
    if (type) window.open(`${BASE_URL}/export/${type}`, "_blank");
}

function exportAll() {
    window.open(`${BASE_URL}/export/csv`, "_blank");
    setTimeout(() => window.open(`${BASE_URL}/export/pdf`, "_blank"), 500);
}

function exportCSV() { window.location.href = `${BASE_URL}/export/csv`; }
function exportPDF() { window.location.href = `${BASE_URL}/export/pdf`; }
function printPage() { window.print(); }

// ──────────────────────────────────────────────
// Voice input
// ──────────────────────────────────────────────
function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast("Voice recognition not supported. Use Google Chrome.", "error");
        return;
    }

    if (recognitionInstance) {
        // Already listening, so stop it manually
        recognitionInstance.stop();
        return;
    }

    recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang        = "en-IN";
    recognitionInstance.continuous  = true;
    recognitionInstance.interimResults = true;

    const voiceBtn = document.getElementById("voiceBtn");
    if (voiceBtn) {
        voiceBtn.innerHTML = "🔴 Stop Listening";
        voiceBtn.classList.add("listening-active");
    }

    const voiceStatus = document.getElementById("voiceStatus");
    if (voiceStatus) {
        voiceStatus.style.display = "flex";
        const voiceStatusText = document.getElementById("voiceStatusText");
        if (voiceStatusText) {
            voiceStatusText.textContent = "Listening continuously... Click button above to stop.";
        }
    }

    recognitionInstance.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        const textarea = document.getElementById("complaint");
        if (textarea) textarea.value = transcript;
        const counter = document.getElementById("charCounter");
        if (counter) counter.textContent = `${transcript.length} / 2000`;
        
        // Auto-detect city & area from spoken words
        detectCityAndAreaFromText(transcript);
    };

    recognitionInstance.onerror = (event) => {
        console.error("Voice recognition error:", event.error);
        if (event.error !== "no-speech") {
            showToast("Voice error: " + event.error, "error");
        }
        cleanupVoiceState();
    };

    recognitionInstance.onend = () => {
        cleanupVoiceState();
        showToast("Voice input captured!", "success");
    };

    recognitionInstance.start();
}

function cleanupVoiceState() {
    recognitionInstance = null;
    const voiceBtn = document.getElementById("voiceBtn");
    if (voiceBtn) {
        voiceBtn.innerHTML = "🎙️ Voice Input";
        voiceBtn.classList.remove("listening-active");
    }
    const voiceStatus = document.getElementById("voiceStatus");
    if (voiceStatus) {
        voiceStatus.style.display = "none";
    }
}

function detectCityAndAreaFromText(text) {
    if (!citiesData || citiesData.length === 0) return;
    const lowerText = text.toLowerCase();
    
    let detectedCity = null;
    let detectedArea = null;

    // Detect city by matching its aliases
    for (const city of citiesData) {
        const matchesCity = city.aliases.some(alias => {
            const regex = new RegExp(`\\b${alias.toLowerCase()}\\b`, 'i');
            return regex.test(lowerText);
        });
        if (matchesCity) {
            detectedCity = city;
            break;
        }
    }

    if (detectedCity) {
        if (selectedCityValue !== detectedCity.name) {
            selectCity(detectedCity.name);
            showAutoTag("cityAutoTag");
        }
        
        // Scan for area inside the detected city
        for (const area of detectedCity.areas) {
            const regex = new RegExp(`\\b${area.toLowerCase()}\\b`, 'i');
            if (regex.test(lowerText)) {
                detectedArea = area;
                break;
            }
        }
    } else {
        // If no city matches yet, scan for any area across all cities
        for (const city of citiesData) {
            for (const area of city.areas) {
                const regex = new RegExp(`\\b${area.toLowerCase()}\\b`, 'i');
                if (regex.test(lowerText)) {
                    detectedCity = city;
                    detectedArea = area;
                    break;
                }
            }
            if (detectedArea) break;
        }
        
        if (detectedCity && selectedCityValue !== detectedCity.name) {
            selectCity(detectedCity.name);
            showAutoTag("cityAutoTag");
        }
    }

    if (detectedArea) {
        const areaInput = document.getElementById("area");
        if (areaInput && areaInput.value !== detectedArea) {
            areaInput.value = detectedArea;
            showAutoTag("areaAutoTag");
        }
    }
}

function showAutoTag(id) {
    const tag = document.getElementById(id);
    if (tag) tag.style.display = "inline-block";
}

// ──────────────────────────────────────────────
// Stats / Analytics
// ──────────────────────────────────────────────
let chartInstances = {};

async function loadStats() {
    try {
        const cityFilter     = document.getElementById("statsFilterCity")?.value ?? "";
        const categoryFilter = document.getElementById("statsFilterCategory")?.value ?? "";
        const priorityFilter = document.getElementById("statsFilterPriority")?.value ?? "";

        const params = new URLSearchParams({
            city:     cityFilter,
            category: categoryFilter,
            priority: priorityFilter
        });

        const res  = await fetch(`${BASE_URL}/stats?${params}`);
        const data = await res.json();

        // Counters
        animateCounter("totalCount",    data.total);
        animateCounter("resolvedCount", data.status.resolved);
        animateCounter("pendingCount",  data.status.pending + (data.status.in_progress || 0));

        // Charts — destroy existing before re-creating
        Object.values(chartInstances).forEach(c => c.destroy());
        chartInstances = {};

        // Line Chart for Daily Timeline
        chartInstances.timeline = buildLine(
            "timelineChart",
            Object.keys(data.timeline || {}),
            Object.values(data.timeline || {})
        );

        chartInstances.priority = buildDoughnut("priorityChart",
            ["High 🔥", "Medium ⚠️", "Low ✅"],
            [data.priority.high, data.priority.medium, data.priority.low],
            ["rgba(231,76,60,0.9)", "rgba(243,156,18,0.9)", "rgba(46,204,113,0.9)"]
        );

        chartInstances.city = buildBar("cityChart",
            Object.keys(data.city),
            Object.values(data.city)
        );

        chartInstances.category = buildPie("categoryChart",
            Object.keys(data.category),
            Object.values(data.category)
        );

        chartInstances.status = buildDoughnut("statusChart",
            ["✅ Resolved", "🔄 In Progress", "⏳ Pending"],
            [data.status.resolved, data.status.in_progress || 0, data.status.pending],
            ["rgba(46,204,113,0.9)", "rgba(243,156,18,0.9)", "rgba(231,76,60,0.85)"]
        );

        // Channels distribution chart
        chartInstances.channel = buildBar("channelChart",
            Object.keys(data.channel || {}),
            Object.values(data.channel || {})
        );

        // SLA compliance rate chart
        chartInstances.sla = buildDoughnut("slaChart",
            ["✓ Compliant", "⚠️ Breached"],
            [data.sla ? data.sla.compliant : 0, data.sla ? data.sla.breached : 0],
            ["rgba(46,204,113,0.9)", "rgba(231,76,60,0.85)"]
        );

        // Auto-refresh countdown
        startRefreshCountdown();

    } catch (err) {
        console.error("Stats error:", err);
        showToast("Failed to load stats. Is the backend running?", "error");
    }
}

function resetStatsFilters() {
    ["statsFilterCity", "statsFilterCategory", "statsFilterPriority"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    loadStats();
}

function animateCounter(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current   = 0;
    const step    = Math.max(1, Math.ceil(target / 60));
    const timer   = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current.toLocaleString();
        if (current >= target) clearInterval(timer);
    }, 20);
}

const CHART_DEFAULTS = {
    legend: {
        labels: {
            color:      "#ffffff",
            font:       { family: "Orbitron, monospace", size: 13, weight: "700" },
            padding:    20,
            usePointStyle: true,
            pointStyle: "circle",
        },
    },
    tooltip: {
        backgroundColor: "rgba(10,10,10,0.95)",
        titleColor:      "#00f5ff",
        bodyColor:       "#ffffff",
        borderColor:     "#00f5ff",
        borderWidth:     2,
        cornerRadius:    12,
        displayColors:   true,
    },
};

function buildLine(id, labels, dataArr) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;

    const canvasContext = ctx.getContext("2d");
    const gradient = canvasContext.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(0, 245, 255, 0.35)");
    gradient.addColorStop(1, "rgba(0, 245, 255, 0.0)");

    return new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label:           "Complaints Filed",
                data:            dataArr,
                fill:            true,
                backgroundColor: gradient,
                borderColor:     "#00f5ff",
                borderWidth:     3,
                pointBackgroundColor: "#ff00ff",
                pointBorderColor:     "#ffffff",
                pointBorderWidth:     2,
                pointRadius:          5,
                pointHoverRadius:     8,
                tension:         0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: "#b0b0b0", font: { family: "Orbitron", size: 11 } },
                    grid:  { color: "rgba(255,255,255,0.08)", lineWidth: 1 },
                },
                x: {
                    ticks: { color: "#ffffff", font: { family: "Orbitron", size: 11, weight: "600" } },
                    grid:  { color: "rgba(255,255,255,0.05)" },
                },
            },
            plugins: {
                legend:  { labels: { color: "#00f5ff", font: { family: "Orbitron", size: 13, weight: "700" } } },
                tooltip: CHART_DEFAULTS.tooltip,
            }
        }
    });
}

function buildDoughnut(id, labels, dataArr, colors) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    return new Chart(ctx, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data: dataArr,
                backgroundColor: colors,
                borderColor:     "#ffffff",
                borderWidth:     4,
                hoverOffset:     12,
                cutout:          "60%",
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend:  CHART_DEFAULTS.legend,
                tooltip: CHART_DEFAULTS.tooltip,
            },
            animation: { animateRotate: true, duration: 2000 },
        },
    });
}

function buildBar(id, labels, dataArr) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    return new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label:           "Complaints",
                data:            dataArr,
                backgroundColor: "rgba(52,152,219,0.85)",
                borderColor:     "#3498db",
                borderWidth:     3,
                borderRadius:    12,
                borderSkipped:   false,
                barThickness:    40,
            }],
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: "#b0b0b0", font: { family: "Orbitron", size: 12 } },
                    grid:  { color: "rgba(255,255,255,0.1)", lineWidth: 1 },
                },
                x: {
                    ticks: { color: "#ffffff", font: { family: "Orbitron", size: 13, weight: "600" } },
                    grid:  { display: false },
                },
            },
            plugins: {
                legend:  { labels: { color: "#00f5ff", font: { family: "Orbitron", size: 15, weight: "700" } } },
                tooltip: CHART_DEFAULTS.tooltip,
            },
            animation: { duration: 1500, easing: "easeOutQuart" },
        },
    });
}

function buildPie(id, labels, dataArr) {
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    return new Chart(ctx, {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data:            dataArr,
                backgroundColor: ["#1abc9c","#2ecc71","#3498db","#9b59b6","#34495e","#f1c40f","#e67e22","#e74c3c","#95a5a6","#16a085"],
                borderColor:     "#ffffff",
                borderWidth:     3,
                hoverOffset:     8,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                legend:  { position: "right", labels: { color: "#ffffff", font: { family: "Orbitron", size: 13, weight: "600" }, padding: 20, usePointStyle: true } },
                tooltip: { ...CHART_DEFAULTS.tooltip, titleColor: "#ff00ff", borderColor: "#ff00ff" },
            },
            animation: { animateRotate: true, animateScale: true, duration: 2000 },
        },
    });
}

let _countdown = 30;
let _countdownTimer = null;

function startRefreshCountdown() {
    const el = document.getElementById("refreshCountdown");
    if (!el) return;

    if (_countdownTimer) clearInterval(_countdownTimer);
    _countdown = 30;

    _countdownTimer = setInterval(() => {
        _countdown--;
        el.textContent = `Auto-refresh in ${_countdown}s`;
        if (_countdown <= 0) {
            clearInterval(_countdownTimer);
            loadStats();
        }
    }, 1000);
}