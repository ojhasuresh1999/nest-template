import appConfig from './app.config';
import dbConfig from './db.config';
import authConfig from './auth.config';
import mailConfig from './mail.config';
import redisConfig from './redis.config';
import s3Config from './s3.config';
import socketConfig from './socket.config';
import firebaseConfig from './firebase.config';

export const AllConfigsList = [
  appConfig,
  dbConfig,
  authConfig,
  mailConfig,
  redisConfig,
  s3Config,
  socketConfig,
  firebaseConfig,
];
