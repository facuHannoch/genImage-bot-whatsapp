import { AnyMessageContent, WASocket, proto } from '@whiskeysockets/baileys';
import { checkUserIsSubscribed } from './utils/utils';

const handleConversation = (socket: WASocket, msg: proto.IWebMessageInfo) => {
    console.log("A new msg to be sent!!!!")
    socket.sendMessage(msg.key.remoteJid!, { text: JSON.stringify(msg.key) });
    const isSubscribed = checkUserIsSubscribed(msg.key.remoteJid!);
    if (isSubscribed) {
        console.log("User is subscribed")
        socket.sendMessage(msg.key.remoteJid!, { text: "You are subscribed" });
    } else {
        console.log("User is not subscribed")
    }
    
}

export default handleConversation