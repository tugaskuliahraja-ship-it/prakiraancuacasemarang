// ======================================================
// KONFIGURASI SUPABASE
// ======================================================

const SUPABASE_URL =
    'https://malpetbethrghgaqvgnf.supabase.co';

const SUPABASE_KEY =
    'sb_publishable_T7nqycPtPHpPnjR4hOQ24w_X7XlCIiL';

let supabaseClient = null;


// ======================================================
// ELEMEN HTML
// ======================================================

const filterWilayah =
    document.getElementById('pilih-wilayah');

const filterTahun =
    document.getElementById('filter-tahun');

const filterBulan =
    document.getElementById('filter-bulan');

const filterTanggal =
    document.getElementById('filter-tanggal');

const labelLokasi =
    document.getElementById('label-lokasi');

const labelWaktu =
    document.getElementById('label-waktu');

const btnCetakPDF =
    document.getElementById('btn-cetak-pdf');


// ======================================================
// FORMAT WAKTU WIB
// ======================================================

function formatWaktuIndonesia(value) {

    if (!value) {
        return '-';
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleString(
        'id-ID',
        {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }
    ) + ' WIB';
}


// ======================================================
// FORMAT NILAI
// ======================================================

function tampilNilai(value, suffix = '') {

    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return '-';
    }

    return `${value}${suffix}`;
}


// ======================================================
// ISI PILIHAN TANGGAL
// ======================================================

function isiOpsiTanggal(tahun, bulan) {

    if (!filterTanggal) {
        return;
    }

    filterTanggal.innerHTML =
        '<option value="">Pilih Tanggal (Opsional)...</option>';

    if (!tahun || !bulan) {
        return;
    }

    const jumlahHari =
        new Date(
            Number(tahun),
            Number(bulan),
            0
        ).getDate();

    for (
        let i = 1;
        i <= jumlahHari;
        i++
    ) {

        const tanggal =
            String(i).padStart(
                2,
                '0'
            );

        filterTanggal.innerHTML +=
            `<option value="${tanggal}">${i}</option>`;
    }
}


// ======================================================
// ATUR STATUS FILTER
// ======================================================

function updateFilterState() {

    if (
        !filterTahun ||
        !filterBulan ||
        !filterTanggal
    ) {
        return;
    }

    // Kalau tahun sudah terpilih,
    // dropdown bulan LANGSUNG aktif
    if (filterTahun.value) {

        filterBulan.disabled =
            false;

    } else {

        filterBulan.disabled =
            true;

        filterBulan.value =
            '';

        filterTanggal.disabled =
            true;

        filterTanggal.value =
            '';

        return;
    }


    // Tanggal baru aktif setelah bulan dipilih
    if (filterBulan.value) {

        filterTanggal.disabled =
            false;

        isiOpsiTanggal(
            filterTahun.value,
            filterBulan.value
        );

    } else {

        filterTanggal.disabled =
            true;

        filterTanggal.value =
            '';
    }
}


// ======================================================
// MUAT DATA TABEL
// ======================================================

