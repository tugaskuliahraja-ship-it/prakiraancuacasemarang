// File: api/cron.js
export default async function handler(req, res) {
    try {
        // SAKELAR: Ubah ke 'false' jika tugas kuliah sudah selesai
        const REKAM_AKTIF = true; 
        if (!REKAM_AKTIF) {
            return res.status(200).json({ message: 'Perekaman dimatikan.' });
        }
        
        // ... (kode penarikan BMKG di bawahnya tetap sama)
        
        // 1. Tarik Data BMKG Semarang
        const urlBmkg = 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=33.74';
        const responBmkg = await fetch(urlBmkg);
        const dataJSON = await responBmkg.json();

        // 2. Urai Data (Menggunakan logika getAllForecasts persis dari app.js Anda)
        const semuaPrakiraan = [];
        if (dataJSON && Array.isArray(dataJSON.data)) {
            dataJSON.data.forEach(group => {
                if (group.cuaca) {
                    group.cuaca.forEach(hari => {
                        if (Array.isArray(hari)) {
                            hari.forEach(item => {
                                semuaPrakiraan.push(item);
                            });
                        }
                    });
                }
            });
        }

        if (semuaPrakiraan.length === 0) {
            throw new Error("Gagal mengurai struktur data BMKG");
        }

        // 3. Filter Batasan Waktu 24 Jam
        // Waktu server Vercel berjalan pada UTC.
        const waktuSekarangUTC = new Date(); 
        const besokUTC = new Date(waktuSekarangUTC.getTime() + (24 * 60 * 60 * 1000));

        const payloadMassal = [];

        semuaPrakiraan.forEach(item => {
            if (!item.local_datetime) return;

            // Mengubah format "YYYY-MM-DD HH:mm:ss" dari BMKG (WIB) menjadi objek Date standar
            const waktuPrakiraan = new Date(item.local_datetime.replace(" ", "T") + "+07:00");

            // Hanya ambil data mulai jam ini hingga 24 jam ke depan
            if (waktuPrakiraan >= waktuSekarangUTC && waktuPrakiraan < besokUTC) {
                payloadMassal.push({
                    kode_wilayah: 'KOTA_SMG',
                    waktu: waktuPrakiraan.toISOString(), // Simpan format ISO ke Supabase
                    suhu: parseFloat(item.t),
                    kelembapan: parseFloat(item.hu),
                    angin: parseFloat(item.ws),
                    kondisi_cuaca: item.weather_desc
                });
            }
        });

        if (payloadMassal.length === 0) {
            return res.status(200).json({ message: 'Tidak ada data pada rentang waktu tersebut.' });
        }

        // 4. Kirim Massal ke Supabase
        const SUPABASE_URL = 'https://malpetbethrghgaqvgnf.supabase.co/rest/v1/riwayat_cuaca';
        const SUPABASE_KEY = 'sb_publishable_T7nqycPtPHpPnjR4hOQ24w_X7XlCIiL';

        const responSupabase = await fetch(SUPABASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payloadMassal)
        });

        if (!responSupabase.ok) {
            throw new Error(`Gagal ke Supabase: ${responSupabase.statusText}`);
        }

        res.status(200).json({ 
            message: `Sukses merekam ${payloadMassal.length} baris riwayat cuaca secara massal!`,
            contoh_data_pertama: payloadMassal[0]
        });

    } catch (error) {
        console.error("Cron Error:", error);
        res.status(500).json({ error: error.message });
    }
}