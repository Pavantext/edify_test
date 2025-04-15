import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const runtime = 'edge';

// Helper function to calculate dynamic font size based on text length
function getDynamicFontSize(text: string, maxSize: number, minSize: number): number {
  const length = text.length;
  if (length <= 50) return maxSize;
  if (length > 150) return minSize;
  // Linear interpolation between maxSize and minSize
  return maxSize - ((length - 50) / 100) * (maxSize - minSize);
}

// Helper function to measure text width with dynamic font size
function getTextWidth(text: string, fontSize: number): number {
  return text.length * (fontSize * 0.5);
}

// Helper function to split text into pages
function splitIntoPages(text: string): string[] {
  return text.split('<h2>').filter(section => section.trim());
}

// Helper function to draw a horizontal line
function drawLine(page: any, y: number, margin: number, pageWidth: number) {
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
}

// Helper function to identify subheadings
function isSubheading(text: string): boolean {
  const subheadings = [
    "Main Topics and Themes:",
    "Significance and Relevance:",
    "Key Research Questions:",
    "Primary Results:",
    "Supporting Evidence:",
    "Practical Applications:",
    "Methodologies Used:",
    "Tools and Techniques:",
    "Study Limitations:",
  ];
  return subheadings.some(heading => text.trim().startsWith(heading));
}

async function addWatermarkToPDF(pdfBytes: Uint8Array, logoPath: string) {
  try {
    // Load the existing PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Fetch the logo image
    const logoResponse = await fetch(new URL(logoPath, process.env.NEXT_PUBLIC_APP_URL));
    const logoBytes = await logoResponse.arrayBuffer();
    
    // Embed the logo image
    const logoImage = await pdfDoc.embedPng(new Uint8Array(logoBytes));
    const logoDims = logoImage.scale(0.15); // Adjust scale as needed

    // Get all pages
    const pages = pdfDoc.getPages();
    pages.forEach((page) => {
      const { width, height } = page.getSize();
      const margin = 20; // Distance from the corner

      // Draw the logo in the bottom right corner
      page.drawImage(logoImage, {
        x: width - logoDims.width - margin,
        y: height - logoDims.height - margin,
        width: logoDims.width,
        height: logoDims.height,
        opacity: 0.3 // Make it semi-transparent
      });
    });

    // Save the updated PDF
    return await pdfDoc.save();
  } catch (error) {
    console.error("Error adding watermark:", error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await request.json();
    const { content, searchQuery } = data;

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // PDF settings
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;
    const contentWidth = pageWidth - (margin * 2);
    
    // Text settings
    const maxMainTitleSize = 20;
    const minMainTitleSize = 14;
    const titleSize = 16;
    const bodySize = 12;
    const lineHeight = 1.5;

    // Add first page
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // Calculate dynamic font size for main title
    const mainTitleSize = getDynamicFontSize(searchQuery, maxMainTitleSize, minMainTitleSize);
    const mainTitle = `Research Summary: ${searchQuery}`;
    
    // Handle long titles by wrapping text if needed
    const words = mainTitle.split(' ');
    let currentLine = '';
    let titleLines = [];
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (getTextWidth(testLine, mainTitleSize) > contentWidth) {
        titleLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      titleLines.push(currentLine);
    }

    // Draw multi-line title
    for (const line of titleLines) {
      const lineWidth = getTextWidth(line, mainTitleSize);
      currentPage.drawText(line, {
        x: (pageWidth - lineWidth) / 2,
        y: yPosition,
        size: mainTitleSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= mainTitleSize * 1.2;
    }

    // Add extra space after multi-line title
    yPosition -= mainTitleSize;

    // Draw line under main title
    drawLine(currentPage, yPosition, margin, pageWidth);
    yPosition -= mainTitleSize;

    // Process content
    const sections = splitIntoPages(content);
    for (const section of sections) {
      // Extract section title and content
      const [title, ...contentParts] = section.split('</h2>');
      const sectionContent = contentParts.join('')
        .replace(/<br\/>/g, '\n')
        .replace(/<ul>/g, '')
        .replace(/<\/ul>/g, '')
        .replace(/<li>/g, '• ')
        .replace(/<\/li>/g, '\n')
        .replace(/<[^>]{0,1000}>/g, '')
        .trim();

      // Add new page if not enough space
      if (yPosition < margin + titleSize * 3) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }

      // Draw section title
      currentPage.drawText(title.trim(), {
        x: margin,
        y: yPosition,
        size: titleSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= titleSize;

      // Draw line under section title
      drawLine(currentPage, yPosition, margin, pageWidth);
      yPosition -= titleSize * 0.8;

      // Add content
      const lines = sectionContent.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue; // Skip empty lines

        // Check if line is a subheading
        const isSubheadingLine = isSubheading(line);
        const currentFont = isSubheadingLine ? boldFont : font;

        const words = line.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          if (getTextWidth(testLine, bodySize) > contentWidth) {
            // Draw current line
            if (yPosition < margin + bodySize) {
              currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
              yPosition = pageHeight - margin;
            }
            currentPage.drawText(currentLine, {
              x: margin,
              y: yPosition,
              size: bodySize,
              font: currentFont,
              color: rgb(0, 0, 0),
            });
            yPosition -= bodySize * lineHeight;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        // Draw remaining text
        if (currentLine) {
          if (yPosition < margin + bodySize) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin;
          }
          currentPage.drawText(currentLine, {
            x: margin,
            y: yPosition,
            size: bodySize,
            font: currentFont,
            color: rgb(0, 0, 0),
          });
          yPosition -= bodySize * lineHeight;
        }

        // Add extra space after subheadings
        if (isSubheadingLine) {
          yPosition -= bodySize * 0.5;
        }
      }

      // Add space between sections
      yPosition -= bodySize * 2;
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    // Add watermark to the generated PDF
    const logoPath = '/mainlogo.png'; // Update with your logo path
    const watermarkedPdfBytes = await addWatermarkToPDF(pdfBytes, logoPath);

    // Return the watermarked PDF
    return new Response(watermarkedPdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="summary.pdf"',
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response('Error generating PDF, please try again.', { status: 500 });
  }
} 