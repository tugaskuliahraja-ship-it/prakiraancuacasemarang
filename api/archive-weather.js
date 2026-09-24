export default async function handler(req, res) {

    // ======================================================
    // HANYA IZINKAN GET
    // ======================================================

    if (req.method !== "GET") {

        return res.status(405).json({
            success: false,
            error: "Method tidak diizinkan"
        });
    }


    try {

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


        if (!Array.isArray(geojson.features)) {

            throw new Error(
                "Format GeoJSON tidak valid"
            );
        }


        // ======================================================
        // AMBIL DAFTAR KELURAHAN
        // ======================================================

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
        // TEST HANYA 1 KELURAHAN
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
        // AMBIL SEMUA PRAKIRAAN DARI RESPONSE BMKG
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


        // ======================================================
        // HASIL TEST
        // ======================================================

        return res.status(200).json({

            success: true,

            message:
                "API BMKG berhasil diakses dari backend",

            kelurahan:
                sampleKelurahan.kelurahan,

            kecamatan:
                sampleKelurahan.kecamatan,

            adm4:
                sampleKelurahan.adm4,

            jumlah_prakiraan:
                forecasts.length,

            contoh_prakiraan:
                forecasts.slice(0, 3)

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
