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
        // AMBIL DATA CACHE DARI SUPABASE
        // ======================================================

        const cacheResponse =
            await fetch(
                `${SUPABASE_URL}/rest/v1/cache_prakiraan_kelurahan?select=*`,
                {
                    headers: {
                        "apikey":
                            SUPABASE_KEY,

                        "Authorization":
                            `Bearer ${SUPABASE_KEY}`
                    }
                }
            );


        if (!cacheResponse.ok) {

            const errorText =
                await cacheResponse.text();

            throw new Error(
                `Gagal membaca cache (${cacheResponse.status}): ${errorText}`
            );
        }


        const cacheData =
            await cacheResponse.json();


        if (!Array.isArray(cacheData) || cacheData.length === 0) {

            throw new Error(
                "Cache prakiraan kelurahan kosong"
            );
        }


        // ======================================================
        // HELPER
        // ======================================================

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
        // KELOMPOKKAN BERDASARKAN ANALYSIS_DATE + WAKTU
        // ======================================================

        const groupMap =
            new Map();


        cacheData.forEach(row => {

            const key =
                `${row.analysis_date}|${row.waktu}`;

            if (!groupMap.has(key)) {

                groupMap.set(
                    key,
                    {
                        analysis_date:
                            row.analysis_date,

                        waktu:
                            row.waktu,

                        rows: []
                    }
                );
            }

            groupMap
                .get(key)
                .rows
                .push(row);
        });


        // ======================================================
        // HASIL AGREGASI
        // ======================================================

        const hasilAgregasi =
            [];


        groupMap.forEach(group => {

            const rows =
                group.rows;


            // ==================================================
            // AGREGASI KOTA
            // ==================================================

            let sumT = 0;
            let sumHu = 0;
            let sumWs = 0;
            let sumTcc = 0;
            let sumTp = 0;

            let countT = 0;
            let countHu = 0;
            let countWs = 0;
            let countTcc = 0;
            let countTp = 0;

            const kondisiCounter = {};
            const arahCounter = {};


            rows.forEach(row => {

                if (row.suhu !== null) {
                    sumT += Number(row.suhu);
                    countT++;
                }

                if (row.kelembapan !== null) {
                    sumHu += Number(row.kelembapan);
                    countHu++;
                }

                if (row.angin !== null) {
                    sumWs += Number(row.angin);
                    countWs++;
                }

                if (row.tutupan_awan !== null) {
                    sumTcc += Number(row.tutupan_awan);
                    countTcc++;
                }

                if (row.curah_hujan !== null) {
                    sumTp += Number(row.curah_hujan);
                    countTp++;
                }

                if (row.kondisi_cuaca) {
                    kondisiCounter[row.kondisi_cuaca] =
                        (kondisiCounter[row.kondisi_cuaca] || 0) + 1;
                }

                if (row.arah_angin) {
                    arahCounter[row.arah_angin] =
                        (arahCounter[row.arah_angin] || 0) + 1;
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
                    group.analysis_date,

                waktu:
                    group.waktu,

                suhu:
                    countT > 0
                        ? Math.round(sumT / countT)
                        : null,

                kelembapan:
                    countHu > 0
                        ? Math.round(sumHu / countHu)
                        : null,

                angin:
                    countWs > 0
                        ? Math.round((sumWs / countWs) * 10) / 10
                        : null,

                arah_angin:
                    dominantValue(
                        arahCounter
                    ),

                tutupan_awan:
                    countTcc > 0
                        ? Math.round(sumTcc / countTcc)
                        : null,

                curah_hujan:
                    countTp > 0
                        ? Math.round((sumTp / countTp) * 100) / 100
                        : null,

                kondisi_cuaca:
                    dominantValue(
                        kondisiCounter
                    )
            });


            // ==================================================
            // AGREGASI KECAMATAN
            // ==================================================

            const kecamatanMap =
                new Map();


            rows.forEach(row => {

                const namaKecamatan =
                    row.kecamatan;

                if (!kecamatanMap.has(namaKecamatan)) {

                    kecamatanMap.set(
                        namaKecamatan,
                        []
                    );
                }

                kecamatanMap
                    .get(namaKecamatan)
                    .push(row);
            });


            kecamatanMap.forEach(
                (items, namaKecamatan) => {

                    let sumT = 0;
                    let sumHu = 0;
                    let sumWs = 0;
                    let sumTcc = 0;
                    let sumTp = 0;

                    let countT = 0;
                    let countHu = 0;
                    let countWs = 0;
                    let countTcc = 0;
                    let countTp = 0;

                    const kondisiCounter = {};
                    const arahCounter = {};


                    items.forEach(row => {

                        if (row.suhu !== null) {
                            sumT += Number(row.suhu);
                            countT++;
                        }

                        if (row.kelembapan !== null) {
                            sumHu += Number(row.kelembapan);
                            countHu++;
                        }

                        if (row.angin !== null) {
                            sumWs += Number(row.angin);
                            countWs++;
                        }

                        if (row.tutupan_awan !== null) {
                            sumTcc += Number(row.tutupan_awan);
                            countTcc++;
                        }

                        if (row.curah_hujan !== null) {
                            sumTp += Number(row.curah_hujan);
                            countTp++;
                        }

                        if (row.kondisi_cuaca) {
                            kondisiCounter[row.kondisi_cuaca] =
                                (kondisiCounter[row.kondisi_cuaca] || 0) + 1;
                        }

                        if (row.arah_angin) {
                            arahCounter[row.arah_angin] =
                                (arahCounter[row.arah_angin] || 0) + 1;
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
                            group.analysis_date,

                        waktu:
                            group.waktu,

                        suhu:
                            countT > 0
                                ? Math.round(sumT / countT)
                                : null,

                        kelembapan:
                            countHu > 0
                                ? Math.round(sumHu / countHu)
                                : null,

                        angin:
                            countWs > 0
                                ? Math.round((sumWs / countWs) * 10) / 10
                                : null,

                        arah_angin:
                            dominantValue(
                                arahCounter
                            ),

                        tutupan_awan:
                            countTcc > 0
                                ? Math.round(sumTcc / countTcc)
                                : null,

                        curah_hujan:
                            countTp > 0
                                ? Math.round((sumTp / countTp) * 100) / 100
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
        // SIMPAN KE RIWAYAT_CUACA
        // ======================================================

        const saveResponse =
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
                            "resolution=merge-duplicates"
                    },

                    body:
                        JSON.stringify(
                            hasilAgregasi
                        )
                }
            );


        if (!saveResponse.ok) {

            const errorText =
                await saveResponse.text();

            throw new Error(
                `Gagal menyimpan agregasi (${saveResponse.status}): ${errorText}`
            );
        }


        // ======================================================
        // RESPONSE
        // ======================================================

        const wilayahUnik =
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
                "Agregasi cache → riwayat_cuaca berhasil",

            total_cache:
                cacheData.length,

            total_waktu:
                groupMap.size,

            total_wilayah:
                wilayahUnik.length,

            wilayah:
                wilayahUnik,

            total_record_disimpan:
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