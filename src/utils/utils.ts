import { MiscMessageGenerationOptions, AnyMessageContent, proto } from '@whiskeysockets/baileys';
import axios from 'axios';
import * as admin from 'firebase-admin';
import FormData from 'form-data'
import { GoogleAuth } from 'google-auth-library';
import { extractPhoneNumber, getUserFromPhoneNumber } from './user';

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

function maxImgPerPeriod(subscription): number {
    switch (subscription) {
        case 'free-trial':
            return 3
        case 'bot-trial':
            return 300
        case 'bot-full':
            return 800
    }
}

interface subscriptionExceededMsg {
    msg: string,
    subscription?: string,
}
/** Checks whether a certain user exists or not in the Firebase Firestore db, and if it has the attribute subscribe to other than 'free' or 'unsubscribed' (returns false if the attribute is set to 'free' or 'unsubscribed') */
const checkUserCanInfere = async (user: User): Promise<subscriptionExceededMsg> => {
    const userDoc = await getUserFromPhoneNumber(user);
    if (!userDoc) return { msg: "no user" };
    const data = userDoc.data();

    if (!data?.subscription) return { msg: "no subscription" };
    if (data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed') {
        if (data.thisPeriodCountInferences >= maxImgPerPeriod(data.subscription)) { // TODO
            return { msg: "inferences number exceeded", subscription: data.subscription };
        } else if (false) {
            // Add logic to check whether user has the subscription up to date
        }
    }
    return { msg: "", subscription: data.subscription }
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

        const url: string = process.env.GCF_URL_MAKE_INDIVIDUAL_TEXT_PROMPT
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
                    countImagesGenerated: admin.firestore.FieldValue.increment(1),
                    thisPeriodCountInferences: admin.firestore.FieldValue.increment(1)
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

export { putUserInferencesOnPool, distributeBatchInferences, doSingleTextInference, triggerWebhookForSingleInference, checkUserCanInfere }


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