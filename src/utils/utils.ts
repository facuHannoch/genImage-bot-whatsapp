// import { getFirestore, doc, getDoc, updateDoc, setDoc, Firestore } from "firebase/firestore";
// import { getDatabase, ref, push, Database } from "firebase/database";
import { MiscMessageGenerationOptions, AnyMessageContent, proto } from '@whiskeysockets/baileys';
import axios from 'axios';
import * as admin from 'firebase-admin';
import FormData from 'form-data'

// const db = getFirestore();
// const database = getDatabase();

type SendMessage = (jid: string, content: AnyMessageContent, options?: MiscMessageGenerationOptions) => Promise<proto.WebMessageInfo>
type User = string
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
    console.log(data)

    if (!data?.subscription) return false;
    return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed';


    const userRef = global.db.collection("users").doc(user);
    return await userRef.get().then((res) => {
        console.log(res.data())
        if (!res.exists) {
            return false;
        }
        const data = res.data();
        console.log(data)
        return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed';
    }, (error) => {
        console.log(error)
        return false
    });
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
const doSingleTextInference = async (user: User, prompt: String) => {
    try {
        // Make the POST request to the Firebase Cloud Function
        const url: string = 'http://127.0.0.1:5001/gen-image-1da8b/us-central1/makeIndividualTextPrompt'
        const inferenceResponse = await axios.post(url, {
            prompt: prompt,
        });

        // Check if the response is successful and contains the image data
        if (inferenceResponse.status === 200 && inferenceResponse.data) {
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
            const response: VertexAIResponse = inferenceResponse.data

            await triggerWebhookForSingleInference({ user, prompt, image: response.predictions[0] })
        } else {
            console.log('Inference was not successful or the image data is missing.');
        }
    } catch (error) {
        console.error('An error occurred during the inference or Firestore update:', error);
    }

}

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
 * @param user 
 */
const unsubscribeUser = async (user: User) => {
    const userDoc = await getUserFromPhoneNumber(user);
    if (!userDoc) return;

    // Update the subscription status of the found user
    await userDoc.ref.set({ subscription: 'unsubscribed' }, { merge: true });
}

export { checkUserIsSubscribed, putUserInferencesOnPool, distributeBatchInferences, subscribeUser, unsubscribeUser, doSingleTextInference }

// obtains from Firestore
async function getUserFromPhoneNumber(phoneNumber: string) {
    const userRef = global.db.collection("users");

    // Query to find the user with the specified wpNumber
    const querySnapshot = await userRef.where("phoneNumber", "==", extractPhoneNumber(phoneNumber)).get();

    if (querySnapshot.empty) {
        console.log('No matching documents.');
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


const triggerWebhookForSingleInference = async (inference) => {
    try {
        // Construct the payload
        const formData = new FormData();
        formData.append('inferences', JSON.stringify([inference]));

        // Add your image file to the form data if needed
        // formData.append('image', imageBuffer, 'image.jpg');

        const response = await axios.post('http://localhost:3000/batch-processing-done', formData, {
            headers: formData.getHeaders(),
        });

        console.log('Webhook triggered successfully:', response.status);
    } catch (error) {
        console.error('Error triggering webhook:', error);
    }
};
