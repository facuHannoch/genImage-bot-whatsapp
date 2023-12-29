"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils/utils");
const handleConversation = (socket, msg) => {
    console.log("A new msg to be sent!!!!");
    socket.sendMessage(msg.key.remoteJid, { text: JSON.stringify(msg.key) });
    const isSubscribed = (0, utils_1.checkUserIsSubscribed)(msg.key.remoteJid);
    if (isSubscribed) {
        console.log("User is subscribed");
        socket.sendMessage(msg.key.remoteJid, { text: "You are subscribed" });
    }
    else {
        console.log("User is not subscribed");
    }
};
exports.default = handleConversation;
