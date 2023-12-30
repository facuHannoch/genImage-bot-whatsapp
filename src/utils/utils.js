"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.doSingleTextInference = exports.unsubscribeUser = exports.subscribeUser = exports.distributeBatchInferences = exports.putUserInferencesOnPool = exports.checkUserIsSubscribed = void 0;
const axios_1 = __importDefault(require("axios"));
const admin = __importStar(require("firebase-admin"));
const form_data_1 = __importDefault(require("form-data"));
const google_auth_library_1 = require("google-auth-library");
/** Checks whether a certain user exists or not in the Firebase Firestore db, and if it has the attribute subscribe to other than 'free' or 'unsubscribed' (returns false if the attribute is set to 'free' or 'unsubscribed') */
const checkUserIsSubscribed = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const userDoc = yield getUserFromPhoneNumber(user);
    if (!userDoc)
        return false;
    const data = userDoc.data();
    console.log(data);
    if (!(data === null || data === void 0 ? void 0 : data.subscription))
        return false;
    return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed';
    const userRef = global.db.collection("users").doc(user);
    return yield userRef.get().then((res) => {
        console.log(res.data());
        if (!res.exists) {
            return false;
        }
        const data = res.data();
        console.log(data);
        return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed';
    }, (error) => {
        console.log(error);
        return false;
    });
});
exports.checkUserIsSubscribed = checkUserIsSubscribed;
/** Checks whether a certain user exists or not in the Firebase Firestore db, and if it has the attribute subscribe to other than 'free' or 'unsubscribed' (returns false if the attribute is set to 'free' or 'unsubscribed') */
const checkUserCanInfere = (user) => __awaiter(void 0, void 0, void 0, function* () {
    return true;
    const userDoc = yield getUserFromPhoneNumber(user);
    if (!userDoc)
        return false;
    const data = userDoc.data();
    return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed' && data.inferencesRemaining > 0;
});
/**
 * Makes a post request to a firebase function, which returns the image inferred. If successfull, adds 1 to the 'countImagesGenerated' attribute of the user collection (only modifies the document that has the attribute phoneNumber set as 3343) with that same phone number on Firebase Firestore
 * @param user
 * @param prompt
 */
const doSingleTextInference = (user, prompt) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const credentialFilename = "./serviceAccountKey.json";
        //     const scopes = ["https://www.googleapis.com/auth/cloud-platform"];
        //     const auth = new google.Auth.JWT({ keyFile: credentialFilename, scopes: scopes });
        // const drive = google.drive({ version: "v3", auth });
        // const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
        // const token = (await admin.credential.cert(credentialFilename).getAccessToken())
        const accessToken = yield getAccessToken();
        const headers = {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        };
        // Make the POST request to the Firebase Cloud Function
        const url = 'https://makeindividualtextprompt-qbnmku2fiq-uc.a.run.app';
        console.log(prompt);
        const inferenceResponse = yield axios_1.default.post(url, {
            prompt: prompt
        }, {
            headers: headers // Headers should be here
        });
        const content = yield inferenceResponse.data;
        // const content = await inferenceResponse.json(); // inferenceResponse.data
        // Check if the response is successful and contains the image data
        if (inferenceResponse.status === 200 && content) {
            // Construct the query to find the user document with the matching phone number
            const usersRef = global.db.collection('users');
            const snapshot = yield usersRef.where('phoneNumber', '==', extractPhoneNumber(user)).get();
            if (!snapshot.empty) {
                // Assuming there's only one user with that phone number
                const userDocument = snapshot.docs[0];
                // Update the countImagesGenerated field
                yield userDocument.ref.update({
                    countImagesGenerated: admin.firestore.FieldValue.increment(1)
                });
                console.log('Updated user document successfully.');
            }
            else {
                console.log('No user found with the given phone number.');
            }
            const response = content;
            yield triggerWebhookForSingleInference({ user, prompt, image: response.predictions[0] });
        }
        else {
            console.log(inferenceResponse.status);
            console.log('Inference was not successful or the image data is missing.');
        }
    }
    catch (error) {
        console.error('An error occurred during the inference or Firestore update:', error);
    }
});
exports.doSingleTextInference = doSingleTextInference;
// const response = await fetch('https://us-central1-gen-image-1da8b.cloudfunctions.net/doSingleTextInference', {
//     method: 'POST',
//     headers: {
//         'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({ user, prompt })
// });
// const data = await response.json();
// if (data.success) {
//     const userRef = global.db.collection("users").doc(user);
//     await userRef.update({ countImagesGenerated: admin.firestore.FieldValue.increment(1) });
// }
// return data;
/**
 * Put the user inference, along with the phone number data into the Firebase Realtime Database, to be batch processed later along with other inference requests
 * @param user
 * @param prompt
 */
