import mammoth from 'mammoth';
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
