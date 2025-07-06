import app from './app';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

const PORT = process.env.PORT || 3141;
const server = http.createServer(app);

server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Error: Port ${PORT} is already in use.`);
        process.exit(1);
    } else {
        console.log('Server error: ', error);
        process.exit(1);
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
