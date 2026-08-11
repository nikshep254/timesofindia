const DATA_URL = "data/papers.json";

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDateDDMMM(dateStr) {
  if (!dateStr) return "N/A";
  const [dd, mm, yyyy] = dateStr.split("-");
  return `${parseInt(dd)} ${months[parseInt(mm) - 1]} ${yyyy}`;
}

function isSunday(dateStr) {
  const [dd, mm, yyyy] = dateStr.split("-");
  return new Date(`${yyyy}-${mm}-${dd}`).getDay() === 0;
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function render() {
  const statusText = document.getElementById("statusText");
  const paperCount = document.getElementById("paperCount");
  const paperGrid = document.getElementById("paperGrid");
  const footerUpdated = document.getElementById("footerUpdated");

  try {
    const resp = await fetch(DATA_URL + "?t=" + Date.now());
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const papers = data.papers || [];
    statusText.textContent = `${papers.length} papers updated`;
    paperCount.textContent = `(${papers.length} papers)`;

    paperGrid.innerHTML = papers.map(paper => buildCard(paper)).join("");

    document.querySelectorAll(".paper-card").forEach(card => {
      card.querySelector(".btn-archive")?.addEventListener("click", e => {
        e.preventDefault();
        card.classList.toggle("open");
      });
    });

    if (data.updated_at) {
      const d = new Date(data.updated_at);
      footerUpdated.textContent = `Last updated: ${d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`;
    }

  } catch (err) {
    statusText.textContent = "Failed to load data";
    paperGrid.innerHTML = `<div class="loading">Error loading index: ${escapeHtml(err.message)}</div>`;
    console.error(err);
  }
}

function buildCard(paper) {
  const latest = paper.latest || {};
  const hasUrl = !!latest.drive_url;
  const unavailable = !hasUrl;

  return `
    <div class="paper-card${unavailable ? " paper-unavailable" : ""}" data-slug="${escapeHtml(paper.slug)}">
      <div class="card-top">
        <h4 class="card-title">${escapeHtml(paper.name)}</h4>
        ${latest.date ? `<span class="card-date">${escapeHtml(formatDateDDMMM(latest.date))}</span>` : ""}
      </div>
      <div class="card-body">
        ${hasUrl
          ? `<a class="btn-download" href="${escapeHtml(latest.drive_url)}" target="_blank" rel="noopener">
              <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download PDF
            </a>`
          : `<div class="unavailable">${escapeHtml(latest.note || "Not available today")}
              ${isSunday(latest.date) ? "(Sunday)" : ""}
            </div>`}
        <a class="btn-archive" href="#">Recent editions ▾</a>
      </div>
      <div class="archive-body">${buildArchive(paper.archive || [])}</div>
    </div>
  `;
}

function buildArchive(entries) {
  if (!entries.length) return `<div class="loading">No archive entries found.</div>`;
  return `
    <div class="archive-list">
      ${entries.map((entry, i) => {
        const label = entry.date_display || "";
        if (entry.drive_url) {
          return `<a class="archive-item" href="${escapeHtml(entry.drive_url)}" target="_blank" rel="noopener">
            <span class="archive-label">${escapeHtml(label)}${i === 0 ? " · Latest" : ""}</span>
            <span class="archive-arrow">→</span>
          </a>`;
        }
        return `<div class="archive-item unavailable-row"><span class="archive-label">${escapeHtml(label)} · ${escapeHtml(entry.note || "N/A")}</span></div>`;
      }).join("")}
    </div>
  `;
}

render();