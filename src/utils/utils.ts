// import { getFirestore, doc, getDoc, updateDoc, setDoc, Firestore } from "firebase/firestore";
// import { getDatabase, ref, push, Database } from "firebase/database";
import { MiscMessageGenerationOptions, AnyMessageContent, proto } from '@whiskeysockets/baileys';
import axios from 'axios';
import * as admin from 'firebase-admin';
import FormData from 'form-data'
// import fs from 'fs'
import google from 'googleapis' // rm
import { GoogleAuth } from 'google-auth-library';
// const db = getFirestore();
// const database = getDatabase();

type SendMessage = (jid: string, content: AnyMessageContent, options?: MiscMessageGenerationOptions) => Promise<proto.WebMessageInfo>
export type User = string
export interface Inference {
    user: User,
    prompt: string,
    image: string,
}

interface VertexAIResponse {
    predictions: Array<string>,
    deployedModelId: string,
    model: string,
    modelDisplayName: string,
    modelVersionId: string
}

/** Checks whether a certain user exists or not in the Firebase Firestore db, and if it has the attribute subscribe to other than 'free' or 'unsubscribed' (returns false if the attribute is set to 'free' or 'unsubscribed') */
const checkUserIsSubscribed = async (user: User): Promise<boolean> => {
    const userDoc = await getUserFromPhoneNumber(user);
    if (!userDoc) return false;
    const data = userDoc.data();

    if (!data?.subscription) return false;
    return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed';
}

/** Checks whether a certain user exists or not in the Firebase Firestore db, and if it has the attribute subscribe to other than 'free' or 'unsubscribed' (returns false if the attribute is set to 'free' or 'unsubscribed') */
const checkUserCanInfere = async (user: User): Promise<boolean> => {
    return true;

    const userDoc = await getUserFromPhoneNumber(user);
    if (!userDoc) return false;
    const data = userDoc.data();
    return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed' && data.inferencesRemaining > 0;
}

/**
 * Makes a post request to a firebase function, which returns the image inferred. If successfull, adds 1 to the 'countImagesGenerated' attribute of the user collection (only modifies the document that has the attribute phoneNumber set as 3343) with that same phone number on Firebase Firestore
 * @param user 
 * @param prompt 
 */
const doSingleTextInference = async (user: User, prompt: string): Promise<Inference> => {
    try {
        // const credentialFilename = "./serviceAccountKey.json";
        //     const scopes = ["https://www.googleapis.com/auth/cloud-platform"];

        //     const auth = new google.Auth.JWT({ keyFile: credentialFilename, scopes: scopes });
        // const drive = google.drive({ version: "v3", auth });

        // const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
        // const token = (await admin.credential.cert(credentialFilename).getAccessToken())
        const accessToken = await getAccessToken();

        const headers = {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        }

        // Make the POST request to the Firebase Cloud Function
        const url: string = 'https://makeindividualtextprompt-qbnmku2fiq-uc.a.run.app'
        const inferenceResponse = await axios.post(url, {
            prompt: prompt
        }, {
            headers: headers  // Headers should be here
        });
        const content = await inferenceResponse.data
        // const content = await inferenceResponse.json(); // inferenceResponse.data
        // Check if the response is successful and contains the image data
        if (inferenceResponse.status === 200 && content) {
            // Construct the query to find the user document with the matching phone number
            const usersRef = global.db.collection('users');
            const snapshot = await usersRef.where('phoneNumber', '==', extractPhoneNumber(user)).get();

            if (!snapshot.empty) {
                // Assuming there's only one user with that phone number
                const userDocument = snapshot.docs[0];

                // Update the countImagesGenerated field
                await userDocument.ref.update({
                    countImagesGenerated: admin.firestore.FieldValue.increment(1)
                });

                console.log('Updated user document successfully.');
            } else {
                console.log('No user found with the given phone number.');
            }
            const response: VertexAIResponse = content
            return { user, prompt, image: response.predictions[0] }
        } else {
            global.logger.error('Inference was not successful or the image data is missing.');
        }
    } catch (error) {
        global.logger.error('An error occurred during the inference or Firestore update:', error);
    }
}

