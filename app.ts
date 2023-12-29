import express, { Request, Response } from 'express';
import axios from 'axios';
import startSock from './src/startBot';
import { WASocket } from '@whiskeysockets/baileys';
import { FirebaseOptions, initializeApp } from "firebase/app";

import { getFirestore, doc, getDoc, updateDoc, setDoc, Firestore } from "firebase/firestore";
import { getDatabase, ref, push, Database } from "firebase/database";


const firebaseConfig: FirebaseOptions = {
    projectId: 'gen-image-1da8b'
};

let sock: WASocket | null = null;

const initBot = async () => {
    startSock().then((sockInitiated) => sock = sockInitiated)
    return 0;
}
global.firebaseApp = initializeApp(firebaseConfig);
global.db = getFirestore(global.firebaseApp);
global.database = getDatabase(global.firebaseApp);

const app = express();
app.use(express.json());

// Webhook endpoint
app.post('/firebase-update', async (req: Request, res: Response) => {
    const data = req.body;
    console.log('Received data from Firebase:', data);
    // Process the data...
    sock.sendMessage("5491156928198@s.whatsapp.net", { text: "We are getting data from firebase..." })
    res.sendStatus(200);
});

const PORT = 3000;
app.listen(PORT, () => {
    return console.log(`Server running on port ${PORT}`);
});
initBot().then((result) => console.log("Bot initiated"))

// startSock().catch((err: any) => console.error('Error in WhatsApp bot:', err));
