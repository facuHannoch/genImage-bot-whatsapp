"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const startBot_1 = __importDefault(require("./src/startBot"));
const app_1 = require("firebase/app");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
let sock = null;
const initBot = () => __awaiter(void 0, void 0, void 0, function* () {
    (0, startBot_1.default)().then((sockInitiated) => sock = sockInitiated);
    return 0;
});
// Firebase Condfig
const firebase_admin_1 = __importDefault(require("firebase-admin"));
var serviceAccount = require("./serviceAccountKey.json");
const firebaseConfig = {
    projectId: 'gen-image-1da8b',
};
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.cert(serviceAccount),
    databaseURL: "https://gen-image-1da8b-default-rtdb.firebaseio.com"
});
global.firebaseApp = (0, app_1.initializeApp)(firebaseConfig);
const db = firebase_admin_1.default.firestore();
const database = firebase_admin_1.default.database();
global.db = db;
global.database = database;
// 
// Configure multer with memory storage
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage: storage });
const app = (0, express_1.default)();
app.use(express_1.default.json());
const writeFileAsync = (0, util_1.promisify)(fs_1.default.writeFile);
const unlinkAsync = (0, util_1.promisify)(fs_1.default.unlink);
app.post('/batch-processing-done', upload.single('image'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const inferences = JSON.parse(req.body.inferences);
        console.log('List of inferences:', inferences);
        for (const inference of inferences) {
            const buffer = Buffer.from(inference.image, 'base64');
            const filename = path_1.default.join(__dirname, `tempImage-${Date.now()}.jpg`); // Unique filename for each image
            yield writeFileAsync(filename, buffer);
            // Send a text message
            yield sock.sendMessage(inference.user, { text: "Your image has been processed!" });
            // Send the image
            // Replace with the actual method to send an image via your WhatsApp API
            yield sock.sendMessage(inference.user, { image: { url: filename } });
            // Optionally delete the image file after sending
            yield unlinkAsync(filename);
        }
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
}));
// app.post('/batch-processing-done', upload.single('image'), async (req: Request, res: Response) => {
//     const inferences: Inference[] = JSON.parse(req.body.inferences);
//     fs.writeFile(filename, buffer, (err) => {
//         if (err) reject(err);
//         else resolve(filename);
//     });
//     // here we get a list of Inference, and send the image that corresponds to each user. The data comes in base64 formar
//     // const listInferences: Inference[] = data.inferences;
//     console.log('List of inferences:', inferences);
//     inferences?.forEach((inference: Inference) => {
//         fs.writeFile(filename, buffer, (err) => {
//             if (err) reject(err);
//             else resolve(filename);
//         });
//         sock.sendMessage(inference.user, { text: "Your image has been processed!" })
//         sock.sendMessage(inference.user, { image: { buffer: Buffer.from(inference.image, 'base64') } })
//     })
//     res.sendStatus(200);
// })
// Webhook endpoint
app.post('/firebase-update', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = req.body;
    console.log('Received data from Firebase:', data);
    // Process the data...
    const s = {
        buttonId: "A button",
        buttonText: {
            displayText: "A nice button"
        },
    };
    sock.sendMessage("5491156928198@s.whatsapp.net", { text: "We are getting data from firebase..." });
    // Step 1: Define the button
    let button = {
        buttonId: 'unique-button-id',
        buttonText: {
            displayText: 'Button Text'
        },
        type: 1 // The type of the button, e.g., response button
    };
    // Step 2: Construct a message content with the button
    let messageContent = {
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
}));
const PORT = 3000;
app.listen(PORT, () => {
    return console.log(`Server running on port ${PORT}`);
});
initBot().then((result) => console.log("Bot initiated"));
// startSock().catch((err: any) => console.error('Error in WhatsApp bot:', err));
