import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { users, sessions } from "../db/schema";
import type { User, Session } from "../db/schema";

// Função para hash de senha usando SHA-256 com salt
export function hashPassword(password: string): string {
  const salt = "facildigitalmais_salt_2026"; // Salt fixo para consistência
  return createHash("sha256").update(password + salt).digest("hex");
}

// Função para verificar senha
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Gerar token de sessão
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// Registrar novo usuário
export async function registerUser(
  email: string,
  password: string,
  name?: string,
  cpf?: string,
  phone?: string,
  role: "user" | "admin" = "user"
): Promise<User | null> {
  const db = getDb();
  
  // Verificar se email já existe
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();
  
  if (existingUser) {
    return null;
  }
  
  // Criar novo usuário
  const passwordHash = hashPassword(password);
  const result = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name,
      cpf,
      phone,
      role,
    })
    .returning();
  
  return result[0] || null;
}

// Autenticar usuário
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: User; session: Session } | null> {
  const db = getDb();
  
  // Buscar usuário
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();
  
  if (!user) {
    return null;
  }
  
  // Verificar senha
  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }
  
  // Criar nova sessão
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
  
  const sessionResult = await db
    .insert(sessions)
    .values({
      userId: user.id,
      token,
      expiresAt: expiresAt.toISOString(),
    })
    .returning();
  
  return { user, session: sessionResult[0]! };
}

// Validar sessão
export async function validateSession(token: string): Promise<User | null> {
  const db = getDb();
  
  // Buscar sessão válida
  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .get();
  
  if (!session) {
    return null;
  }
  
  // Verificar se expirou
  if (new Date(session.expiresAt) < new Date()) {
    // Remover sessão expirada
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }
  
  // Buscar usuário
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .get();
  
  return user || null;
}

// Logout (deletar sessão)
export async function logoutSession(token: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.token, token));
}

// Limpar sessões expiradas
export async function cleanupExpiredSessions(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.delete(sessions).where(eq(sessions.expiresAt, now));
}