import { AnyMessageContent, WASocket, proto } from '@whiskeysockets/baileys';
import { User, checkUserCanInfere, checkUserIsSubscribed, doSingleTextInference, putUserInferencesOnPool, triggerWebhookForSingleInference, unsubscribeUser } from '../utils/utils';
import { verifyTransactionAndUpdateUser } from '../utils/payments';
global.aboutToUnsub = false;

interface UserState {
    aboutToSubscribe?: boolean,
    aboutToUnsubscribe?: boolean,
    subscription?: string,
    subscribed: boolean,
}
const requestQueue = new Map();
const userStates = new Map<User, UserState>();

const processRequest = async (userId: string, requestData: string, socket: WASocket) => {
    if (requestQueue.has(userId)) {
        await socket.sendMessage(userId, { text: "Espera! se está haciendo tu imagen anterior" });
        return;
    }
    requestQueue.set(userId, requestData);

    if (checkUserCanInfere(userId)) {
        // Start the inference process
        const inferencePromise = doSingleTextInference(userId, requestData);

        // Send the first message immediately
        await socket.sendMessage(userId, { text: "Generando imagen de " + requestData });

        // Wait for 3 seconds before sending the next message
        setTimeout(async () => {
            await socket.sendMessage(userId, { text: "Por favor espera un momento" });

            // Wait for the inference to complete and then trigger the webhook
            inferencePromise.then(async inference => {
                await triggerWebhookForSingleInference(inference);
            }).catch(async error => {
                console.error(error);
                await socket.sendMessage(userId, { text: "Disculpa, hubo un error" });
            }).finally(() => {
                // Remove the user from the queue after 4 seconds
                setTimeout(() => {
                    requestQueue.delete(userId);
                }, 3500);
            });

        }, 3000); // 3 seconds delay
    }
};



const handleConversation = async (socket: WASocket, msg: proto.IWebMessageInfo) => {
    const userId: string = msg.key.remoteJid
    const isSubscribed = await checkUserIsSubscribed(userId);
    let userState = userStates.get(userId) || { aboutToSubscribe: true, subscribed: isSubscribed }

    const text: string | undefined | null =
        msg.message.conversation !== ''
            ? msg.message.conversation
            : msg.message.extendedTextMessage?.text
    if (!text) {
        socket.sendMessage(userId, { text: "Por ahora sólo podemos convertir texto en imágenes" });
        return
    }
    if (userState.aboutToUnsubscribe) {
        if (text === "si") {
            // userStates.set(userId, { subscribed: true })
            unsubscribeUser(userId);
            socket.sendMessage(userId, { text: "Subscripción cancelada" });
            return;
        }
    } else if (!userState.subscribed) {
        const potentialTransactionIds = extractTransactionId(text)
        const result = await verifyTransactionAndUpdateUser(userId, potentialTransactionIds, 'bot-trial') // TODO: This part
        if (result === 0) {
            socket.sendMessage(userId, { text: "Felicidades! Ya puedes empezar a generar imágenes" })
            userStates.set(userId, { subscribed: true })
        }
    }
    userState = userStates.get(userId) || userState

    if (userState.subscribed) {
        if (text === "-unsubscribe") {
            userStates.set(userId, { aboutToUnsubscribe: true, subscribed: true })
            socket.sendMessage(userId, { text: "¿Quieres cancelar la subscripción?" });
        } else {
            // await putUserInferencesOnPool(userId, text);
            await processRequest(userId, text, socket)
        }
    } else {
        await socket.sendMessage(userId, { text: "Hola! parece que no estás subscripto" });
        // socket.sendMessage(userId, { image: { url: "src/media/img.jpg" } });
        await socket.sendMessage(userId, { text: "Ofrecemos un período de muy bajo costo, con el que puedes crear más de 500 imágenes libres de derechos de autor." });
        await socket.sendMessage(userId, { text: createPaymentLink(userId, 'bot-trial') });
        // await socket.sendMessage(userId, { text: "Si ya has hecho un pago, introduce el id de la transacción para que verifiquemos y empieces a generar" });
        userStates.set(userId, { aboutToSubscribe: true, subscribed: false })
    }
}

export default handleConversation

function extractTransactionId(msg): string[] | [] {
    const regex = /\b\d+\b/g; // Regular expression to match sequences of digits
    const matches = msg.match(regex);
    return matches || [];
}

function createPaymentLink(user: User, subscription: string) {
    const encodedPhone = Buffer.from(user).toString('base64');
    const doubleEncodedPhone = Buffer.from(encodedPhone).toString('base64');
    const url = `${process.env.PAYMENT_PAGE_URL}/index.html?p=${doubleEncodedPhone}`;

    return url
}