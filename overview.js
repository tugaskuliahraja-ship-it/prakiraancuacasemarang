/* =========================================================
   OVERVIEW.JS
   Dashboard Overview Cuaca Kota Semarang
   - Sumber: Supabase tabel riwayat_cuaca
   - Theme: mengikuti theme.js
   - Tidak menyimpan data; hanya membaca & merangkum
========================================================= */

"use strict";

// =========================================================
// 1. SUPABASE
// =========================================================

const SUPABASE_URL = "https://malpetbethrghgaqvgnf.supabase.co";
const SUPABASE_KEY = "sb_publishable_T7nqycPtPHpPnjR4hOQ24w_X7XlCIiL";

const supabaseClient =
    window.supabase && typeof window.supabase.createClient === "function"
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
        : null;


// =========================================================
// 2. STATE
// =========================================================

const overviewState = {
    latestAnalysisDate: null,
    cityRows: [],
    currentRow: null,
    currentIndex: -1,
    upcomingRows: [],
    districtRows: []
};


// =========================================================
// 3. HELPER DOM
// =========================================================

function getEl(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const el = getEl(id);
    if (el) el.textContent = value;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// =========================================================
// 4. TOAST / NOTIFIKASI
// =========================================================

function showToast(message, type = "info", timeout = 4000) {
    const container = getEl("toastContainer");

    if (!container) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }

    const toast = document.createElement("div");
    toast.className = `custom-toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, timeout);
}


// =========================================================
// 5. FORMAT NILAI
// =========================================================

function toFiniteNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function formatTemp(value) {
    const number = toFiniteNumber(value);
    return number === null ? "--°" : `${Math.round(number)}°`;
}

function formatPercent(value) {
    const number = toFiniteNumber(value);
    return number === null ? "--%" : `${Math.round(number)}%`;
}

function formatWind(value) {
    const number = toFiniteNumber(value);
    return number === null ? "-- km/jam" : `${number.toFixed(1)} km/jam`;
}

function formatRain(value) {
    const number = toFiniteNumber(value);
    return number === null ? "-- mm" : `${number.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")} mm`;
}

function safeText(value, fallback = "--") {
    if (value === null || value === undefined || String(value).trim() === "") {
        return fallback;
    }

    return String(value).trim();
}


// =========================================================
// 6. FORMAT WAKTU WIB
// =========================================================

function parseDate(value) {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatWIBDate(value) {
    const date = parseDate(value);
    if (!date) return "--";

    return date.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

function formatWIBTime(value) {
    const date = parseDate(value);
    if (!date) return "--.-- WIB";

    return (
        date
            .toLocaleTimeString("id-ID", {
                timeZone: "Asia/Jakarta",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            })
            .replace(":", ".") + " WIB"
    );
}

function formatWIBDateTime(value) {
    const date = parseDate(value);
    if (!date) return "--";

    const tanggal = date.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

    const jam = date
        .toLocaleTimeString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        })
        .replace(":", ".");

    return `${tanggal} • ${jam} WIB`;
}

function getWIBDateKey(value) {
    const date = parseDate(value);
    if (!date) return "";

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(date);
}

function getWIBHour(value) {
    const date = parseDate(value);
    if (!date) return 12;

    return Number(
        new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            hourCycle: "h23"
        }).format(date)
    );
}

function isNightForecast(value) {
    const hour = getWIBHour(value);
    return hour >= 18 || hour < 6;
}


// =========================================================
// 7. ICON CUACA
// Icon mengikuti WAKTU PRAKIRAAN, bukan theme halaman.
// =========================================================