/**
 * Put the user inference, along with the phone number data into the Firebase Realtime Database, to be batch processed later along with other inference requests
 * @param user 
 * @param prompt 
 */
const putUserInferencesOnPool = async (user: User, prompt: string) => {
    const timestamp = Date.now()
    const userRef = global.database.ref('inferences/pool').push();
    await userRef.set({
        user,
        prompt,
        timestamp
    });
}

/**
 * takes a list of inferences and sends a message to every user, sending the corresponding ai generated image
 * @param listInferences 
 * @param sendMessageFunction receives a callback function to send the message
 */
const distributeBatchInferences = (listInferences: Inference[], sendMessageFunction: SendMessage) => {
    listInferences.forEach((inference) => {
        const { user, prompt, image } = inference
        sendMessageFunction(user, { image: { url: image } })
    })
}
/**
 * Adds the user details to the Firebase Firestore db, and sets the 'subscription' attribute to 'bot-trial'
 * @param user 
 */
const subscribeUser = async (user: User, subscriptionType: string) => {
    const userRef = global.db.collection("users").doc();
    await userRef.set({ phoneNumber: extractPhoneNumber(user), subscription: subscriptionType }, { merge: true });
}
/**
 * Modifies the specific user details, changing the 'subscription' attribute to 'unsubscribed'
 * Should keep the rest of the subscription period, until next billing
 * @param user 
 */
const unsubscribeUser = async (user: User) => {
    const userDoc = await getUserFromPhoneNumber(user);
    if (!userDoc) return;

    // Update the subscription status of the found user
    await userDoc.ref.set({ subscription: 'unsubscribed' }, { merge: true });
}

export { checkUserIsSubscribed, putUserInferencesOnPool, distributeBatchInferences, subscribeUser, unsubscribeUser, doSingleTextInference, triggerWebhookForSingleInference, getUserFromPhoneNumber, checkUserCanInfere }

// obtains from Firestore
async function getUserFromPhoneNumber(phoneNumber: string) {
    const userRef = global.db.collection("users");

    // Query to find the user with the specified wpNumber
    const querySnapshot = await userRef.where("phoneNumber", "==", extractPhoneNumber(phoneNumber)).get();

    if (querySnapshot.empty) {
        global.logger.warn('No matching documents.');
        return;
    }

    // Assuming there's only one user with this wpNumber
    const userDoc = querySnapshot.docs[0];
    return userDoc;
}

function extractPhoneNumber(fullNumber) {
    const parts = fullNumber.split('@');
    return parts[0];
}
// @s.whatsapp.net


const triggerWebhookForSingleInference = async (inference: Inference) => {
    try {
        // Construct the payload
        const formData = new FormData();
        formData.append('inferences', JSON.stringify([inference]));

        axios.post('http://localhost:3000/batch-processing-done', formData)
            .then(response => console.log('Webhook triggered successfully:', response.status))
            .catch(error => console.error('Error triggering webhook:', error));
    } catch (error) {
        global.logger.warn('Error triggering webhook:', error);
    }
};

async function getAccessToken() {
    const auth = new GoogleAuth({
        keyFilename: './serviceAccountKey.json',
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });

    const accessToken = await auth.getAccessToken();
    return accessToken;
}

// function sendSingleImage() {

//     try {
//         const inferences = JSON.parse(req.body.inferences);
//         // console.log('List of inferences:', inferences);

//         for (const inference of inferences) {
//             const buffer = Buffer.from(inference.image, 'base64');
//             const filename = path.join(__dirname, `tempImage-${Date.now()}.jpg`); // Unique filename for each image

//             await writeFileAsync(filename, buffer);

//             sock.sendMessage(inference.user, { image: { url: filename } });
//             // sock.sendMessage(inference.user, { sticker: { url: filename } });
//             await sock.sendMessage(inference.user, { text: "Tu imagen ha sido procesada!" });

//             // Optionally delete the image file after sending
//             await unlinkAsync(filename);
//         }
//     } catch (error) {
//         global.logger.error('Error:', error);
//     }
// }