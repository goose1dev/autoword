import mammoth from 'mammoth';
import JSZip from 'jszip';
import type { TemplateField } from '@/types/index.ts';

const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g;

export async function convertDocxToHtml(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    }
  );
  return result.value;
}

export function extractFields(html: string): TemplateField[] {
  const matches = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = PLACEHOLDER_REGEX.exec(html)) !== null) {
    matches.add(match[1].trim());
  }

  return Array.from(matches).map((key, index) => ({
    id: `field-${index}`,
    key,
    label: formatFieldLabel(key),
    type: guessFieldType(key),
    defaultValue: '',
  }));
}

export function fillTemplate(html: string, values: Record<string, string>): string {
  return html.replace(PLACEHOLDER_REGEX, (_, key: string) => {
    const trimmedKey = key.trim();
    return values[trimmedKey] ?? `{{${trimmedKey}}}`;
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function replacePlaceholdersInText(text: string, values: Record<string, string>): { text: string; count: number } {
  let count = 0;
  const nextText = text.replace(PLACEHOLDER_REGEX, (match, key: string) => {
    const trimmedKey = key.trim();
    if (!Object.prototype.hasOwnProperty.call(values, trimmedKey)) {
      return match;
    }

    count++;
    return escapeXml(values[trimmedKey] ?? '');
  });

  return { text: nextText, count };
}

function replacePlaceholdersInTextNodes(xml: string, values: Record<string, string>): { xml: string; count: number } {
  let count = 0;
  const nextXml = xml.replace(/(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g, (match, open, text, close) => {
    const result = replacePlaceholdersInText(text, values);
    if (result.count === 0) return match;
    count += result.count;
    return `${open}${result.text}${close}`;
  });

  return { xml: nextXml, count };
}

function replaceSplitPlaceholdersInParagraph(paragraphXml: string, values: Record<string, string>): { xml: string; count: number } {
  const runRegex = /(<w:r\b[^>]*>)([\s\S]*?)(<\/w:r>)/g;
  const textRegex = /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/;

  interface RunInfo {
    fullMatch: string;
    pre: string;
    textOpen: string;
    text: string;
    post: string;
  }

  const runs: RunInfo[] = [];
  let concatenated = '';
  let runMatch: RegExpExecArray | null;

  while ((runMatch = runRegex.exec(paragraphXml)) !== null) {
    const runBody = runMatch[2];
    const textMatch = textRegex.exec(runBody);
    if (!textMatch) continue;

    const beforeText = runBody.substring(0, textMatch.index);
    const afterText = runBody.substring(textMatch.index + textMatch[0].length);
    runs.push({
      fullMatch: runMatch[0],
      pre: `${runMatch[1]}${beforeText}${textMatch[1]}`,
      textOpen: textMatch[1],
      text: textMatch[2],
      post: `${afterText}${runMatch[3]}`,
    });
    concatenated += textMatch[2];
  }

  if (runs.length === 0) return { xml: paragraphXml, count: 0 };

  const replacement = replacePlaceholdersInText(concatenated, values);
  if (replacement.count === 0) return { xml: paragraphXml, count: 0 };

  let nextXml = paragraphXml;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const replacementText = i === 0 ? replacement.text : '';
    const preserveSpace = run.textOpen.includes('xml:space')
      ? run.textOpen
      : run.textOpen.replace('>', ' xml:space="preserve">');
    const newRun = run.pre.replace(run.textOpen, preserveSpace) + replacementText + run.post;
    nextXml = nextXml.replace(run.fullMatch, newRun);
  }

  return { xml: nextXml, count: replacement.count };
}

function replacePlaceholdersInXml(xml: string, values: Record<string, string>): string {
  const direct = replacePlaceholdersInTextNodes(xml, values);

  const paragraphRegex = /(<w:p\b[^>]*>[\s\S]*?<\/w:p>)/g;
  return direct.xml.replace(paragraphRegex, (paragraph) => {
    return replaceSplitPlaceholdersInParagraph(paragraph, values).xml;
  });
}

function isWordXmlPath(path: string): boolean {
  return path.startsWith('word/') && path.endsWith('.xml');
}

export async function fillDocxTemplate(file: File, values: Record<string, string>): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  await Promise.all(
    Object.keys(zip.files).map(async (path) => {
      const entry = zip.files[path];
      if (entry.dir || !isWordXmlPath(path)) return;

      const xml = await entry.async('string');
      const nextXml = replacePlaceholdersInXml(xml, values);
      if (nextXml !== xml) {
        zip.file(path, nextXml);
      }
    }),
  );

  return zip.generateAsync({ type: 'arraybuffer' });
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/[_-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function guessFieldType(key: string): TemplateField['type'] {
  const lower = key.toLowerCase();
  if (lower.includes('дата') || lower.includes('date') || lower.includes('рік') || lower.includes('year'))
    return 'date';
  if (lower.includes('кількість') || lower.includes('номер') || lower.includes('number') || lower.includes('count'))
    return 'number';
  return 'text';
}

export function generateId(): string {
  return crypto.randomUUID();
}
