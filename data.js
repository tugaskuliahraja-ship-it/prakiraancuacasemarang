const SUPABASE_URL = 'https://malpetbethrghgaqvgnf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_T7nqycPtPHpPnjR4hOQ24w_X7XlCIiL';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    muatDataTabel('KOTA_SMG');
});

async function muatDataTabel(wilayah) {
    const tbody = document.getElementById('isi-tabel');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Memuat riwayat cuaca dari pangkalan data...</td></tr>`;

    const { data, error } = await supabase
        .from('riwayat_cuaca')
        .select('*')
        .eq('kode_wilayah', wilayah)
        .order('waktu', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Gagal memuat data: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Belum ada riwayat data. Menunggu perekaman Vercel Cron pada pukul 07:00 WIB.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    data.forEach(row => {
        const tanggalFormatted = new Date(row.waktu).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${tanggalFormatted}</td>
            <td><strong>${row.kondisi_cuaca}</strong></td>
            <td>${row.suhu} °C</td>
            <td>${row.kelembapan} %</td>
            <td>${row.angin} km/jam</td>
        `;
        tbody.appendChild(tr);
    });
}