async function muatDataTabel() {

    const tbody =
        document.getElementById(
            'isi-tabel'
        );

    if (!tbody) {
        return;
    }


    if (!supabaseClient) {

        tbody.innerHTML = `
            <tr>
                <td colspan="8"
                    style="
                        text-align:center;
                        color:#dc2626;
                        padding:30px;
                    "
                >
                    Supabase belum berhasil diinisialisasi.
                </td>
            </tr>
        `;

        return;
    }


    const wilayahVal =
        filterWilayah?.value
        || 'KOTA_SMG';


    const wilayahText =
        filterWilayah
            ? filterWilayah.options[
                filterWilayah.selectedIndex
            ].text
            : 'Rata-rata Kota Semarang';


    const tahun =
        filterTahun?.value || '';

    const bulan =
        filterBulan?.value || '';

    const tanggal =
        filterTanggal?.value || '';


    // ==================================================
    // LABEL
    // ==================================================

    if (labelLokasi) {

        labelLokasi.textContent =
            `Lokasi: ${wilayahText}`;
    }


    if (labelWaktu) {

        if (
            tahun &&
            bulan &&
            tanggal
        ) {

            labelWaktu.textContent =
                `Tanggal arsip BMKG: ${tanggal}-${bulan}-${tahun}`;

        } else if (
            tahun &&
            bulan
        ) {

            const namaBulan =
                filterBulan.options[
                    filterBulan.selectedIndex
                ].text;

            labelWaktu.textContent =
                `Arsip BMKG: ${namaBulan} ${tahun}`;

        } else if (tahun) {

            labelWaktu.textContent =
                `Arsip BMKG Tahun ${tahun}`;

        } else {

            labelWaktu.textContent =
                'Arsip prakiraan BMKG';
        }
    }


    tbody.innerHTML = `
        <tr>
            <td colspan="8"
                style="
                    text-align:center;
                    padding:30px;
                    color:#64748b;
                "
            >
                Memuat arsip prakiraan BMKG...
            </td>
        </tr>
    `;


    // ==================================================
    // QUERY DASAR
    // ==================================================

    let kueri =
        supabaseClient
            .from('riwayat_cuaca')
            .select(`
                kode_wilayah,
                nama_wilayah,
                tingkat_wilayah,
                analysis_date,
                waktu,
                suhu,
                kelembapan,
                angin,
                arah_angin,
                tutupan_awan,
                curah_hujan,
                kondisi_cuaca
            `)
            .eq(
                'kode_wilayah',
                wilayahVal
            )
            .not(
                'analysis_date',
                'is',
                null
            );


    // ==================================================
    // FILTER BERDASARKAN ANALYSIS_DATE
    // ==================================================

    if (tahun) {

        let rentangAwal;
        let rentangAkhir;


        if (
            bulan &&
            tanggal
        ) {

            rentangAwal =
                `${tahun}-${bulan}-${tanggal}T00:00:00+07:00`;

            rentangAkhir =
                `${tahun}-${bulan}-${tanggal}T23:59:59+07:00`;

        } else if (bulan) {

            const hariTerakhir =
                new Date(
                    Number(tahun),
                    Number(bulan),
                    0
                ).getDate();

            rentangAwal =
                `${tahun}-${bulan}-01T00:00:00+07:00`;

            rentangAkhir =
                `${tahun}-${bulan}-${String(
                    hariTerakhir
                ).padStart(2, '0')}T23:59:59+07:00`;

        } else {

            rentangAwal =
                `${tahun}-01-01T00:00:00+07:00`;

            rentangAkhir =
                `${tahun}-12-31T23:59:59+07:00`;
        }


        kueri =
            kueri
                .gte(
                    'analysis_date',
                    rentangAwal
                )
                .lte(
                    'analysis_date',
                    rentangAkhir
                );
    }


    kueri =
        kueri
            .order(
                'analysis_date',
                {
                    ascending: false
                }
            )
            .order(
                'waktu',
                {
                    ascending: true
                }
            );


    // ==================================================
    // JALANKAN QUERY
    // ==================================================

    const {
        data,
        error
    } =
        await kueri;


    if (error) {

        console.error(
            'SUPABASE ERROR:',
            error
        );

        tbody.innerHTML = `
            <tr>
                <td colspan="8"
                    style="
                        text-align:center;
                        color:#dc2626;
                        padding:30px;
                    "
                >
                    Gagal memuat data:
                    ${error.message}
                </td>
            </tr>
        `;

        return;
    }


    if (
        !data ||
        data.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td colspan="8"
                    style="
                        text-align:center;
                        color:#94a3b8;
                        padding:40px;
                    "
                >
                    Belum ada arsip prakiraan BMKG
                    untuk wilayah dan periode tersebut.
                </td>
            </tr>
        `;

        return;
    }


    // ==================================================
    // TAMPILKAN DATA
    // ==================================================

    tbody.innerHTML = '';


    data.forEach(row => {

        const tr =
            document.createElement(
                'tr'
            );

        tr.innerHTML = `

            <td>
                ${formatWaktuIndonesia(
                    row.analysis_date
                )}
            </td>

            <td>
                ${formatWaktuIndonesia(
                    row.waktu
                )}
            </td>

            <td>
                <strong>
                    ${row.kondisi_cuaca || '-'}
                </strong>
            </td>

            <td>
                ${tampilNilai(
                    row.suhu,
                    ' °C'
                )}
            </td>

            <td>
                ${tampilNilai(
                    row.kelembapan,
                    ' %'
                )}
            </td>

            <td>
                ${tampilNilai(
                    row.angin,
                    ' km/jam'
                )}
            </td>

            <td>
                ${tampilNilai(
                    row.arah_angin
                )}
            </td>

            <td>
                ${tampilNilai(
                    row.curah_hujan,
                    ' mm'
                )}
            </td>
        `;

        tbody.appendChild(
            tr
        );
    });
}


// ======================================================
// EVENT FILTER
// ======================================================

if (filterWilayah) {

    filterWilayah.addEventListener(
        'change',
        muatDataTabel
    );
}


if (filterTahun) {

    filterTahun.addEventListener(
        'change',
        function () {

            updateFilterState();

            muatDataTabel();
        }
    );
}


if (filterBulan) {

    filterBulan.addEventListener(
        'change',
        function () {

            updateFilterState();

            muatDataTabel();
        }
    );
}


if (filterTanggal) {

    filterTanggal.addEventListener(
        'change',
        muatDataTabel
    );
}


// ======================================================
// CETAK PDF
// ======================================================

if (btnCetakPDF) {

    btnCetakPDF.addEventListener(
        'click',
        function () {

            const area =
                document.getElementById(
                    'area-cetak-pdf'
                );

            if (!area) {
                return;
            }


            html2pdf()
                .from(area)
                .set({

                    margin:
                        7,

                    filename:
                        'Arsip_Prakiraan_Cuaca_Semarang.pdf',

                    image: {
                        type: 'jpeg',
                        quality: 0.98
                    },

                    html2canvas: {
                        scale: 2,
                        useCORS: true
                    },

                    jsPDF: {
                        unit: 'mm',
                        format: 'a4',
                        orientation: 'landscape'
                    }
                })
                .save();
        }
    );
}


// ======================================================
// START APLIKASI
// ======================================================

document.addEventListener(
    'DOMContentLoaded',
    async function () {

        try {

            // Pastikan library Supabase benar-benar tersedia
            if (
                !window.supabase ||
                typeof window.supabase.createClient !==
                    'function'
            ) {

                throw new Error(
                    'Library Supabase tidak ditemukan'
                );
            }


            supabaseClient =
                window.supabase.createClient(
                    SUPABASE_URL,
                    SUPABASE_KEY
                );


            console.log(
                '✅ Supabase Riwayat terhubung'
            );


            // Ini yang sebelumnya kurang:
            // tahun 2026 sudah terpilih sejak awal,
            // jadi Bulan harus langsung aktif.
            updateFilterState();


            await muatDataTabel();


        } catch (error) {

            console.error(
                '❌ Gagal inisialisasi:',
                error
            );


            const tbody =
                document.getElementById(
                    'isi-tabel'
                );


            if (tbody) {

                tbody.innerHTML = `
                    <tr>
                        <td colspan="8"
                            style="
                                text-align:center;
                                color:#dc2626;
                                padding:30px;
                            "
                        >
                            Gagal menghubungkan halaman
                            Riwayat ke Supabase:
                            ${error.message}
                        </td>
                    </tr>
                `;
            }
        }
    }
);
