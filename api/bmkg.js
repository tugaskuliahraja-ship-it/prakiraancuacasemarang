export default async function handler(req, res) {

    const {
        adm4
    } = req.query;


    if (!adm4) {

        return res.status(400).json({
            error: "adm4 wajib diisi"
        });
    }


    try {

        const url =
            `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`;


        const response =
            await fetch(url);


        if (!response.ok) {

            return res.status(
                response.status
            ).json({
                error:
                    `BMKG ${response.status}`
            });
        }


        const data =
            await response.json();


        res.setHeader(
            "Access-Control-Allow-Origin",
            "*"
        );


        return res
            .status(200)
            .json(data);

    }

    catch (error) {

        return res
            .status(500)
            .json({
                error:
                    error.message
            });
    }
}