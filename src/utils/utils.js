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
Object.defineProperty(exports, "__esModule", { value: true });
exports.unsubscribeUser = exports.subscribeUser = exports.distributeBatchInferences = exports.putUserInferencesOnPool = exports.checkUserIsSubscribed = void 0;
/** Checks whether a certain user exists or not in the Firebase Firestore db, and if it has the attribute subscribe to other than 'free' or 'unsubscribed' (returns false if the attribute is set to 'free' or 'unsubscribed') */
const checkUserIsSubscribed = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const userRef = global.db.collection("users").doc(user);
    const doc = yield userRef.get();
    if (!doc.exists) {
        return false;
    }
    const data = doc.data();
    return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed';
});
exports.checkUserIsSubscribed = checkUserIsSubscribed;
/** Checks whether a certain user exists or not in the Firebase Firestore db, and if it has the attribute subscribe to other than 'free' or 'unsubscribed' (returns false if the attribute is set to 'free' or 'unsubscribed') */
const checkUserCanInfere = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const userRef = global.db.collection("users").doc(user);
    const doc = yield userRef.get();
    if (!doc.exists) {
        return false;
    }
    const data = doc.data();
    return data.subscription && data.subscription !== 'free' && data.subscription !== 'unsubscribed';
});
/**
 * Put the user inference, along with the phone number data into the Firebase Realtime Database, to be batch processed later along with other inference requests
 * @param user
 * @param prompt
 */
const putUserInferencesOnPool = (user, prompt) => __awaiter(void 0, void 0, void 0, function* () {
    const userRef = global.database.ref('inferences/pool').push();
    yield userRef.set({
        user,
        prompt,
    });
    // const userRef = ref(global.database, 'inferences/pool');
    // await push(userRef, {
    //     user,
    //     prompt,
    // });
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
const subscribeUser = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const userRef = global.db.collection("users").doc(user);
    yield userRef.set({ subscription: 'bot-trial' }, { merge: true });
});
exports.subscribeUser = subscribeUser;
/**
 * Modifies the specific user details, changing the 'subscription' attribute to 'unsubscribed'
 * @param user
 */
const unsubscribeUser = (user) => __awaiter(void 0, void 0, void 0, function* () {
    const userRef = global.db.collection("users").doc(user);
    yield userRef.set({ subscription: 'unsubscribed' }, { merge: true });
});
exports.unsubscribeUser = unsubscribeUser;
