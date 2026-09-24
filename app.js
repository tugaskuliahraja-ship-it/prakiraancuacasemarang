"use strict";

// ======================================================
// NOTIFIKASI APLIKASI
// ======================================================

function ensureAppNotificationStyles() {

    if (
        document.getElementById(
            "app-toast-style"
        )
    ) {
        return;
    }

    const style =
        document.createElement(
            "style"
        );

    style.id =
        "app-toast-style";

    style.textContent = `
        #app-toast-container {
            position: fixed;
            top: 78px;
            right: 18px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: min(360px, calc(100vw - 36px));
            pointer-events: none;
        }

        .app-toast {
            pointer-events: auto;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px 14px;
            border-radius: 12px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: rgba(255, 255, 255, 0.97);
            color: #1e293b;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
            backdrop-filter: blur(12px);
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 12px;
            line-height: 1.45;
            opacity: 0;
            transform: translateY(-8px);
            transition: opacity .22s ease, transform .22s ease;
        }

        html[data-theme="dark"] .app-toast {
            background: rgba(15, 23, 42, 0.97);
            color: #e5edf7;
            border-color: #334155;
            box-shadow: 0 12px 34px rgba(0, 0, 0, 0.42);
        }

        .app-toast.show {
            opacity: 1;
            transform: translateY(0);
        }

        .app-toast-icon {
            flex: 0 0 auto;
            font-size: 16px;
            line-height: 1.2;
        }

        .app-toast-message {
            flex: 1;
            min-width: 0;
            word-break: break-word;
        }

        .app-toast-success {
            border-left: 4px solid #22c55e;
        }

        .app-toast-warning {
            border-left: 4px solid #f59e0b;
        }

        .app-toast-error {
            border-left: 4px solid #ef4444;
        }

        .app-toast-info {
            border-left: 4px solid #3b82f6;
        }
    `;

    document.head.appendChild(
        style
    );
}


function showAppNotification(
    message,
    type = "info",
    duration = 4500
) {

    ensureAppNotificationStyles();

    let container =
        document.getElementById(
            "app-toast-container"
        );

    if (!container) {

        container =
            document.createElement(
                "div"
            );

        container.id =
            "app-toast-container";

        document.body.appendChild(
            container
        );
    }

    const icons = {
        success: "✓",
        warning: "⚠",
        error: "✕",
        info: "ℹ"
    };

    const normalizedType =
        [
            "success",
            "warning",
            "error",
            "info"
        ].includes(type)
            ? type
            : "info";

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `app-toast app-toast-${normalizedType}`;

    toast.innerHTML = `
        <span class="app-toast-icon">
            ${icons[normalizedType]}
        </span>
        <span class="app-toast-message"></span>
    `;

    toast.querySelector(
        ".app-toast-message"
    ).textContent =
        String(message || "");

    container.appendChild(
        toast
    );

    requestAnimationFrame(
        () => {
            toast.classList.add(
                "show"
            );
        }
    );

    const removeToast =
        () => {

            toast.classList.remove(
                "show"
            );

            setTimeout(
                () => {
                    toast.remove();

                    if (
                        container &&
                        container.childElementCount === 0
                    ) {
                        container.remove();
                    }
                },
                220
            );
        };

    setTimeout(
        removeToast,
        Math.max(
            1200,
            Number(duration) || 4500
        )
    );
}


window.showAppNotification =
    showAppNotification;


// Tangkap error JavaScript yang benar-benar tidak tertangani.
window.addEventListener(
    "error",
    function(event) {

        if (!event.error) {
            return;
        }

        const message =
            event.error?.message ||
            event.message ||
            "Terjadi kesalahan pada aplikasi.";

        console.error(
            "WebGIS error:",
            event.error
        );

        showAppNotification(
            `Terjadi kesalahan: ${message}`,
            "error",
            7000
        );
    }
);


window.addEventListener(
    "unhandledrejection",
    function(event) {

        const reason =
            event.reason;

        const message =
            reason?.message ||
            String(reason || "Promise gagal dijalankan.");

        console.error(
            "Unhandled promise rejection:",
            reason
        );

        showAppNotification(
            `Proses gagal: ${message}`,
            "error",
            7000
        );
    }
);


// ======================================================
// THEME FALLBACK
// ======================================================
// theme.js tetap menjadi pengatur utama. Bagian ini hanya
// menjadi pengaman apabila theme.js terlambat / tidak termuat.

function getCurrentWIBHour() {

    const hourText =
        new Intl.DateTimeFormat(
            "en-GB",
            {
                timeZone:
                    "Asia/Jakarta",

                hour:
                    "2-digit",

                hourCycle:
                    "h23"
            }
        ).format(
            new Date()
        );

    return Number(
        hourText
    );
}


function getFallbackTheme() {

    const hour =
        getCurrentWIBHour();

    return (
        hour >= 18 ||
        hour < 6
    )
        ? "dark"
        : "light";
}


function syncFallbackTheme() {

    const current =
        document
            .documentElement
            .dataset
            .theme;

    if (
        current === "light" ||
        current === "dark"
    ) {
        return;
    }

    document
        .documentElement
        .dataset
        .theme =
            getFallbackTheme();
}


syncFallbackTheme();


// ======================================================
// INISIALISASI MAP
// ======================================================

const map =
    L.map(
        "map",
        {
            zoomControl:
                false
        }
    )
    .setView(
        [
            -7.005,
            110.438
        ],
        11
    );


// Zoom dipindah ke kanan atas agar tidak tertutup
// panel informasi cuaca di sisi kiri.
L.control
    .zoom({
        position:
            "topright"
    })
    .addTo(map);


// ======================================================
// BASEMAP
// ======================================================

// OSM standar / light.
const osmStandard =
    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:
                "© OpenStreetMap contributors | Data Cuaca © BMKG",

            maxZoom:
                19,

            className:
                "osm-light-tiles"
        }
    );


// OSM dark memakai tile OSM yang sama.
// Efek gelap dikerjakan oleh CSS .osm-dark-tiles,
// jadi TIDAK membutuhkan API key tambahan.
const osmDark =
    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:
                "© OpenStreetMap contributors | Data Cuaca © BMKG",

            maxZoom:
                19,

            className:
                "osm-dark-tiles"
        }
    );


// Esri Satellite tetap dipertahankan.
const esriSatellite =
    L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            attribution:
                "Tiles © Esri | Data Cuaca © BMKG",

            maxZoom:
                19
        }
    );


// auto = OSM Light/Dark mengikuti theme.
// osm  = OSM standar terus.
// esri = Esri Satellite.
let currentBasemapMode =
    "auto";

let currentBasemap =
    null;


function getAutomaticBasemap() {

    const isDark =
        document
            .documentElement
            .dataset
            .theme ===
        "dark";

    return isDark
        ? osmDark
        : osmStandard;
}


function applyBasemap() {

    let nextBasemap;

    if (
        currentBasemapMode ===
        "esri"
    ) {

        nextBasemap =
            esriSatellite;

    } else if (
        currentBasemapMode ===
        "osm"
    ) {

        nextBasemap =
            osmStandard;

    } else {

        nextBasemap =
            getAutomaticBasemap();
    }

    if (
        currentBasemap ===
            nextBasemap &&
        currentBasemap &&
        map.hasLayer(
            currentBasemap
        )
    ) {
        return;
    }

    if (
        currentBasemap &&
        map.hasLayer(
            currentBasemap
        )
    ) {

        map.removeLayer(
            currentBasemap
        );
    }

    currentBasemap =
        nextBasemap;

    currentBasemap
        .addTo(map);
}


// Default basemap saat halaman dibuka.
applyBasemap();


// Bila theme.js berganti dari light ↔ dark,
// basemap hanya ikut berubah jika mode AUTO.
window.addEventListener(
    "app-theme-changed",
    function() {

        if (
            currentBasemapMode ===
            "auto"
        ) {

            applyBasemap();
        }
    }
);


// ======================================================
// VARIABEL LAYER
// ======================================================

let layerKecamatan;
let layerKelurahan;

let currentAdminLevel =
    "kecamatan";

const labelKecamatanLayer =
    L.layerGroup();

const labelKelurahanLayer =
    L.layerGroup();


// ======================================================
// VISIBILITAS LABEL KELURAHAN BERDASARKAN ZOOM
// ======================================================

// Label dan icon 177 kelurahan baru muncul ketika
// peta cukup dekat agar layar tidak penuh / bertumpuk.
const KELURAHAN_LABEL_MIN_ZOOM =
    14;


