// ======================================================
// THEME OTOMATIS BERDASARKAN WAKTU WIB
// Light : 06.00 - 17.59
// Dark  : 18.00 - 05.59
// ======================================================

(function () {

    function getWIBHour() {

        const hourText =
            new Intl.DateTimeFormat(
                'en-GB',
                {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    hourCycle: 'h23'
                }
            ).format(new Date());

        return Number(hourText);
    }


    function getAutomaticTheme() {

        const hour =
            getWIBHour();

        return (
            hour >= 18 ||
            hour < 6
        )
            ? 'dark'
            : 'light';
    }


    function applyAutomaticTheme() {

        const theme =
            getAutomaticTheme();

        const oldTheme =
            document.documentElement
                .dataset.theme;

        document.documentElement
            .dataset.theme =
                theme;


        if (oldTheme !== theme) {

            window.dispatchEvent(
                new CustomEvent(
                    'app-theme-changed',
                    {
                        detail: {
                            theme: theme
                        }
                    }
                )
            );
        }
    }


    // Jalankan langsung
    applyAutomaticTheme();


    // Cek ulang tiap 1 menit
    setInterval(
        applyAutomaticTheme,
        60 * 1000
    );


    // Bisa dipakai app.js
    window.getAutomaticTheme =
        getAutomaticTheme;

})();