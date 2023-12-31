import { User, getUserFromPhoneNumber, subscribeUser } from "./utils";

const verifyTransactionAndUpdateUser = async (user: User, transactionIds: string[], subscription: string) => {
    let transactionFound = false;

    for (const transactionId of transactionIds) {
        const transactionDoc = global.db.collection('transactions').doc(transactionId);
        
        if ((await transactionDoc.get()).exists) {
            transactionFound = true;
            await transactionDoc.set({status: 'completed', userId: user, 'path': 'add'})
            // await global.db.collection('transactions').doc(transactionId).delete();
            break; // Exit the loop if a valid transaction is found
        }
    }

    if (!transactionFound) {
        return -1
        // return 'Transaction not found';
    }

    await subscribeUser(user, subscription)
    
    // Update user's subscription status
    /* const userDoc = await getUserFromPhoneNumber(user);
    if (!userDoc) return 2; // 'User not found';
    await userDoc.set({ subscription }, { merge: true }); */

    return 0;
    // return 'User subscription updated';
};

export { verifyTransactionAndUpdateUser }