import { Document, Packer, Paragraph, TextRun, AlignmentType, convertMillimetersToTwip } from 'docx';
import { saveAs } from 'file-saver';

export interface ExportOptions {
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  fontSize: number;
  fontFamily: string;
  lineSpacing: number;
}

const DEFAULT_OPTIONS: ExportOptions = {
  marginTop: 20,
  marginBottom: 20,
  marginLeft: 30,
  marginRight: 15,
  fontSize: 14,
  fontFamily: 'Times New Roman',
  lineSpacing: 1.5,
};

/**
 * Convert HTML to structured paragraphs preserving some formatting.
 * This is a best-effort parser — for full fidelity, consider using
 * the original .docx and replacing placeholders directly with JSZip.
 */
function htmlToParagraphs(html: string): { text: string; bold: boolean }[][] {
  const paragraphs: { text: string; bold: boolean }[][] = [];

  // Split by block-level tags
  const blocks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|li|tr)[^>]*>/gi, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const runs: { text: string; bold: boolean }[] = [];

    // Parse inline <strong>/<b> tags
    const parts = block.split(/(<\/?(?:strong|b)>)/gi);
    let isBold = false;

    for (const part of parts) {
      if (/^<(strong|b)>/i.test(part)) {
        isBold = true;
        continue;
      }
      if (/^<\/(strong|b)>/i.test(part)) {
        isBold = false;
        continue;
      }
      // Strip remaining HTML tags
      const clean = part.replace(/<[^>]*>/g, '').trim();
      if (clean) {
        runs.push({ text: clean, bold: isBold });
      }
    }

    if (runs.length > 0) {
      paragraphs.push(runs);
    }
  }

  return paragraphs;
}

export async function exportToDocx(
  content: string,
  fileName: string,
  options: Partial<ExportOptions> = {},
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const parsedParagraphs = htmlToParagraphs(content);

  const paragraphs = parsedParagraphs.map(
    (runs) =>
      new Paragraph({
        children: runs.map(
          (run) =>
            new TextRun({
              text: run.text,
              size: opts.fontSize * 2,
              font: opts.fontFamily,
              bold: run.bold,
            }),
        ),
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: opts.lineSpacing * 240 },
      }),
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(opts.marginTop),
              bottom: convertMillimetersToTwip(opts.marginBottom),
              left: convertMillimetersToTwip(opts.marginLeft),
              right: convertMillimetersToTwip(opts.marginRight),
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
}