function updateLabelVisibility() {

    const zoom =
        map.getZoom();

    // MODE KECAMATAN
    if (
        currentAdminLevel ===
        "kecamatan"
    ) {

        if (
            map.hasLayer(
                labelKelurahanLayer
            )
        ) {

            map.removeLayer(
                labelKelurahanLayer
            );
        }

        if (
            !map.hasLayer(
                labelKecamatanLayer
            )
        ) {

            labelKecamatanLayer
                .addTo(map);
        }

        return;
    }

    // MODE KELURAHAN
    if (
        map.hasLayer(
            labelKecamatanLayer
        )
    ) {

        map.removeLayer(
            labelKecamatanLayer
        );
    }

    if (
        zoom >=
        KELURAHAN_LABEL_MIN_ZOOM
    ) {

        if (
            !map.hasLayer(
                labelKelurahanLayer
            )
        ) {

            labelKelurahanLayer
                .addTo(map);
        }

    } else {

        if (
            map.hasLayer(
                labelKelurahanLayer
            )
        ) {

            map.removeLayer(
                labelKelurahanLayer
            );
        }
    }
}


map.on(
    "zoomend",
    updateLabelVisibility
);


// ======================================================
// DATA CUACA
// ======================================================

const weatherCache = new Map();

const BMKG_API =
    (
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1"
    )
        ? "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4="
        : "/api/bmkg?adm4=";

const CACHE_DURATION =
    5 * 60 * 1000;


let totalWeather = 0;
let loadedWeather = 0;

let forecastTimes = [];
let selectedForecastIndex = 0;
let selectedForecastTime = null;
let selectedDayIndex = 0;

let demoWeatherType = null;
let demoWeatherTimer = null;

const MAX_TIME_DIFFERENCE_MINUTES = 60;

const kecamatanWeatherData = new Map();


// ======================================================
// NORMALISASI NAMA
// ======================================================

function normalizeName(text) {

    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}


// ======================================================
// STYLE KECAMATAN
// ======================================================

function styleKecamatan() {

    return {
        color: "#ffffff",
        weight: 2.5,
        opacity: 1,
        fillColor: "#0891b2",
        fillOpacity: 0.20
    };
}


// ======================================================
// STYLE KELURAHAN
// ======================================================

function styleKelurahan() {

    return {
        color: "#ffffff",
        weight: 1,
        opacity: 0.85,
        fillColor: "#38bdf8",
        fillOpacity: 0.15
    };
}


// ======================================================
// WARNA BERDASARKAN CUACA
// ======================================================

function getWeatherColor(weatherDesc) {

    const weather =
        String(weatherDesc || "")
            .toLowerCase();

    if (
    weather.includes("petir") ||
    weather.includes("kilat")
) {
    return "#0F172A";
}

    if (weather.includes("hujan lebat")) {
        return "#1d4ed8";
    }

    if (weather.includes("hujan sedang")) {
        return "#2563eb";
    }

    if (weather.includes("hujan ringan")) {
        return "#38bdf8";
    }

    if (weather.includes("cerah berawan")) {
        return "#f59e0b";
    }

    if (
        weather.includes("berawan tebal") ||
        weather.includes("mendung")
    ) {
        return "#475569";
    }

    if (weather.includes("berawan")) {
        return "#64748b";
    }

    if (weather.includes("cerah")) {
        return "#facc15";
    }

    if (
        weather.includes("kabut") ||
        weather.includes("asap")
    ) {
        return "#94a3b8";
    }

    return "#64748b";
}


// ======================================================
// IKON CUACA SIANG / MALAM
// ======================================================

