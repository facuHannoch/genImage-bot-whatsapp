import { AnyMessageContent, WASocket, proto } from '@whiskeysockets/baileys';
import { checkUserIsSubscribed, doSingleTextInference, putUserInferencesOnPool, unsubscribeUser } from './utils/utils';
global.aboutToUnsub = false;

const requestQueue = new Map();

const processRequest = async (userId: string, requestData: string, socket: WASocket) => {
    if (requestQueue.has(userId)) {
        socket.sendMessage(userId, { text: "Espera! se está haciendo tu imagen anterior" })
        return;
    }
    requestQueue.set(userId, requestData);
    await socket.sendMessage(userId, { text: "Generando imagen de " + requestData });
    await socket.sendMessage(userId, { text: "Por favor espera un momento" });
    try {
        await doSingleTextInference(userId, requestData)
    } catch (error) {
        await socket.sendMessage(userId, { text: "Disculpa, hubo un error" });
    }
    setTimeout(() => {
        requestQueue.delete(userId);
    }, 4000);
};


const handleConversation = async (socket: WASocket, msg: proto.IWebMessageInfo) => {
    const isSubscribed = await checkUserIsSubscribed(msg.key.remoteJid!);
    console.log(`'${msg.message.conversation}- '`)
    const text: string = msg.message.conversation !== '' ? msg.message.conversation : msg.message.extendedTextMessage.text
    if (global.aboutToUnsub && text === "si") {
        global.aboutToUnsub = false;
        unsubscribeUser(msg.key.remoteJid!);
        socket.sendMessage(msg.key.remoteJid!, { text: "Subscripción cancelada" });
        return;
    }

    if (isSubscribed) {
        if (text === "-unsubscribe") {
            global.aboutToUnsub = true
            socket.sendMessage(msg.key.remoteJid!, { text: "¿Quieres cancelar la subscripción?" });
        } else {
            console.log("User is subscribed")
            console.log(text ?? msg.message.extendedTextMessage.text)
            console.log(msg.message)
            // await putUserInferencesOnPool(msg.key.remoteJid!, text);
            await processRequest(msg.key.remoteJid!, text, socket)

        }
    } else {
        console.log("User is not subscribed")
        await socket.sendMessage(msg.key.remoteJid!, { text: "Hola! parece que no estás subscripto" });
        // socket.sendMessage(msg.key.remoteJid!, { image: { url: "src/media/img.jpg" } });
        await socket.sendMessage(msg.key.remoteJid!, { text: "Ofrecemos un período de muy bajo costo, con el que puedes crear más de 500 imágenes libres de derechos de autor." });
        await socket.sendMessage(msg.key.remoteJid!, { text: "https://www.mercadopago.com.ar/cuenta" });
        // socket.sendMessage(msg.key.remoteJid!, {
        //     buttons: [
        //         {
        //             buttonId: 'id1',
        //             buttonText: { displayText: 'Subscribe' },
        //             type: 1
        //         },
        //     ],
        //     // headerType: 1,
        //     text: "¿Quieres suscribirte?"
        // });
    }
}

export default handleConversation