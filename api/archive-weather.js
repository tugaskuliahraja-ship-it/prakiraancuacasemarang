export default async function handler(req, res) {

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method tidak diizinkan"
        });
    }

    try {

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


        // ======================================================
        // HELPER
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


        function normalizeName(text) {

            return String(text || "")
                .trim()
                .toUpperCase()
                .replace(/\s+/g, "_");
        }


        function dominantValue(counter) {

            const entries =
                Object.entries(counter);

            if (entries.length === 0) {
                return null;
            }

            return entries
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                )[0][0];
        }


        // ======================================================
        // TEMPAT MENAMPUNG DATA
        // ======================================================

        const dataPerWaktu =
            new Map();

        let totalBerhasil =
            0;

        let totalGagal =
            0;
const daftarError = [];

        // ======================================================
        // AMBIL BMKG UNTUK SEMUA KELURAHAN
        // ======================================================

        for (const item of daftarKelurahan) {

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


                    const key =
                        `${weather.analysis_date}|${weather.datetime}`;


                    if (!dataPerWaktu.has(key)) {

                        dataPerWaktu.set(
                            key,
                            {
                                analysis_date:
                                    weather.analysis_date,

                                waktu:
                                    weather.datetime,

                                kelurahan: []
                            }
                        );
                    }


                    dataPerWaktu
                        .get(key)
                        .kelurahan
                        .push({
                            kecamatan:
                                item.kecamatan,

                            kelurahan:
                                item.kelurahan,

                            t:
                                Number(weather.t),

                            hu:
                                Number(weather.hu),

                            ws:
                                Number(weather.ws),

                            wd:
                                weather.wd || null,

                            tcc:
                                weather.tcc !== undefined
                                    ? Number(weather.tcc)
                                    : null,

                            tp:
                                weather.tp !== undefined
                                    ? Number(weather.tp)
                                    : null,

                            kondisi:
                                weather.weather_desc || null
                        });
                });


                totalBerhasil++;

            }