const putUserInferencesOnPool = (user, prompt) => __awaiter(void 0, void 0, void 0, function* () {
    const timestamp = Date.now();
    const userRef = global.database.ref('inferences/pool').push();
    yield userRef.set({
        user,
        prompt,
        timestamp
    });
});
exports.putUserInferencesOnPool = putUserInferencesOnPool;
/**
 * takes a list of inferences and sends a message to every user, sending the corresponding ai generated image
 * @param listInferences
 * @param sendMessageFunction receives a callback function to send the message
 */
const distributeBatchInferences = (listInferences, sendMessageFunction) => {
    listInferences.forEach((inference) => {
        const { user, prompt, image } = inference;
        sendMessageFunction(user, { image: { url: image } });
    });
};
exports.distributeBatchInferences = distributeBatchInferences;
/**
 * Adds the user details to the Firebase Firestore db, and sets the 'subscription' attribute to 'bot-trial'
 * @param user
 */
const subscribeUser = (user, subscriptionType) => __awaiter(void 0, void 0, void 0, function* () {
    const userRef = global.db.collection("users").doc();
    yield userRef.set({ phoneNumber: extractPhoneNumber(user), subscription: subscriptionType }, { merge: true });
});
exports.subscribeUser = subscribeUser;
/**
 * Modifies the specific user details, changing the 'subscription' attribute to 'unsubscribed'
 * @param user
 */
const unsubscribeUser = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const userDoc = yield getUserFromPhoneNumber(user);
    if (!userDoc)
        return;
    // Update the subscription status of the found user
    yield userDoc.ref.set({ subscription: 'unsubscribed' }, { merge: true });
});
exports.unsubscribeUser = unsubscribeUser;
// obtains from Firestore
function getUserFromPhoneNumber(phoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const userRef = global.db.collection("users");
        // Query to find the user with the specified wpNumber
        const querySnapshot = yield userRef.where("phoneNumber", "==", extractPhoneNumber(phoneNumber)).get();
        if (querySnapshot.empty) {
            console.log('No matching documents.');
            return;
        }
        // Assuming there's only one user with this wpNumber
        const userDoc = querySnapshot.docs[0];
        return userDoc;
    });
}
function extractPhoneNumber(fullNumber) {
    const parts = fullNumber.split('@');
    return parts[0];
}
// @s.whatsapp.net
const triggerWebhookForSingleInference = (inference) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Construct the payload
        const formData = new form_data_1.default();
        formData.append('inferences', JSON.stringify([inference]));
        // Add your image file to the form data if needed
        // formData.append('image', imageBuffer, 'image.jpg');
        const response = yield axios_1.default.post('http://localhost:3000/batch-processing-done', formData, {
            headers: formData.getHeaders(),
        });
        console.log('Webhook triggered successfully:', response.status);
    }
    catch (error) {
        console.error('Error triggering webhook:', error);
    }
});
function getAccessToken() {
    return __awaiter(this, void 0, void 0, function* () {
        const auth = new google_auth_library_1.GoogleAuth({
            keyFilename: './gen-image-1da8b-1c7ec3e2c812.json',
            scopes: 'https://www.googleapis.com/auth/cloud-platform',
        });
        const accessToken = yield auth.getAccessToken();
        return accessToken;
    });
}
