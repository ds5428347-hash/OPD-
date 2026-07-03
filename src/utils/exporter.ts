/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';

/**
 * Downloads a structured Markdown document containing input properties and generated responses.
 */
export function exportToMarkdown(title: string, input: string, output: string, metadata?: string) {
  const content = `# ${title}
${metadata ? `> **Configuration:** ${metadata}\n` : ''}

## Source Context / Configuration
\`\`\`text
${input.trim()}
\`\`\`

## Generated Results
${output.trim()}

---
*Generated using Gemini Studio Companion Developer Workspace on ${new Date().toLocaleDateString()}*
`;

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_export.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Programmatically constructs a beautiful PDF document, handling paragraph wrapping and pagination.
 */
export function exportToPdf(title: string, input: string, output: string, metadata?: string) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  let y = margin;

  // Document Title Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(24, 24, 27); // Zinc 900
  doc.text(title, margin, y);
  y += 8;

  // Metadata if present
  if (metadata) {
    doc.setFont('Helvetica', 'oblique');
    doc.setFontSize(9.5);
    doc.setTextColor(113, 113, 122); // Zinc 500
    doc.text(metadata, margin, y);
    y += 10;
  }

  // Draw separator line
  doc.setDrawColor(228, 228, 231); // Zinc 200
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Source Content Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(39, 39, 42); // Zinc 800
  doc.text('Source Input / Configuration:', margin, y);
  y += 6;

  // Input Block (using Courier for code/data feel)
  doc.setFont('Courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(82, 82, 91); // Zinc 600
  
  const wrappedInputLines = doc.splitTextToSize(input.trim(), contentWidth);
  wrappedInputLines.forEach((line: string) => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 4.5;
  });
  
  y += 10;

  // Draw separator line before results
  if (y > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  doc.setDrawColor(228, 228, 231);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Output Content Header
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(39, 39, 42);
  doc.text('Generated Results:', margin, y);
  y += 6;

  // Output Blocks (using clean Helvetica)
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(24, 24, 27);

  const wrappedOutputLines = doc.splitTextToSize(output.trim(), contentWidth);
  wrappedOutputLines.forEach((line: string) => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 5.2;
  });

  // Save the document
  doc.save(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_export.pdf`);
}
