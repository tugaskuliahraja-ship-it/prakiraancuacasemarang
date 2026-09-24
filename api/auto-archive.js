export default async function handler(req, res) {

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method tidak diizinkan"
        });
    }


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
        // HELPER
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

                    if (
                        !Array.isArray(day)
                    ) {
                        return;
                    }


                    day.forEach(item => {

                        forecasts.push(
                            item
                        );
                    });
                });
            });


            return forecasts;
        }


        function normalizeAnalysisDate(value) {

            if (!value) {
                return null;
            }


            const text =
                String(value).trim();


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
                        feature.properties || {};


                    return {

                        adm4:
                            String(
                                props.adm4 || ""
                            ).trim(),

                        kelurahan:
                            String(
                                props.Kelurahan || ""
                            ).trim(),

                        kecamatan:
                            String(
                                props.Kecamatan || ""
                            ).trim()
                    };
                })
                .filter(
                    item =>
                        item.adm4
                );


        if (
            daftarKelurahan.length !== 177
        ) {

            throw new Error(
                `Jumlah kelurahan bukan 177, tetapi ${daftarKelurahan.length}`
            );
        }


        // ======================================================
        // AMBIL DATA BMKG
        //
        // Request dimulai satu per satu setiap 1.2 detik.
        // Bukan 177 sekaligus.
        // ======================================================

        const tasks = [];


        for (
            let i = 0;
            i < daftarKelurahan.length;
            i++
        ) {

            const wilayah =
                daftarKelurahan[i];


            const task =
                (async () => {

                    let lastError =
                        null;


                    // Maksimal 2 percobaan
                    for (
                        let attempt = 1;
                        attempt <= 2;
                        attempt++
                    ) {

                        try {

                            const bmkgUrl =
                                `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(
                                    wilayah.adm4
                                )}`;


                            const response =
                                await fetch(
                                    bmkgUrl
                                );


                            if (!response.ok) {

                                lastError =
                                    `BMKG ${response.status}`;


                                // Kalau 429, tunggu dulu
                                // sebelum retry satu kali

                                if (
                                    response.status === 429 &&
                                    attempt === 1
                                ) {

                                    await delay(
                                        15000
                                    );

                                    continue;
                                }


                                throw new Error(
                                    lastError
                                );
                            }


                            const data =
                                await response.json();


                            const forecasts =
                                getAllForecasts(
                                    data
                                );


                            if (
                                forecasts.length === 0
                            ) {

                                throw new Error(
                                    "Data prakiraan kosong"
                                );
                            }


                            const rows =
                                [];


                            forecasts.forEach(
                                weather => {

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
                                            weather.t !== undefined
                                                ? Number(
                                                    weather.t
                                                )
                                                : null,

                                        kelembapan:
                                            weather.hu !== undefined
                                                ? Number(
                                                    weather.hu
                                                )
                                                : null,

                                        angin:
                                            weather.ws !== undefined
                                                ? Number(
                                                    weather.ws
                                                )
                                                : null,

                                        arah_angin:
                                            weather.wd || null,

                                        tutupan_awan:
                                            weather.tcc !== undefined
                                                ? Number(
                                                    weather.tcc
                                                )
                                                : null,

                                        curah_hujan:
                                            weather.tp !== undefined
                                                ? Number(
                                                    weather.tp
                                                )
                                                : null,

                                        kondisi_cuaca:
                                            weather.weather_desc
                                            || null
                                    });
                                }
                            );


                            return {

                                success:
                                    true,

                                wilayah:
                                    wilayah,

                                rows:
                                    rows
                            };


                        } catch (error) {

                            lastError =
                                error.message;


                            if (attempt === 1) {

                                await delay(
                                    5000
                                );
                            }
                        }
                    }


                    return {

                        success:
                            false,

                        wilayah:
                            wilayah,

                        error:
                            lastError
                            || "Request gagal",

                        rows:
                            []
                    };

                })();


            tasks.push(
                task
            );


            // ==================================================
            // JEDA ANTAR MULAI REQUEST
            // ==================================================

            if (
                i <
                daftarKelurahan.length - 1
            ) {

                await delay(
                    1200
                );
            }
        }


        // ======================================================
        // TUNGGU SELURUH REQUEST SELESAI
        // ======================================================

        const results =
            await Promise.all(
                tasks
            );


        const berhasil =
            results.filter(
                item =>
                    item.success
            );


        const gagal =
            results.filter(
                item =>
                    !item.success
            );


        // ======================================================
        // KUMPULKAN DATA RAW
        // ======================================================

        const rowsToSave =
            berhasil.flatMap(
                item =>
                    item.rows
            );


        // ======================================================
        // SIMPAN HASIL YANG BERHASIL KE CACHE
        // ======================================================

        const CHUNK_SIZE =
            500;


        for (
            let i = 0;
            i < rowsToSave.length;
            i += CHUNK_SIZE
        ) {

            const chunk =
                rowsToSave.slice(
                    i,
                    i + CHUNK_SIZE
                );


            const saveResponse =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/cache_prakiraan_kelurahan?on_conflict=adm4,analysis_date,waktu`,
                    {
                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            apikey:
                                SUPABASE_KEY,

                            Authorization:
                                `Bearer ${SUPABASE_KEY}`,

                            Prefer:
                                "resolution=merge-duplicates"
                        },

                        body:
                            JSON.stringify(
                                chunk
                            )
                    }
                );


            if (!saveResponse.ok) {

                const errorText =
                    await saveResponse.text();


                throw new Error(
                    `Gagal menyimpan cache (${saveResponse.status}): ${errorText}`
                );
            }
        }


        // ======================================================
        // JANGAN AGREGASI KALAU TIDAK 177 KELURAHAN
        // ======================================================

        if (
            berhasil.length !== 177
        ) {

            return res.status(409).json({

                success:
                    false,

                message:
                    "Cache sebagian berhasil disimpan, tetapi agregasi dibatalkan karena belum 177 kelurahan.",

                total_kelurahan:
                    177,

                request_berhasil:
                    berhasil.length,

                request_gagal:
                    gagal.length,

                rows_cache_disimpan:
                    rowsToSave.length,

                contoh_error:
                    gagal
                        .slice(
                            0,
                            10
                        )
                        .map(
                            item => ({
                                adm4:
                                    item.wilayah.adm4,

                                kelurahan:
                                    item.wilayah.kelurahan,

                                error:
                                    item.error
                            })
                        )
            });
        }


        // ======================================================
        // PASTIKAN ANALYSIS_DATE KONSISTEN
        // ======================================================

        const analysisDates =
            [
                ...new Set(
                    rowsToSave.map(
                        row =>
                            row.analysis_date
                    )
                )
            ];


        if (
            analysisDates.length !== 1
        ) {

            return res.status(409).json({

                success:
                    false,

                message:
                    "Semua kelurahan berhasil diambil, tetapi ditemukan lebih dari satu analysis_date. Agregasi dibatalkan agar versi prakiraan tidak tercampur.",

                analysis_dates:
                    analysisDates,

                request_berhasil:
                    berhasil.length,

                rows_cache_disimpan:
                    rowsToSave.length
            });
        }


        // ======================================================
        // PANGGIL ENDPOINT AGREGASI
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

            return res.status(500).json({

                success:
                    false,

                message:
                    "Pengambilan BMKG dan cache berhasil, tetapi agregasi gagal.",

                request_berhasil:
                    berhasil.length,

                rows_cache_disimpan:
                    rowsToSave.length,

                aggregate:
                    aggregateData
            });
        }


        // ======================================================
        // BERSIHKAN CACHE LAMA > 7 HARI
        // ======================================================

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


        await fetch(
            `${SUPABASE_URL}/rest/v1/cache_prakiraan_kelurahan?analysis_date=lt.${encodeURIComponent(
                cutoffDate
            )}`,
            {
                method:
                    "DELETE",

                headers: {

                    apikey:
                        SUPABASE_KEY,

                    Authorization:
                        `Bearer ${SUPABASE_KEY}`
                }
            }
        );


        // ======================================================
        // BERHASIL
        // ======================================================

        return res.status(200).json({

            success:
                true,

            message:
                "Arsip cuaca otomatis berhasil",

            analysis_date:
                analysisDates[0],

            total_kelurahan:
                daftarKelurahan.length,

            request_berhasil:
                berhasil.length,

            request_gagal:
                gagal.length,

            rows_cache_disimpan:
                rowsToSave.length,

            agregasi:
                aggregateData
        });


    } catch (error) {

        return res.status(500).json({

            success:
                false,

            error:
                error.message
        });
    }
}