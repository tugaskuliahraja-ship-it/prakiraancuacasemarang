export default async function handler(req, res) {

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method tidak diizinkan"
        });
    }

    try {

        // ======================================================
        // ENVIRONMENT VARIABLE SUPABASE
        // ======================================================

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
        // ALAMAT WEBSITE VERCEL
        // ======================================================

        const protocol =
            req.headers["x-forwarded-proto"] || "https";

        const host =
            req.headers.host;

        const baseUrl =
            `${protocol}://${host}`;


        // ======================================================
        // BACA GEOJSON KELURAHAN
        // ======================================================

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


        if (daftarKelurahan.length === 0) {
            throw new Error(
                "Tidak ada kelurahan dengan adm4"
            );
        }


        // ======================================================
        // TEST 1 KELURAHAN
        // ======================================================

        const sampleKelurahan =
            daftarKelurahan[0];


        const bmkgUrl =
            `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(
                sampleKelurahan.adm4
            )}`;


        const bmkgResponse =
            await fetch(bmkgUrl);


        if (!bmkgResponse.ok) {
            throw new Error(
                `BMKG gagal diakses (${bmkgResponse.status})`
            );
        }


        const bmkgData =
            await bmkgResponse.json();


        // ======================================================
        // AMBIL SEMUA PRAKIRAAN
        // ======================================================

        const forecasts = [];


        if (Array.isArray(bmkgData.data)) {

            bmkgData.data.forEach(group => {

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

        }


        if (forecasts.length === 0) {
            throw new Error(
                "Data prakiraan BMKG kosong"
            );
        }


        // ======================================================
        // AMBIL 1 PRAKIRAAN SEBAGAI TEST
        // ======================================================

        const weather =
            forecasts[0];


        // analysis_date BMKG tidak memiliki timezone pada string,
        // sehingga kita perlakukan sebagai UTC sesuai struktur data BMKG.
        const analysisDate =
            weather.analysis_date
                ? weather.analysis_date + "Z"
                : null;


        const forecastTime =
            weather.datetime ||
            weather.utc_datetime;


        if (!analysisDate || !forecastTime) {
            throw new Error(
                "analysis_date atau waktu prakiraan tidak tersedia"
            );
        }


        // ======================================================
        // PAYLOAD TEST
        // ======================================================

        const payload = {

            kode_wilayah:
                "TEST_BANYUMANIK",

            nama_wilayah:
                sampleKelurahan.kelurahan,

            tingkat_wilayah:
                "TEST",

            analysis_date:
                analysisDate,

            waktu:
                forecastTime,

            suhu:
                Number(weather.t),

            kelembapan:
                Number(weather.hu),

            angin:
                Number(weather.ws),

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
        };


        // ======================================================
        // SIMPAN KE SUPABASE
        // ======================================================

        const supabaseResponse =
            await fetch(
                `${SUPABASE_URL}/rest/v1/riwayat_cuaca?on_conflict=kode_wilayah,analysis_date,waktu`,
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
                            "resolution=merge-duplicates,return=representation"
                    },

                    body:
                        JSON.stringify(payload)
                }
            );


        const responseText =
            await supabaseResponse.text();


        if (!supabaseResponse.ok) {

            throw new Error(
                `Supabase ${supabaseResponse.status}: ${responseText}`
            );
        }


        let savedData = [];

        if (responseText) {
            savedData =
                JSON.parse(responseText);
        }


        // ======================================================
        // HASIL
        // ======================================================

        return res.status(200).json({

            success: true,

            message:
                "Test BMKG → Supabase berhasil",

            sumber: {
                kelurahan:
                    sampleKelurahan.kelurahan,

                kecamatan:
                    sampleKelurahan.kecamatan,

                adm4:
                    sampleKelurahan.adm4
            },

            payload:
                payload,

            data_supabase:
                savedData
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
