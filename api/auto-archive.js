// ======================================================
// AUTO ARCHIVE HARIAN PRAKIRAAN CUACA BMKG
// Tujuan:
// - Menyimpan 1 batch prakiraan terbaru setiap hari.
// - Cocok untuk Vercel Hobby: 1 Cron Job per hari.
// - Request BMKG dibuat SEKUENSIAL agar lebih aman dari 429.
// - Jika cache batch yang sama sudah sebagian terisi,
//   hanya adm4 yang belum tersimpan yang diminta ulang.
// - Setelah 177 kelurahan tersedia, panggil aggregate-weather.
// ======================================================

export default async function handler(req, res) {

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method tidak diizinkan"
        });
    }

    const startedAt = Date.now();

    // Sisakan waktu agar function masih sempat menyimpan cache
    // dan memanggil aggregate-weather sebelum batas 300 detik.
    const SAFE_RUNTIME_MS = 270000;

    // Karena request dilakukan satu per satu dan menunggu respons,
    // jeda 1 detik membuat laju praktis tetap di bawah 60 req/menit.
    const REQUEST_GAP_MS = 1000;

    const MAX_ATTEMPTS = 3;

    const CHUNK_SIZE = 500;

    let targetAnalysisDate = null;

    let targetAnalysisDateLocal = null;

    let rowsCacheDisimpan = 0;

    let jumlahRequestBaru = 0;

    let jumlahBerhasilBaru = 0;

    let jumlahGagalBaru = 0;

    let daftarGagal = [];


    try {

        const SUPABASE_URL =
            process.env.SUPABASE_URL;

        const SUPABASE_KEY =
            process.env.SUPABASE_KEY;


        if (!SUPABASE_URL || !SUPABASE_KEY) {

            throw new Error(
                "Environment Variable Supabase belum terbaca"
            );
        }


        // ======================================================
        // HELPER DASAR
        // ======================================================

        function delay(ms) {

            return new Promise(
                resolve =>
                    setTimeout(resolve, ms)
            );
        }


        function remainingRuntime() {

            return SAFE_RUNTIME_MS -
                (Date.now() - startedAt);
        }


        function normalizeAnalysisDate(value) {

            if (!value) {
                return null;
            }

            const text =
                String(value).trim();

            try {

                if (
                    /Z$/.test(text) ||
                    /[+-]\d{2}:\d{2}$/.test(text)
                ) {

                    return new Date(
                        text
                    ).toISOString();
                }

                return new Date(
                    text + "Z"
                ).toISOString();

            } catch {

                return null;
            }
        }


        function getAllForecasts(data) {

            const forecasts = [];

            if (
                !data ||
                !Array.isArray(data.data)
            ) {

                return forecasts;
            }


            data.data.forEach(group => {

                if (
                    !Array.isArray(
                        group.cuaca
                    )
                ) {

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


        function getRowsFromBMKGData(
            data,
            wilayah,
            expectedAnalysisDate = null
        ) {

            const forecasts =
                getAllForecasts(data);

            if (forecasts.length === 0) {

                throw new Error(
                    "Data prakiraan kosong"
                );
            }


            const rows = [];

            const analysisDates =
                new Set();


            forecasts.forEach(weather => {

                const analysisDate =
                    normalizeAnalysisDate(
                        weather.analysis_date
                    );

                const waktu =
                    weather.datetime
                    ||
                    (
                        weather.utc_datetime
                            ? new Date(
                                weather.utc_datetime
                                    .replace(
                                        " ",
                                        "T"
                                    )
                                + "Z"
                            ).toISOString()
                            : null
                    );


                if (
                    !analysisDate ||
                    !waktu
                ) {

                    return;
                }


                analysisDates.add(
                    analysisDate
                );


                // Jika target sudah ditentukan, jangan campur
                // batch analysis_date lain.
                if (
                    expectedAnalysisDate &&
                    analysisDate !==
                        expectedAnalysisDate
                ) {

                    return;
                }


                rows.push({

                    adm4:
                        wilayah.adm4,

                    kelurahan:
                        wilayah.kelurahan,

                    kecamatan:
                        wilayah.kecamatan,

                    analysis_date:
                        analysisDate,

                    waktu:
                        waktu,

                    suhu:
                        weather.t !==
                        undefined
                            ? Number(
                                weather.t
                            )
                            : null,

                    kelembapan:
                        weather.hu !==
                        undefined
                            ? Number(
                                weather.hu
                            )
                            : null,

                    angin:
                        weather.ws !==
                        undefined
                            ? Number(
                                weather.ws
                            )
                            : null,

                    arah_angin:
                        weather.wd || null,

                    tutupan_awan:
                        weather.tcc !==
                        undefined
                            ? Number(
                                weather.tcc
                            )
                            : null,

                    curah_hujan:
                        weather.tp !==
                        undefined
                            ? Number(
                                weather.tp
                            )
                            : null,

                    kondisi_cuaca:
                        weather.weather_desc
                        || null
                });
            });


            return {
                rows,
                analysisDates:
                    Array.from(
                        analysisDates
                    )
            };
        }


        function formatDateWIB(value) {

            if (!value) {
                return null;
            }

            const date =
                new Date(value);

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return null;
            }

            return new Intl
                .DateTimeFormat(
                    "sv-SE",
                    {
                        timeZone:
                            "Asia/Jakarta",

                        year:
                            "numeric",

                        month:
                            "2-digit",

                        day:
                            "2-digit"
                    }
                )
                .format(date);
        }


        // ======================================================
        // SUPABASE REST HELPER
        // ======================================================

        async function supabaseFetch(
            path,
            options = {}
        ) {

            const response =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/${path}`,
                    {
                        ...options,

                        headers: {
                            apikey:
                                SUPABASE_KEY,

                            Authorization:
                                `Bearer ${SUPABASE_KEY}`,

                            ...(options.headers || {})
                        }
                    }
                );


            return response;
        }


        async function saveRowsToCache(rows) {

            if (
                !Array.isArray(rows) ||
                rows.length === 0
            ) {

                return 0;
            }


            let totalSaved = 0;


            for (
                let i = 0;
                i < rows.length;
                i += CHUNK_SIZE
            ) {

                const chunk =
                    rows.slice(
                        i,
                        i + CHUNK_SIZE
                    );


                const response =
                    await supabaseFetch(
                        "cache_prakiraan_kelurahan" +
                        "?on_conflict=adm4,analysis_date,waktu",
                        {
                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                Prefer:
                                    "resolution=merge-duplicates"
                            },

                            body:
                                JSON.stringify(
                                    chunk
                                )
                        }
                    );


                if (!response.ok) {

                    const errorText =
                        await response.text();

                    throw new Error(
                        `Gagal menyimpan cache (${response.status}): ${errorText}`
                    );
                }


                totalSaved +=
                    chunk.length;
            }


            rowsCacheDisimpan +=
                totalSaved;


            return totalSaved;
        }


        async function getExistingAdm4(
            analysisDate
        ) {

            const result =
                new Set();

            const PAGE_SIZE =
                1000;

            let offset =
                0;


            while (true) {

                const from =
                    offset;

                const to =
                    offset +
                    PAGE_SIZE -
                    1;


                const response =
                    await supabaseFetch(
                        "cache_prakiraan_kelurahan" +
                        "?select=adm4" +
                        `&analysis_date=eq.${encodeURIComponent(
                            analysisDate
                        )}` +
                        "&order=id.asc",
                        {
                            headers: {
                                Range:
                                    `${from}-${to}`
                            }
                        }
                    );


                if (!response.ok) {

                    const errorText =
                        await response.text();

                    throw new Error(
                        `Gagal membaca cache existing (${response.status}): ${errorText}`
                    );
                }


                const rows =
                    await response.json();


                rows.forEach(item => {

                    if (item.adm4) {

                        result.add(
                            String(
                                item.adm4
                            ).trim()
                        );
                    }
                });


                if (
                    rows.length <
                    PAGE_SIZE
                ) {

                    break;
                }


                offset +=
                    PAGE_SIZE;
            }


            return result;
        }


        async function isAlreadyArchived(
            analysisDate
        ) {

            const response =
                await supabaseFetch(
                    "riwayat_cuaca" +
                    "?select=id" +
                    `&analysis_date=eq.${encodeURIComponent(
                        analysisDate
                    )}` +
                    "&limit=1"
                );


            if (!response.ok) {

                const errorText =
                    await response.text();

                throw new Error(
                    `Gagal mengecek riwayat (${response.status}): ${errorText}`
                );
            }


            const rows =
                await response.json();


            return (
                Array.isArray(rows) &&
                rows.length > 0
            );
        }


        async function cleanupOldCache() {

            const cutoffDate =
                new Date(
                    Date.now()
                    -
                    (
                        7 *
                        24 *
                        60 *
                        60 *
                        1000
                    )
                ).toISOString();


            await supabaseFetch(
                "cache_prakiraan_kelurahan" +
                `?analysis_date=lt.${encodeURIComponent(
                    cutoffDate
                )}`,
                {
                    method:
                        "DELETE"
                }
            );
        }


        // ======================================================
        // BACA GEOJSON 177 KELURAHAN
        // ======================================================

        const protocol =
            req.headers["x-forwarded-proto"]
            || "https";

        const host =
            req.headers.host;

        const baseUrl =
            `${protocol}://${host}`;


        const geojsonResponse =
            await fetch(
                `${baseUrl}/data/Kelurahan%20Semarang.geojson`
            );


        if (!geojsonResponse.ok) {

            throw new Error(
                `GeoJSON gagal dibaca (${geojsonResponse.status})`
            );
        }


        const geojson =
            await geojsonResponse.json();


        const daftarKelurahan =
            geojson.features
                .map(feature => {

                    const props =
                        feature.properties ||
                        {};


                    return {

                        adm4:
                            String(
                                props.adm4 || ""
                            ).trim(),

                        kelurahan:
                            String(
                                props.Kelurahan ||
                                ""
                            ).trim(),

                        kecamatan:
                            String(
                                props.Kecamatan ||
                                ""
                            ).trim()
                    };
                })
                .filter(
                    item =>
                        item.adm4
                );


        if (
            daftarKelurahan.length !==
            177
        ) {

            throw new Error(
                `Jumlah kelurahan bukan 177, tetapi ${daftarKelurahan.length}`
            );
        }


        // ======================================================
        // FETCH BMKG SEKUENSIAL + RETRY
        // ======================================================

        async function fetchBMKGWilayah(
            wilayah,
            expectedAnalysisDate = null
        ) {

            let lastError =
                null;


            for (
                let attempt = 1;
                attempt <=
                    MAX_ATTEMPTS;
                attempt++
            ) {

                if (
                    remainingRuntime() <
                    15000
                ) {

                    return {
                        success:
                            false,

                        wilayah:
                            wilayah,

                        error:
                            "Waktu eksekusi hampir habis"
                    };
                }


                try {

                    const controller =
                        new AbortController();

                    const timeout =
                        setTimeout(
                            () =>
                                controller.abort(),
                            10000
                        );


                    const bmkgUrl =
                        "https://api.bmkg.go.id" +
                        "/publik/prakiraan-cuaca" +
                        `?adm4=${encodeURIComponent(
                            wilayah.adm4
                        )}`;


                    const response =
                        await fetch(
                            bmkgUrl,
                            {
                                signal:
                                    controller.signal
                            }
                        );


                    clearTimeout(
                        timeout
                    );


                    if (!response.ok) {

                        lastError =
                            `BMKG ${response.status}`;


                        if (
                            response.status ===
                            429
                        ) {

                            const retryAfterHeader =
                                response.headers.get(
                                    "retry-after"
                                );

                            const retryAfterSeconds =
                                Number(
                                    retryAfterHeader
                                );


                            const waitMs =
                                Number.isFinite(
                                    retryAfterSeconds
                                ) &&
                                retryAfterSeconds >
                                0
                                    ? Math.min(
                                        retryAfterSeconds *
                                        1000,
                                        12000
                                    )
                                    : (
                                        4000 *
                                        attempt
                                    );


                            if (
                                attempt <
                                MAX_ATTEMPTS &&
                                remainingRuntime() >
                                    waitMs +
                                    15000
                            ) {

                                await delay(
                                    waitMs
                                );

                                continue;
                            }
                        }


                        throw new Error(
                            lastError
                        );
                    }


                    const data =
                        await response.json();


                    const parsed =
                        getRowsFromBMKGData(
                            data,
                            wilayah,
                            expectedAnalysisDate
                        );


                    if (
                        parsed.rows.length ===
                        0
                    ) {

                        const dateText =
                            parsed
                                .analysisDates
                                .join(", ");


                        throw new Error(
                            expectedAnalysisDate
                                ? `analysis_date tidak sesuai target. Ditemukan: ${dateText || "-"}`
                                : "Data prakiraan kosong"
                        );
                    }


                    return {
                        success:
                            true,

                        wilayah:
                            wilayah,

                        rows:
                            parsed.rows,

                        analysisDates:
                            parsed
                                .analysisDates
                    };


                } catch (error) {

                    lastError =
                        error.name ===
                        "AbortError"
                            ? "Timeout request BMKG"
                            : error.message;


                    if (
                        attempt <
                        MAX_ATTEMPTS
                    ) {

                        const waitMs =
                            1500 *
                            attempt;


                        if (
                            remainingRuntime() >
                            waitMs +
                            15000
                        ) {

                            await delay(
                                waitMs
                            );

                            continue;
                        }
                    }
                }
            }


            return {
                success:
                    false,

                wilayah:
                    wilayah,

                error:
                    lastError ||
                    "Request gagal"
            };
        }


        // ======================================================
        // 1. PROBE SATU KELURAHAN UNTUK MENENTUKAN
        //    ANALYSIS_DATE BMKG TERBARU
        // ======================================================

        const probeWilayah =
            daftarKelurahan[0];


        const probeResult =
            await fetchBMKGWilayah(
                probeWilayah
            );


        if (!probeResult.success) {

            return res
                .status(503)
                .json({
                    success:
                        false,

                    message:
                        "Gagal menentukan pembaruan BMKG terbaru.",

                    error:
                        probeResult.error,

                    adm4:
                        probeWilayah.adm4
                });
        }


        const probeDates =
            [
                ...new Set(
                    probeResult
                        .rows
                        .map(
                            row =>
                                row.analysis_date
                        )
                )
            ];


        if (
            probeDates.length !==
            1
        ) {

            return res
                .status(409)
                .json({
                    success:
                        false,

                    message:
                        "Probe BMKG mengandung lebih dari satu analysis_date.",

                    analysis_dates:
                        probeDates
                });
        }


        targetAnalysisDate =
            probeDates[0];


        targetAnalysisDateLocal =
            formatDateWIB(
                targetAnalysisDate
            );


        // ======================================================
        // 2. JIKA BATCH INI SUDAH ADA DI RIWAYAT,
        //    TIDAK PERLU MENGAMBIL 177 REQUEST LAGI.
        // ======================================================

        if (
            await isAlreadyArchived(
                targetAnalysisDate
            )
        ) {

            await cleanupOldCache();


            return res
                .status(200)
                .json({
                    success:
                        true,

                    already_archived:
                        true,

                    message:
                        "Batch BMKG terbaru sudah tersimpan di riwayat. Tidak ada request massal yang dijalankan.",

                    analysis_date:
                        targetAnalysisDate,

                    tanggal_wib:
                        targetAnalysisDateLocal
                });
        }


        // ======================================================
        // 3. BACA CACHE BATCH YANG SAMA.
        //
        // Jika invocation sebelumnya hanya sempat menyimpan
        // sebagian kelurahan, request berikutnya hanya mengambil
        // adm4 yang belum ada.
        // ======================================================

        const existingAdm4 =
            await getExistingAdm4(
                targetAnalysisDate
            );


        // Simpan hasil probe bila belum ada.
        if (
            !existingAdm4.has(
                probeWilayah.adm4
            )
        ) {

            await saveRowsToCache(
                probeResult.rows
            );

            existingAdm4.add(
                probeWilayah.adm4
            );
        }


        const missingWilayah =
            daftarKelurahan.filter(
                wilayah =>
                    !existingAdm4.has(
                        wilayah.adm4
                    )
            );


        // ======================================================
        // 4. AMBIL HANYA ADM4 YANG BELUM ADA
        // ======================================================

        const pendingRows =
            [];


        for (
            let i = 0;
            i <
            missingWilayah.length;
            i++
        ) {

            if (
                remainingRuntime() <
                18000
            ) {

                break;
            }


            const wilayah =
                missingWilayah[i];


            jumlahRequestBaru++;


            const result =
                await fetchBMKGWilayah(
                    wilayah,
                    targetAnalysisDate
                );


            if (result.success) {

                jumlahBerhasilBaru++;


                pendingRows.push(
                    ...result.rows
                );


                existingAdm4.add(
                    wilayah.adm4
                );


                // Simpan progres berkala agar tidak hilang
                // walaupun function mendekati timeout.
                if (
                    pendingRows.length >=
                    400
                ) {

                    await saveRowsToCache(
                        pendingRows.splice(
                            0,
                            pendingRows.length
                        )
                    );
                }


            } else {

                jumlahGagalBaru++;


                daftarGagal.push({

                    adm4:
                        wilayah.adm4,

                    kelurahan:
                        wilayah.kelurahan,

                    error:
                        result.error
                });
            }


            if (
                i <
                missingWilayah.length -
                    1 &&
                remainingRuntime() >
                    REQUEST_GAP_MS +
                    15000
            ) {

                await delay(
                    REQUEST_GAP_MS
                );
            }
        }


        if (
            pendingRows.length > 0
        ) {

            await saveRowsToCache(
                pendingRows
            );
        }


        // ======================================================
        // 5. CEK ULANG BERAPA ADM4 YANG SUDAH TERSIMPAN
        // ======================================================

        const finalAdm4 =
            await getExistingAdm4(
                targetAnalysisDate
            );


        if (
            finalAdm4.size !== 177
        ) {

            const missingFinal =
                daftarKelurahan
                    .filter(
                        wilayah =>
                            !finalAdm4.has(
                                wilayah.adm4
                            )
                    )
                    .map(
                        wilayah => ({
                            adm4:
                                wilayah.adm4,

                            kelurahan:
                                wilayah.kelurahan
                        })
                    );


            // Cache yang berhasil TETAP disimpan.
            // Invocation manual berikutnya akan melanjutkan
            // hanya wilayah yang masih kurang.
            return res
                .status(202)
                .json({
                    success:
                        false,

                    partial:
                        true,

                    message:
                        "Cache batch terbaru belum lengkap. Progres sudah disimpan dan dapat dilanjutkan tanpa mengulang adm4 yang sudah berhasil.",

                    analysis_date:
                        targetAnalysisDate,

                    tanggal_wib:
                        targetAnalysisDateLocal,

                    total_kelurahan:
                        177,

                    cache_adm4_tersimpan:
                        finalAdm4.size,

                    adm4_belum_tersimpan:
                        missingFinal.length,

                    request_baru:
                        jumlahRequestBaru,

                    request_baru_berhasil:
                        jumlahBerhasilBaru,

                    request_baru_gagal:
                        jumlahGagalBaru,

                    rows_cache_disimpan:
                        rowsCacheDisimpan,

                    contoh_error:
                        daftarGagal.slice(
                            0,
                            10
                        ),

                    contoh_adm4_belum:
                        missingFinal.slice(
                            0,
                            10
                        )
                });
        }


        // ======================================================
        // 6. 177 KELURAHAN SUDAH ADA -> AGREGASI
        // ======================================================

        const aggregateResponse =
            await fetch(
                `${baseUrl}/api/aggregate-weather`
            );


        const aggregateText =
            await aggregateResponse.text();


        let aggregateData;


        try {

            aggregateData =
                JSON.parse(
                    aggregateText
                );

        } catch {

            aggregateData = {
                raw:
                    aggregateText
            };
        }


        if (!aggregateResponse.ok) {

            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Cache 177 kelurahan sudah lengkap, tetapi agregasi gagal.",

                    analysis_date:
                        targetAnalysisDate,

                    cache_adm4_tersimpan:
                        finalAdm4.size,

                    aggregate:
                        aggregateData
                });
        }


        // ======================================================
        // 7. BERSIHKAN CACHE LAMA
        // ======================================================

        await cleanupOldCache();


        // ======================================================
        // 8. BERHASIL
        // ======================================================

        return res
            .status(200)
            .json({
                success:
                    true,

                message:
                    "Arsip prakiraan harian otomatis berhasil.",

                analysis_date:
                    targetAnalysisDate,

                tanggal_wib:
                    targetAnalysisDateLocal,

                total_kelurahan:
                    daftarKelurahan.length,

                cache_adm4_tersimpan:
                    finalAdm4.size,

                request_baru:
                    jumlahRequestBaru,

                request_baru_berhasil:
                    jumlahBerhasilBaru,

                request_baru_gagal:
                    jumlahGagalBaru,

                rows_cache_disimpan:
                    rowsCacheDisimpan,

                agregasi:
                    aggregateData
            });


    } catch (error) {

        return res
            .status(500)
            .json({
                success:
                    false,

                error:
                    error.message,

                analysis_date:
                    targetAnalysisDate,

                tanggal_wib:
                    targetAnalysisDateLocal,

                elapsed_ms:
                    Date.now() -
                    startedAt
            });
    }
}
