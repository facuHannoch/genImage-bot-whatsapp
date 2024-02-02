import express, { NextFunction, Request, Response } from 'express';
// import startSock from './bot/startBot';
import { AnyMessageContent, AnyRegularMessageContent, PollMessageOptions, WASocket, proto } from '@whiskeysockets/baileys';
import { FirebaseOptions, initializeApp } from "firebase/app";
import { Inference } from './utils/inferences';
import multer from 'multer';

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import cors from 'cors'

import P from 'pino';

import dotenv from 'dotenv'
dotenv.config()

// const streams = [
//     { stream: process.stdout },
//     { stream: fs.createWriteStream('/logs/file.log', { flags: 'a' }) }
// ]

const logger = P({ timestamp: () => `,"|APP|time":"${new Date().toJSON()}"` })
logger.level = 'info'
global.logger = logger

// let sock: WASocket | null = null;
// const initBot = async () => {
//     startSock().then((sockInitiated) => sock = sockInitiated)
//     return 0;
// }

// Firebase admin Condfig
import admin from 'firebase-admin';
import { extractPhoneNumber, subscribeUser } from './utils/user';
var serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.firestore();
const database = admin.database();

global.db = db;
global.database = database;

// 

// Configure multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


const app = express();
app.use(express.json());

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

const corstOptions = {
    origin: process.env.PAYMENT_PAGE_URL
}
app.use(cors(corstOptions))

const allowedUrls: string[] = [process.env.PAYMENT_PAGE_URL]
const allowedIPs: string[] = [process.env.TEST_ORIGIN_IP_ALLOWED]

function checkRequestIPAndURL(req: Request, res: Response, next: NextFunction) {
    const requestIP: string = req.ip || req.socket.remoteAddress || ''
    const referer = req.get('Referer')

    const isIPAllowed = allowedIPs.includes(requestIP)
    const isRefererAllowed = referer && allowedUrls.includes(new URL(referer).origin)
    if (isIPAllowed || isRefererAllowed) {
        next()
    } else {
        res.status(403).send(`Access Denied from IP: ${requestIP}, Referer: ${referer}`)
    }
}

// app.get('/ping', async (req, res) => res.status(200).send("OKI"))

