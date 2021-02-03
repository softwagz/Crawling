const express = require("express");
const app = express();
const router = require("express").Router();
var https = require("https");
const puppeteer = require('puppeteer');

app.set('port', process.env.PORT | 8000);

app.use(express.json()); // Permite que el servidor recibe request de tipo Json.
app.use(express.urlencoded({ extended: true })) // Permite recibir request de tipo "multimedia"
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
    next();
});

// Hapag Lloyd 
app.use("/hapag-lloyd", router.get("/", (req, res) => {
    try {
        (async () => {
            const browser = await puppeteer.launch({ headless: false });
            const page = await browser.newPage();
            let value;
            let codeError = false;
            await page.setViewport({ width: 1080, height: 800 });
            await page.goto('https://www.hapag-lloyd.com/es/online-business/tracing/tracing-by-booking.html?blno=HLCUSHA2010NDHC8');
            await page.waitForNavigation({
                waitUntil: 'networkidle0',
            });
            await page.click('#accept-recommended-btn-handler');
            codeError = await page.evaluate(() => {
                let error = document.querySelector("#tracing_by_booking_f\\:hl15");
                if (error) return true
                else return false;
            })
            if (codeError) {
                console.log("codigo invalido");
                await page.browser().close();
                res.status(400).json({ result: "codigo invalido" });
            } else {

                // Obteniendo carga de lista de codigos
                await page.waitForSelector("#tracing_by_booking_f\\:hl27");
                let listCodeContainers = await page.evaluate(() => {
                    //var listContainers = [...document.querySelectorAll("#tracing_by_booking_f\\:hl27 > tbody > tr > td > span")];
                    let tabla = document.querySelector("#tracing_by_booking_f\\:hl27 > tbody");
                    let data = [...tabla.querySelectorAll("tr > td > span")]
                    var position = 1;
                    var listContainers = [];
                    data.forEach((e, k) => {
                        if (position == 0 && k == 1) {
                            listContainers.push(e.innerText)
                            position = position + 5;
                        }
                        else {
                            if (position == k) {
                                listContainers.push(e.innerText)
                                position = position + 5;
                            }
                        }

                    })

                    return listContainers;
                });

                forSincronus(page, listCodeContainers).then(async data => {
                    await page.browser().close();
                    res.json(data);
                })
            }
        })();
    } catch (error) {
        res.status(400).json({ result: "Error on server" });
    }
}))
// funcion para "for" Sincrono.  Hapag-Lloyd
async function forSincronus(page, array) {
    let arrays = [];
    for (let x of array) {
        await page.goto(`https://www.hapag-lloyd.com/en/online-business/tracing/tracing-by-booking.html?view=S8510&container=${x.replace(" ", "++")}`, { delay: 0 })
        await page.waitForSelector(".inputNonEdit > span");
        //await page.waitForSelector(".inputNonEdit > span");
        value = await page.evaluate(() => {
            let headerContent = {
                NumberContainer: '',
                Type: '',
                Description: '',
                Dimensiones: '',
                Tare_KG: '',
                MaxPayload_KG: '',
                LastMovent: ''
            };

            let data = [...document.querySelectorAll(".inputNonEdit > span")];
            headerContent.Type = data[0].innerText;
            headerContent.Description = data[1].innerText;
            headerContent.Dimensiones = data[2].innerText;
            headerContent.Tare_KG = data[3].innerText;
            headerContent.MaxPayload_KG = data[4].innerText;
            headerContent.LastMovent = data[5].innerText;
            let movementsData = [...document.querySelectorAll("#tracing_by_booking_f\\:hl66 > tbody > tr > td > span")];
            var movements = [];
            if (movementsData.length > 0) {
                var position = 0;
                while (position < movementsData.length) {
                    movements.push({
                        Status: movementsData[position].innerText,
                        LocationOfAcivity: movementsData[position + 1].innerText,
                        DateActivity: movementsData[position + 2].innerText,
                        Time: movementsData[position + 3].innerText,
                        Transport: movementsData[position + 4].innerText,
                        NroViaje: movementsData[position + 5].innerText
                    });
                    position = position + 6;
                }
            }

            let NumberContainer = document.querySelector("#tracing_by_booking_f\\:hl12").value;
            headerContent.NumberContainer = NumberContainer;

            let trackingData = {
                General: headerContent,
                Movements: movements
            }
            return trackingData;
        })
        arrays.push(value);
    }
    return arrays;
}
app.listen(app.get('port'), () => {
    console.log('Server is running On PORT: ', app.get('port'));
});