catch (error) {

    totalGagal++;

    if (daftarError.length < 10) {

        daftarError.push({
            kelurahan: item.kelurahan,
            adm4: item.adm4,
            error: error.message
        });
    }

    console.warn(
        "Gagal:",
        item.kelurahan,
        error.message
    );
}
        }


        // ======================================================
        // AGREGASI
        // ======================================================

        const hasilAgregasi =
            [];


        dataPerWaktu.forEach(group => {

            const daftar =
                group.kelurahan;


            // ==================================================
            // KOTA SEMARANG
            // ==================================================

            if (daftar.length > 0) {

                let sumT = 0;
                let sumHu = 0;
                let sumWs = 0;
                let sumTcc = 0;
                let sumTp = 0;

                let countTcc = 0;
                let countTp = 0;

                const kondisiCounter = {};
                const arahCounter = {};


                daftar.forEach(item => {

                    sumT += item.t;
                    sumHu += item.hu;
                    sumWs += item.ws;

                    if (item.tcc !== null) {
                        sumTcc += item.tcc;
                        countTcc++;
                    }

                    if (item.tp !== null) {
                        sumTp += item.tp;
                        countTp++;
                    }

                    if (item.kondisi) {
                        kondisiCounter[item.kondisi] =
                            (kondisiCounter[item.kondisi] || 0) + 1;
                    }

                    if (item.wd) {
                        arahCounter[item.wd] =
                            (arahCounter[item.wd] || 0) + 1;
                    }
                });


                hasilAgregasi.push({

                    kode_wilayah:
                        "KOTA_SMG",

                    nama_wilayah:
                        "Kota Semarang",

                    tingkat_wilayah:
                        "KOTA",

                    analysis_date:
                        group.analysis_date + "Z",

                    waktu:
                        group.waktu,

                    suhu:
                        Math.round(
                            sumT / daftar.length
                        ),

                    kelembapan:
                        Math.round(
                            sumHu / daftar.length
                        ),

                    angin:
                        Math.round(
                            (sumWs / daftar.length) * 10
                        ) / 10,

                    arah_angin:
                        dominantValue(
                            arahCounter
                        ),

                    tutupan_awan:
                        countTcc > 0
                            ? Math.round(
                                sumTcc / countTcc
                            )
                            : null,

                    curah_hujan:
                        countTp > 0
                            ? Math.round(
                                (sumTp / countTp) * 100
                            ) / 100
                            : null,

                    kondisi_cuaca:
                        dominantValue(
                            kondisiCounter
                        )
                });
            }


            // ==================================================
            // KELOMPOKKAN PER KECAMATAN
            // ==================================================

            const kecamatanMap =
                new Map();


            daftar.forEach(item => {

                const key =
                    item.kecamatan;

                if (!kecamatanMap.has(key)) {
                    kecamatanMap.set(
                        key,
                        []
                    );
                }

                kecamatanMap
                    .get(key)
                    .push(item);
            });


            kecamatanMap.forEach(
                (items, namaKecamatan) => {

                    let sumT = 0;
                    let sumHu = 0;
                    let sumWs = 0;
                    let sumTcc = 0;
                    let sumTp = 0;

                    let countTcc = 0;
                    let countTp = 0;

                    const kondisiCounter = {};
                    const arahCounter = {};


                    items.forEach(item => {

                        sumT += item.t;
                        sumHu += item.hu;
                        sumWs += item.ws;

                        if (item.tcc !== null) {
                            sumTcc += item.tcc;
                            countTcc++;
                        }

                        if (item.tp !== null) {
                            sumTp += item.tp;
                            countTp++;
                        }

                        if (item.kondisi) {
                            kondisiCounter[item.kondisi] =
                                (kondisiCounter[item.kondisi] || 0) + 1;
                        }

                        if (item.wd) {
                            arahCounter[item.wd] =
                                (arahCounter[item.wd] || 0) + 1;
                        }
                    });


                    hasilAgregasi.push({

                        kode_wilayah:
                            "KEC_" +
                            normalizeName(
                                namaKecamatan
                            ),

                        nama_wilayah:
                            namaKecamatan,

                        tingkat_wilayah:
                            "KECAMATAN",

                        analysis_date:
                            group.analysis_date + "Z",

                        waktu:
                            group.waktu,

                        suhu:
                            Math.round(
                                sumT / items.length
                            ),

                        kelembapan:
                            Math.round(
                                sumHu / items.length
                            ),

                        angin:
                            Math.round(
                                (sumWs / items.length) * 10
                            ) / 10,

                        arah_angin:
                            dominantValue(
                                arahCounter
                            ),

                        tutupan_awan:
                            countTcc > 0
                                ? Math.round(
                                    sumTcc / countTcc
                                )
                                : null,

                        curah_hujan:
                            countTp > 0
                                ? Math.round(
                                    (sumTp / countTp) * 100
                                ) / 100
                                : null,

                        kondisi_cuaca:
                            dominantValue(
                                kondisiCounter
                            )
                    });
                }
            );
        });


        // ======================================================
        // HASIL TEST
        // ======================================================

        const kodeWilayahUnik =
            [
                ...new Set(
                    hasilAgregasi.map(
                        item =>
                            item.kode_wilayah
                    )
                )
            ];


        return res.status(200).json({

            success: true,

            message:
                "Agregasi BMKG berhasil",

            total_kelurahan:
                daftarKelurahan.length,

            request_berhasil:
                totalBerhasil,

            request_gagal:
                totalGagal,
            
            contoh_error:
                daftarError,

            total_waktu:
                dataPerWaktu.size,

            total_wilayah:
                kodeWilayahUnik.length,

            wilayah:
                kodeWilayahUnik,

            total_record_hasil:
                hasilAgregasi.length,

            contoh_data:
                hasilAgregasi.slice(0, 10)

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