app.post('/get-payment-details', checkRequestIPAndURL, async (req, res) => {
    const { subscription, id } = req.body // id is user id, which is the phone number
    logger.info(req.body)

    // payment request logging
    // try {
    //     // Log the payment request to a file
    //     fs.appendFile('payment-requests.log', JSON.stringify(req) + '\n', (err) => {
    //         if (err) {
    //             console.error('Error logging payment request:', err);
    //         } else {
    //             console.log('Payment request logged successfully.');
    //         }
    //     });

    // } catch (e) {
    //     logger.warn("Error while trying to log")
    // }

    let items = [
        {
            "title": "bot-trial",
            "description": "Subscription for bot WhatsApp service",
            "quantity": 1,
            "currency_id": "ARG",
            "unit_price": 2970
        }
    ]
    switch (subscription) {
        case 'bot-trial':
            items = [{
                "title": "Período de prueba bot WhatsApp",
                "description": "Período de prueba",
                "quantity": 1,
                "currency_id": "ARG",
                "unit_price": 2970
            }]
            break;
        case 'bot-full':
            items = [{
                "title": "Período de prueba bot WhatsApp",
                "description": "Período de prueba",
                "quantity": 1,
                "currency_id": "ARG",
                "unit_price": 2970
            }]
            break;
        case 'bot-imgs-batch':
            items = [{
                "title": "Paquete 200 imágenes personalizadas",
                "description": "",
                "quantity": 1,
                "currency_id": "ARG",
                "unit_price": 1900
            }]
            break;
        case 'week-trial':
            items = [{
                "title": "Paquete 200 imágenes personalizadas",
                "description": "",
                "quantity": 1,
                "currency_id": "USD",
                "unit_price": 3
            }]
        case 'monthly-basic':
            items = [{
                "title": "Paquete 200 imágenes personalizadas",
                "description": "",
                "quantity": 1,
                "currency_id": "USD",
                "unit_price": 3
            }]
        default:
            break;
    }

    let preference = {
        metadata: {
            wp_id: id,
            subscription: subscription,
        },
        items: items,
        // back_urls: {
        //     "success": `${process.env.PAYMENT_PAGE_URL}/payment-success?id=${id}&subscription=${subscription}`,
        //     "failure": "${process.env.PAYMENT_PAGE_URL}/feedback",
        //     "pending": `${process.env.PAYMENT_PAGE_URL}/payment-success?id=${id}&subscription=${subscription}&status=pending`
        // },
    };

    fetch('https://api.mercadopago.com/checkout/preferences', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN_PROD}`
        },
        body: JSON.stringify(preference)
    })
        .then(response => response.json()) // Correctly parsing the JSON response
        .then(data => {
            res.json({ id: data.id });
        })
        .catch(error => {
            logger.error(`Error trying to fetch preferences ${error}`);
        });
})

/* app.post('/batch-processing-done', upload.single('image'), async (req, res) => {
    try {
        const inferences = JSON.parse(req.body.inferences);
        // console.log('List of inferences:', inferences);

        for (const inference of inferences) {
            const buffer = Buffer.from(inference.image, 'base64');
            // const path = './'
            const filename = path.join(__dirname, `tempImage-${Date.now()}.jpg`); // Unique filename for each image
            // const filename = path.join('./public/img-generated-temp', `tempImage-${Date.now()}.jpg`);

            await writeFileAsync(filename, buffer);

            await sock.sendMessage(inference.user, { image: { url: filename } });
            // sock.sendMessage(inference.user, { sticker: { url: filename } });
            await sock.sendMessage(inference.user, { text: "Tu imagen ha sido procesada!" });

            // Optionally delete the image file after sending
            await unlinkAsync(filename);


            // writeFileAsync(filename, buffer)
            //     .then(() => {
            //         sock.sendMessage(inference.user, { text: "Tu imagen ha sido procesada!" });
            //         // sock.sendMessage(inference.user, { sticker: { url: filename } });
            //         sock.sendMessage(inference.user, { image: { url: filename } })
            //             .then(() => unlinkAsync(filename)) // delete the image file after sending the image
            //             .catch(error => logger.error('Error deleting the file:', error));
            //     })
            //     .catch(error => {
            //         logger.error('Error writing the file:', error);
            //     });
        }

        res.sendStatus(200);
    } catch (error) {
        logger.error('Error:', error);
        logger.error(`Error ${error}`);
        res.status(500).send('Internal Server Error');
    }
});
 */

interface MPResponse {
    wp_id: string | undefined;
    user: {
        email: string;
        user_id: string
    };
    subscription: string;
}
app.post('/mp-payment-received', async (req, res) => {
    const transactionId = req.body.transaction_id;
    logger.info(`Payment received ${transactionId}`)

    const transactionData = {
        transactionId: transactionId,
        status: 'completed',
        date: admin.firestore.Timestamp.fromDate(new Date()),
    }

    const { metadata }: { metadata: MPResponse } = await fetch(`https://api.mercadopago.com/v1/payments/${transactionId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.PAYMENTS_ENV == 'prod' ? process.env.MP_ACCESS_TOKEN_PROD : process.env.MP_ACCESS_TOKEN_TEST}`
        },
    })
        .then(response => response.json())
        .then(data => {
            return data
        })
        .catch(error => {
            logger.error(error);
        });

    const user = metadata.user
    const wp_id = metadata.wp_id
    const subscription = metadata.subscription

    const sub = subscription ?? 'bot-trial'

    let id: string = user.user_id ?? wp_id

    let phoneNumber = null
    if (wp_id) {
        phoneNumber = extractPhoneNumber(wp_id)
        id = phoneNumber
    }
    if (id) {
        try {
            subscribeUser(sub, user.user_id, user.email, phoneNumber)
        } catch (error) {
            logger.error(`Error on trying to create user ${error}`)
        }
        logger.info(`${id} was successfully subscribed to ${sub}`)
        saveTransactionData({
            ...transactionData,
            userId: id
        })

        // if (sock)
        //     sock.sendMessage(user_id, { text: "Felicidades! Ya puedes empezar a generar imágenes" })

        res.status(201).send("Success")
    } else {
        saveTransactionData(transactionData)

        logger.error(`User undefined`)
        logger.error(id)
        logger.error(sub)

        res.status(500).send("Error")
    }
});

async function saveTransactionData(transactionData) {
    try {
        await global.db.collection('transactions').doc(transactionData.transactionId).set(transactionData);
    } catch (error) {
        logger.error('Error saving transaction data:', error);
    }

}

const PORT = 3000;
app.listen(PORT, () => {
    return logger.info(`Server running on port ${PORT}`);
});
// initBot().then((result) => logger.info("Bot initiated"))