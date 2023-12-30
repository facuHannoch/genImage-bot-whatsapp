// import { getFirestore, doc, getDoc, updateDoc, setDoc, Firestore } from "firebase/firestore";
// import { getDatabase, ref, push, Database } from "firebase/database";
import { MiscMessageGenerationOptions, AnyMessageContent, proto } from '@whiskeysockets/baileys';

// const db = getFirestore();
// const database = getDatabase();

type SendMessage = (jid: string, content: AnyMessageContent, options?: MiscMessageGenerationOptions) => Promise<proto.WebMessageInfo>
type User = string
export interface Inference {
    user: User,
    prompt: string,
    image: string,
}
/** Checks whether a certain user exists or not in the Firebase Firestore db, and if it has the attribute subscribe to other than 'free' or 'unsubscribed' (returns false if the attribute is set to 'free' or 'unsubscribed') */
const checkUserIsSubscribed = async (user: User): Promise<boolean> => {
    const userRef = global.db.collection("users").doc(user);
    const doc = await userRef.get();
    if (!doc.exists) {
        return false;
    }
    const data = doc.data();
    return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed';
}

/** Checks whether a certain user exists or not in the Firebase Firestore db, and if it has the attribute subscribe to other than 'free' or 'unsubscribed' (returns false if the attribute is set to 'free' or 'unsubscribed') */
const checkUserCanInfere = async (user: User): Promise<boolean> => {
    const userRef = global.db.collection("users").doc(user);
    const doc = await userRef.get();
    if (!doc.exists) {
        return false;
    }
    const data = doc.data();
    return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed';
}

/**
 * Put the user inference, along with the phone number data into the Firebase Realtime Database, to be batch processed later along with other inference requests
 * @param user 
 * @param prompt 
 */
const putUserInferencesOnPool = async (user: User, prompt: string) => {
    const userRef = global.database.ref('inferences/pool').push();
    await userRef.set({
        user,
        prompt,
    });
    // const userRef = ref(global.database, 'inferences/pool');
    // await push(userRef, {
    //     user,
    //     prompt,
    // });
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
const subscribeUser = async (user: User) => {
    const userRef = global.db.collection("users").doc(user);
    await userRef.set({ subscription: 'bot-trial' }, { merge: true });
}
/**
 * Modifies the specific user details, changing the 'subscription' attribute to 'unsubscribed'
 * @param user 
 */
const unsubscribeUser = async (user: User) => {
    const userRef = global.db.collection("users").doc(user);
    await userRef.set({ subscription: 'unsubscribed' }, { merge: true });
    
}

export { checkUserIsSubscribed, putUserInferencesOnPool, distributeBatchInferences, subscribeUser, unsubscribeUser }
