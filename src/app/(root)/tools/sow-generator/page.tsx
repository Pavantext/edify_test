"use client";
import React, { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, Edit, FileText } from "lucide-react";
import type { SOW } from "@/schemas/sow-schema";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import { ReportButton } from "@/components/ReportButton";
import { ExportDropdown } from "@/components/ExportDropdown";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { PDFDocument } from 'pdf-lib';
import { Document, Packer, PageOrientation, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType } from "docx";
import { toast } from "sonner";
import { Header, ImageRun } from "docx";
import SubscriptionDialog from "@/components/SubscriptionDialog";

const emphasisAreas = [
  "metacognition",
  "criticalThinking",
  "research",
  "discussion",
  "practical",
];

const difficultyLevels = [
  { value: "foundation", label: "Foundation" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export default function SOWGeneratorPage() {
  const [isChecked, setIsChecked] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [sowResponse, setSOWResponse] = useState<SOW | null>(null);
  const [error, setError] = useState("");
  const [selectedEmphasis, setSelectedEmphasis] = useState<string[]>([]);
  const [sowId, setSowId] = useState<string | null>(null);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [isFromApprovedUrl, setIsFromApprovedUrl] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Effect to check for approved URL parameters
  React.useEffect(() => {
    const fetchApprovedSOW = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const approvedId = searchParams.get('approved');

      if (approvedId) {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/tools/sow-generator?approved=${approvedId}`);
          const data = await response.json();

          if (!response.ok) {
            if (response.status === 403) {
              // Content not approved
              setError(`Content not approved: ${data.details?.status || 'Unknown status'}`);
              return;
            }
            throw new Error(data.error || 'Failed to fetch scheme of work');
          }

          setSOWResponse(data.sow_data);
          setSowId(approvedId);
          // Add a flag to track if content is from approved URL
          setIsFromApprovedUrl(true);

          // Pre-fill form with input data
          if (data.input_data && formRef.current) {
            const form = formRef.current;
            const input = data.input_data;

            if (form.subject) form.subject.value = input.subject || '';
            if (form.topic) form.topic.value = input.topic || '';
            if (form.year) form.year.value = input.ageGroup?.year || '';
            if (form.totalLessons) form.totalLessons.value = input.totalLessons || '';
            if (form.lessonDuration) form.lessonDuration.value = input.lessonDuration || '';
            if (form.difficultyLevel) form.difficultyLevel.value = input.userPreferences?.difficultyLevel || 'intermediate';

            // Set emphasis areas if provided
            if (input.userPreferences?.emphasisAreas && Array.isArray(input.userPreferences.emphasisAreas)) {
              setSelectedEmphasis(input.userPreferences.emphasisAreas);
            }
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load scheme of work');
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchApprovedSOW();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Early premium/usage check
    try {
      const res = await fetch("/api/check-premium", {
        method: "GET",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!data.premium && data.usageExceeded) {
        setShowSubscriptionDialog(true);
        return;
      }
    } catch (err) {
      console.error("Error checking premium status:", err);
    }

    // Add validation for emphasis areas
    if (selectedEmphasis.length === 0 && !isFromApprovedUrl) {
      setError("Please select at least one emphasis area");
      setSOWResponse(null); // Clear previous response when validation fails
      return;
    }

    setIsLoading(true);
    setError("");
    setSOWResponse(null); // Clear previous response

    if (!formRef.current) {
      console.error("Form reference is null");
      return;
    }
    const formData = new FormData(formRef.current);
    const data = {
      subject: isFromApprovedUrl ? formRef.current.subject.value : formData.get("subject"),
      topic: isFromApprovedUrl ? formRef.current.topic.value : formData.get("topic"),
      ageGroup: {
        year: isFromApprovedUrl ? Number(formRef.current.year.value) : Number(formData.get("year")),
      },
      totalLessons: isFromApprovedUrl ? Number(formRef.current.totalLessons.value) : Number(formData.get("totalLessons")),
      lessonDuration: isFromApprovedUrl ? Number(formRef.current.lessonDuration.value) : Number(formData.get("lessonDuration")),
      userPreferences: {
        emphasisAreas: selectedEmphasis,
        difficultyLevel: formData.get("difficultyLevel"),
      },
    };

    try {
      const response = await fetch(`/api/tools/sow-generator${sowId && isFromApprovedUrl ? `?approvedId=${sowId}` : ''}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.details) {
          // Handle content violation details
          const violationMessages = [];
          if (result.details.content_violation)
            violationMessages.push("Inappropriate content detected");
          if (result.details.pii_detected)
            violationMessages.push("Personal information detected");
          if (result.details.bias_detected)
            violationMessages.push("Potentially biased content detected");

          throw new Error(
            violationMessages.length > 0
              ? `${result.message}\n${violationMessages.join("\n")}`
              : result.message || result.error
          );
        }
        throw new Error(result.error || "Failed to generate scheme of work");
      }
      setSOWResponse(result.sow_data);
      setSowId(result.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate SOW");
    } finally {
      setIsLoading(false);
      setIsChecked(!isChecked);
    }
  };

  const handleEmphasisToggle = (area: string) => {
    setSelectedEmphasis((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  async function addWatermarkToPDF(pdfBytes: Uint8Array) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const logoResponse = await fetch('/mainlogo.png');
      const logoBytes = await logoResponse.arrayBuffer();
      const logoImage = await pdfDoc.embedPng(logoBytes);

      // Increase scale to 0.20 (20% of original size)
      const logoDims = logoImage.scale(0.20);

      const pages = pdfDoc.getPages();
      pages.forEach(page => {
        const { width, height } = page.getSize();
        const margin = 20;

        // Adjust position calculation for larger size
        page.drawImage(logoImage, {
          x: width - logoDims.width - margin,
          y: height - logoDims.height - margin,
          width: logoDims.width,
          height: logoDims.height,
          opacity: 0.3 // Slightly more visible
        });
      });

      return await pdfDoc.save();
    } catch (error) {
      console.error('Error adding watermark:', error);
      return pdfBytes;
    }
  }

  const handleExport = async (format: "csv" | "pdf" | "word") => {
    if (!sowResponse) return;

    if (format === "csv") {
      // Create CSV content
      const csvRows = [
        // Headers
        ["Subject", "Topic", "Year", "Total Lessons", "Lesson Duration"],
        // Overview data
        [
          sowResponse.data.subject,
          sowResponse.data.topic,
          sowResponse.data.ageGroup.year,
          sowResponse.data.lessons.length,
          `${sowResponse.data.lessons[0].duration} mins`,
        ],
        // Empty row for spacing
        [],
        // Lessons header
        [
          "Lesson Number",
          "Title",
          "Duration",
          "Learning Objectives",
          "Key Activities and Resources",
          "Stretch/Challenge Tasks",
          "Scaffolding/Support",
          "Reflection/Metacognition",
          "Cross-Curricular Links",
        ],
      ];

      // Add lesson data
      sowResponse.data.lessons.forEach((lesson: any) => {
        csvRows.push([
          lesson.lessonNumber,
          lesson.title,
          `${lesson.duration} mins`,
          lesson.learningObjectives.join("\n"),
          lesson.activities
            .map(
              (a: any) =>
                `${a.title}: ${a.description}${a.resources ? `\nResources: ${a.resources.join(", ")}` : ""
                }`
            )
            .join("\n"),
          lesson.stretchTasks ? lesson.stretchTasks.join("\n") : "",
          lesson.scaffoldingStrategies
            ? lesson.scaffoldingStrategies.join("\n")
            : "",
          lesson.reflectionPrompts ? lesson.reflectionPrompts.join("\n") : "",
          lesson.crossCurricularLinks
            ? lesson.crossCurricularLinks.join("\n")
            : "",
        ]);
      });

      const csvContent = csvRows
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, "scheme_of_work.csv");
    } else if (format === "pdf") {
      const doc = new jsPDF("landscape");
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 10;

      // Table configuration
      const headers = [
        "No.",
        "Title",
        "Duration",
        "Learning Objectives",
        "Key Activities and Resources",
        "Stretch/Challenge Tasks",
        "Scaffolding/Support",
        "Reflection/Metacognition",
        "Cross-Curricular Links",
      ];

      // Column widths in proportion
      const colWidths = [
        8, // Lesson
        20, // Title
        15, // Duration
        45, // Learning Objectives
        50, // Activities
        30, // Stretch
        30, // Scaffolding
        30, // Reflection
        45, // Cross-Curricular
      ];

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Scheme of Work", pageWidth / 2, margin, { align: "center" });

      // Overview
      doc.setFontSize(10);
      doc.text(`Subject: ${sowResponse.data.subject}`, margin, margin + 10);
      doc.text(`Topic: ${sowResponse.data.topic}`, margin + 100, margin + 10);
      doc.text(
        `Year Group: ${sowResponse.data.ageGroup.year}`,
        margin + 200,
        margin + 10
      );

      // Start position for table
      let startY = margin + 20;
      const rowHeight = 30;

      // Function to draw cell borders
      const drawCell = (
        x: number,
        y: number,
        width: number,
        height: number
      ) => {
        doc.rect(x, y, width, height);
      };

      // Function to add multiline text in a cell
      const addCellText = (
        text: string,
        x: number,
        y: number,
        width: number
      ) => {
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(text, width - 4);
        doc.text(lines, x + 2, y + 4);
        return lines.length * 3.5; // Return actual height used by text
      };

      // Draw headers
      let currentX = margin;
      doc.setFillColor(240, 240, 240);
      headers.forEach((header, i) => {
        // Draw header cell with gray background
        doc.setFillColor(240, 240, 240);
        doc.rect(currentX, startY, colWidths[i], 8, "F");
        drawCell(currentX, startY, colWidths[i], 8);

        // Add header text
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(header, currentX + 2, startY + 5);

        currentX += colWidths[i];
      });

      // Draw rows
      let currentY = startY + 8;
      sowResponse.data.lessons.forEach((lesson: any) => {
        // Calculate heights for all cells first
        const cellHeights = [];
        currentX = margin;

        // Calculate all cell heights first
        const lessonHeight =
          doc.splitTextToSize(lesson.lessonNumber.toString(), colWidths[0] - 4)
            .length * 3.5;
        const durationHeight =
          doc.splitTextToSize(`${lesson.duration} mins`, colWidths[2] - 4)
            .length * 3.5;

        const objectives = lesson.learningObjectives
          .map((obj: string) => `• ${obj}`)
          .join("\n");
        const objectivesHeight =
          doc.splitTextToSize(objectives, colWidths[3] - 4).length * 3.5;

        const activities = lesson.activities
          .map(
            (act: any) =>
              `• ${act.title}\n${act.description}${act.resources ? `\nResources: ${act.resources.join(", ")}` : ""
              }`
          )
          .join("\n");
        const activitiesHeight =
          doc.splitTextToSize(activities, colWidths[4] - 4).length * 3.5;

        const stretchTasks = lesson.stretchTasks
          ? lesson.stretchTasks.map((task: string) => `• ${task}`).join("\n")
          : "";
        const stretchHeight =
          doc.splitTextToSize(stretchTasks, colWidths[5] - 4).length * 3.5;

        const scaffolding = lesson.scaffoldingStrategies
          ? lesson.scaffoldingStrategies
            .map((strategy: string) => `• ${strategy}`)
            .join("\n")
          : "";
        const scaffoldingHeight =
          doc.splitTextToSize(scaffolding, colWidths[6] - 4).length * 3.5;

        const reflection = lesson.reflectionPrompts
          ? lesson.reflectionPrompts
            .map((prompt: string) => `• ${prompt}`)
            .join("\n")
          : "";
        const reflectionHeight =
          doc.splitTextToSize(reflection, colWidths[7] - 4).length * 3.5;

        const links = lesson.crossCurricularLinks
          ? lesson.crossCurricularLinks
            .map((link: string) => `• ${link}`)
            .join("\n")
          : "";
        const linksHeight =
          doc.splitTextToSize(links, colWidths[8] - 4).length * 3.5;

        cellHeights.push(
          lessonHeight,
          durationHeight,
          objectivesHeight,
          activitiesHeight,
          stretchHeight,
          scaffoldingHeight,
          reflectionHeight,
          linksHeight
        );

        // Calculate total row height needed
        const rowHeight = Math.max(...cellHeights) + 6;

        // Check if we need a new page BEFORE drawing the row
        if (currentY + rowHeight > pageHeight - margin) {
          doc.addPage();
          currentY = margin;

          // Redraw headers on new page
          currentX = margin;
          headers.forEach((header, i) => {
            doc.setFillColor(240, 240, 240);
            doc.rect(currentX, currentY, colWidths[i], 8, "F");
            drawCell(currentX, currentY, colWidths[i], 8);
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.text(header, currentX + 2, currentY + 5);
            currentX += colWidths[i];
          });
          currentY += 8;
        }

        // Now draw all cells with the calculated height
        currentX = margin;
        doc.setFont("helvetica", "normal");

        // Draw cells and add content
        drawCell(currentX, currentY, colWidths[0], rowHeight);
        addCellText(
          lesson.lessonNumber.toString(),
          currentX,
          currentY,
          colWidths[0]
        );
        currentX += colWidths[0];

        drawCell(currentX, currentY, colWidths[1], rowHeight);
        addCellText(lesson.title, currentX, currentY, colWidths[1]);
        currentX += colWidths[1];

        drawCell(currentX, currentY, colWidths[2], rowHeight);
        addCellText(
          `${lesson.duration} mins`,
          currentX,
          currentY,
          colWidths[2]
        );
        currentX += colWidths[2];

        drawCell(currentX, currentY, colWidths[3], rowHeight);
        addCellText(objectives, currentX, currentY, colWidths[3]);
        currentX += colWidths[3];

        drawCell(currentX, currentY, colWidths[4], rowHeight);
        addCellText(activities, currentX, currentY, colWidths[4]);
        currentX += colWidths[4];

        drawCell(currentX, currentY, colWidths[5], rowHeight);
        addCellText(stretchTasks, currentX, currentY, colWidths[5]);
        currentX += colWidths[5];

        drawCell(currentX, currentY, colWidths[6], rowHeight);
        addCellText(scaffolding, currentX, currentY, colWidths[6]);
        currentX += colWidths[6];

        drawCell(currentX, currentY, colWidths[7], rowHeight);
        addCellText(reflection, currentX, currentY, colWidths[7]);
        currentX += colWidths[7];

        drawCell(currentX, currentY, colWidths[8], rowHeight);
        addCellText(links, currentX, currentY, colWidths[8]);

        currentY += rowHeight;
      });

      // doc.save("scheme_of_work.pdf");
      const pdfBytes = doc.output('arraybuffer');
      const watermarkedPdf = await addWatermarkToPDF(new Uint8Array(pdfBytes));

      const blob = new Blob([watermarkedPdf], { type: 'application/pdf' });
      saveAs(blob, "scheme_of_work.pdf");

    } else if (format === "word") {
      // Create document with full table format matching the HTML
      const downloadAsWord = async () => {
        if (!sowResponse || !sowResponse.data) return;

        try {
          // Load the watermark image
          const imageUrl = "/mainlogo.png";
          const response = await fetch(imageUrl);
          const imageBuffer = await response.arrayBuffer();

          // Create a new document with a watermark in the header
          const doc = new Document({
            sections: [
              {
                headers: {
                  default: new Header({
                    children: [
                      new Paragraph({
                        children: [
                          new ImageRun({
                            data: imageBuffer,
                            transformation: { width: 50, height: 50 }, // Small watermark size
                            type: 'png',
                          }),
                        ],
                        alignment: AlignmentType.RIGHT, // Align watermark to the right
                      }),
                    ],
                  }),
                },
                properties: {
                  page: {
                    margin: {
                      top: 720,
                      right: 720,
                      bottom: 720,
                      left: 720,
                    },
                    size: {
                      width: 16838, // Landscape width
                      height: 11907, // Landscape height
                    },
                  },
                },
                children: [
                  // Title
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Scheme of Work",
                        bold: true,
                        size: 28,
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 300 },
                  }),

                  // Overview section
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Overview",
                        bold: true,
                        size: 24,
                      }),
                    ],
                    spacing: { after: 200 },
                  }),

                  new Paragraph({
                    children: [new TextRun({ text: `Subject: ${sowResponse.data.subject}` })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: `Topic: ${sowResponse.data.topic}` })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: `Year Group: ${sowResponse.data.ageGroup.year}` })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: `Total Lessons: ${sowResponse.data.lessons.length}` })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: `Lesson Duration: ${sowResponse.data.lessons[0].duration} minutes` })],
                    spacing: { after: 300 },
                  }),

                  // Detailed lessons table
                  new Table({
                    width: {
                      size: 100,
                      type: WidthType.PERCENTAGE,
                    },
                    rows: [
                      new TableRow({
                        tableHeader: true,
                        children: [
                          new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "Lesson", bold: true })] })],
                          }),
                          new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "Duration", bold: true })] })],
                          }),
                          new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "Learning Objectives", bold: true })] })],
                          }),
                          new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "Key Activities and Resources", bold: true })] })],
                          }),
                          new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "Stretch/Challenge Tasks", bold: true })] })],
                          }),
                          new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "Scaffolding/Support", bold: true })] })],
                          }),
                          new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "Reflection/Metacognition", bold: true })] })],
                          }),
                          new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: "Cross-Curricular Links", bold: true })] })],
                          }),
                        ],
                      }),
                      ...sowResponse.data.lessons.map((lesson) =>
                        new TableRow({
                          children: [
                            new TableCell({
                              children: [new Paragraph({ children: [new TextRun({ text: `${lesson.lessonNumber}. ${lesson.title}` })] })],
                            }),
                            new TableCell({
                              children: [new Paragraph({ children: [new TextRun({ text: `${lesson.duration} mins` })] })],
                            }),
                            new TableCell({
                              children: lesson.learningObjectives.map((obj) =>
                                new Paragraph({ children: [new TextRun({ text: obj })], bullet: { level: 0 } })
                              ),
                            }),
                            new TableCell({
                              children: lesson.activities.flatMap((activity) => [
                                new Paragraph({ children: [new TextRun({ text: activity.title, bold: true })] }),
                                new Paragraph({ children: [new TextRun({ text: activity.description })] }),
                              ]),
                            }),
                            new TableCell({
                              children: lesson.stretchTasks ? lesson.stretchTasks.map((task) =>
                                new Paragraph({ children: [new TextRun({ text: task })], bullet: { level: 0 } })
                              ) : [new Paragraph("")],
                            }),
                            new TableCell({
                              children: lesson.scaffoldingStrategies ? lesson.scaffoldingStrategies.map((strategy) =>
                                new Paragraph({ children: [new TextRun({ text: strategy })], bullet: { level: 0 } })
                              ) : [new Paragraph("")],
                            }),
                            new TableCell({
                              children: lesson.reflectionPrompts ? lesson.reflectionPrompts.map((prompt) =>
                                new Paragraph({ children: [new TextRun({ text: prompt })], bullet: { level: 0 } })
                              ) : [new Paragraph("")],
                            }),
                            new TableCell({
                              children: lesson.crossCurricularLinks ? lesson.crossCurricularLinks.map((link) =>
                                new Paragraph({ children: [new TextRun({ text: link })], bullet: { level: 0 } })
                              ) : [new Paragraph("")],
                            }),
                          ],
                        })
                      ),
                    ],
                  }),
                ],
              },
            ],
          });

          const blob = await Packer.toBlob(doc);
          saveAs(blob, "scheme_of_work.docx");
          toast.success("Word document downloaded successfully!");
        } catch (error) {
          toast.error("Failed to download Word document");
          console.error("Error generating Word document:", error);
        }
      };

      downloadAsWord();
    }
  };

  const exportOptions = [
    {
      label: "Export CSV",
      value: "csv",
      onClick: () => handleExport("csv"),
    },
    {
      label: "Export PDF",
      value: "pdf",
      onClick: () => handleExport("pdf"),
    },
    {
      label: "Export Word",
      value: "word",
      onClick: () => handleExport("word"),
    },
  ];

  return (
    <div className='min-h-screen bg-white py-12'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className='container mx-auto px-4 py-12'>
        <div className='flex justify-end mb-4'>
          <ReportButton toolType='sow' position='inline' variant='pre' />
        </div>
        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            Scheme of Work Generator
          </h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Create comprehensive schemes of work with detailed lesson plans,
            objectives, and cross-curricular links.
          </p>
        </div>

        <div className=''>
          {/* Form Card */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            {isFromApprovedUrl && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-blue-800 text-sm mb-4">
                <p className="font-medium">All form fields are locked based on approved content</p>
                <p>The subject, topic, year group, total lessons, lesson duration, emphasis areas, and difficulty level are locked. You can click "Generate Scheme of Work" to view the approved content.</p>
              </div>
            )}
            <form ref={formRef} onSubmit={handleSubmit} className='space-y-6'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='subject'>Subject</Label>
                  <Input
                    id='subject'
                    name='subject'
                    required
                    placeholder='e.g., Mathematics'
                    disabled={isFromApprovedUrl}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='topic'>Topic</Label>
                  <Input
                    id='topic'
                    name='topic'
                    required
                    placeholder='e.g., Algebra Basics'
                    disabled={isFromApprovedUrl}
                  />
                </div>
              </div>

              <div className='grid grid-cols-1 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='year'>Year Group</Label>
                  <Input
                    id='year'
                    name='year'
                    type='number'
                    required
                    min={1}
                    max={13}
                    disabled={isFromApprovedUrl}
                  />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='totalLessons'>Total Lessons</Label>
                  <Input
                    id='totalLessons'
                    name='totalLessons'
                    type='number'
                    required
                    min={1}
                    max={50}
                    disabled={isFromApprovedUrl}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='lessonDuration'>
                    Lesson Duration (minutes)
                  </Label>
                  <Input
                    id='lessonDuration'
                    name='lessonDuration'
                    type='number'
                    required
                    min={1}
                    max={180}
                    placeholder='Enter duration in minutes'
                    disabled={isFromApprovedUrl}
                  />
                  <p className='text-sm text-gray-500'>
                    Enter duration between 1-180 minutes
                  </p>
                </div>
              </div>

              <div className='space-y-2'>
                <Label>Emphasis Areas - (Select at least one)</Label>
                <div className='grid grid-cols-2 gap-4'>
                  {emphasisAreas.map((area) => (
                    <div key={area} className='flex items-center space-x-2'>
                      <Checkbox
                        id={area}
                        checked={selectedEmphasis.includes(area)}
                        onCheckedChange={() => !isFromApprovedUrl && handleEmphasisToggle(area)}
                        disabled={isFromApprovedUrl}
                      />
                      <Label htmlFor={area} className={`capitalize cursor-pointer ${isFromApprovedUrl ? 'opacity-70' : ''}`}>
                        {area}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='difficultyLevel'>Difficulty Level</Label>
                <Select name='difficultyLevel' defaultValue='intermediate' disabled={isFromApprovedUrl}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select difficulty level' />
                  </SelectTrigger>
                  <SelectContent>
                    {difficultyLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='flex items-center space-x-4'>
                <Checkbox
                  id='verification'
                  checked={isChecked}
                  onCheckedChange={() => setIsChecked(!isChecked)}
                  className='border-purple-400 data-[state=checked]:bg-purple-400'
                />
                <label
                  htmlFor='verification'
                  className='text-sm text-purple-400 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                >
                  I verify that I have not used any personal data such as
                  student names or private information. Instead of names, I have
                  referred to them as student, pupil or similar.
                </label>
              </div>

              <Button
                type='submit'
                disabled={
                  !isChecked || isLoading || (selectedEmphasis.length === 0 && !isFromApprovedUrl)
                }
                className='w-full'
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Generating...
                  </>
                ) : (
                  "Generate Scheme of Work"
                )}
              </Button>
            </form>
          </Card>

          {/* Results Card */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            {sowResponse?.data && (
              <div className='flex gap-4 mb-6 ml-2 justify-between'>
                <h2 className='text-2xl font-bold text-gray-900 mb-6'>
                  Generated Scheme of Work
                </h2>

                <div className='flex ml-2'>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/tools/sow-generator/${sowId}/view`}
                          className={buttonVariants({ variant: "outline" })}
                        >
                          <FileText className='w-4 h-4 mr-2' />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/tools/sow-generator/${sowId}/edit`}
                          className={buttonVariants({ variant: "outline" })}
                        >
                          <Edit className='w-4 h-4 mr-2' />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <ExportDropdown options={exportOptions} />
                </div>
              </div>
            )}

            {error && (
              <div className='bg-red-50 text-red-600 p-4 rounded-lg mb-6'>
                {error}
              </div>
            )}

            {isLoading ? (
              <div className='animate-pulse space-y-4'>
                <div className='h-4 bg-gray-200 rounded w-3/4'></div>
                <div className='h-4 bg-gray-200 rounded w-full'></div>
                <div className='h-4 bg-gray-200 rounded w-5/6'></div>
              </div>
            ) : sowResponse?.data ? (
              <div className='space-y-6'>
                {/* <div className=''>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/tools/sow-generator/${sowId}/view`}
                          className={buttonVariants({ variant: 'outline' })}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/tools/sow-generator/${sowId}/edit`}
                          className={buttonVariants({ variant: 'outline' })}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                         
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div> */}
                {/* Overview Section */}
                <div className='bg-white p-6 rounded-lg border border-gray-100'>
                  <h3 className='font-semibold text-gray-900 mb-3'>Overview</h3>
                  <div className='grid grid-cols-2 gap-4 text-sm'>
                    <p>Subject: {sowResponse.data.subject}</p>
                    <p>Topic: {sowResponse.data.topic}</p>
                    <p>Year: {sowResponse.data.ageGroup.year}</p>
                  </div>
                </div>

                {/* Table Section */}
                <div className='bg-white p-6 rounded-lg border border-gray-100 overflow-x-auto'>
                  <table className='min-w-full divide-y divide-gray-200 border border-gray-200'>
                    <thead>
                      <tr>
                        <th className='px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200'>
                          LESSON NUMBER
                        </th>
                        <th className='px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200'>
                          DURATION
                        </th>
                        <th className='px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200'>
                          LEARNING OBJECTIVES
                        </th>
                        <th className='px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200'>
                          KEY ACTIVITIES AND RESOURCES
                        </th>
                        <th className='px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200'>
                          STRETCH/CHALLENGE TASKS
                        </th>
                        <th className='px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200'>
                          SCAFFOLDING/SUPPORT STRATEGIES
                        </th>
                        <th className='px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200'>
                          REFLECTION/METACOGNITION PROMPTS
                        </th>
                        <th className='px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200'>
                          CROSS-CURRICULAR LINKS
                        </th>
                      </tr>
                    </thead>
                    <tbody className='bg-white divide-y divide-gray-200'>
                      {sowResponse.data.lessons.map((lesson, idx) => (
                        <tr
                          key={idx}
                          className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <td className='px-4 py-4 text-sm text-gray-900 align-top border border-gray-200'>
                            {lesson.lessonNumber} . {lesson.title}
                          </td>
                          <td className='px-4 py-4 text-sm text-gray-900 align-top border border-gray-200'>
                            {lesson.duration} mins
                          </td>
                          <td className='px-4 py-4 text-sm text-gray-900 align-top border border-gray-200'>
                            <ul className='list-disc list-inside'>
                              {lesson.learningObjectives.map((obj, i) => (
                                <li key={i}>{obj}</li>
                              ))}
                            </ul>
                          </td>
                          <td className='px-4 py-4 text-sm text-gray-900 align-top border border-gray-200'>
                            {lesson.activities.map((activity, i) => (
                              <div key={i} className='mb-2'>
                                <p className='font-medium'>{activity.title}</p>
                                <p>{activity.description}</p>
                                {activity.resources && (
                                  <ul className='list-disc list-inside mt-1'>
                                    {activity.resources.map((resource, ri) => (
                                      <li key={ri} className='text-gray-600'>
                                        {resource}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </td>
                          <td className='px-4 py-4 text-sm text-gray-900 align-top border border-gray-200'>
                            {lesson.stretchTasks && (
                              <ul className='list-disc list-inside'>
                                {lesson.stretchTasks.map((task, i) => (
                                  <li key={i}>{task}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className='px-4 py-4 text-sm text-gray-900 align-top border border-gray-200'>
                            {lesson.scaffoldingStrategies && (
                              <ul className='list-disc list-inside'>
                                {lesson.scaffoldingStrategies.map(
                                  (strategy, i) => (
                                    <li key={i}>{strategy}</li>
                                  )
                                )}
                              </ul>
                            )}
                          </td>
                          <td className='px-4 py-4 text-sm text-gray-900 align-top border border-gray-200'>
                            {lesson.reflectionPrompts && (
                              <ul className='list-disc list-inside'>
                                {lesson.reflectionPrompts.map((prompt, i) => (
                                  <li key={i}>{prompt}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className='px-4 py-4 text-sm text-gray-900 align-top border border-gray-200'>
                            {lesson.crossCurricularLinks && (
                              <ul className='list-disc list-inside'>
                                {lesson.crossCurricularLinks.map((link, i) => (
                                  <li key={i}>{link}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Metadata */}
                {/* <div className='text-sm text-gray-500 mt-4'>
                  <p>Author: {sowResponse.data.metadata.author}</p>
                  <p>
                    Created:{" "}
                    {new Date(
                      sowResponse.data.metadata.createdAt
                    ).toLocaleString()}
                  </p>
                  <p>Version: {sowResponse.data.metadata.version}</p>
                </div> */}
              </div>
            ) : (
              <p className='text-center text-gray-500'>
                Your generated scheme of work will appear here
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
