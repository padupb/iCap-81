import { Session, SessionData } from 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

// Estender a interface Request do Express para incluir a sessão tipada
declare module 'express' {
  interface Request {
    session: Session & Partial<SessionData>;
  }
}