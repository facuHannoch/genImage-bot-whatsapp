import express, { Request, Response } from 'express';
import startSock from './bot/startBot';
import { AnyMessageContent, AnyRegularMessageContent, PollMessageOptions, WASocket, proto } from '@whiskeysockets/baileys';
import { FirebaseOptions, initializeApp } from "firebase/app";
import { Inference, subscribeUser } from './utils/utils';
import multer from 'multer';

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import P from 'pino';
const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` })
global.logger = logger

let sock: WASocket | null = null;
const initBot = async () => {
    startSock().then((sockInitiated) => sock = sockInitiated)
    return 0;
}

// Firebase Condfig
import admin from 'firebase-admin';
var serviceAccount = require("../serviceAccountKey.json");

// const firebaseConfig: FirebaseOptions = {
//     projectId: 'gen-image-1da8b',
// };

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gen-image-1da8b-default-rtdb.firebaseio.com",
});

// global.firebaseApp = initializeApp(firebaseConfig);
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

app.post('/batch-processing-done', upload.single('image'), async (req, res) => {
    try {
        const inferences = JSON.parse(req.body.inferences);
        // console.log('List of inferences:', inferences);

        for (const inference of inferences) {
            const buffer = Buffer.from(inference.image, 'base64');
            const filename = path.join(__dirname, `tempImage-${Date.now()}.jpg`); // Unique filename for each image

            await writeFileAsync(filename, buffer);

            sock.sendMessage(inference.user, { image: { url: filename } });
            // sock.sendMessage(inference.user, { sticker: { url: filename } });
            await sock.sendMessage(inference.user, { text: "Tu imagen ha sido procesada!" });

            // Optionally delete the image file after sending
            await unlinkAsync(filename);
        }

        res.sendStatus(200);
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/payment-received', async (req, res) => {
    const transactionId = req.body.transaction_id;
    logger.info('Payment received ', transactionId)

    const transactionData = {
        transactionId: transactionId,
        status: 'pending',
    }

    try {
        await global.db.collection('transactions').doc(transactionId).set(transactionData);
        res.send('Transaction data recorded');
    } catch (error) {
        console.error('Error saving transaction data:', error);
        res.status(500).send('Internal Server Error');
    }


});

// const saveTempTransactionOndb
// 
// app.post('/payment-received', async (req, res) => {
//     // console.log(req.body)
//     const data = (req.body)
//     console.log('Payment received:', data);
//     const subscriptionType: string = data.subscriptionType ?? 'bot-trial';
//     const jid: string = `${data.user}@s.whatsapp.net`
//     subscribeUser(jid, subscriptionType);
//     sock.sendMessage(jid, { text: "Felicidades! Ya puedes empezar a generar imágenes" })
//     res.sendStatus(200);
// });


const PORT = 3000;
app.listen(PORT, () => {
    return logger.info(`Server running on port ${PORT}`);
});
initBot().then((result) => logger.info("Bot initiated"))

// startSock().catch((err: any) => console.error('Error in WhatsApp bot:', err));
