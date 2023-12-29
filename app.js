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
const firestore_1 = require("firebase/firestore");
const database_1 = require("firebase/database");
const firebaseConfig = {
    projectId: 'gen-image-1da8b'
};
let sock = null;
const initBot = () => __awaiter(void 0, void 0, void 0, function* () {
    (0, startBot_1.default)().then((sockInitiated) => sock = sockInitiated);
    return 0;
});
global.firebaseApp = (0, app_1.initializeApp)(firebaseConfig);
global.db = (0, firestore_1.getFirestore)(global.firebaseApp);
global.database = (0, database_1.getDatabase)(global.firebaseApp);
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Webhook endpoint
app.post('/firebase-update', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = req.body;
    console.log('Received data from Firebase:', data);
    // Process the data...
    sock.sendMessage("5491156928198@s.whatsapp.net", { text: "We are getting data from firebase..." });
    res.sendStatus(200);
}));
const PORT = 3000;
app.listen(PORT, () => {
    return console.log(`Server running on port ${PORT}`);
});
initBot().then((result) => console.log("Bot initiated"));
// startSock().catch((err: any) => console.error('Error in WhatsApp bot:', err));
