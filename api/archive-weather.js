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
        // PARAMETER BATCH
        // ======================================================

        const BATCH_SIZE = 40;

        const batch =
            Math.max(
                1,
                parseInt(req.query.batch || "1", 10)
            );

        const startIndex =
            (batch - 1) * BATCH_SIZE;

        const endIndex =
            startIndex + BATCH_SIZE;


        // ======================================================
        // BACA GEOJSON
        // ======================================================

        const protocol =
            req.headers["x-forwarded-proto"] || "https";

        const host =
            req.headers.host;

        const baseUrl =
            `${protocol}://${host}`;

        const geojsonUrl =
            `${baseUrl}/data/Kelurahan%20Semarang.geojson`;

        const geojsonResponse =
            await fetch(geojsonUrl);

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
                        kecamatan:
                            props.Kecamatan || "",

                        kelurahan:
                            props.Kelurahan || "",

                        adm4:
                            String(
                                props.adm4 || ""
                            ).trim()
                    };
                })
                .filter(item => item.adm4);


        // ======================================================
        // PILIH DATA SESUAI BATCH
        // ======================================================

        const batchKelurahan =
            daftarKelurahan.slice(
                startIndex,
                endIndex
            );


        if (batchKelurahan.length === 0) {

            return res.status(400).json({
                success: false,
                error: "Batch tidak memiliki data"
            });
        }


        // ======================================================
        // HELPER AMBIL PRAKIRAAN
        // ======================================================

        function getAllForecasts(data) {

            const forecasts = [];

            if (!data || !Array.isArray(data.data)) {
                return forecasts;
            }

            data.data.forEach(group => {

                if (!Array.isArray(group.cuaca)) {
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
        // HASIL
        // ======================================================

        const rowsToSave = [];

        const daftarError = [];

        let requestBerhasil = 0;
        let requestGagal = 0;


        // ======================================================
        // PROSES SATU-SATU
        // ======================================================

        for (const item of batchKelurahan) {

            try {

                const bmkgUrl =
                    `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(
                        item.adm4
                    )}`;

                const response =
                    await fetch(bmkgUrl);

                if (!response.ok) {

                    throw new Error(
                        `BMKG ${response.status}`
                    );
                }

                const data =
                    await response.json();

                const forecasts =
                    getAllForecasts(data);


                forecasts.forEach(weather => {

                    if (
                        !weather.analysis_date ||
                        !weather.datetime
                    ) {
                        return;
                    }


                    rowsToSave.push({

                        adm4:
                            item.adm4,

                        kelurahan:
                            item.kelurahan,

                        kecamatan:
                            item.kecamatan,

                        analysis_date:
                            weather.analysis_date + "Z",

                        waktu:
                            weather.datetime,

                        suhu:
                            weather.t !== undefined
                                ? Number(weather.t)
                                : null,

                        kelembapan:
                            weather.hu !== undefined
                                ? Number(weather.hu)
                                : null,

                        angin:
                            weather.ws !== undefined
                                ? Number(weather.ws)
                                : null,

                        arah_angin:
                            weather.wd || null,

                        tutupan_awan:
                            weather.tcc !== undefined
                                ? Number(weather.tcc)
                                : null,

                        curah_hujan:
                            weather.tp !== undefined
                                ? Number(weather.tp)
                                : null,

                        kondisi_cuaca:
                            weather.weather_desc || null
                    });
                });


                requestBerhasil++;

            }

            catch (error) {

                requestGagal++;

                if (daftarError.length < 10) {

                    daftarError.push({
                        kelurahan:
                            item.kelurahan,

                        adm4:
                            item.adm4,

                        error:
                            error.message
                    });
                }
            }
        }


        // ======================================================
        // SIMPAN MASSAL KE SUPABASE
        // ======================================================

        let savedRows = 0;


        if (rowsToSave.length > 0) {

            const supabaseResponse =
                await fetch(
                    `${SUPABASE_URL}/rest/v1/cache_prakiraan_kelurahan?on_conflict=adm4,analysis_date,waktu`,
                    {
                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "apikey":
                                SUPABASE_KEY,

                            "Authorization":
                                `Bearer ${SUPABASE_KEY}`,

                            "Prefer":
                                "resolution=merge-duplicates"
                        },

                        body:
                            JSON.stringify(
                                rowsToSave
                            )
                    }
                );


            if (!supabaseResponse.ok) {

                const errorText =
                    await supabaseResponse.text();

                throw new Error(
                    `Supabase ${supabaseResponse.status}: ${errorText}`
                );
            }


            savedRows =
                rowsToSave.length;
        }


        // ======================================================
        // RESPONSE
        // ======================================================

        return res.status(200).json({

            success: true,

            message:
                "Batch BMKG berhasil diproses",

            batch:
                batch,

            batch_size:
                BATCH_SIZE,

            index_awal:
                startIndex,

            index_akhir:
                Math.min(
                    endIndex,
                    daftarKelurahan.length
                ),

            total_kelurahan:
                daftarKelurahan.length,

            kelurahan_batch:
                batchKelurahan.length,

            request_berhasil:
                requestBerhasil,

            request_gagal:
                requestGagal,

            rows_disimpan:
                savedRows,

            contoh_error:
                daftarError
        });

    }

    catch (error) {

        return res.status(500).json({

            success: false,

            error:
                error.message
        });
    }
}
