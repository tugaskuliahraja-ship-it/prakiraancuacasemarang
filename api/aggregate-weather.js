export default async function handler(req, res) {

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method tidak diizinkan"
        });
    }

    try {

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_KEY = process.env.SUPABASE_KEY;

        if (!SUPABASE_URL || !SUPABASE_KEY) {
            throw new Error(
                "Environment Variable Supabase belum terbaca"
            );
        }


        // ======================================================
        // 1. CARI ANALYSIS_DATE TERBARU
        // ======================================================

        const latestResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/cache_prakiraan_kelurahan?select=analysis_date&order=analysis_date.desc&limit=1`,
            {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            }
        );

        if (!latestResponse.ok) {

            const errorText =
                await latestResponse.text();

            throw new Error(
                `Gagal membaca analysis_date (${latestResponse.status}): ${errorText}`
            );
        }


        const latestData =
            await latestResponse.json();


        if (
            !Array.isArray(latestData) ||
            latestData.length === 0 ||
            !latestData[0].analysis_date
        ) {
            throw new Error(
                "Analysis date tidak ditemukan di cache"
            );
        }


        const latestAnalysisDate =
            latestData[0].analysis_date;


        // ======================================================
        // 2. AMBIL SEMUA CACHE UNTUK ANALYSIS_DATE TERBARU
        // ======================================================

        const cacheData = [];

        const PAGE_SIZE = 1000;

        let offset = 0;


        while (true) {

            const from = offset;
            const to = offset + PAGE_SIZE - 1;

            const url =
                `${SUPABASE_URL}/rest/v1/cache_prakiraan_kelurahan` +
                `?select=*` +
                `&analysis_date=eq.${encodeURIComponent(latestAnalysisDate)}` +
                `&order=id.asc`;


            const cacheResponse =
                await fetch(
                    url,
                    {
                        headers: {
                            apikey:
                                SUPABASE_KEY,

                            Authorization:
                                `Bearer ${SUPABASE_KEY}`,

                            Range:
                                `${from}-${to}`
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


            const pageData =
                await cacheResponse.json();


            if (!Array.isArray(pageData)) {
                throw new Error(
                    "Format cache tidak valid"
                );
            }


            cacheData.push(
                ...pageData
            );


            if (pageData.length < PAGE_SIZE) {
                break;
            }


            offset += PAGE_SIZE;
        }


        if (cacheData.length === 0) {
            throw new Error(
                "Cache prakiraan kelurahan kosong"
            );
        }


        // ======================================================
        // 3. HELPER
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


            entries.sort(
                (a, b) =>
                    b[1] - a[1]
            );


            return entries[0][0];
        }


        function getForecastSlot(waktu) {

            const date =
                new Date(waktu);


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return null;
            }


            const hour =
                date.getUTCHours();


            // 15 dan 16 -> 15
            // 18 dan 19 -> 18
            // 21 dan 22 -> 21
            // dst.

            const slotHour =
                Math.floor(hour / 3) * 3;


            date.setUTCHours(
                slotHour,
                0,
                0,
                0
            );


            return date.toISOString();
        }


        function average(items, field, decimals = 0) {

            const values =
                items
                    .map(item =>
                        Number(item[field])
                    )
                    .filter(value =>
                        Number.isFinite(value)
                    );


            if (values.length === 0) {
                return null;
            }


            const avg =
                values.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) / values.length;


            const factor =
                Math.pow(
                    10,
                    decimals
                );


            return (
                Math.round(
                    avg * factor
                ) / factor
            );
        }


        function aggregateRows(
            rows,
            kodeWilayah,
            namaWilayah,
            tingkatWilayah,
            analysisDate,
            waktu
        ) {

            const kondisiCounter = {};
            const arahCounter = {};


            rows.forEach(row => {

                if (row.kondisi_cuaca) {

                    kondisiCounter[
                        row.kondisi_cuaca
                    ] =
                        (
                            kondisiCounter[
                                row.kondisi_cuaca
                            ] || 0
                        ) + 1;
                }


                if (row.arah_angin) {

                    arahCounter[
                        row.arah_angin
                    ] =
                        (
                            arahCounter[
                                row.arah_angin
                            ] || 0
                        ) + 1;
                }
            });


            return {

                kode_wilayah:
                    kodeWilayah,

                nama_wilayah:
                    namaWilayah,

                tingkat_wilayah:
                    tingkatWilayah,

                analysis_date:
                    analysisDate,

                waktu:
                    waktu,

                suhu:
                    average(
                        rows,
                        "suhu",
                        0
                    ),

                kelembapan:
                    average(
                        rows,
                        "kelembapan",
                        0
                    ),

                angin:
                    average(
                        rows,
                        "angin",
                        1
                    ),

                arah_angin:
                    dominantValue(
                        arahCounter
                    ),

                tutupan_awan:
                    average(
                        rows,
                        "tutupan_awan",
                        0
                    ),

                curah_hujan:
                    average(
                        rows,
                        "curah_hujan",
                        2
                    ),

                kondisi_cuaca:
                    dominantValue(
                        kondisiCounter
                    )
            };
        }


        // ======================================================
        // 4. NORMALISASI SLOT WAKTU + DEDUPLIKASI ADM4
        // ======================================================

        const groupMap =
            new Map();


        cacheData.forEach(row => {

            const slotWaktu =
                getForecastSlot(
                    row.waktu
                );


            if (!slotWaktu) {
                return;
            }


            const key =
                `${row.analysis_date}|${slotWaktu}`;


            if (!groupMap.has(key)) {

                groupMap.set(
                    key,
                    {
                        analysis_date:
                            row.analysis_date,

                        waktu:
                            slotWaktu,

                        rowsByAdm4:
                            new Map()
                    }
                );
            }


            const group =
                groupMap.get(key);


            const existing =
                group.rowsByAdm4.get(
                    row.adm4
                );


            if (!existing) {

                group.rowsByAdm4.set(
                    row.adm4,
                    row
                );

                return;
            }


            // Untuk kasus Gedawang/Terboyo Wetan:
            // jika ada data jam 15 dan 16 dalam slot sama,
            // prioritaskan timestamp yang lebih akhir
            // agar konsisten dengan mayoritas 122 kelurahan.

            const existingTime =
                new Date(
                    existing.waktu
                ).getTime();

            const newTime =
                new Date(
                    row.waktu
                ).getTime();


            if (newTime > existingTime) {

                group.rowsByAdm4.set(
                    row.adm4,
                    row
                );
            }
        });


        // ======================================================
        // 5. VALIDASI SETIAP SLOT HARUS 177 KELURAHAN
        // ======================================================

        const slotStatus =
            [];


        groupMap.forEach(group => {

            slotStatus.push({

                waktu:
                    group.waktu,

                total_kelurahan:
                    group.rowsByAdm4.size
            });
        });


        slotStatus.sort(
            (a, b) =>
                new Date(a.waktu) -
                new Date(b.waktu)
        );


        const slotTidakLengkap =
            slotStatus.filter(
                item =>
                    item.total_kelurahan !== 177
            );


        if (slotTidakLengkap.length > 0) {

            return res.status(409).json({

                success:
                    false,

                error:
                    "Agregasi dibatalkan karena ada slot yang belum berisi 177 kelurahan.",

                analysis_date:
                    latestAnalysisDate,

                total_cache:
                    cacheData.length,

                total_slot:
                    groupMap.size,

                slot_tidak_lengkap:
                    slotTidakLengkap,

                semua_slot:
                    slotStatus
            });
        }


        // ======================================================
        // 6. AGREGASI KOTA + KECAMATAN
        // ======================================================

        const hasilAgregasi = [];


        groupMap.forEach(group => {

            const rows =
                Array.from(
                    group.rowsByAdm4.values()
                );


            // ------------------------------
            // KOTA SEMARANG
            // ------------------------------

            hasilAgregasi.push(

                aggregateRows(
                    rows,
                    "KOTA_SMG",
                    "Kota Semarang",
                    "KOTA",
                    group.analysis_date,
                    group.waktu
                )
            );


            // ------------------------------
            // KELOMPOKKAN KECAMATAN
            // ------------------------------

            const kecamatanMap =
                new Map();


            rows.forEach(row => {

                const kecamatan =
                    String(
                        row.kecamatan || ""
                    ).trim();


                if (!kecamatan) {
                    return;
                }


                if (
                    !kecamatanMap.has(
                        kecamatan
                    )
                ) {

                    kecamatanMap.set(
                        kecamatan,
                        []
                    );
                }


                kecamatanMap
                    .get(kecamatan)
                    .push(row);
            });


            // Harus ada 16 kecamatan

            if (kecamatanMap.size !== 16) {

                throw new Error(
                    `Jumlah kecamatan pada slot ${group.waktu} bukan 16, tetapi ${kecamatanMap.size}`
                );
            }


            kecamatanMap.forEach(
                (items, namaKecamatan) => {

                    hasilAgregasi.push(

                        aggregateRows(
                            items,

                            "KEC_" +
                            normalizeName(
                                namaKecamatan
                            ),

                            namaKecamatan,

                            "KECAMATAN",

                            group.analysis_date,

                            group.waktu
                        )
                    );
                }
            );
        });


        // ======================================================
        // 7. VALIDASI HASIL AKHIR
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


        if (wilayahUnik.length !== 17) {

            throw new Error(
                `Jumlah wilayah hasil agregasi bukan 17, tetapi ${wilayahUnik.length}`
            );
        }


        const expectedRecords =
            groupMap.size * 17;


        if (
            hasilAgregasi.length !==
            expectedRecords
        ) {

            throw new Error(
                `Jumlah record agregasi tidak sesuai. Diharapkan ${expectedRecords}, didapat ${hasilAgregasi.length}`
            );
        }


        // ======================================================
        // 8. SIMPAN KE RIWAYAT_CUACA
        // ======================================================

        const saveResponse =
            await fetch(
                `${SUPABASE_URL}/rest/v1/riwayat_cuaca?on_conflict=kode_wilayah,analysis_date,waktu`,
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
        // 9. RESPONSE
        // ======================================================

        return res.status(200).json({

            success:
                true,

            message:
                "Agregasi cache → riwayat_cuaca berhasil dan tervalidasi",

            analysis_date:
                latestAnalysisDate,

            total_cache:
                cacheData.length,

            total_waktu:
                groupMap.size,

            total_wilayah:
                wilayahUnik.length,

            total_record_disimpan:
                hasilAgregasi.length,

            wilayah:
                wilayahUnik,

            kelurahan_per_slot:
                slotStatus,

            contoh_data:
                hasilAgregasi.slice(
                    0,
                    5
                )
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