function getWIBHourFromDate(
    date
) {

    if (
        !(date instanceof Date) ||
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    const hourText =
        new Intl.DateTimeFormat(
            "en-GB",
            {
                timeZone:
                    "Asia/Jakarta",

                hour:
                    "2-digit",

                hourCycle:
                    "h23"
            }
        ).format(
            date
        );

    return Number(
        hourText
    );
}


function getForecastHour(
    weatherTime = null
) {

    let value =
        weatherTime;

    // Jika yang dikirim adalah object item BMKG,
    // prioritaskan local_datetime karena sudah berupa waktu lokal.
    if (
        value &&
        typeof value ===
            "object" &&
        !(value instanceof Date)
    ) {

        value =
            value.local_datetime ||
            value._timeline_time ||
            value.datetime ||
            value.utc_datetime ||
            null;
    }

    if (
        value instanceof Date
    ) {

        return getWIBHourFromDate(
            value
        );
    }

    if (
        typeof value ===
            "string" &&
        value.trim()
    ) {

        const clean =
            value.trim();

        // ISO dengan zona waktu (Z / +07:00 / dll)
        // harus dikonversi ke WIB lebih dulu.
        if (
            /Z$/i.test(clean) ||
            /[+-]\d{2}:\d{2}$/.test(
                clean
            )
        ) {

            const parsed =
                new Date(
                    clean
                );

            const hour =
                getWIBHourFromDate(
                    parsed
                );

            if (
                hour !== null
            ) {
                return hour;
            }
        }

        // Format BMKG lokal:
        // YYYY-MM-DD HH:mm:ss
        // atau YYYY-MM-DDTHH:mm:ss tanpa zona.
        const match =
            clean.match(
                /(?:T|\s)(\d{2}):/
            );

        if (match) {

            return Number(
                match[1]
            );
        }
    }

    // Fallback ke waktu timeline yang sedang dipilih.
    if (
        weatherTime !==
            selectedForecastTime &&
        selectedForecastTime
    ) {

        const selectedHour =
            getForecastHour(
                selectedForecastTime
            );

        if (
            selectedHour !==
            null
        ) {

            return selectedHour;
        }
    }

    // Fallback terakhir: jam sekarang di WIB.
    return getCurrentWIBHour();
}


function isNightWeatherTime(
    weatherTime = null
) {

    const hour =
        getForecastHour(
            weatherTime
        );

    return (
        hour >= 18 ||
        hour < 6
    );
}


function getWeatherIcon(
    weatherDesc,
    weatherTime = null
) {

    const weather =
        String(
            weatherDesc || ""
        )
        .toLowerCase();

    const isNight =
        isNightWeatherTime(
            weatherTime
        );

    if (
        weather.includes(
            "petir"
        ) ||
        weather.includes(
            "kilat"
        )
    ) {

        return "⛈️";
    }

    if (
        weather.includes(
            "hujan lebat"
        )
    ) {

        return "🌧️";
    }

    if (
        weather.includes(
            "hujan"
        )
    ) {

        return isNight
            ? "🌧️"
            : "🌦️";
    }

    if (
        weather.includes(
            "cerah berawan"
        )
    ) {

        return isNight
            ? "🌙☁️"
            : "🌤️";
    }

    if (
        weather.includes(
            "mendung"
        ) ||
        weather.includes(
            "berawan tebal"
        )
    ) {

        return "☁️";
    }

    if (
        weather.includes(
            "berawan"
        )
    ) {

        return isNight
            ? "☁️"
            : "⛅";
    }

    if (
        weather.includes(
            "cerah"
        )
    ) {

        return isNight
            ? "🌙"
            : "☀️";
    }

    if (
        weather.includes(
            "kabut"
        ) ||
        weather.includes(
            "asap"
        )
    ) {

        return "🌫️";
    }

    return isNight
        ? "🌙"
        : "🌤️";
}


// ======================================================
// CLASS ANIMASI CUACA
// ======================================================

function getWeatherAnimationClass(
    weatherDesc
) {

    const weather =
        String(weatherDesc || "")
            .toLowerCase();

    if (
        weather.includes("petir") ||
        weather.includes("kilat")
    ) {
        return "weather-thunder";
    }

    if (weather.includes("hujan")) {
        return "weather-rain";
    }

    if (weather.includes("berawan")) {
        return "weather-cloud";
    }

    if (weather.includes("cerah")) {
        return "weather-sun";
    }

    return "";
}


// ======================================================
// FORMAT WAKTU
// ======================================================

function formatForecastTime(dateString) {

    if (!dateString) {
        return "-";
    }

    const date =
        new Date(
            dateString.replace(" ", "T")
        );

    return new Intl.DateTimeFormat(
        "id-ID",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(date);
}


// ======================================================
// POSISI LABEL POLYGON
// ======================================================

function getPolygonCenter(layer) {

    return layer
        .getBounds()
        .getCenter();
}


// ======================================================
// REQUEST BMKG
// ======================================================

function getLocalBMKGCache(adm4) {

    const cacheKey =
        `bmkg_${adm4}`;

    const cached =
        localStorage.getItem(
            cacheKey
        );

    if (!cached) {
        return null;
    }

    try {

        const parsed =
            JSON.parse(cached);

        const age =
            Date.now() -
            parsed.timestamp;

        if (
            age < CACHE_DURATION &&
            parsed.data
        ) {

            return parsed.data;
        }

        localStorage.removeItem(
            cacheKey
        );

    } catch (error) {

        localStorage.removeItem(
            cacheKey
        );
    }

    return null;
}


async function getBMKGWeather(adm4) {

    if (weatherCache.has(adm4)) {
        return weatherCache.get(adm4);
    }

    const localData =
        getLocalBMKGCache(adm4);

    if (localData) {

        weatherCache.set(
            adm4,
            localData
        );

        return localData;
    }

    const url =
        BMKG_API +
        encodeURIComponent(adm4);

    const response =
        await fetch(url);

    if (!response.ok) {

        throw new Error(
            `BMKG ${response.status}`
        );
    }

    const data =
        await response.json();

    weatherCache.set(
        adm4,
        data
    );

    try {

        localStorage.setItem(
            `bmkg_${adm4}`,
            JSON.stringify({
                timestamp: Date.now(),
                data: data
            })
        );

    } catch (error) {

        console.warn(
            "Cache browser tidak dapat disimpan:",
            adm4
        );
    }

    return data;
}


// ======================================================
// SEMUA WAKTU PRAKIRAAN
// ======================================================

function getAllForecasts(data) {

    if (
        !data ||
        !Array.isArray(data.data)
    ) {
        return [];
    }

    const forecasts = [];

    data.data.forEach(group => {

        if (!group.cuaca) {
            return;
        }

        group.cuaca.forEach(day => {

            if (!Array.isArray(day)) {
                return;
            }

            day.forEach(item => {

                forecasts.push(item);
            });
        });
    });

    return forecasts;
}


// ======================================================
// PRAKIRAAN TERDEKAT
// ======================================================

function getNearestForecast(data) {

    const forecasts =
        getAllForecasts(data);

    if (forecasts.length === 0) {
        return null;
    }

    const now =
        new Date();

    forecasts.sort(
        (a, b) => {

            const timeA =
                new Date(
                    a.local_datetime
                        .replace(" ", "T")
                );

            const timeB =
                new Date(
                    b.local_datetime
                        .replace(" ", "T")
                );

            return (
                Math.abs(timeA - now) -
                Math.abs(timeB - now)
            );
        }
    );

    return forecasts[0];
}


// ======================================================
// PARSE WAKTU LOKAL BMKG
// ======================================================

function parseLocalDateTime(dateTimeString) {

    if (!dateTimeString) {
        return null;
    }

    const [
        datePart,
        timePart
    ] = dateTimeString.split(" ");

    if (
        !datePart ||
        !timePart
    ) {
        return null;
    }

    const [
        year,
        month,
        day
    ] =
        datePart
            .split("-")
            .map(Number);

    const [
        hour,
        minute,
        second
    ] =
        timePart
            .split(":")
            .map(Number);

    return new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second || 0
    );
}


// ======================================================
// FORMAT WAKTU UNTUK TIMELINE
// ======================================================

function dateToLocalDateTimeString(date) {

    const pad =
        value =>
            String(value)
                .padStart(2, "0");

    return (
        date.getFullYear() +
        "-" +
        pad(date.getMonth() + 1) +
        "-" +
        pad(date.getDate()) +
        " " +
        pad(date.getHours()) +
        ":00:00"
    );
}


// ======================================================
// MEMBENTUK TIMELINE PER JAM
// ======================================================

function initializeForecastTimeline() {

    if (weatherCache.size === 0) {
        return;
    }

    const allDates = [];

    weatherCache.forEach(data => {

        const forecasts =
            getAllForecasts(data);

        forecasts.forEach(item => {

            const date =
                parseLocalDateTime(
                    item.local_datetime
                );

            if (
                date &&
                !Number.isNaN(
                    date.getTime()
                )
            ) {

                allDates.push(date);
            }
        });
    });

    if (
        allDates.length === 0
    ) {
        return;
    }

    let minDate =
        new Date(
            Math.min(
                ...allDates.map(
                    date =>
                        date.getTime()
                )
            )
        );

    let maxDate =
        new Date(
            Math.max(
                ...allDates.map(
                    date =>
                        date.getTime()
                )
            )
        );

    minDate.setMinutes(
        0,
        0,
        0
    );

    maxDate.setMinutes(
        0,
        0,
        0
    );

    forecastTimes =
        [];

    const cursor =
        new Date(
            minDate.getTime()
        );

    while (
        cursor <= maxDate
    ) {

        forecastTimes.push(
            dateToLocalDateTimeString(
                cursor
            )
        );

        cursor.setHours(
            cursor.getHours() + 1
        );
    }

    if (
        forecastTimes.length === 0
    ) {
        return;
    }

    const now =
        new Date();

    let nearestIndex =
        0;

    let nearestDifference =
        Infinity;

    forecastTimes.forEach(
        (time, index) => {

            const date =
                parseLocalDateTime(
                    time
                );

            const difference =
                Math.abs(
                    date - now
                );

            if (
                difference <
                nearestDifference
            ) {

                nearestDifference =
                    difference;

                nearestIndex =
                    index;
            }
        }
    );

    selectedForecastIndex =
        nearestIndex;

    selectedForecastTime =
        forecastTimes[
            selectedForecastIndex
        ];

    console.log(
        "Timeline per jam:",
        forecastTimes
    );

    console.log(
        "Toleransi data terdekat:",
        MAX_TIME_DIFFERENCE_MINUTES,
        "menit"
    );

    updateTimelineDisplay();
}


// ======================================================
// DATA HARI TIMELINE
// ======================================================

function getTimelineDays() {

    const days = [];

    forecastTimes.forEach(time => {

        const datePart =
            time.split(" ")[0];

        if (
            !days.includes(datePart)
        ) {
            days.push(datePart);
        }
    });

    return days;
}


// ======================================================
// FORMAT TANGGAL TIMELINE
// ======================================================

function formatTimelineDate(datePart) {

    const [
        year,
        month,
        day
    ] =
        datePart
            .split("-")
            .map(Number);

    const date =
        new Date(
            year,
            month - 1,
            day
        );

    return new Intl.DateTimeFormat(
        "id-ID",
        {
            weekday: "short",
            day: "numeric",
            month: "short"
        }
    ).format(date);
}


// ======================================================
// TAMPILAN TIMELINE (GAYA KARTU BERSUHU - RATA-RATA KOTA)
// ======================================================

function updateTimelineDisplay() {
    if (forecastTimes.length === 0 || !selectedForecastTime) {
        return;
    }

    const days = getTimelineDays();
    const selectedDatePart = selectedForecastTime.split(" ")[0];
    selectedDayIndex = days.indexOf(selectedDatePart);

    if (selectedDayIndex < 0) {
        selectedDayIndex = 0;
    }

    const dateElement = document.getElementById("timeline-date");
    if (dateElement) {
        dateElement.textContent = formatTimelineDate(days[selectedDayIndex]);
    }

    const hoursContainer = document.getElementById("timeline-hours");
    if (!hoursContainer) {
        return;
    }

    // Bersihkan isi wadah jam lama
    hoursContainer.innerHTML = "";

    const timesForDay = forecastTimes.filter(time =>
        time.startsWith(days[selectedDayIndex])
    );

    timesForDay.forEach(time => {
        const timePart = time.split(" ")[1];
        const [hour, minute] = timePart.split(":");

        // Hitung rata-rata suhu dari seluruh kelurahan yang ada di cache untuk jam ini
        let tempSum = 0;
        let tempCount = 0;
        let sampleDesc = "Cerah";

        if (weatherCache.size > 0) {
            weatherCache.forEach((data) => {
                const w = getForecastByTime(data, time);
                if (w && w.t !== undefined && !isNaN(Number(w.t))) {
                    tempSum += Number(w.t);
                    tempCount++;
                    sampleDesc = w.weather_desc;
                }
            });
        }

        let icon = getWeatherIcon(sampleDesc, time);
        let temp = tempCount > 0 ? Math.round(tempSum / tempCount) : "--";

        const box = document.createElement("div");
        box.className = "hour-box"; 

        if (time === selectedForecastTime) {
            box.classList.add("active");
        }

        // Cetak susunan Kartu: Jam -> Ikon -> Suhu Rata-rata
        box.innerHTML = `
            <div class="hour-box-text">${hour}.${minute}</div>
            <div class="hour-box-icon">${icon}</div>
            <div class="hour-box-temp">${temp}°</div>
        `;

        box.onclick = function() {
            selectedForecastTime = time;
            selectedForecastIndex = forecastTimes.indexOf(time);
            updateMapForSelectedTime();
        };

        hoursContainer.appendChild(box);
    });

    const prevButton = document.getElementById("timeline-prev-day");
    const nextButton = document.getElementById("timeline-next-day");

    if (prevButton) {
        prevButton.disabled = selectedDayIndex <= 0;
    }

    if (nextButton) {
        nextButton.disabled = selectedDayIndex >= days.length - 1;
    }
}

// ======================================================
// PRAKIRAAN TERDEKAT DENGAN TOLERANSI 90 MENIT
// ======================================================

function getForecastByTime(
    data,
    selectedTime
) {

    const forecasts =
        getAllForecasts(data);

    if (
        forecasts.length === 0
    ) {
        return null;
    }

    const target =
        parseLocalDateTime(
            selectedTime
        );

    if (!target) {
        return null;
    }

    let nearestForecast =
        null;

    let nearestDifference =
        Infinity;

    forecasts.forEach(item => {

        const forecastDate =
            parseLocalDateTime(
                item.local_datetime
            );

        if (!forecastDate) {
            return;
        }

        const difference =
            Math.abs(
                forecastDate -
                target
            );

        if (
            difference <
            nearestDifference
        ) {

            nearestDifference =
                difference;

            nearestForecast =
                item;
        }
    });

    if (!nearestForecast) {
        return null;
    }

    const differenceMinutes =
        nearestDifference /
        60000;

    if (
        differenceMinutes >
        MAX_TIME_DIFFERENCE_MINUTES
    ) {
        return null;
    }

    return {
        ...nearestForecast,

        _timeline_time:
            selectedTime,

        _time_difference_minutes:
            Math.round(
                differenceMinutes
            )
    };
}


// ======================================================
// BANTUAN: HTML 3 HARI UNTUK POPUP
// ======================================================

function get3DayPopupHTML(adm4) {

    if (!adm4) return "";

    const rawData =
        weatherCache.get(adm4);

    if (!rawData) return "";

    const forecasts =
        getAllForecasts(rawData);

    if (forecasts.length === 0) return "";

    const daysMap = new Map();

    forecasts.forEach(item => {

        if (!item.local_datetime) return;

        const dayKey =
            item.local_datetime.split(" ")[0];

        if (!daysMap.has(dayKey)) {
            daysMap.set(dayKey, []);
        }

        daysMap.get(dayKey).push(item);
    });

    const sortedDays =
        Array.from(daysMap.keys())
            .sort()
            .slice(0, 3);

    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

    let colsHTML = "";

    sortedDays.forEach((dayKey) => {

        const items =
            daysMap.get(dayKey);

        const midItem =
            items[Math.floor(items.length / 2)] || items[0];

        const icon =
            getWeatherIcon(midItem.weather_desc, midItem);

        // Cari Suhu Minimum dan Maksimum Harian
        const temps = items.map(i => Number(i.t)).filter(t => !isNaN(t));
        const minT = Math.min(...temps);
        const maxT = Math.max(...temps);
        const tempStr = (minT === maxT) ? `${minT}°C` : `${minT}°C - ${maxT}°C`;

        // Format Tanggal (Contoh: Rabu, 09 Sep)
        const [y, m, d] = dayKey.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayName = dayNames[dateObj.getDay()];
        const dateStr = `${String(d).padStart(2, '0')} ${monthNames[m - 1]}`;

        colsHTML += `
            <div class="popup-forecast-col">
                <span class="p-fc-day">${dayName}</span>
                <span class="p-fc-date">${dateStr}</span>
                <div class="p-fc-icon">${icon}</div>
                <span class="p-fc-temp">${tempStr}</span>
            </div>
        `;
    });

    return `
        <div style="font-size:12px; font-weight:800; color:var(--text, #1E293B); margin-top:8px;">
            Prakiraan 3 Hari Ke Depan
        </div>
        <div class="popup-forecast-container">
            ${colsHTML}
        </div>
    `;
}

// ======================================================
// LABEL CUACA KELURAHAN
// ======================================================

function createKelurahanWeatherLabel(layer, namaKel, weather) {
    let icon = getWeatherIcon(weather.weather_desc, weather);
    let weatherClass = getWeatherAnimationClass(weather.weather_desc);

    const center = getPolygonCenter(layer);

    if (layer._weatherLabel) {
        labelKelurahanLayer.removeLayer(layer._weatherLabel);
    }

    const label = L.marker(center, {
        interactive: false,
        icon: L.divIcon({
            className: "", // Kosongkan agar tidak bentrok dengan CSS Leaflet
            html: `
                <div class="region-label-container">
                    <div class="label-circle">
                        <div class="label-icon-wrapper ${weatherClass}">${icon}</div>
                        <div class="label-temp">${weather.t}°C</div>
                    </div>
                    <div class="label-name">${namaKel}</div>
                </div>
            `,
            iconSize: [0, 0], // KUNCI: Titik koordinat diset ke 0 agar berada persis di pusat
            iconAnchor: [0, 0] 
        })
    });

    layer._weatherLabel = label;
    labelKelurahanLayer.addLayer(label);
}

// ======================================================
// LABEL DATA TIDAK TERSEDIA (KELURAHAN)
// ======================================================

function setKelurahanNoData(
    layer
) {

    const props =
        layer.feature.properties;

    const namaKel =
        props.Kelurahan || "-";

    const namaKec =
        props.Kecamatan || "-";

    layer._weatherColor =
        "#9ca3af";

    layer._weatherData =
        null;

    layer.setStyle({
        color: "#ffffff",
        weight: 1.4,
        opacity: 0.95,
        fillColor: "#9ca3af",
        fillOpacity: 0.35
    });

    if (
        layer._weatherLabel
    ) {

        labelKelurahanLayer
            .removeLayer(
                layer._weatherLabel
            );
    }

    layer.bindPopup(`
        <div style="min-width:210px;">
            <b style="font-size:15px;">${namaKel}</b>
            <br>
            <span style="color:#94A3B8; font-size:11px;">Kecamatan ${namaKec}</span>
            <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0;">
            Data tidak tersedia dalam toleransi ±60 menit.
        </div>
    `);
}


// ======================================================
// UPDATE KELURAHAN
// ======================================================

function updateKelurahanWeather(layer, weather) {
    if (!weather) return;

    const props = layer.feature.properties;
    const namaKel = props.Kelurahan || "-";
    const namaKec = props.Kecamatan || "-";
    const adm4 = String(props.adm4 || "").trim();

    const icon = getWeatherIcon(weather.weather_desc, weather);
    const color = getWeatherColor(weather.weather_desc);

    layer._weatherColor = color;
    layer._weatherData = weather;

    layer.setStyle({
        color: "#ffffff",
        weight: 1.4,
        opacity: 0.95,
        fillColor: color,
        fillOpacity: 0.50
    });

    const forecastHTML = get3DayPopupHTML(adm4);

    layer.bindPopup(`
        <div style="min-width:240px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; border-bottom:1px solid var(--theme-border, #E2E8F0); padding-bottom:10px;">
                <div style="font-size:28px;">${icon}</div>
                <div>
                    <div style="font-size:16px; font-weight:700; color:var(--text, #1E293B); line-height:1.2;">${namaKel}</div>
                    <div style="font-size:12px; color:var(--text-sec, #64748B);">Kec. ${namaKec}</div>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;">
                <div style="background:var(--theme-soft, #F5F9FC); border:1px solid var(--theme-border, #E2E8F0); padding:8px; border-radius:8px;">
                    <div style="font-size:10px; color:var(--text-sec, #64748B);">Kondisi</div>
                    <div style="font-size:13px; font-weight:700; color:var(--text, #1E293B); margin-top:2px;">${weather.weather_desc}</div>
                </div>
                <div style="background:var(--theme-soft, #F5F9FC); border:1px solid var(--theme-border, #E2E8F0); padding:8px; border-radius:8px;">
                    <div style="font-size:10px; color:var(--text-sec, #64748B);">Suhu</div>
                    <div style="font-size:13px; font-weight:700; color:var(--text, #1E293B); margin-top:2px;">${weather.t ?? "-"}°C</div>
                </div>
                <div style="background:var(--theme-soft, #F5F9FC); border:1px solid var(--theme-border, #E2E8F0); padding:8px; border-radius:8px;">
                    <div style="font-size:10px; color:var(--text-sec, #64748B);">Kelembapan</div>
                    <div style="font-size:13px; font-weight:700; color:var(--text, #1E293B); margin-top:2px;">${weather.hu ?? "-"}%</div>
                </div>
                <div style="background:var(--theme-soft, #F5F9FC); border:1px solid var(--theme-border, #E2E8F0); padding:8px; border-radius:8px;">
                    <div style="font-size:10px; color:var(--text-sec, #64748B);">Kec. Angin</div>
                    <div style="font-size:13px; font-weight:700; color:var(--text, #1E293B); margin-top:2px;">${weather.ws ?? "-"} km/j</div>
                </div>
            </div>

            ${forecastHTML}
        </div>
    `);

    createKelurahanWeatherLabel(layer, namaKel, weather);
}


// ======================================================
// MENYIMPAN DATA PER KECAMATAN
// ======================================================

function addWeatherToKecamatan(
    namaKecamatan,
    weather
) {

    const key =
        normalizeName(
            namaKecamatan
        );

    if (
        !kecamatanWeatherData
            .has(key)
    ) {

        kecamatanWeatherData
            .set(
                key,
                []
            );
    }

    kecamatanWeatherData
        .get(key)
        .push(weather);
}


// ======================================================
// AGREGASI CUACA KECAMATAN
// ======================================================

function calculateKecamatanWeather(
    weatherList
) {

    if (
        !weatherList ||
        weatherList.length === 0
    ) {
        return null;
    }

    const weatherCounter = {};
    const temperatures = [];
    
    let sumHu = 0, sumWs = 0;
    let countHu = 0, countWs = 0;

    weatherList.forEach(
        weather => {

            const desc =
                String(weather.weather_desc || "Tidak diketahui");

            weatherCounter[desc] =
                (weatherCounter[desc] || 0) + 1;

            const temp =
                Number(weather.t);

            if (!Number.isNaN(temp)) {
                temperatures.push(temp);
            }

            if (weather.hu) { 
                sumHu += Number(weather.hu); 
                countHu++; 
            }
            if (weather.ws) { 
                sumWs += Number(weather.ws); 
                countWs++; 
            }
        }
    );

    const dominantWeather =
        Object.entries(weatherCounter)
            .sort((a, b) => b[1] - a[1])[0][0];

    const minTemp =
        temperatures.length ? Math.min(...temperatures) : null;

    const maxTemp =
        temperatures.length ? Math.max(...temperatures) : null;

    return {
        weather_desc: dominantWeather,
        minTemp: minTemp,
        maxTemp: maxTemp,
        hu: countHu ? Math.round(sumHu / countHu) : "-",
        ws: countWs ? Math.round(sumWs / countWs) : "-",
        total: weatherList.length
    };
}


// ======================================================
// LABEL CUACA KECAMATAN
// ======================================================

function createKecamatanWeatherLabel(
    layer, 
    namaKecamatan, 
    aggregate
) {

    let icon = 
        getWeatherIcon(aggregate.weather_desc, selectedForecastTime);
    
    let weatherClass = 
        getWeatherAnimationClass(aggregate.weather_desc);

    const center = 
        getPolygonCenter(layer);

    if (layer._weatherLabel) {
        labelKecamatanLayer.removeLayer(layer._weatherLabel);
    }

    let suhuText = "-";
    
    if (aggregate.minTemp !== null && aggregate.maxTemp !== null) {
        suhuText = aggregate.minTemp === aggregate.maxTemp 
            ? `${aggregate.minTemp}°` 
            : `${aggregate.minTemp}–${aggregate.maxTemp}°`;
    }

    const label = L.marker(center, {
        interactive: false,
        icon: L.divIcon({
            className: "", 
            html: `
                <div class="region-label-container">
                    <div class="label-circle">
                        <div class="label-icon-wrapper ${weatherClass}">${icon}</div>
                        <div class="label-temp">${suhuText}</div>
                    </div>
                    <div class="label-name">${namaKecamatan}</div>
                </div>
            `,
            iconSize: [0, 0], 
            iconAnchor: [0, 0]
        })
    });

    layer._weatherLabel = label;
    labelKecamatanLayer.addLayer(label);
}


function setKecamatanNoData(
    layer
) {

    const nama = 
        layer.feature.properties.Kecamatan || "-";

    if (currentAdminLevel !== 'kecamatan') {
        layer.setStyle({ opacity: 0, fillOpacity: 0 });
        if (layer._weatherLabel) {
            labelKecamatanLayer.removeLayer(layer._weatherLabel);
            layer._weatherLabel = null;
        }
        return;
    }

    layer._weatherColor = "#9ca3af";
    
    layer.setStyle({
        color: "#ffffff",
        weight: 2.5,
        opacity: 1,
        fillColor: "#9ca3af",
        fillOpacity: 0.35
    });

    if (layer._weatherLabel) {
        labelKecamatanLayer.removeLayer(layer._weatherLabel);
    }

    layer.bindPopup(`
        <div style="min-width:210px;">
            <b style="font-size:15px; color:var(--text, #1E293B);">Kecamatan ${nama}</b>
            <hr style="border:0; border-top:1px solid var(--theme-border, #E2E8F0); margin:8px 0;">
            <span style="color:var(--text-sec, #64748B); font-size:12px;">Data tidak tersedia dalam toleransi ±60 menit.</span>
        </div>
    `);
}


// ======================================================
// UPDATE KECAMATAN & POPUP
// ======================================================

function getAdm4ByKecamatan(namaKecamatan) {
    let foundAdm4 = null;
    
    layerKelurahan.eachLayer(layer => {
        if (foundAdm4) return;
        
        if (normalizeName(layer.feature.properties.Kecamatan) === normalizeName(namaKecamatan)) {
            foundAdm4 = layer.feature.properties.adm4;
        }
    });
    
    return foundAdm4;
}


function updateKecamatanWeather(
    namaKecamatan
) {

    if (!layerKecamatan) {
        return;
    }

    const key =
        normalizeName(namaKecamatan);

    const weatherList =
        kecamatanWeatherData.get(key);

    const aggregate =
        calculateKecamatanWeather(weatherList);

    if (!aggregate) {
        return;
    }

    layerKecamatan
        .eachLayer(
            function(layer) {

                const nama =
                    layer.feature.properties.Kecamatan || "-";

                if (normalizeName(nama) !== key) {
                    return;
                }

                if (currentAdminLevel !== 'kecamatan') {
                    layer.setStyle({ opacity: 0, fillOpacity: 0 });
                    if (layer._weatherLabel) {
                        labelKecamatanLayer.removeLayer(layer._weatherLabel);
                        layer._weatherLabel = null;
                    }
                    return;
                }

                const color = 
                    getWeatherColor(aggregate.weather_desc);
                
                const icon = 
                    getWeatherIcon(aggregate.weather_desc, selectedForecastTime);

                layer._weatherColor = color;
                
                layer.setStyle({
                    color: "#ffffff",
                    weight: 2.5,
                    opacity: 1,
                    fillColor: color,
                    fillOpacity: 0.45
                });

                let suhuText = "-";
                if (aggregate.minTemp !== null && aggregate.maxTemp !== null) {
                    suhuText = aggregate.minTemp === aggregate.maxTemp 
                        ? `${aggregate.minTemp}°C` 
                        : `${aggregate.minTemp}–${aggregate.maxTemp}°C`;
                }

                const adm4 = 
                    getAdm4ByKecamatan(nama);
                
                const forecastHTML = 
                    get3DayPopupHTML(adm4);

                layer.bindPopup(`
                    <div style="min-width:240px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; border-bottom:1px solid var(--theme-border, #E2E8F0); padding-bottom:10px;">
                            <div style="font-size:28px;">${icon}</div>
                            <div>
                                <div style="font-size:16px; font-weight:700; color:var(--text, #1E293B); line-height:1.2;">Kecamatan ${nama}</div>
                                <div style="font-size:12px; color:var(--text-sec, #64748B);">Kota Semarang</div>
                            </div>
                        </div>
                        
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;">
                            <div style="background:var(--theme-soft, #F5F9FC); border:1px solid var(--theme-border, #E2E8F0); padding:8px; border-radius:8px;">
                                <div style="font-size:10px; color:var(--text-sec, #64748B);">Kondisi</div>
                                <div style="font-size:13px; font-weight:700; color:var(--text, #1E293B); margin-top:2px;">${aggregate.weather_desc}</div>
                            </div>
                            <div style="background:var(--theme-soft, #F5F9FC); border:1px solid var(--theme-border, #E2E8F0); padding:8px; border-radius:8px;">
                                <div style="font-size:10px; color:var(--text-sec, #64748B);">Suhu</div>
                                <div style="font-size:13px; font-weight:700; color:var(--text, #1E293B); margin-top:2px;">${suhuText}</div>
                            </div>
                            <div style="background:var(--theme-soft, #F5F9FC); border:1px solid var(--theme-border, #E2E8F0); padding:8px; border-radius:8px;">
                                <div style="font-size:10px; color:var(--text-sec, #64748B);">Kelembapan</div>
                                <div style="font-size:13px; font-weight:700; color:var(--text, #1E293B); margin-top:2px;">${aggregate.hu}%</div>
                            </div>
                            <div style="background:var(--theme-soft, #F5F9FC); border:1px solid var(--theme-border, #E2E8F0); padding:8px; border-radius:8px;">
                                <div style="font-size:10px; color:var(--text-sec, #64748B);">Kec. Angin</div>
                                <div style="font-size:13px; font-weight:700; color:var(--text, #1E293B); margin-top:2px;">${aggregate.ws} km/j</div>
                            </div>
                        </div>

                        ${forecastHTML}
                    </div>
                `);

                createKecamatanWeatherLabel(
                    layer, 
                    nama, 
                    aggregate
                );
            }
        );
}


// ======================================================
// UPDATE PETA BERDASARKAN TIMELINE
// ======================================================

function updateMapForSelectedTime() {

    if (
        !selectedForecastTime ||
        !layerKelurahan
    ) {
        return;
    }

    kecamatanWeatherData
        .clear();

    const totalPerKecamatan =
        new Map();

    const cachedPerKecamatan =
        new Map();

    layerKelurahan
        .eachLayer(
            layer => {

                const namaKecamatan =
                    normalizeName(
                        layer.feature
                            .properties
                            .Kecamatan
                    );

                totalPerKecamatan.set(
                    namaKecamatan,
                    (
                        totalPerKecamatan
                            .get(namaKecamatan) ||
                        0
                    ) + 1
                );

                const adm4 =
                    String(
                        layer.feature
                            .properties
                            .adm4 ||
                        ""
                    ).trim();

                if (!adm4) {
                    return;
                }

                const data =
                    weatherCache
                        .get(adm4);

                if (!data) {
                    return;
                }

                cachedPerKecamatan.set(
                    namaKecamatan,
                    (
                        cachedPerKecamatan
                            .get(namaKecamatan) ||
                        0
                    ) + 1
                );

                const weather =
                    getForecastByTime(
                        data,
                        selectedForecastTime
                    );

                if (!weather) {

                    setKelurahanNoData(
                        layer
                    );

                    return;
                }

                updateKelurahanWeather(
                    layer,
                    weather
                );

                addWeatherToKecamatan(
                    layer.feature
                        .properties
                        .Kecamatan,
                    weather
                );
            }
        );

    if (layerKecamatan) {

        layerKecamatan
            .eachLayer(
                layer => {

                    const nama =
                        layer.feature
                            .properties
                            .Kecamatan ||
                        "-";

                    const key =
                        normalizeName(
                            nama
                        );

                    const weatherList =
                        kecamatanWeatherData
                            .get(key);

                    if (
                        weatherList &&
                        weatherList.length > 0
                    ) {

                        updateKecamatanWeather(
                            nama
                        );

                        return;
                    }

                    const total =
                        totalPerKecamatan
                            .get(key) ||
                        0;

                    const cached =
                        cachedPerKecamatan
                            .get(key) ||
                        0;

                    if (
                        total > 0 &&
                        cached >= total
                    ) {

                        setKecamatanNoData(
                            layer
                        );
                    }
                }
            );
    }

    updateTimelineDisplay();

    updateBMKGInfoPanel();
}


// ======================================================
// PRAKIRAAN 3 HARI KE DEPAN (UNTUK PANEL KOTA)
// ======================================================

function get3DayForecastGlobal() {

    if (weatherCache.size === 0) {
        return [];
    }

    const sampleData =
        Array.from(
            weatherCache.values()
        )[0];

    const forecasts =
        getAllForecasts(sampleData);

    if (
        forecasts.length === 0
    ) {
        return [];
    }

    const daysMap =
        new Map();

    forecasts.forEach(item => {

        if (!item.local_datetime) {
            return;
        }

        const dayKey =
            item.local_datetime
                .split(" ")[0];

        if (
            !daysMap.has(dayKey)
        ) {

            daysMap.set(
                dayKey,
                []
            );
        }

        daysMap.get(dayKey)
            .push(item);
    });

    const sortedDays =
        Array.from(
            daysMap.keys()
        )
        .sort()
        .slice(0, 3);

    const dayLabels = [
        "Hari Ini",
        "Besok",
        "Lusa"
    ];

    return sortedDays.map(
        (dayKey, idx) => {

            const items =
                daysMap.get(
                    dayKey
                );

            const midItem =
                items[
                    Math.floor(
                        items.length / 2
                    )
                ] || items[0];

            return {
                label:
                    dayLabels[idx],

                icon:
                    getWeatherIcon(
                        midItem.weather_desc,
                        midItem
                    ),

                temp:
                    midItem.t
            };
        }
    );
}


// ======================================================
// UPDATE PANEL RATA-RATA KOTA & 3 HARI KE DEPAN
// ======================================================

function updateBMKGInfoPanel() {

    const activeWeatherData =
        [];

    if (layerKelurahan) {

        layerKelurahan.eachLayer(
            layer => {

                if (layer._weatherData) {

                    activeWeatherData.push(
                        layer._weatherData
                    );
                }
            }
        );
    }

    if (
        activeWeatherData.length === 0
    ) {

        document.getElementById(
            "city-temp"
        ).textContent = "--°C";

        document.getElementById(
            "city-desc"
        ).textContent = "Data tidak tersedia";

        document.getElementById(
            "city-time"
        ).textContent = "--.-- WIB";

        return;
    }

    let tempSum = 0;
    let humSum = 0;
    let windSum = 0;
    let cloudSum = 0;

    const descCounter = {};
    const dirCounter = {};

    activeWeatherData.forEach(
        w => {

            tempSum +=
                Number(w.t || 0);

            humSum +=
                Number(w.hu || 0);

            windSum +=
                Number(w.ws || 0);

            cloudSum +=
                Number(w.tcc || 0);

            const desc =
                w.weather_desc || "-";

            descCounter[desc] =
                (descCounter[desc] || 0) + 1;

            if (w.wd) {

                dirCounter[w.wd] =
                    (dirCounter[w.wd] || 0) + 1;
            }
        }
    );

    const len =
        activeWeatherData.length;

    const avgTemp =
        Math.round(tempSum / len);

    const avgHum =
        Math.round(humSum / len);

    const avgWind =
        Math.round(windSum / len);

    const avgCloud =
        Math.round(cloudSum / len);

    const domDesc =
        Object.keys(
            descCounter
        ).reduce(
            (a, b) =>
                descCounter[a] > descCounter[b]
                    ? a
                    : b
        );

    const domDir =
        Object.keys(dirCounter).length > 0
            ? Object.keys(
                dirCounter
            ).reduce(
                (a, b) =>
                    dirCounter[a] > dirCounter[b]
                        ? a
                        : b
            )
            : "--";

    document.getElementById(
        "city-temp"
    ).textContent =
        avgTemp + "°C";

    document.getElementById(
        "city-desc"
    ).textContent =
        getWeatherIcon(
            domDesc,
            selectedForecastTime || activeWeatherData[0]
        ) + " " + domDesc;

    document.getElementById(
        "city-humidity"
    ).textContent =
        avgHum + "%";

    document.getElementById(
        "city-wind"
    ).textContent =
        avgWind + " km/jam";

    document.getElementById(
        "city-wind-dir"
    ).textContent =
        domDir;

    document.getElementById(
        "city-cloud"
    ).textContent =
        avgCloud + "%";

    const usedTimes =
        activeWeatherData
            .map(
                w => w.local_datetime
            )
            .sort();

    const getHourMinute =
        (dtStr) =>
            dtStr
                .split(" ")[1]
                .substring(0, 5)
                .replace(":", ".");

    const firstHour =
        getHourMinute(
            usedTimes[0]
        );

    const lastHour =
        getHourMinute(
            usedTimes[
                usedTimes.length - 1
            ]
        );

    document.getElementById(
        "city-time"
    ).textContent =
        firstHour === lastHour
            ? firstHour + " WIB"
            : firstHour + "–" + lastHour + " WIB";

    const analysisTime =
        activeWeatherData[0].analysis_date;

    if (analysisTime) {

        const utcString =
            analysisTime
                .replace(" ", "T") +
            "Z";

        const localDate =
            new Date(utcString);

        const formattedDate =
            new Intl.DateTimeFormat(
                "id-ID",
                {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                }
            ).format(localDate).replace(":", ".");

        const analysisElement =
            document.getElementById(
                "info-analysis-time"
            );

        if (analysisElement) {

            analysisElement.textContent =
                "Pembaruan: " +
                formattedDate +
                " WIB";
        }
    }

    const container3Day =
        document.getElementById(
            "city-3day-container"
        );

    if (container3Day) {

        const forecasts =
            get3DayForecastGlobal();

        container3Day.innerHTML =
            forecasts.map(
                (f, i) => `
                    <div class="f-card ${i === 0 ? 'active' : ''}">
                        <span class="f-day">${f.label}</span>
                        <span class="f-icon">${f.icon}</span>
                        <span class="f-temp">${f.temp}°</span>
                    </div>
                `
            ).join("");
    }
}


// ======================================================
// DELAY REQUEST
// ======================================================

function delay(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}


// ======================================================
// LOAD CUACA SELURUH KELURAHAN
// ======================================================

async function loadAllKelurahanWeather() {

    if (!layerKelurahan) {
        return;
    }

    const layers = [];

    layerKelurahan.eachLayer(
        layer => {

            const adm4 =
                String(
                    layer.feature
                        .properties
                        .adm4 || ""
                ).trim();

            if (adm4) {

                layers.push({
                    layer,
                    adm4
                });
            }
        }
    );

    totalWeather =
        layers.length;

    loadedWeather =
        0;

    let failedWeather =
        0;

    const loadingBox =
        document.getElementById(
            "weather-loading"
        );

    const progressText =
        document.getElementById(
            "weather-progress"
        );

    if (loadingBox) {

        loadingBox.style.display =
            "block";
    }

    if (progressText) {

        progressText.textContent =
            `0/${totalWeather}`;
    }

    console.log(
        `Memulai pengambilan ${totalWeather} data BMKG...`
    );


    // ==================================================
    // PROSES SATU KELURAHAN
    // ==================================================

    async function processKelurahan(
        item
    ) {

        try {

            const data =
                await getBMKGWeather(
                    item.adm4
                );


            let weather =
                null;


            if (selectedForecastTime) {

                weather =
                    getForecastByTime(
                        data,
                        selectedForecastTime
                    );

            } else {

                weather =
                    getNearestForecast(
                        data
                    );
            }


            if (weather) {

                updateKelurahanWeather(
                    item.layer,
                    weather
                );


                const namaKecamatan =
                    item.layer
                        .feature
                        .properties
                        .Kecamatan;


                addWeatherToKecamatan(
                    namaKecamatan,
                    weather
                );


                updateKecamatanWeather(
                    namaKecamatan
                );

            } else {

                setKelurahanNoData(
                    item.layer
                );
            }


            console.log(
                item.layer.feature
                    .properties
                    .Kelurahan,
                weather
                    ? weather.weather_desc
                    : "Data tidak tersedia"
            );

        }

        catch (error) {

            failedWeather++;

            console.warn(
                "Gagal:",
                item.layer.feature
                    .properties
                    .Kelurahan,
                error.message
            );

        }

        finally {

            loadedWeather++;


            if (progressText) {

                progressText.textContent =
                    `${loadedWeather}/${totalWeather}`;
            }
        }
    }


    // ==================================================
    // REQUEST BERTAHAP
    // ==================================================

    const requests = [];

    for (
        let i = 0;
        i < layers.length;
        i++
    ) {

        const item =
            layers[i];


        const usesCache =
            weatherCache.has(
                item.adm4
            ) ||
            getLocalBMKGCache(
                item.adm4
            ) !== null;


        requests.push(
            processKelurahan(
                item
            )
        );


        // ±57 request per menit untuk data yang belum ada di cache
        if (
            !usesCache &&
            i <
            layers.length - 1
        ) {

            await delay(
                1050
            );
        }
    }


    // Tunggu request terakhir selesai
    await Promise.all(
        requests
    );

    // ==================================================
    // FINALISASI PETA
    // ==================================================
    initializeForecastTimeline();
    updateMapForSelectedTime();
    updateBMKGInfoPanel();

    if (loadingBox) {

        loadingBox.textContent =
            failedWeather === 0
                ? "Data BMKG selesai dimuat ✓"
                : `Data selesai: ${totalWeather - failedWeather}/${totalWeather} berhasil`;

        setTimeout(
            function() {
                loadingBox.style.display =
                    "none";
            },
            2500
        );
    }

    if (
        failedWeather === 0
    ) {

        showAppNotification(
            `Data BMKG berhasil dimuat untuk ${totalWeather} kelurahan.`,
            "success",
            3200
        );

    } else {

        showAppNotification(
            `${totalWeather - failedWeather}/${totalWeather} data kelurahan berhasil dimuat. ${failedWeather} request gagal dan dapat dicoba lagi saat refresh berikutnya.`,
            "warning",
            6500
        );
    }

    console.log(
        "Seluruh proses cuaca selesai.",
        {
            total:
                totalWeather,

            berhasil:
                totalWeather - failedWeather,

            gagal:
                failedWeather
        }
    );

    // ==================================================
    // PENYIMPANAN HISTORIS
    // ==================================================
    // Tidak lagi dilakukan dari browser.
    // Arsip prakiraan ditangani otomatis oleh backend Vercel
    // melalui auto-archive.js + aggregate-weather.js.

} // <-- Ini adalah kurung penutup fungsi utama loadAllKelurahanWeather


// ======================================================
// LOAD KECAMATAN
// ======================================================

fetch(
    "data/Kecamatan Semarang.geojson"
)

.then(response => {

    if (!response.ok) {

        throw new Error(
            "Gagal membaca Kecamatan Semarang.geojson"
        );
    }

    return response.json();
})

.then(data => {

    layerKecamatan =
        L.geoJSON(
            data,
            {
                style:
                    styleKecamatan,

                onEachFeature:
                    function(
                        feature,
                        layer
                    ) {

                        const nama =
                            feature
                                .properties
                                .Kecamatan ||
                            "-";

                        layer.bindPopup(`

                            <b>
                                Kecamatan ${nama}
                            </b>

                            <br>

                            Kota Semarang

                            <br>

                            Memuat data BMKG...
                        `);

                        layer.on({

                            mouseover:
                                function(e) {

                                    e.target
                                        .setStyle({
                                            weight: 4,
                                            fillOpacity: 0.65
                                        });

                                    e.target
                                        .bringToFront();
                                },

                            mouseout:
                                function(e) {

                                    const target =
                                        e.target;

                                    if (
                                        target
                                            ._weatherColor
                                    ) {

                                        target
                                            .setStyle({
                                                color: "#ffffff",
                                                weight: 2.5,
                                                opacity: 1,
                                                fillColor:
                                                    target
                                                        ._weatherColor,
                                                fillOpacity: 0.45
                                            });

                                    } else {

                                        layerKecamatan
                                            .resetStyle(
                                                target
                                            );
                                    }
                                }
                        });

                        const center =
                            getPolygonCenter(
                                layer
                            );

                        const label =
                            L.marker(
                                center,
                                {
                                    interactive:
                                        false,

                                    icon:
                                        L.divIcon({

                                            className:
                                                "label-kecamatan",

                                            html:
                                                `<div>${nama}</div>`,

                                            iconSize:
                                                null
                                        })
                                }
                            );

                        layer._weatherLabel =
                            label;

                        labelKecamatanLayer
                            .addLayer(
                                label
                            );
                    }
            }
        );

    layerKecamatan
        .addTo(map);

    labelKecamatanLayer
        .addTo(map);

    map.fitBounds(
        layerKecamatan
            .getBounds()
    );

    setupLayerControl();

    updateLabelVisibility();
})

.catch(error => {

    console.error(
        "Error Kecamatan:",
        error
    );

    showAppNotification(
        `Gagal memuat batas Kecamatan: ${error.message}`,
        "error",
        7000
    );
});


// ======================================================
// LOAD KELURAHAN
// ======================================================

fetch(
    "data/Kelurahan Semarang.geojson"
)

.then(response => {

    if (!response.ok) {

        throw new Error(
            "Gagal membaca Kelurahan Semarang.geojson"
        );
    }

    return response.json();
})

.then(data => {

    layerKelurahan =
        L.geoJSON(
            data,
            {
                style:
                    styleKelurahan,

                onEachFeature:
                    function(
                        feature,
                        layer
                    ) {

                        const namaKel =
                            feature
                                .properties
                                .Kelurahan ||
                            "-";

                        const namaKec =
                            feature
                                .properties
                                .Kecamatan ||
                            "-";

                        layer.bindPopup(`

                            <b>
                                ${namaKel}
                            </b>

                            <br>

                            Kecamatan:
                            ${namaKec}

                            <br>

                            Memuat data BMKG...
                        `);

                        layer.on({

                            mouseover:
                                function(e) {

                                    e.target
                                        .setStyle({
                                            weight: 2.5,
                                            fillOpacity: 0.65
                                        });

                                    e.target
                                        .bringToFront();
                                },

                            mouseout:
                                function(e) {

                                    const target =
                                        e.target;

                                    if (
                                        target
                                            ._weatherColor
                                    ) {

                                        target
                                            .setStyle({
                                                color: "#ffffff",
                                                weight: 1.4,
                                                opacity: 0.95,
                                                fillColor:
                                                    target
                                                        ._weatherColor,
                                                fillOpacity: 0.50
                                            });

                                    } else {

                                        layerKelurahan
                                            .resetStyle(
                                                target
                                            );
                                    }
                                }
                        });
                    }
            }
        );

    setupLayerControl();

    updateLabelVisibility();

    loadAllKelurahanWeather();
})

.catch(error => {

    console.error(
        "Error Kelurahan:",
        error
    );

    showAppNotification(
        `Gagal memuat batas Kelurahan: ${error.message}`,
        "error",
        7000
    );
});


// ======================================================
// KONTROL NAVBAR (BASEMAP & TINGKAT WILAYAH)
// ======================================================


// ======================================================
// 1. BASEMAP
// ======================================================

document
    .querySelectorAll(
        'input[name="basemap"]'
    )
    .forEach(
        radio => {

            radio.addEventListener(
                "change",
                function(event) {

                    const value =
                        event
                            .target
                            .value;

                    if (
                        ![
                            "auto",
                            "osm",
                            "esri"
                        ].includes(value)
                    ) {

                        console.warn(
                            "Basemap tidak dikenal:",
                            value
                        );

                        return;
                    }

                    currentBasemapMode =
                        value;

                    applyBasemap();
                }
            );
        }
    );


// ======================================================
// 2. KECAMATAN / KELURAHAN
// ======================================================

document
    .querySelectorAll(
        'input[name="admin_level"]'
    )
    .forEach(
        radio => {

            radio.addEventListener(
                "change",
                function(event) {

                    const value =
                        event
                            .target
                            .value;

                    if (
                        ![
                            "kecamatan",
                            "kelurahan"
                        ].includes(value)
                    ) {

                        console.warn(
                            "Tingkat administrasi tidak dikenal:",
                            value
                        );

                        return;
                    }

                    currentAdminLevel =
                        value;


                    // ------------------------------------------
                    // MODE KECAMATAN
                    // ------------------------------------------

                    if (
                        currentAdminLevel ===
                        "kecamatan"
                    ) {

                        if (
                            layerKelurahan &&
                            map.hasLayer(
                                layerKelurahan
                            )
                        ) {

                            map.removeLayer(
                                layerKelurahan
                            );
                        }

                        if (
                            layerKecamatan &&
                            !map.hasLayer(
                                layerKecamatan
                            )
                        ) {

                            layerKecamatan
                                .addTo(map);
                        }
                    }


                    // ------------------------------------------
                    // MODE KELURAHAN
                    // ------------------------------------------

                    else {

                        if (
                            layerKecamatan &&
                            map.hasLayer(
                                layerKecamatan
                            )
                        ) {

                            map.removeLayer(
                                layerKecamatan
                            );
                        }

                        if (
                            layerKelurahan &&
                            !map.hasLayer(
                                layerKelurahan
                            )
                        ) {

                            layerKelurahan
                                .addTo(map);
                        }
                    }


                    // Icon + nama kelurahan hanya muncul
                    // pada zoom yang cukup dekat.
                    updateLabelVisibility();


                    // Update warna, popup, icon, panel kota
                    // sesuai waktu timeline saat ini.
                    updateMapForSelectedTime();
                }
            );
        }
    );


// Fungsi ini tetap dipertahankan karena dipanggil setelah
// masing-masing GeoJSON selesai dimuat.
function setupLayerControl() {

    updateLabelVisibility();
}


// ======================================================
// KONTROL HARI TIMELINE
// ======================================================

document
    .getElementById(
        "timeline-prev-day"
    )
    ?.addEventListener(
        "click",
        function() {

            const days =
                getTimelineDays();

            if (
                days.length === 0 ||
                selectedDayIndex <= 0
            ) {
                return;
            }

            selectedDayIndex--;

            const selectedDay =
                days[
                    selectedDayIndex
                ];

            const currentHour =
                selectedForecastTime
                    ?.split(" ")[1];

            let nextTime =
                forecastTimes.find(
                    time =>
                        time ===
                        `${selectedDay} ${currentHour}`
                );

            if (!nextTime) {

                nextTime =
                    forecastTimes.find(
                        time =>
                            time.startsWith(
                                selectedDay
                            )
                    );
            }

            if (!nextTime) {
                return;
            }

            selectedForecastTime =
                nextTime;

            selectedForecastIndex =
                forecastTimes.indexOf(
                    nextTime
                );

            updateMapForSelectedTime();
        }
    );


document
    .getElementById(
        "timeline-next-day"
    )
    ?.addEventListener(
        "click",
        function() {

            const days =
                getTimelineDays();

            if (
                days.length === 0 ||
                selectedDayIndex >=
                days.length - 1
            ) {
                return;
            }

            selectedDayIndex++;

            const selectedDay =
                days[
                    selectedDayIndex
                ];

            const currentHour =
                selectedForecastTime
                    ?.split(" ")[1];

            let nextTime =
                forecastTimes.find(
                    time =>
                        time ===
                        `${selectedDay} ${currentHour}`
                );

            if (!nextTime) {

                nextTime =
                    forecastTimes.find(
                        time =>
                            time.startsWith(
                                selectedDay
                            )
                    );
            }

            if (!nextTime) {
                return;
            }

            selectedForecastTime =
                nextTime;

            selectedForecastIndex =
                forecastTimes.indexOf(
                    nextTime
                );

            updateMapForSelectedTime();
        }
    );
// ======================================================
// MODE DEMO CUACA
// ======================================================

function testWeatherAnimation(type) {

    const demoMap = {

        sun: {
            icon: "☀️",
            className: "weather-sun",
            color: "#FDE047"
        },

        cloud: {
            icon: "☁️",
            className: "weather-cloud",
            color: "#94A3B8"
        },

        rain: {
            icon: "🌧️",
            className: "weather-rain",
            color: "#2563EB"
        },

        thunder: {
            icon: "⛈️",
            className: "weather-thunder",
            color: "#0F172A"
        }
    };


    const selected =
        demoMap[type];


    if (!selected) {

        console.log(
            "Pilihan: sun, cloud, rain, thunder"
        );

        return;
    }


    demoWeatherType =
        type;


    if (demoWeatherTimer) {

        clearTimeout(
            demoWeatherTimer
        );
    }


    // ==================================================
    // DEMO LAYER KELURAHAN
    // ==================================================

    if (layerKelurahan) {

        layerKelurahan.eachLayer(
            layer => {

                const weather =
                    layer._weatherData;

                if (!weather) {
                    return;
                }


                layer._weatherColor =
                    selected.color;


                layer.setStyle({
                    color: "#ffffff",
                    weight: 1.4,
                    opacity: 0.95,
                    fillColor:
                        selected.color,
                    fillOpacity: 0.50
                });


                const namaKel =
                    layer.feature
                        .properties
                        .Kelurahan || "-";


                createKelurahanWeatherLabel(
                    layer,
                    namaKel,
                    weather
                );
            }
        );
    }


    // ==================================================
    // DEMO LAYER KECAMATAN
    // ==================================================

    if (layerKecamatan) {

        layerKecamatan.eachLayer(
            layer => {

                const namaKecamatan =
                    layer.feature
                        .properties
                        .Kecamatan || "-";


                const key =
                    normalizeName(
                        namaKecamatan
                    );


                const weatherList =
                    kecamatanWeatherData
                        .get(key);


                const aggregate =
                    calculateKecamatanWeather(
                        weatherList
                    );


                if (!aggregate) {
                    return;
                }


                layer._weatherColor =
                    selected.color;


                layer.setStyle({
                    color: "#ffffff",
                    weight: 2.5,
                    opacity: 1,
                    fillColor:
                        selected.color,
                    fillOpacity: 0.45
                });


                createKecamatanWeatherLabel(
                    layer,
                    namaKecamatan,
                    aggregate
                );
            }
        );
    }


    demoWeatherTimer =
        setTimeout(
            function() {

                resetWeatherAnimation();

            },
            10000
        );


    console.log(
        `Mode demo aktif: ${type}`
    );
}


// ======================================================
// MATIKAN MODE DEMO
// ======================================================

function resetWeatherAnimation() {

    if (demoWeatherTimer) {

        clearTimeout(
            demoWeatherTimer
        );

        demoWeatherTimer =
            null;
    }


    demoWeatherType =
        null;


    updateMapForSelectedTime();


    console.log(
        "Mode demo dimatikan."
    );
}

// ======================================================
// FITUR PENCARIAN KECAMATAN / KELURAHAN (ENTER)
// ======================================================
const searchInput = document.querySelector('.search-bar input');

if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
        
        // Eksekusi pencarian saat tombol "Enter" ditekan pada keyboard
        if (e.key === 'Enter') {
            const query = normalizeName(this.value);
            if (!query) return;

            let foundLayer = null;

            // Cari di layer Kecamatan jika sedang aktif
            if (currentAdminLevel === 'kecamatan' && layerKecamatan) {
                layerKecamatan.eachLayer(layer => {
                    const nama = normalizeName(layer.feature.properties.Kecamatan);
                    if (nama.includes(query)) {
                        foundLayer = layer;
                    }
                });
            } 
            // Atau cari di layer Kelurahan jika sedang aktif
            else if (currentAdminLevel === 'kelurahan' && layerKelurahan) {
                layerKelurahan.eachLayer(layer => {
                    const namaKel = normalizeName(layer.feature.properties.Kelurahan);
                    const namaKec = normalizeName(layer.feature.properties.Kecamatan);
                    
                    // Bisa mencari berdasarkan nama kelurahan atau kecamatannya
                    if (namaKel.includes(query) || namaKec.includes(query)) {
                        foundLayer = layer;
                    }
                });
            }

            if (foundLayer) {
                // Zoom peta secara otomatis ke batas wilayah yang dicari
                map.fitBounds(foundLayer.getBounds());
                
                // Buka pop-up wilayah tersebut setelah animasi zoom selesai (300ms)
                setTimeout(() => {
                    foundLayer.openPopup();
                }, 300);
            } else {

                showAppNotification(
                    `Wilayah "${this.value}" tidak ditemukan pada layer ${currentAdminLevel} yang sedang aktif.`,
                    "warning",
                    4500
                );
            }
        }
    });
}

// ======================================================
// CATATAN ARSIP HISTORIS
// ======================================================
// Penulisan ke Supabase dari browser sengaja dihapus.
// Penyimpanan historis dilakukan oleh backend Vercel agar
// tidak tergantung pada ada/tidaknya pengunjung WebGIS.

