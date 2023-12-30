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
const utils_1 = require("./utils/utils");
global.aboutToUnsub = false;
const requestQueue = new Map();
const processRequest = (userId, requestData, socket) => __awaiter(void 0, void 0, void 0, function* () {
    if (requestQueue.has(userId)) {
        socket.sendMessage(userId, { text: "Espera! se está haciendo tu imagen anterior" });
        return;
    }
    requestQueue.set(userId, requestData);
    yield socket.sendMessage(userId, { text: "Generando imagen de " + requestData });
    yield socket.sendMessage(userId, { text: "Por favor espera un momento" });
    try {
        yield (0, utils_1.doSingleTextInference)(userId, requestData);
    }
    catch (error) {
        yield socket.sendMessage(userId, { text: "Disculpa, hubo un error" });
    }
    setTimeout(() => {
        requestQueue.delete(userId);
    }, 4000);
});
const handleConversation = (socket, msg) => __awaiter(void 0, void 0, void 0, function* () {
    const isSubscribed = yield (0, utils_1.checkUserIsSubscribed)(msg.key.remoteJid);
    console.log(`'${msg.message.conversation}- '`);
    const text = msg.message.conversation !== '' ? msg.message.conversation : msg.message.extendedTextMessage.text;
    if (global.aboutToUnsub && text === "si") {
        global.aboutToUnsub = false;
        (0, utils_1.unsubscribeUser)(msg.key.remoteJid);
        socket.sendMessage(msg.key.remoteJid, { text: "Subscripción cancelada" });
        return;
    }
    if (isSubscribed) {
        if (text === "-unsubscribe") {
            global.aboutToUnsub = true;
            socket.sendMessage(msg.key.remoteJid, { text: "¿Quieres cancelar la subscripción?" });
        }
        else {
            console.log("User is subscribed");
            console.log(text !== null && text !== void 0 ? text : msg.message.extendedTextMessage.text);
            console.log(msg.message);
            // await putUserInferencesOnPool(msg.key.remoteJid!, text);
            yield processRequest(msg.key.remoteJid, text, socket);
        }
    }
    else {
        console.log("User is not subscribed");
        yield socket.sendMessage(msg.key.remoteJid, { text: "Hola! parece que no estás subscripto" });
        // socket.sendMessage(msg.key.remoteJid!, { image: { url: "src/media/img.jpg" } });
        yield socket.sendMessage(msg.key.remoteJid, { text: "Ofrecemos un período de muy bajo costo, con el que puedes crear más de 500 imágenes libres de derechos de autor." });
        yield socket.sendMessage(msg.key.remoteJid, { text: "https://www.mercadopago.com.ar/cuenta" });
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
});
exports.default = handleConversation;
