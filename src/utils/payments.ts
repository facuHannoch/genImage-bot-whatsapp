import { subscribeUser } from "./user";
import { User } from "./utils";

const verifyTransactionAndUpdateUser = async (user: User, transactionIds: string[], subscription: string) => {
    let transactionFound = false;

    for (const transactionId of transactionIds) {
        const transactionDocRef = global.db.collection('transactions').doc(transactionId);
        const transactionDoc = await transactionDocRef.get();

        if (transactionDoc.exists && transactionDoc.data().status === 'pending') {
            transactionFound = true;
            await transactionDocRef.update({ status: 'completed', userId: user, path: 'add' });
            break; // Exit the loop if a valid transaction is found
        }
    }

    if (!transactionFound) {
        return -1; // Transaction not found
    } else {
        await subscribeUser(user, subscription);
        return 0; // User subscription updated
    }
};

export { verifyTransactionAndUpdateUser };
