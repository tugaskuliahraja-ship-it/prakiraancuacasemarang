// ======================================================
// SUPABASE
// ======================================================

const SUPABASE_URL =
    'https://malpetbethrghgaqvgnf.supabase.co';

const SUPABASE_KEY =
    'sb_publishable_T7nqycPtPHpPnjR4hOQ24w_X7XlCIiL';

let supabaseClient = null;


// ======================================================
// STATE DATA YANG SEDANG DITAMPILKAN
// ======================================================

let currentTableData = [];


// ======================================================
// ELEMENT
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
// FORMAT WIB
// ======================================================

function formatWaktuIndonesia(
    value
) {

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
    )
    .replace(
        ':',
        '.'
    )
    + ' WIB';
}


// ======================================================
// NILAI
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
// FILTER TANGGAL
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
            Number(tahun),
            Number(bulan),
            0
        )
        .getDate();


    for (
        let i = 1;
        i <= jumlahHari;
        i++
    ) {

        const tanggal =
            String(i)
                .padStart(
                    2,
                    '0'
                );


        const option =
            document.createElement(
                'option'
            );


        option.value =
            tanggal;

        option.textContent =
            i;


        filterTanggal.appendChild(
            option
        );
    }
}


// ======================================================
// UPDATE STATUS FILTER
// ======================================================

