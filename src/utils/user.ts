import { User } from "./inferences";

/**
 * Adds the user details to the Firebase Firestore db, and sets the 'subscription' attribute to 'bot-trial'
 * @param user 
 */
export const subscribeUser = async (user: User, subscriptionType: string) => {
    const userRef = global.db.collection("users").doc();
    await userRef.set({
        phoneNumber: extractPhoneNumber(user),
        subscription: subscriptionType,
        thisPeriodCountInferences: 0,
    }, { merge: true });
}
/**
 * Modifies the specific user details, changing the 'subscription' attribute to 'unsubscribed'
 * Should keep the rest of the subscription period, until next billing
 * @param user 
 */
export const unsubscribeUser = async (user: User) => {
    const userDoc = await getUserFromPhoneNumber(user);
    if (!userDoc) return;

    // Update the subscription status of the found user
    await userDoc.ref.set({ subscription: 'unsubscribed' }, { merge: true });
}

/** Checks whether a certain user exists or not in the Firebase Firestore db, and if it has the attribute subscribe to other than 'free' or 'unsubscribed' (returns false if the attribute is set to 'free' or 'unsubscribed') */
export const checkUserIsSubscribed = async (user: User): Promise<boolean> => {
    const userDoc = await getUserFromPhoneNumber(user);
    if (!userDoc) return false;
    const data = userDoc.data();

    if (!data?.subscription) return false;
    return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed';
}


// obtains from Firestore
export async function getUserFromPhoneNumber(userId: string) {
    const userRef = global.db.collection("users");

    // Query to find the user with the specified wpNumber
    const querySnapshot = await userRef.where("phoneNumber", "==", extractPhoneNumber(userId)).get();

    if (querySnapshot.empty) {
        global.logger.warn('No matching documents.');
        return;
    }

    // Assuming there's only one user with this wpNumber
    const userDoc = querySnapshot.docs[0];
    return userDoc;
}

export function extractPhoneNumber(fullNumber) {
    const parts = fullNumber.split('@');
    return parts[0];
}
// @s.whatsapp.net