function getWeatherIcon(condition, forecastTime) {
    const text = safeText(condition, "").toLowerCase();
    const night = isNightForecast(forecastTime);

    if (text.includes("petir") || text.includes("kilat")) return "⛈️";
    if (text.includes("hujan lebat")) return "🌧️";
    if (text.includes("hujan sedang")) return "🌧️";
    if (text.includes("hujan ringan")) return "🌦️";
    if (text.includes("hujan")) return "🌦️";
    if (text.includes("kabut") || text.includes("berkabut")) return "🌫️";

    if (text.includes("cerah berawan")) {
        return night ? "🌙☁️" : "🌤️";
    }

    if (text.includes("berawan")) return "☁️";
    if (text.includes("cerah")) return night ? "🌙" : "☀️";

    return night ? "🌙" : "☀️";
}


// =========================================================
// 8. REALTIME CLOCK & LABEL THEME
// =========================================================

function updateRealtimeClock() {
    const now = new Date();

    const timeText = now
        .toLocaleTimeString("id-ID", {
            timeZone: "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        })
        .replace(":", ".");

    setText("overviewRealtimeClock", `${timeText} WIB`);

    const currentTheme = document.documentElement.dataset.theme || "light";
    setText(
        "overviewThemeLabel",
        currentTheme === "dark"
            ? "Dark Mode Otomatis"
            : "Light Mode Otomatis"
    );
}


// =========================================================
// 9. QUERY SUPABASE
// =========================================================

async function fetchLatestAnalysisDate() {
    const { data, error } = await supabaseClient
        .from("riwayat_cuaca")
        .select("analysis_date")
        .eq("kode_wilayah", "KOTA_SMG")
        .not("analysis_date", "is", null)
        .order("analysis_date", { ascending: false })
        .limit(1);

    if (error) throw error;

    if (!Array.isArray(data) || data.length === 0) {
        return null;
    }

    return data[0].analysis_date;
}

async function fetchCityForecast(latestAnalysisDate) {
    const { data, error } = await supabaseClient
        .from("riwayat_cuaca")
        .select(
            "kode_wilayah,nama_wilayah,tingkat_wilayah,analysis_date,waktu,suhu,kelembapan,angin,arah_angin,tutupan_awan,curah_hujan,kondisi_cuaca"
        )
        .eq("kode_wilayah", "KOTA_SMG")
        .eq("analysis_date", latestAnalysisDate)
        .order("waktu", { ascending: true });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

async function fetchDistrictForecast(latestAnalysisDate, forecastTime) {
    const { data, error } = await supabaseClient
        .from("riwayat_cuaca")
        .select(
            "kode_wilayah,nama_wilayah,tingkat_wilayah,analysis_date,waktu,suhu,kelembapan,angin,arah_angin,tutupan_awan,curah_hujan,kondisi_cuaca"
        )
        .eq("analysis_date", latestAnalysisDate)
        .eq("waktu", forecastTime)
        .neq("kode_wilayah", "KOTA_SMG")
        .not("analysis_date", "is", null);

    if (error) throw error;

    return (Array.isArray(data) ? data : []).filter(row => {
        return safeText(row.nama_wilayah, "") !== "";
    });
}


// =========================================================
// 10. LOGIKA SLOT AKTIF
// =========================================================

function findActiveForecastIndex(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return -1;

    const nowMs = Date.now();

    // Prioritas pertama: slot pertama yang belum lewat.
    const nextIndex = rows.findIndex(row => {
        const date = parseDate(row.waktu);
        return date && date.getTime() >= nowMs;
    });

    if (nextIndex !== -1) return nextIndex;

    // Kalau seluruh prakiraan sudah lewat, pakai slot terakhir.
    return rows.length - 1;
}

function getSameDayRows(rows, targetTime) {
    const targetKey = getWIBDateKey(targetTime);
    if (!targetKey) return [];

    return rows.filter(row => getWIBDateKey(row.waktu) === targetKey);
}


// =========================================================
// 11. ANALISIS RINGKAS
// =========================================================

function getDominantValue(rows, key) {
    const counter = new Map();

    for (const row of rows) {
        const value = safeText(row[key], "");
        if (!value) continue;

        counter.set(value, (counter.get(value) || 0) + 1);
    }

    let winner = "--";
    let highest = 0;

    for (const [value, count] of counter.entries()) {
        if (count > highest) {
            highest = count;
            winner = value;
        }
    }

    return winner;
}

function findNextConditionChange(rows, activeIndex) {
    if (!rows[activeIndex]) return null;

    const currentCondition = safeText(rows[activeIndex].kondisi_cuaca, "");

    for (let index = activeIndex + 1; index < rows.length; index++) {
        const candidateCondition = safeText(rows[index].kondisi_cuaca, "");

        if (candidateCondition && candidateCondition !== currentCondition) {
            return rows[index];
        }
    }

    return null;
}

function findExtremeRow(rows, key, mode = "max") {
    const validRows = rows.filter(row => toFiniteNumber(row[key]) !== null);
    if (validRows.length === 0) return null;

    return validRows.reduce((best, row) => {
        if (!best) return row;

        const bestValue = toFiniteNumber(best[key]);
        const rowValue = toFiniteNumber(row[key]);

        if (mode === "min") {
            return rowValue < bestValue ? row : best;
        }

        return rowValue > bestValue ? row : best;
    }, null);
}


// =========================================================
// 12. RENDER HERO
// =========================================================

function renderHero() {
    const row = overviewState.currentRow;
    if (!row) return;

    setText("heroTitle", "Cuaca Kota Semarang");
    setText("heroDateText", formatWIBDate(row.waktu));
    setText("heroWeatherIcon", getWeatherIcon(row.kondisi_cuaca, row.waktu));
    setText("heroTemp", formatTemp(row.suhu));
    setText("heroCondition", safeText(row.kondisi_cuaca, "Tidak diketahui"));
    setText("heroForecastTime", formatWIBDateTime(row.waktu));
    setText("heroUpdateText", formatWIBDateTime(overviewState.latestAnalysisDate));
    setText(
        "heroSlotText",
        formatWIBDateTime(row.waktu)
    );
}


// =========================================================
// 13. RENDER METRIC PRIMER
// =========================================================

function renderMetricCards() {
    const row = overviewState.currentRow;
    if (!row) return;

    setText("humidityValue", formatPercent(row.kelembapan));
    setText("windValue", formatWind(row.angin));
    setText("windSubValue", `Arah: ${safeText(row.arah_angin, "--")}`);
    setText("rainValue", formatRain(row.curah_hujan));
    setText("cloudValue", formatPercent(row.tutupan_awan));
}


// =========================================================
// 14. RENDER UPCOMING HOURS
// =========================================================

function renderUpcomingHours() {
    const container = getEl("upcomingHours");
    if (!container) return;

    const rows = overviewState.upcomingRows;

    if (!rows.length) {
        container.innerHTML =
            '<div class="overview-list-item">Prakiraan berikutnya belum tersedia.</div>';
        return;
    }

    container.innerHTML = rows
        .map((row, index) => {
            const label = index === 0 ? "Aktif" : formatWIBTime(row.waktu).replace(" WIB", "");
            const condition = escapeHTML(safeText(row.kondisi_cuaca, "--"));

            return `
                <div class="upcoming-hour-item">
                    <div class="upcoming-hour-label">${label}</div>
                    <div class="upcoming-hour-icon">${getWeatherIcon(row.kondisi_cuaca, row.waktu)}</div>
                    <div class="upcoming-hour-temp">${formatTemp(row.suhu)}</div>
                    <div class="upcoming-hour-cond">${condition}</div>
                </div>
            `;
        })
        .join("");
}


// =========================================================
// 15. RENDER CHART SVG SUHU
// =========================================================

function renderTemperatureChart() {
    const svg = getEl("upcomingChart");
    const rows = overviewState.upcomingRows;

    if (!svg) return;

    if (!rows.length) {
        svg.innerHTML = "";
        return;
    }

    const width = 760;
    const height = 180;
    const left = 38;
    const right = 28;
    const top = 24;
    const bottom = 34;

    const data = rows
        .map(row => ({
            value: toFiniteNumber(row.suhu),
            time: row.waktu
        }))
        .filter(item => item.value !== null);

    if (!data.length) {
        svg.innerHTML = "";
        return;
    }

    const values = data.map(item => item.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    // Beri ruang agar grafik tidak menempel atas/bawah.
    const minValue = Math.floor(rawMin - 1);
    const maxValue = Math.ceil(rawMax + 1);
    const range = Math.max(1, maxValue - minValue);

    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--ov-accent").trim() || "#2196f3";
    const accentSoft = styles.getPropertyValue("--ov-accent-soft").trim() || "rgba(33,150,243,.16)";
    const border = styles.getPropertyValue("--ov-border").trim() || "#d9e6f5";
    const muted = styles.getPropertyValue("--ov-muted").trim() || "#6b7b93";

    const points = data.map((item, index) => {
        const x =
            data.length === 1
                ? left + plotWidth / 2
                : left + (index / (data.length - 1)) * plotWidth;

        const y = top + ((maxValue - item.value) / range) * plotHeight;

        return {
            ...item,
            x,
            y,
            label: formatWIBTime(item.time).replace(" WIB", "")
        };
    });

    const polyline = points.map(point => `${point.x},${point.y}`).join(" ");

    const areaPath = [
        `M ${points[0].x} ${height - bottom}`,
        ...points.map(point => `L ${point.x} ${point.y}`),
        `L ${points[points.length - 1].x} ${height - bottom}`,
        "Z"
    ].join(" ");

    const guideValues = [maxValue, Math.round((minValue + maxValue) / 2), minValue];

    const guideMarkup = guideValues
        .map(value => {
            const y = top + ((maxValue - value) / range) * plotHeight;

            return `
                <line
                    x1="${left}"
                    y1="${y}"
                    x2="${width - right}"
                    y2="${y}"
                    stroke="${border}"
                    stroke-width="1"
                    stroke-dasharray="4 5"
                ></line>
                <text
                    x="${left - 6}"
                    y="${y + 4}"
                    text-anchor="end"
                    fill="${muted}"
                    font-size="10"
                    font-family="Plus Jakarta Sans, sans-serif"
                >${value}°</text>
            `;
        })
        .join("");

    const pointMarkup = points
        .map(point => `
            <circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${accent}"></circle>
            <text
                x="${point.x}"
                y="${point.y - 11}"
                text-anchor="middle"
                fill="${muted}"
                font-size="10"
                font-family="Plus Jakarta Sans, sans-serif"
            >${Math.round(point.value)}°</text>
            <text
                x="${point.x}"
                y="${height - 11}"
                text-anchor="middle"
                fill="${muted}"
                font-size="10"
                font-family="Plus Jakarta Sans, sans-serif"
            >${point.label}</text>
        `)
        .join("");

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    svg.innerHTML = `
        ${guideMarkup}
        <path d="${areaPath}" fill="${accentSoft}"></path>
        <polyline
            points="${polyline}"
            fill="none"
            stroke="${accent}"
            stroke-width="4"
            stroke-linecap="round"
            stroke-linejoin="round"
        ></polyline>
        ${pointMarkup}
    `;
}


// =========================================================
// 16. RINGKASAN HARI INI
// =========================================================

function renderDailySummary() {
    const container = getEl("summaryList");
    const currentRow = overviewState.currentRow;

    if (!container || !currentRow) return;

    const todayRows = getSameDayRows(overviewState.cityRows, currentRow.waktu);

    if (!todayRows.length) {
        container.innerHTML =
            '<div class="overview-list-item">Ringkasan hari ini belum tersedia.</div>';
        return;
    }

    const temperatures = todayRows
        .map(row => toFiniteNumber(row.suhu))
        .filter(value => value !== null);

    const minimum = temperatures.length ? Math.min(...temperatures) : null;
    const maximum = temperatures.length ? Math.max(...temperatures) : null;

    const dominantCondition = getDominantValue(todayRows, "kondisi_cuaca");

    const rainValues = todayRows
        .map(row => toFiniteNumber(row.curah_hujan))
        .filter(value => value !== null);

    const maximumRain = rainValues.length ? Math.max(...rainValues) : null;

    const nextChange = findNextConditionChange(
        overviewState.cityRows,
        overviewState.currentIndex
    );

    const nextChangeText = nextChange
        ? `${escapeHTML(safeText(currentRow.kondisi_cuaca))} → ${escapeHTML(
              safeText(nextChange.kondisi_cuaca)
          )} • ${formatWIBTime(nextChange.waktu)}`
        : "Belum ada perubahan kondisi pada sisa prakiraan";

    container.innerHTML = `
        <div class="overview-list-item">
            🌡️ Suhu hari ini:
            <strong>${minimum === null ? "--" : Math.round(minimum) + "°C"} – ${
                maximum === null ? "--" : Math.round(maximum) + "°C"
            }</strong>
        </div>

        <div class="overview-list-item">
            ☀️ Kondisi dominan:
            <strong>${escapeHTML(dominantCondition)}</strong>
        </div>

        <div class="overview-list-item">
            🌧️ Curah hujan tertinggi per slot:
            <strong>${maximumRain === null ? "--" : formatRain(maximumRain)}</strong>
        </div>

        <div class="overview-list-item">
            🔄 Perubahan berikutnya:
            <strong>${nextChangeText}</strong>
        </div>
    `;
}


// =========================================================
// 17. SOROTAN 16 KECAMATAN
// =========================================================

function renderDistrictHighlights() {
    const container = getEl("highlightList");
    const rows = overviewState.districtRows;

    if (!container) return;

    if (!rows.length) {
        container.innerHTML =
            '<div class="overview-list-item">Sorotan kecamatan belum tersedia untuk slot ini.</div>';
        return;
    }

    const hottest = findExtremeRow(rows, "suhu", "max");
    const coolest = findExtremeRow(rows, "suhu", "min");
    const humidest = findExtremeRow(rows, "kelembapan", "max");
    const windiest = findExtremeRow(rows, "angin", "max");

    function regionName(row) {
        return row ? escapeHTML(safeText(row.nama_wilayah, "--")) : "--";
    }

    container.innerHTML = `
        <div class="overview-list-item">
            🔥 Terpanas:
            <strong>${
                hottest
                    ? `${regionName(hottest)} • ${formatTemp(hottest.suhu).replace("°", "°C")}`
                    : "--"
            }</strong>
        </div>

        <div class="overview-list-item">
            ❄️ Tersejuk:
            <strong>${
                coolest
                    ? `${regionName(coolest)} • ${formatTemp(coolest.suhu).replace("°", "°C")}`
                    : "--"
            }</strong>
        </div>

        <div class="overview-list-item">
            💧 Kelembapan tertinggi:
            <strong>${
                humidest
                    ? `${regionName(humidest)} • ${formatPercent(humidest.kelembapan)}`
                    : "--"
            }</strong>
        </div>

        <div class="overview-list-item">
            💨 Angin terkuat:
            <strong>${
                windiest
                    ? `${regionName(windiest)} • ${formatWind(windiest.angin)}`
                    : "--"
            }</strong>
        </div>
    `;
}


// =========================================================
// 18. RENDER SEMUA
// =========================================================

function renderOverview() {
    renderHero();
    renderMetricCards();
    renderUpcomingHours();
    renderTemperatureChart();
    renderDailySummary();
    renderDistrictHighlights();
    updateRealtimeClock();
}


// =========================================================
// 19. LOAD DATA UTAMA
// =========================================================

async function loadOverviewData(options = {}) {
    const { silent = false } = options;

    try {
        if (!supabaseClient) {
            throw new Error(
                "Library Supabase tidak tersedia. Pastikan script Supabase dimuat sebelum overview.js."
            );
        }

        const latestAnalysisDate = await fetchLatestAnalysisDate();

        if (!latestAnalysisDate) {
            throw new Error("Belum ada arsip prakiraan BMKG yang dapat ditampilkan.");
        }

        const cityRows = await fetchCityForecast(latestAnalysisDate);

        if (!cityRows.length) {
            throw new Error(
                "Data agregat Kota Semarang (KOTA_SMG) untuk pembaruan terbaru tidak ditemukan."
            );
        }

        const activeIndex = findActiveForecastIndex(cityRows);

        if (activeIndex < 0 || !cityRows[activeIndex]) {
            throw new Error("Slot prakiraan aktif tidak dapat ditentukan.");
        }

        const currentRow = cityRows[activeIndex];

        const districtRows = await fetchDistrictForecast(
            latestAnalysisDate,
            currentRow.waktu
        );

        overviewState.latestAnalysisDate = latestAnalysisDate;
        overviewState.cityRows = cityRows;
        overviewState.currentIndex = activeIndex;
        overviewState.currentRow = currentRow;
        overviewState.upcomingRows = cityRows.slice(activeIndex, activeIndex + 7);
        overviewState.districtRows = districtRows;

        renderOverview();

        if (!silent) {
            if (districtRows.length === 16) {
                showToast("Overview cuaca berhasil dimuat.", "success", 3000);
            } else {
                showToast(
                    `Overview berhasil dimuat. Data kecamatan tersedia ${districtRows.length}/16.`,
                    "warning",
                    4500
                );
            }
        }
    } catch (error) {
        console.error("Gagal memuat Overview:", error);

        setText("heroTitle", "Data belum tersedia");
        setText("heroCondition", "Gagal memuat data");

        const upcoming = getEl("upcomingHours");
        if (upcoming) {
            upcoming.innerHTML =
                '<div class="overview-list-item">Data prakiraan belum dapat dimuat.</div>';
        }

        const summary = getEl("summaryList");
        if (summary) {
            summary.innerHTML =
                '<div class="overview-list-item">Ringkasan belum dapat dimuat.</div>';
        }

        const highlight = getEl("highlightList");
        if (highlight) {
            highlight.innerHTML =
                '<div class="overview-list-item">Sorotan kecamatan belum dapat dimuat.</div>';
        }

        showToast(
            `Gagal memuat Overview: ${error?.message || "Kesalahan tidak diketahui"}`,
            "error",
            7000
        );
    }
}


// =========================================================
// 20. THEME CHANGE
// Chart digambar ulang agar warnanya ikut dark/light.
// =========================================================

window.addEventListener("app-theme-changed", () => {
    updateRealtimeClock();

    if (overviewState.upcomingRows.length) {
        window.requestAnimationFrame(renderTemperatureChart);
    }
});


// =========================================================
// 21. ERROR GLOBAL HALAMAN OVERVIEW
// =========================================================

window.addEventListener("error", event => {
    console.error("Overview JavaScript Error:", event.error || event.message);

    showToast(
        "Terjadi kesalahan pada halaman Overview. Silakan muat ulang halaman.",
        "error",
        6000
    );
});

window.addEventListener("unhandledrejection", event => {
    console.error("Overview Promise Error:", event.reason);

    showToast(
        "Terjadi kegagalan saat memuat data Overview.",
        "error",
        6000
    );
});


// =========================================================
// 22. INIT
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
    updateRealtimeClock();
    window.setInterval(updateRealtimeClock, 1000);

    await loadOverviewData();

    // Refresh ringan agar dashboard yang dibiarkan terbuka lama
    // tetap mengecek apakah arsip BMKG terbaru sudah tersedia.
    window.setInterval(() => {
        loadOverviewData({ silent: true });
    }, 10 * 60 * 1000);
});
