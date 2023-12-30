import { AnyMessageContent, WASocket, proto } from '@whiskeysockets/baileys';
import { checkUserIsSubscribed, doSingleTextInference, putUserInferencesOnPool, unsubscribeUser } from './utils/utils';
global.aboutToUnsub = false;

const handleConversation = async (socket: WASocket, msg: proto.IWebMessageInfo) => {
    console.log("A new msg to be sent!!!!")
    // socket.sendMessage(msg.key.remoteJid!, { text: JSON.stringify(msg.key) });
    const isSubscribed = await checkUserIsSubscribed(msg.key.remoteJid!);
    if (global.aboutToUnsub && msg.message.conversation === "si") {
        global.aboutToUnsub = false;
        unsubscribeUser(msg.key.remoteJid!);
        socket.sendMessage(msg.key.remoteJid!, { text: "Subscripción cancelada" });
        return;
    }

    if (isSubscribed) {
        if (msg.message.conversation === "-unsubscribe") {
            global.aboutToUnsub = true
            socket.sendMessage(msg.key.remoteJid!, { text: "¿Quieres cancelar la subscripción?" });
        } else {
            console.log("User is subscribed")
            await socket.sendMessage(msg.key.remoteJid!, { text: "Generando imagen de " + msg.message.conversation });
            socket.sendMessage(msg.key.remoteJid!, { text: "Por favor espera un momento" });
            // await putUserInferencesOnPool(msg.key.remoteJid!, msg.message.conversation);
            await doSingleTextInference(msg.key.remoteJid!, msg.message.conversation)

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