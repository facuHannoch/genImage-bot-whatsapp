import express, { Request, Response } from 'express';
import axios from 'axios';
import startSock from './startBot';

const app = express();
app.use(express.json());

// Webhook endpoint
app.post('/firebase-update', async (req: Request, res: Response) => {
    const data = req.body;
    console.log('Received data from Firebase:', data);
    // Process the data...
    res.sendStatus(200);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

startSock().catch((err: any) => console.error('Error in WhatsApp bot:', err));
