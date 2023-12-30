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
const handleConversation = (socket, msg) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("A new msg to be sent!!!!");
    // socket.sendMessage(msg.key.remoteJid!, { text: JSON.stringify(msg.key) });
    const isSubscribed = yield (0, utils_1.checkUserIsSubscribed)(msg.key.remoteJid);
    if (global.aboutToUnsub && msg.message.conversation === "si") {
        global.aboutToUnsub = false;
        (0, utils_1.unsubscribeUser)(msg.key.remoteJid);
        socket.sendMessage(msg.key.remoteJid, { text: "Subscripción cancelada" });
        return;
    }
    if (isSubscribed) {
        if (msg.message.conversation === "-unsubscribe") {
            global.aboutToUnsub = true;
            socket.sendMessage(msg.key.remoteJid, { text: "¿Quieres cancelar la subscripción?" });
        }
        else {
            console.log("User is subscribed");
            yield socket.sendMessage(msg.key.remoteJid, { text: "Generando imagen de " + msg.message.conversation });
            socket.sendMessage(msg.key.remoteJid, { text: "Por favor espera un momento" });
            // await putUserInferencesOnPool(msg.key.remoteJid!, msg.message.conversation);
            yield (0, utils_1.doSingleTextInference)(msg.key.remoteJid, msg.message.conversation);
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
