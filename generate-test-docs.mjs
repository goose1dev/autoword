import { Document, Packer, Paragraph, TextRun } from 'docx';
import fs from 'fs';
import path from 'path';

const dir = path.resolve('test-docs');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

for (let i = 1; i <= 10; i++) {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: `Документ №${i}`, bold: true, size: 28, font: 'Times New Roman' }),
          ],
        }),
        new Paragraph({ children: [] }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Студент: {{ПІБ}}', size: 24, font: 'Times New Roman' }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Група: {{Група}}', size: 24, font: 'Times New Roman' }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Оцінка: {{Оцінка}}', size: 24, font: 'Times New Roman' }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Кількість годин: 12', size: 24, font: 'Times New Roman' }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Дата: {{Дата}}', size: 24, font: 'Times New Roman' }),
          ],
        }),
      ],
    }],
  });

  Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(path.join(dir, `document-${i}.docx`), buffer);
    console.log(`Created document-${i}.docx`);
  });
}