function updateFilterState() {

    if (
        !filterTahun ||
        !filterBulan ||
        !filterTanggal
    ) {
        return;
    }


    if (
        filterTahun.value
    ) {

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


    if (
        filterBulan.value
    ) {

        filterTanggal.disabled =
            false;


        const currentDateValue =
            filterTanggal.value;


        isiOpsiTanggal(
            filterTahun.value,
            filterBulan.value
        );


        if (
            currentDateValue
        ) {

            filterTanggal.value =
                currentDateValue;
        }

    } else {

        filterTanggal.disabled =
            true;

        filterTanggal.value =
            '';
    }
}


// ======================================================
// LABEL PERIODE
// ======================================================

function getPeriodeLabel() {

    const tahun =
        filterTahun?.value || '';

    const bulan =
        filterBulan?.value || '';

    const tanggal =
        filterTanggal?.value || '';


    if (
        tahun &&
        bulan &&
        tanggal
    ) {

        return (
            `${tanggal}-${bulan}-${tahun}`
        );
    }


    if (
        tahun &&
        bulan
    ) {

        const namaBulan =
            filterBulan.options[
                filterBulan.selectedIndex
            ].text;


        return (
            `${namaBulan} ${tahun}`
        );
    }


    if (tahun) {

        return (
            `Tahun ${tahun}`
        );
    }


    return (
        'Semua Arsip'
    );
}


// ======================================================
// MUAT DATA
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
                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:35px;
                        color:#dc2626;
                    "
                >
                    Supabase belum terhubung.
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
        filterTahun?.value
        || '';

    const bulan =
        filterBulan?.value
        || '';

    const tanggal =
        filterTanggal?.value
        || '';


    // ==================================================
    // LABEL
    // ==================================================

    if (labelLokasi) {

        labelLokasi.textContent =
            `Lokasi: ${wilayahText}`;
    }


    if (labelWaktu) {

        labelWaktu.textContent =
            `Periode Arsip: ${getPeriodeLabel()}`;
    }


    tbody.innerHTML = `
        <tr>
            <td
                colspan="8"
                style="
                    text-align:center;
                    padding:35px;
                    color:#94a3b8;
                "
            >
                Memuat arsip prakiraan BMKG...
            </td>
        </tr>
    `;


    // ==================================================
    // QUERY
    // ==================================================

    let kueri =
        supabaseClient
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
            );


    // ==================================================
    // FILTER ANALYSIS_DATE
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
                )
                .getDate();


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


    kueri =
        kueri
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
    // EXECUTE
    // ==================================================

    const {
        data,
        error
    } =
        await kueri;


    if (error) {

        console.error(
            'Supabase:',
            error
        );


        currentTableData =
            [];


        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:35px;
                        color:#dc2626;
                    "
                >
                    Gagal memuat data:
                    ${error.message}
                </td>
            </tr>
        `;


        return;
    }


    currentTableData =
        Array.isArray(data)
            ? data
            : [];


    if (
        currentTableData.length ===
        0
    ) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:40px;
                        color:#94a3b8;
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
    // RENDER
    // ==================================================

    tbody.innerHTML =
        '';


    currentTableData
        .forEach(
            row => {

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
            }
        );
}


// ======================================================
// EVENT FILTER
// ======================================================

filterWilayah
    ?.addEventListener(
        'change',
        muatDataTabel
    );


filterTahun
    ?.addEventListener(
        'change',
        function () {

            updateFilterState();

            muatDataTabel();
        }
    );


filterBulan
    ?.addEventListener(
        'change',
        function () {

            updateFilterState();

            muatDataTabel();
        }
    );


filterTanggal
    ?.addEventListener(
        'change',
        muatDataTabel
    );


// ======================================================
// PDF
// SELALU LIGHT / PUTIH
// A4 LANDSCAPE
// AUTO PAGINATION
// ======================================================

function cetakPDF() {

    if (
        !currentTableData ||
        currentTableData.length === 0
    ) {

        alert(
            'Belum ada data yang dapat dicetak.'
        );

        return;
    }


    if (
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {

        alert(
            'Library PDF belum berhasil dimuat.'
        );

        return;
    }


    const {
        jsPDF
    } =
        window.jspdf;


    // A4 LANDSCAPE
    const doc =
        new jsPDF({
            orientation:
                'landscape',

            unit:
                'mm',

            format:
                'a4'
        });


    // ==================================================
    // UKURAN HALAMAN
    // ==================================================

    const pageWidth =
        doc.internal
            .pageSize
            .getWidth();


    const pageHeight =
        doc.internal
            .pageSize
            .getHeight();


    // Margin normal A4
    const marginLeft =
        12;

    const marginRight =
        12;

    const marginTop =
        12;

    const marginBottom =
        14;


    // ==================================================
    // IDENTITAS
    // ==================================================

    const wilayahText =
        filterWilayah
            ? filterWilayah.options[
                filterWilayah.selectedIndex
            ].text
            : 'Rata-rata Kota Semarang';


    const periode =
        getPeriodeLabel();


    const now =
        new Date();


    const tanggalCetak =
        now.toLocaleString(
            'id-ID',
            {
                timeZone:
                    'Asia/Jakarta',

                weekday:
                    'long',

                day:
                    '2-digit',

                month:
                    'long',

                year:
                    'numeric',

                hour:
                    '2-digit',

                minute:
                    '2-digit'
            }
        )
        .replace(
            ':',
            '.'
        );


    // ==================================================
    // HEADER PDF
    // ==================================================

    doc.setTextColor(
        30,
        41,
        59
    );


    doc.setFont(
        'helvetica',
        'bold'
    );


    doc.setFontSize(
        16
    );


    doc.text(
        'LAPORAN RIWAYAT PRAKIRAAN CUACA',
        pageWidth / 2,
        marginTop + 4,
        {
            align:
                'center'
        }
    );


    doc.setFont(
        'helvetica',
        'normal'
    );


    doc.setFontSize(
        9.5
    );


    doc.setTextColor(
        71,
        85,
        105
    );


    doc.text(
        'Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)',
        pageWidth / 2,
        marginTop + 10,
        {
            align:
                'center'
        }
    );


    doc.setFontSize(
        9
    );


    doc.text(
        `Lokasi: ${wilayahText}`,
        marginLeft,
        marginTop + 19
    );


    doc.text(
        `Periode Arsip: ${periode}`,
        marginLeft,
        marginTop + 24
    );


    doc.text(
        `Dicetak: ${tanggalCetak} WIB`,
        pageWidth - marginRight,
        marginTop + 19,
        {
            align:
                'right'
        }
    );


    doc.setDrawColor(
        203,
        213,
        225
    );


    doc.line(
        marginLeft,
        marginTop + 29,
        pageWidth - marginRight,
        marginTop + 29
    );


    // ==================================================
    // DATA PDF
    // ==================================================

    const body =
        currentTableData.map(
            row => [

                formatWaktuIndonesia(
                    row.analysis_date
                ),

                formatWaktuIndonesia(
                    row.waktu
                ),

                row.kondisi_cuaca
                    || '-',

                tampilNilai(
                    row.suhu,
                    ' °C'
                ),

                tampilNilai(
                    row.kelembapan,
                    ' %'
                ),

                tampilNilai(
                    row.angin,
                    ' km/jam'
                ),

                tampilNilai(
                    row.arah_angin
                ),

                tampilNilai(
                    row.curah_hujan,
                    ' mm'
                )
            ]
        );


    doc.autoTable({

        startY:
            marginTop + 34,


        margin: {

            left:
                marginLeft,

            right:
                marginRight,

            bottom:
                marginBottom
        },


        head: [[

            'Diterbitkan BMKG',

            'Waktu Prakiraan',

            'Kondisi Cuaca',

            'Suhu',

            'Kelembapan',

            'Angin',

            'Arah Angin',

            'Curah Hujan'
        ]],


        body:
            body,


        theme:
            'grid',


        showHead:
            'everyPage',


        rowPageBreak:
            'avoid',


        styles: {

            font:
                'helvetica',

            fontSize:
                8,

            textColor: [
                51,
                65,
                85
            ],

            lineColor: [
                203,
                213,
                225
            ],

            lineWidth:
                0.2,

            cellPadding:
                2.5,

            valign:
                'middle',

            overflow:
                'linebreak'
        },


        headStyles: {

            fillColor: [
                241,
                245,
                249
            ],

            textColor: [
                30,
                41,
                59
            ],

            fontStyle:
                'bold',

            fontSize:
                8,

            halign:
                'center',

            valign:
                'middle',

            minCellHeight:
                10
        },


        alternateRowStyles: {

            fillColor: [
                248,
                250,
                252
            ]
        },


        columnStyles: {

            0: {
                cellWidth: 35
            },

            1: {
                cellWidth: 35
            },

            2: {
                cellWidth: 38
            },

            3: {
                cellWidth: 20,
                halign: 'center'
            },

            4: {
                cellWidth: 24,
                halign: 'center'
            },

            5: {
                cellWidth: 27,
                halign: 'center'
            },

            6: {
                cellWidth: 23,
                halign: 'center'
            },

            7: {
                cellWidth: 27,
                halign: 'center'
            }
        },


        // ==================================================
        // FOOTER SETIAP HALAMAN
        // ==================================================

        didDrawPage: function () {

            const currentPage =
                doc.internal
                    .getCurrentPageInfo()
                    .pageNumber;


            const totalPages =
                doc.internal
                    .getNumberOfPages();


            doc.setFont(
                'helvetica',
                'normal'
            );


            doc.setFontSize(
                7.5
            );


            doc.setTextColor(
                100,
                116,
                139
            );


            doc.text(
                'Sumber: BMKG',
                marginLeft,
                pageHeight - 7
            );


            doc.text(
                `Halaman ${currentPage} dari ${totalPages}`,
                pageWidth - marginRight,
                pageHeight - 7,
                {
                    align:
                        'right'
                }
            );
        }
    });


    // ==================================================
    // UPDATE NOMOR TOTAL HALAMAN
    //
    // didDrawPage di atas kadang belum mengetahui
    // jumlah final sampai tabel selesai.
    // Tambahkan ulang footer nomor halaman.
    // ==================================================

    const totalPages =
        doc.internal
            .getNumberOfPages();


    for (
        let i = 1;
        i <= totalPages;
        i++
    ) {

        doc.setPage(
            i
        );


        doc.setFontSize(
            7.5
        );


        doc.setTextColor(
            100,
            116,
            139
        );


        // Tutup nomor halaman lama
        doc.setFillColor(
            255,
            255,
            255
        );


        doc.rect(
            pageWidth - 55,
            pageHeight - 11,
            45,
            6,
            'F'
        );


        doc.text(
            `Halaman ${i} dari ${totalPages}`,
            pageWidth - marginRight,
            pageHeight - 7,
            {
                align:
                    'right'
            }
        );
    }


    // ==================================================
    // FILE NAME
    // ==================================================

    const safeWilayah =
        wilayahText
            .replace(
                /[^a-zA-Z0-9]+/g,
                '_'
            )
            .replace(
                /^_+|_+$/g,
                ''
            );


    const safePeriode =
        periode
            .replace(
                /[^a-zA-Z0-9]+/g,
                '_'
            )
            .replace(
                /^_+|_+$/g,
                ''
            );


    doc.save(
        `Riwayat_Cuaca_${safeWilayah}_${safePeriode}.pdf`
    );
}


// ======================================================
// BUTTON PDF
// ======================================================

btnCetakPDF
    ?.addEventListener(
        'click',
        cetakPDF
    );


// ======================================================
// START
// ======================================================

document.addEventListener(
    'DOMContentLoaded',
    async function () {

        try {

            if (
                !window.supabase ||
                typeof window
                    .supabase
                    .createClient !==
                    'function'
            ) {

                throw new Error(
                    'Library Supabase tidak ditemukan.'
                );
            }


            supabaseClient =
                window.supabase
                    .createClient(
                        SUPABASE_URL,
                        SUPABASE_KEY
                    );


            updateFilterState();


            await muatDataTabel();


        } catch (error) {

            console.error(
                error
            );


            const tbody =
                document.getElementById(
                    'isi-tabel'
                );


            if (tbody) {

                tbody.innerHTML = `
                    <tr>
                        <td
                            colspan="8"
                            style="
                                text-align:center;
                                padding:35px;
                                color:#dc2626;
                            "
                        >
                            ${error.message}
                        </td>
                    </tr>
                `;
            }
        }
    }
);
