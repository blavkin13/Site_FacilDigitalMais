import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

// Diretório para armazenar PDFs temporários protegidos
const PROTECTED_DIR = join(process.cwd(), "data", "protected");

// Garantir que o diretório exista
async function ensureProtectedDir(): Promise<void> {
  try {
    await mkdir(PROTECTED_DIR, { recursive: true });
  } catch {}
}

// Validar CPF (algoritmo oficial)
export function validateCpf(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false; // todos dígitos iguais

  // Validação do primeiro dígito
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf[i]) * (10 - i);
  let check1 = (sum * 10) % 11;
  if (check1 === 10) check1 = 0;
  if (check1 !== parseInt(cleanCpf[9])) return false;

  // Validação do segundo dígito
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf[i]) * (11 - i);
  let check2 = (sum * 10) % 11;
  if (check2 === 10) check2 = 0;
  if (check2 !== parseInt(cleanCpf[10])) return false;

  return true;
}

// Formatar CPF: 12345678901 -> 123.456.789-01
export function formatCpf(cpf: string): string {
  const clean = cpf.replace(/\D/g, "");
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

// Adicionar marca d'água com CPF em todas as páginas do PDF
export async function addWatermarkToPdf(
  pdfBytes: Uint8Array,
  cpf: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const formattedCpf = formatCpf(cpf);

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Texto principal: CPF diagonal no centro
    page.drawText(`CPF: ${formattedCpf}`, {
      x: width / 2 - 120,
      y: height / 2,
      size: 32,
      font,
      color: rgb(0.85, 0.85, 0.85),
      rotate: degrees(45),
      opacity: 0.35,
    });

    // Texto menor no rodapé de cada página
    page.drawText(
      `Documento exclusivo - CPF: ${formattedCpf} - Facil Digital+`,
      {
        x: 40,
        y: 20,
        size: 8,
        font,
        color: rgb(0.6, 0.6, 0.6),
        opacity: 0.8,
      }
    );
  }

  return pdfDoc.save();
}

// Proteger PDF com senha (usando CPF como senha)
// NOTA: pdf-lib não suporta nativamente criptografia de senha.
// Em produção, use uma biblioteca como 'qpdf' ou 'gs' via child_process.
// Por enquanto, retornamos o PDF com watermark, que já é a proteção principal.
export async function protectPdfWithPassword(
  pdfBytes: Uint8Array,
  password: string
): Promise<Uint8Array> {
  // Implementação futura: usar qpdf para adicionar senha real
  // Por enquanto, retorna o mesmo PDF (watermark já aplicado)
  return pdfBytes;
}

// Gerar PDF protegido completo (watermark + senha) e salvar temporariamente
export async function generateProtectedPdf(
  originalPdfPath: string,
  userCpf: string,
  userId: number
): Promise<{
  protectedPath: string;
  downloadToken: string;
  expiresAt: Date;
}> {
  await ensureProtectedDir();

  // Ler PDF original
  let pdfBytes: Uint8Array;
  try {
    const buffer = await readFile(originalPdfPath);
    pdfBytes = new Uint8Array(buffer);
  } catch (error) {
    // Se o PDF original não existir, criar um PDF de exemplo para testes
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText("Facil Digital+ - Material de Estudo", {
      x: 50,
      y: 750,
      size: 24,
      font,
    });
    page.drawText("Este é um PDF de exemplo gerado para testes.", {
      x: 50,
      y: 700,
      size: 14,
      font,
    });
    page.drawText("Em produção, este será o conteúdo real da apostila.", {
      x: 50,
      y: 670,
      size: 12,
      font,
    });

    pdfBytes = await pdfDoc.save();
  }

  // Aplicar watermark
  const watermarkedPdf = await addWatermarkToPdf(pdfBytes, userCpf);

  // Aplicar senha (implementação futura)
  const protectedPdf = await protectPdfWithPassword(watermarkedPdf, userCpf);

  // Gerar token único e caminho do arquivo
  const downloadToken = randomBytes(32).toString("hex");
  const fileName = `protected_${userId}_${Date.now()}_${downloadToken.slice(0, 8)}.pdf`;
  const protectedPath = join(PROTECTED_DIR, fileName);

  // Salvar PDF protegido
  await writeFile(protectedPath, protectedPdf);

  // Validade: 12 horas
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  return { protectedPath, downloadToken, expiresAt };
}

// Limpar PDFs protegidos expirados
export async function cleanupExpiredPdfs(): Promise<number> {
  const { readdir, stat } = await import("fs/promises");
  let removed = 0;

  try {
    await ensureProtectedDir();
    const files = await readdir(PROTECTED_DIR);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith(".pdf")) continue;

      const filePath = join(PROTECTED_DIR, file);
      try {
        const stats = await stat(filePath);
        // Remover arquivos com mais de 12 horas
        if (now - stats.mtimeMs > 12 * 60 * 60 * 1000) {
          await unlink(filePath);
          removed++;
        }
      } catch {}
    }
  } catch {}

  return removed;
}

// Buscar PDF protegido por token
export async function getProtectedPdfByToken(
  downloadToken: string
): Promise<{ filePath: string; buffer: Buffer } | null> {
  try {
    await ensureProtectedDir();
    const { readdir } = await import("fs/promises");
    const files = await readdir(PROTECTED_DIR);

    // Procurar arquivo que contém o token no nome
    const targetFile = files.find((f) => f.includes(downloadToken.slice(0, 8)));

    if (!targetFile) return null;

    const filePath = join(PROTECTED_DIR, targetFile);
    if (!existsSync(filePath)) return null;

    const buffer = await readFile(filePath);
    return { filePath, buffer };
  } catch {
    return null;
  }
}