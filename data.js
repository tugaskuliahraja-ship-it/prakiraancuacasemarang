const SUPABASE_URL =
    'https://malpetbethrghgaqvgnf.supabase.co';

const SUPABASE_KEY =
    'sb_publishable_T7nqycPtPHpPnjR4hOQ24w_X7XlCIiL';


const supabase =
    window.supabase
        ? window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        )
        : null;


// ======================================================
// ELEMEN
// ======================================================

const filterWilayah =
    document.getElementById(
        'pilih-wilayah'
    );

const filterTahun =
    document.getElementById(
        'filter-tahun'
    );

const filterBulan =
    document.getElementById(
        'filter-bulan'
    );

const filterTanggal =
    document.getElementById(
        'filter-tanggal'
    );

const labelLokasi =
    document.getElementById(
        'label-lokasi'
    );

const labelWaktu =
    document.getElementById(
        'label-waktu'
    );

const btnCetakPDF =
    document.getElementById(
        'btn-cetak-pdf'
    );


// ======================================================
// FORMAT WAKTU
// ======================================================

function formatWaktuIndonesia(value) {

    if (!value) {
        return '-';
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return '-';
    }


    return date.toLocaleString(
        'id-ID',
        {
            timeZone:
                'Asia/Jakarta',

            day:
                '2-digit',

            month:
                '2-digit',

            year:
                'numeric',

            hour:
                '2-digit',

            minute:
                '2-digit'
        }
    ) + ' WIB';
}


// ======================================================
// FORMAT NILAI
// ======================================================

function tampilNilai(
    value,
    suffix = ''
) {

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
// INISIALISASI
// ======================================================

document.addEventListener(
    'DOMContentLoaded',
    () => {

        muatDataTabel();
    }
);


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

            if (this.value !== '') {

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
            }


            muatDataTabel();
        }
    );
}


if (filterBulan) {

    filterBulan.addEventListener(
        'change',
        function () {

            if (this.value !== '') {

                filterTanggal.disabled =
                    false;

                isiOpsiTanggal(
                    filterTahun.value,
                    this.value
                );

            } else {

                filterTanggal.disabled =
                    true;

                filterTanggal.value =
                    '';
            }


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
// ISI PILIHAN TANGGAL
// ======================================================

function isiOpsiTanggal(
    tahun,
    bulan
) {

    if (!filterTanggal) {
        return;
    }


    filterTanggal.innerHTML =
        '<option value="">Pilih Tanggal (Opsional)...</option>';


    if (
        !tahun ||
        !bulan
    ) {
        return;
    }


    const jumlahHari =
        new Date(
            tahun,
            Number(bulan),
            0
        ).getDate();


    for (
        let i = 1;
        i <= jumlahHari;
        i++
    ) {

        const angkaTanggal =
            String(i)
                .padStart(
                    2,
                    '0'
                );


        filterTanggal.innerHTML +=
            `<option value="${angkaTanggal}">${i}</option>`;
    }
}


// ======================================================
// MUAT DATA RIWAYAT
// ======================================================

async function muatDataTabel() {

    const tbody =
        document.getElementById(
            'isi-tabel'
        );


    if (
        !tbody ||
        !supabase
    ) {
        return;
    }


    const wilayahVal =
        filterWilayah
            ? filterWilayah.value
            : 'KOTA_SMG';


    const wilayahText =
        filterWilayah
            ? filterWilayah.options[
                filterWilayah.selectedIndex
            ].text
            : 'Rata-rata Kota Semarang';


    const tahun =
        filterTahun
            ? filterTahun.value
            : '';


    const bulan =
        filterBulan
            ? filterBulan.value
            : '';


    const tanggal =
        filterTanggal
            ? filterTanggal.value
            : '';


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
                `Arsip BMKG tahun ${tahun}`;

        } else {

            labelWaktu.textContent =
                'Arsip prakiraan BMKG';
        }
    }


    tbody.innerHTML = `
        <tr>
            <td
                colspan="8"
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
    // QUERY
    //
    // HANYA DATA SISTEM OTOMATIS BARU.
    // analysis_date NULL = data lama/browser.
    // ==================================================

    let kueri =
        supabase
            .from(
                'riwayat_cuaca'
            )
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
            )
            .order(
                'analysis_date',
                {
                    ascending:
                        false
                }
            )
            .order(
                'waktu',
                {
                    ascending:
                        true
                }
            );


    // ==================================================
    // FILTER BERDASARKAN TANGGAL ANALYSIS_DATE
    // BUKAN WAKTU PRAKIRAAN
    // ==================================================

    if (tahun) {

        let rentangAwal;
        let rentangAkhir;


        if (
            tahun &&
            bulan &&
            tanggal
        ) {

            rentangAwal =
                `${tahun}-${bulan}-${tanggal}T00:00:00+07:00`;

            rentangAkhir =
                `${tahun}-${bulan}-${tanggal}T23:59:59+07:00`;

        } else if (
            tahun &&
            bulan
        ) {

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
                ).padStart(
                    2,
                    '0'
                )}T23:59:59+07:00`;

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


    // ==================================================
    // EKSEKUSI
    // ==================================================

    const {
        data,
        error
    } =
        await kueri;


    if (error) {

        console.error(
            error
        );


        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
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


    // ==================================================
    // DATA KOSONG
    // ==================================================

    if (
        !data ||
        data.length === 0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
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

    tbody.innerHTML =
        '';


    data.forEach(row => {

        const diterbitkan =
            formatWaktuIndonesia(
                row.analysis_date
            );


        const waktuPrakiraan =
            formatWaktuIndonesia(
                row.waktu
            );


        const kondisi =
            row.kondisi_cuaca
            || '-';


        const tr =
            document.createElement(
                'tr'
            );


        tr.innerHTML = `

            <td>
                ${diterbitkan}
            </td>

            <td>
                ${waktuPrakiraan}
            </td>

            <td>
                <strong>
                    ${kondisi}
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
// CETAK PDF
// ======================================================

if (btnCetakPDF) {

    btnCetakPDF.addEventListener(
        'click',
        function () {

            const elemenAreaCetak =
                document.getElementById(
                    'area-cetak-pdf'
                );


            if (!elemenAreaCetak) {
                return;
            }


            const opsiPengaturan = {

                margin:
                    7,

                filename:
                    'Arsip_Prakiraan_Cuaca_Semarang.pdf',

                image: {
                    type:
                        'jpeg',

                    quality:
                        0.98
                },

                html2canvas: {

                    scale:
                        2,

                    useCORS:
                        true
                },

                jsPDF: {

                    unit:
                        'mm',

                    format:
                        'a4',

                    orientation:
                        'landscape'
                }
            };


            html2pdf()
                .from(
                    elemenAreaCetak
                )
                .set(
                    opsiPengaturan
                )
                .save();
        }
    );
}
