import { AnyMessageContent, WASocket, proto } from '@whiskeysockets/baileys';
import { User, checkUserCanInfere, doSingleTextInference, putUserInferencesOnPool, triggerWebhookForSingleInference } from '../utils/inferences';
import { checkUserIsSubscribed, extractPhoneNumber, subscribeUser, unsubscribeUser } from '../utils/user'
import { verifyTransactionAndUpdateUser } from '../utils/payments';
global.aboutToUnsub = false;

interface UserState {
    aboutToSubscribe?: boolean,
    aboutToUnsubscribe?: boolean,
    subscription: string,
    subscribed?: boolean,
    onTrial?: number,
}
const requestQueue = new Map();
const userStates = new Map<User, UserState>();

const processRequest = async (userId: string, requestData: string, socket: WASocket) => {
    if (requestQueue.has(userId)) {
        await socket.sendMessage(userId, { text: "Espera! se está haciendo tu imagen anterior" });
        return;
    }
    requestQueue.set(userId, requestData);

    const canInfere = await checkUserCanInfere(userId)
    if (canInfere.msg == '') {
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
                // if (inference) {
                // } else {
                //     await socket.sendMessage(userId, { text: "Disculpa, no se pude generar tu imagen" })
                // }
            }).catch(async error => {
                console.error(error);
                await socket.sendMessage(userId, { text: "Disculpa, hubo un error" });
            }).finally(() => {
                // Remove the user from the queue after 4 seconds
                setTimeout(() => {
                    requestQueue.delete(userId);
                }, 3500);
            });
        }, 2000); // 2 seconds delay
    } else {
        switch (canInfere.msg) {
            case 'inferences number exceeded':
                if (canInfere.subscription != 'bot-full') {
                    socket.sendMessage(userId, { text: "Has alcanzado el límite de imágenes para tu subscripción" })
                }
                break;
            case 'no user':
                break;
            // case 'no subscription':
            //     // socket.sendMessage(userId, { text: "Has alcanzado el límite de imágenes creadas por este período" })
            //     break;
        }
        requestQueue.delete(userId);
    }
};
async function makeTestInference(userId: string, requestData: string, socket: WASocket) {
    const inferencePromise = doSingleTextInference(userId, requestData);
    await socket.sendMessage(userId, { text: "Generando imagen de " + requestData });

    await inferencePromise.then(async inference => {
        await triggerWebhookForSingleInference(inference);
    }).catch(async error => {
        console.error(error);
        await socket.sendMessage(userId, { text: "Disculpa, hubo un error" });
    })
}



const handleConversation = async (socket: WASocket, msg: proto.IWebMessageInfo) => {
    const userId: string = msg.key.remoteJid
    const subscription: string = await checkUserIsSubscribed(userId);
    let userState = {
        ...userStates.get(userId),
        subscription,
        // subscribed: subscription
    }
    const text: string | undefined | null =
        msg.message.conversation !== ''
            ? msg.message.conversation
            : msg.message.extendedTextMessage?.text

    console.log("userState")
    console.log(userState)
    console.log("userState")


    if (userState.onTrial > 0 || userState.subscription === 'free-trial') {
        if (!text) {
            // socket.sendMessage(userId, { text: "Por ahora sólo podemos convertir texto en imágenes" });
            return
        }

        if (userState.onTrial == 1) {

            await makeTestInference(userId, text, socket)
            // Send the first message immediately
            // await socket.sendMessage(userId, { text: "¿Qué te pareció?" });
            setTimeout(async () => {
                await socket.sendMessage(userId, { text: "Probemos una vez más, déjame hacerte una sugerencia, escribe..." });
                setTimeout(async () => {
                    await socket.sendMessage(userId, { text: "cachorro hermoso, adorable. meteors" });
                }, 3000);
            }, 5000);
            userStates.set(userId, { onTrial: 2, subscription })
        } else if (userState.onTrial == 2) {
            await makeTestInference(userId, text, socket)
            setTimeout(async () => {
                await socket.sendMessage(userId, { text: "¿Ahí tienes, hacer esas imágenes no fue gratis, pero son un regalo para vos!" });
            }, 3000);
            userStates.set(userId, { onTrial: 3, subscription })
        } else if (userState.onTrial == 3) {
        }

        const susbscribePattern = /sub?scribir((se)|(me))?/i
        const subscribeFullPattern = /sub?scribir((se)|(me))?.*(mes|mensual|full)/i
        let subscriptionType: string = ''

        if (text === "suscribirse paquete imágenes") {
            subscriptionType = 'bot-imgs-batch'
        } else if (subscribeFullPattern.test(text)) {
            subscriptionType = 'bot-full'
        } else if (susbscribePattern.test(text)) {
            subscriptionType = 'bot-trial'
        }

        if (subscriptionType !== '') {
            await socket.sendMessage(userId, { text: createPaymentLink(userId, subscriptionType) });
            // userStates.set(userId, { aboutToSubscribe: true, subscription, onTrial: 3 })
        }

        return
    }
    userState = userStates.get(userId) || userState

    // When the user is really subscribed...
    if (userState.subscription && userState.subscription != 'free-trial') {
        if (text === "-unsubscribe") {
            userStates.set(userId, { aboutToUnsubscribe: true, subscription })
            socket.sendMessage(userId, { text: "¿Quieres cancelar la subscripción?" });
        } else {
            // await putUserInferencesOnPool(userId, text);
            await processRequest(userId, text, socket)
        }
        if (!text) {
            socket.sendMessage(userId, { text: "Por ahora sólo podemos convertir texto en imágenes" });
            return
        }
        // Handling actions like unsubscription
        if (userState.aboutToUnsubscribe)
            if (text === "si") {
                // userStates.set(userId, { subscribed: true })
                unsubscribeUser(userId);
                socket.sendMessage(userId, { text: "Subscripción cancelada" });
                return;
            }
    }
    userState = userStates.get(userId) || userState

    // When the user is not subscribed (first touch with the app)
    if (!userState.subscription) {
        subscribeUser(userId, 'free-trial')
        setTimeout(async () => {
            await socket.sendMessage(userId, { text: "Hola! Te cuento cómo funciona (¡es muy sencillo!)" });
            setTimeout(async () => {
                await socket.sendMessage(userId, { text: "Vos le escribís a este mismo chat, y en segundos obtienes una imagen generada de lo que pediste" });
                setTimeout(async () => {
                    await socket.sendMessage(userId, { text: "Hagamos una prueba... escribe \"perrito\" (o lo que desees)" })
                }, 3500);
            }, 200);
        }, 3500);

        userStates.set(userId, { onTrial: 1, subscription: "free-trial" })
    } /* else if (text === "quiero probarlo") {
        subscribeUser(userId, 'free-trial')
        // await socket.sendMessage(userId, { text: "Hola! parece que no estás subscripto" });
        // socket.sendMessage(userId, { image: { url: "src/media/img.jpg" } });
        // await socket.sendMessage(userId, { text: "Genera y usa como quieras más de 300 imágenes, por un período de prueba de 5 días de $2970" })
        await socket.sendMessage(userId, { text: createPaymentLink(userId, 'bot-trial') });
        // await socket.sendMessage(userId, { text: "Si ya has hecho un pago, introduce el id de la transacción para que verifiquemos y empieces a generar" });
        userStates.set(userId, { aboutToSubscribe: true, subscribed: false })
    } */
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
    const url = `${process.env.PAYMENT_PAGE_URL}/index.html?p=${doubleEncodedPhone}?stype=${subscription}`;

    return url
}