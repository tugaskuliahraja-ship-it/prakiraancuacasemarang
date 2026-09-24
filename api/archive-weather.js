export default async function handler(req, res) {

    // Hanya izinkan request GET
    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            error: "Method tidak diizinkan"
        });
    }

    try {

        // ==========================================
        // ALAMAT WEBSITE SAAT INI
        // ==========================================

        const protocol =
            req.headers["x-forwarded-proto"] || "http";

        const host =
            req.headers.host;

        const baseUrl =
            `${protocol}://${host}`;


        // ==========================================
        // BACA GEOJSON KELURAHAN SEMARANG
        // ==========================================

        const geojsonUrl =
            `${baseUrl}/data/Kelurahan%20Semarang.geojson`;

        const response =
            await fetch(geojsonUrl);


        if (!response.ok) {

            throw new Error(
                `GeoJSON gagal dibaca (${response.status})`
            );
        }


        const geojson =
            await response.json();


        if (!Array.isArray(geojson.features)) {

            throw new Error(
                "Format GeoJSON tidak valid"
            );
        }


        // ==========================================
        // AMBIL DATA KELURAHAN + ADM4
        // ==========================================

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

                // Hanya ambil kelurahan
                // yang mempunyai kode adm4
                .filter(item => item.adm4);


        // ==========================================
        // CEK ADM4 UNIK
        // ==========================================

        const adm4Unik =
            new Set(
                daftarKelurahan.map(
                    item => item.adm4
                )
            );


        // ==========================================
        // HASIL TEST
        // ==========================================

        return res.status(200).json({

            success: true,

            message:
                "GeoJSON Kelurahan Semarang berhasil dibaca",

            total_feature:
                geojson.features.length,

            total_kelurahan_dengan_adm4:
                daftarKelurahan.length,

            total_adm4_unik:
                adm4Unik.size,

            contoh_data:
                daftarKelurahan.slice(0, 5)

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