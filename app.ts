import express, { Request, Response } from 'express';
import axios from 'axios';
import startSock from './src/startBot';
import { AnyMessageContent, AnyRegularMessageContent, PollMessageOptions, WASocket, proto } from '@whiskeysockets/baileys';
import { FirebaseOptions, initializeApp } from "firebase/app";
import { Inference } from './src/utils/utils';
import multer from 'multer';

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

let sock: WASocket | null = null;
const initBot = async () => {
    startSock().then((sockInitiated) => sock = sockInitiated)
    return 0;
}

// Firebase Condfig
import admin from 'firebase-admin';
var serviceAccount = require("./serviceAccountKey.json");

const firebaseConfig: FirebaseOptions = {
    projectId: 'gen-image-1da8b',

};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gen-image-1da8b-default-rtdb.firebaseio.com"
});

global.firebaseApp = initializeApp(firebaseConfig);
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
        console.log('List of inferences:', inferences);

        for (const inference of inferences) {
            const buffer = Buffer.from(inference.image, 'base64');
            const filename = path.join(__dirname, `tempImage-${Date.now()}.jpg`); // Unique filename for each image

            await writeFileAsync(filename, buffer);

            // Send a text message
            await sock.sendMessage(inference.user, { text: "Your image has been processed!" });

            // Send the image
            // Replace with the actual method to send an image via your WhatsApp API
            await sock.sendMessage(inference.user, { image: { url: filename } });

            // Optionally delete the image file after sending
            await unlinkAsync(filename);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Webhook endpoint
app.post('/firebase-update', async (req: Request, res: Response) => {
    const data = req.body;
    console.log('Received data from Firebase:', data);
    // Process the data...
    const s: proto.Message.ButtonsMessage.IButton = {
        buttonId: "A button",
        buttonText: {
            displayText: "A nice button"
        },
    }
    sock.sendMessage("5491156928198@s.whatsapp.net", { text: "We are getting data from firebase..." })
    // Step 1: Define the button
    let button: proto.Message.ButtonsMessage.IButton = {
        buttonId: 'unique-button-id',
        buttonText: {
            displayText: 'Button Text'
        },
        type: 1 // The type of the button, e.g., response button
    };

    // Step 2: Construct a message content with the button
    let messageContent: AnyRegularMessageContent = {
        text: 'Your message text here',
        buttons: [button] // Add the button here
        // Other properties like contextInfo, mentions, etc., can be added as needed
    };

    // Step 4: Send the Message
    // Replace 'recipient-jid', messageContent, and options with actual values
    sock.sendMessage("5491156928198@s.whatsapp.net", messageContent)
        .then(response => {
            console.log('Message sent', response);
        })
        .catch(error => {
            console.error('Error sending message', error);
        });

    // sock.sendMessage("5491156928198@s.whatsapp.net", {
    //     poll: {
    //         name: "What is your favorite color?",
    //         values: [
    //             "Red",
    //             "Green",
    //             "Blue"
    //         ],
    //         // openEnded: false
    //     }
    // })
    // sock.sendMessage("5491156928198@s.whatsapp.net", { buttons: [{ buttonId: 'id1', buttonText: { displayText: 'Button 1' }, type: 1 }], footerText: 'Hello World!', templateButtons: [{ index: 1, urlButton: { displayText: 'Link Button', url: 'https://google.com' } }], type: 'buttons' })

    // sock.sendMessage("5491156928198@s.whatsapp.net", { image: { url: "src/media/img.jpg" } });

    res.sendStatus(200);
});

const PORT = 3000;
app.listen(PORT, () => {
    return console.log(`Server running on port ${PORT}`);
});
initBot().then((result) => console.log("Bot initiated"))

// startSock().catch((err: any) => console.error('Error in WhatsApp bot:', err));
