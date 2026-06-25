import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { registerSocketHandlers } from './sockets';

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = CLIENT_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
const userHome = process.env.USERPROFILE || process.env.HOME || process.cwd();
const DEFAULT_AUDIO_LIBRARY_PATH = path.join(userHome, 'Desktop', 'spellcaster-tts');
const AUDIO_LIBRARY_PATH = process.env.AUDIO_LIBRARY_PATH || DEFAULT_AUDIO_LIBRARY_PATH;

// setting up express basics
app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

// tiny health check so we know the server boots
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

if (!fs.existsSync(AUDIO_LIBRARY_PATH)) {
  console.warn(
    `[audio] library folder not found at ${AUDIO_LIBRARY_PATH}. Set AUDIO_LIBRARY_PATH to the directory that contains your mp3s.`
  );
}

app.use('/audio/spells', express.static(AUDIO_LIBRARY_PATH));

const httpServer = http.createServer(app);

// plug socket.io into the same server
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// break socket handlers into their own module
registerSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`spellcaster server listening on port ${PORT}`);
});

