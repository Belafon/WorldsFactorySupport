import express, { Request, Response } from 'express';

const app = express();
const port = 3000;

app.use(express.json());


app.post('/data', (req: Request, res: Response) => {
    const data = req.body;
    console.log('Received JSON:', data);

    // Send response back to the client
    res.send('JSON received');
});

app.post('/html', (req, res) => {
    const htmlContent = req.body.html;
    console.log('Received HTML:', htmlContent);

    // Send response back to the client
    res.send('HTML received');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

console.log('Server class created454');

export class Server {
    constructor() {
        console.log('Server class created');
    }

    public start() {
        console.log('Server started');
    }
}