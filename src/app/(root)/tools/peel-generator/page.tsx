"use client";
import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { PEELResponse } from "@/schemas/peel-schema";
import { Checkbox } from "@/components/ui/checkbox";
import { ReportButton } from "@/components/ReportButton";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import { ExportDropdown } from "@/components/ExportDropdown";
import { PDFDocument } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, Header, ImageRun } from "docx";
import SubscriptionDialog from "@/components/SubscriptionDialog";

const complexityLevels = [
  { value: "basic", label: "Basic" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const toneOptions = [
  { value: "formal", label: "Formal" },
  { value: "academic", label: "Academic" },
  { value: "explanatory", label: "Explanatory" },
];

const audienceOptions = [
  { value: "key-stage-3", label: "Key Stage 3" },
  { value: "gcse", label: "GCSE" },
  { value: "a-level", label: "A-Level" },
];

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

export default function PEELGeneratorPage() {
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [peelResponse, setPEELResponse] = useState<any>(null);
  const [error, setError] = useState("");
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [savedPeelId, setSavedPeelId] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchApprovedPeel = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const approvedId = searchParams.get('approved');

      if (approvedId) {
        setIsLoading(true);
        try {
          console.log("Fetching approved PEEL with ID:", approvedId);
          
          // Use /api/tools/peel-generator?approved={id} format
          const apiUrl = `/api/tools/peel-generator?approved=${approvedId}`;
          console.log("API URL:", apiUrl);
          
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Error response:", response.status, errorText);
            
            if (response.status === 403) {
              setError(`Content not approved: ${JSON.parse(errorText).details?.status || 'Unknown status'}`);
              return;
            }
            
            throw new Error(`Failed to fetch PEEL data: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          const data = await response.json();
          console.log("API Response:", data);

          if (!data || !data.input_data) {
            console.error("Invalid API response format:", data);
            throw new Error('Invalid response format');
          }

          // Make sure we handle the case where data.content is null or undefined
          const peel_content = data.content || {};
          setPEELResponse({ data: { peel_content } });
          setSavedPeelId(approvedId);

          // Auto-check the verification checkbox when loading an approved PEEL
          setIsChecked(true);

          if (data.input_data) {
            const form = formRef.current;
            if (form) {
              // Ensure topic is set even if the field is disabled
              const topicInput = form.querySelector('input[name="topic"]') as HTMLInputElement;
              if (topicInput) {
                topicInput.value = data.input_data.topic || '';
              }
              
              form.subject.value = data.input_data.subject || '';
              
              if (form.complexity && data.input_data.complexity) {
                form.complexity.value = data.input_data.complexity;
              }
              
              if (form.tone && data.input_data.tone) {
                form.tone.value = data.input_data.tone;
              }
              
              if (form.audience && data.input_data.audience) {
                form.audience.value = data.input_data.audience;
              }
              
              if (data.input_data.word_count_range) {
                if (form.wordCountMin) {
                  form.wordCountMin.value = data.input_data.word_count_range.min || '';
                }
                if (form.wordCountMax) {
                  form.wordCountMax.value = data.input_data.word_count_range.max || '';
                }
              }
            }
          }
        } catch (err: any) {
          console.error('Error loading PEEL data:', err);
          setError(err.message || 'Failed to load PEEL data');
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchApprovedPeel();
  }, []);

  const handleExport = async (format: "text" | "pdf" | "word") => {
    if (format === "pdf") {
      const doc = new jsPDF();

      let yPosition = 20;
      const leftMargin = 20;
      const pageWidth = doc.internal.pageSize.width;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("PEEL Paragraph Analysis", pageWidth / 2, yPosition, {
        align: "center",
      });
      yPosition += 15;

      const addSection = (title: string, content: string) => {
        // Add section title
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(title, leftMargin, yPosition);
        yPosition += 7;

        // Add section content
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        // Split text into lines that fit the page width
        const contentLines = doc.splitTextToSize(
          content,
          pageWidth - leftMargin * 2
        );

        contentLines.forEach((line: string) => {
          // Check if we need a new page
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, leftMargin, yPosition);
          yPosition += 6;
        });

        yPosition += 10; // Add space between sections
      };

      // Add each section
      addSection("Point", peelResponse.data.peel_content.point);
      addSection("Evidence", peelResponse.data.peel_content.evidence);
      addSection("Explanation", peelResponse.data.peel_content.explanation);
      addSection("Link", peelResponse.data.peel_content.link);

      yPosition += 5;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Feedback", leftMargin, yPosition);
      yPosition += 10;

      addSection(
        "Strengths",
        peelResponse.data.peel_content.feedback.strengths
      );
      addSection(
        "Areas for Improvement",
        peelResponse.data.peel_content.feedback.improvements
      );
      // Replace doc.save() with watermarked version
      const pdfBytes = doc.output('arraybuffer');
      const watermarkedPdf = await addWatermarkToPDF(new Uint8Array(pdfBytes));

      const blob = new Blob([watermarkedPdf], { type: 'application/pdf' });
      saveAs(blob, "peel-paragraph.pdf");
    } else if (format === "text") {
      const content = `
      Point: ${peelResponse.data.peel_content.point}
      Evidence: ${peelResponse.data.peel_content.evidence}
      Explanation: ${peelResponse.data.peel_content.explanation}
      Link: ${peelResponse.data.peel_content.link}

      Feedback:
      Strengths: ${peelResponse.data.peel_content.feedback.strengths}
      Improvements: ${peelResponse.data.peel_content.feedback.improvements}
    `;

      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      saveAs(blob, "peel-paragraph.txt");
    } else if (format === "word") {
      // Fixed Word export implementation
      const downloadAsWord = async () => {
        try {
          // Load the watermark image
          const imageUrl = "/mainlogo.png";
          const response = await fetch(imageUrl);
          const imageBuffer = await response.arrayBuffer();

          // Create a header with the watermark image
          const header = new Header({
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imageBuffer,
                    transformation: { width: 50, height: 50 }, // Adjust size
                    type: "png",
                  }),
                ],
                alignment: "right", // Align watermark to the right
              }),
            ],
          });

          // Construct the document with watermark
          const doc = new Document({
            sections: [
              {
                headers: { default: header },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "PEEL Paragraph Analysis",
                        bold: true,
                        size: 36,
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Point:", bold: true, size: 28 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: peelResponse.data.peel_content.point, size: 24 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Evidence:", bold: true, size: 28 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: peelResponse.data.peel_content.evidence, size: 24 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Explanation:", bold: true, size: 28 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: peelResponse.data.peel_content.explanation, size: 24 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Link:", bold: true, size: 28 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: peelResponse.data.peel_content.link, size: 24 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Feedback:", bold: true, size: 28 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Strengths:", bold: true, size: 26 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: peelResponse.data.peel_content.feedback.strengths, size: 24 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: "Areas for Improvement:", bold: true, size: 26 })],
                  }),
                  new Paragraph({
                    children: [new TextRun({ text: peelResponse.data.peel_content.feedback.improvements, size: 24 })],
                  }),
                ],
              },
            ],
          });

          // Generate the document
          const blob = await Packer.toBlob(doc);

          // Save the document
          saveAs(blob, "peel-paragraph.docx");

          console.log("Word document generated successfully!");
        } catch (error) {
          console.error("Error generating Word document:", error);
        }
      };

      // Call the function to download
      downloadAsWord();
    }
  };

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

    setIsLoading(true);
    setError("");
    setPEELResponse(null);

    if (!formRef.current) {
      console.error("Form reference is null");
      return;
    }
    const formData = new FormData(formRef.current);
    
    // Get the topic value, ensuring it's not null even if the field is disabled
    let topic = formData.get("topic") as string;
    
    // If topic is empty but we have a savedPeelId, try to get it from the form element directly
    if ((!topic || topic.trim() === '') && savedPeelId && formRef.current) {
      const topicInput = formRef.current.querySelector('input[name="topic"]') as HTMLInputElement;
      if (topicInput) {
        topic = topicInput.value;
      }
    }
    
    const subject = formData.get("subject") as string;
    const complexity = formData.get("complexity") as string;
    const tone = formData.get("tone") as string;
    const audience = formData.get("audience") as string;
    const minCount = parseInt(formData.get("wordCountMin") as string);
    const maxCount = parseInt(formData.get("wordCountMax") as string);

    // Skip validation when using an approved ID
    if (!savedPeelId) {
    // Validate all required fields
    if (!topic?.trim()) {
      setError("Please enter a topic");
      setIsLoading(false);
      return;
    }

    if (!subject?.trim()) {
      setError("Please enter a subject area");
      setIsLoading(false);
      return;
    }

    if (!complexity) {
      setError("Please select a complexity level");
      setIsLoading(false);
      return;
    }

    if (!tone) {
      setError("Please select a tone");
      setIsLoading(false);
      return;
    }

    if (!audience) {
      setError("Please select a target audience");
      setIsLoading(false);
      return;
    }

    // Validate word count range
    if (isNaN(minCount) || isNaN(maxCount)) {
      setError("Please specify both minimum and maximum word count");
      setIsLoading(false);
      return;
    }

    if (minCount > maxCount) {
      setError("Minimum word count cannot be greater than maximum word count");
      setIsLoading(false);
      return;
    }

    if (minCount < 0 || maxCount < 0) {
      setError("Word count cannot be negative");
      setIsLoading(false);
      return;
    }

    if (maxCount === 0) {
      setError("Maximum word count must be greater than 0");
      setIsLoading(false);
      return;
      }
    }

    const data = {
      topic,
      subject,
      complexity,
      tone,
      audience,
      wordCountRange: {
        min: minCount,
        max: maxCount,
      },
    };

    try {
      const response = await fetch(`/api/tools/peel-generator${savedPeelId ? `?approvedId=${savedPeelId}` : ''}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setPEELResponse(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate PEEL paragraph"
      );
    } finally {
      setIsLoading(false);
      setIsChecked(!isChecked);
    }
  };

  const exportOptions = [
    {
      label: "Export Text",
      value: "text",
      onClick: () => handleExport("text"),
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
    <div className='min-h-screen bg-white'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className='container mx-auto px-4 py-12'>
        <div className='flex justify-end mb-4'>
          <ReportButton toolType='peel' position='inline' variant='pre' />
        </div>

        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            PEEL Paragraph Generator
          </h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Generate well-structured paragraphs using the PEEL (Point, Evidence,
            Explanation, Link) format to enhance your writing.
          </p>
        </div>

        <div className='grid gap-8 lg:grid-cols-2 max-w-7xl mx-auto'>
          {/* Form Card */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            <form ref={formRef} onSubmit={handleSubmit} className='space-y-6'>
              <div className='space-y-2'>
                <Label htmlFor='topic'>Topic</Label>
                <Input
                  id='topic'
                  name='topic'
                  required
                  placeholder='Enter your topic...'
                  disabled={!!savedPeelId}
                  readOnly={!!savedPeelId}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='subject'>Subject Area</Label>
                <Input
                  id='subject'
                  name='subject'
                  required
                  placeholder='e.g., History, Science...'
                  // disabled={!!savedPeelId}
                  // readOnly={!!savedPeelId}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='complexity'>Complexity Level</Label>
                <Select name='complexity' defaultValue='intermediate' >
                {/* <Select name='complexity' defaultValue='intermediate' required disabled={!!savedPeelId}> */}
                  <SelectTrigger>
                    <SelectValue placeholder='Select complexity level' />
                  </SelectTrigger>
                  <SelectContent>
                    {complexityLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='tone'>Tone</Label>
                <Select name='tone'>
                {/* <Select name='tone' required disabled={!!savedPeelId}> */}
                  <SelectTrigger>
                    <SelectValue placeholder='Select tone' />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((tone) => (
                      <SelectItem key={tone.value} value={tone.value}>
                        {tone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='audience'>Target Audience</Label>
                <Select name='audience'>
                {/* <Select name='audience' required disabled={!!savedPeelId}> */}
                  <SelectTrigger>
                    <SelectValue placeholder='Select audience' />
                  </SelectTrigger>
                  <SelectContent>
                    {audienceOptions.map((audience) => (
                      <SelectItem key={audience.value} value={audience.value}>
                        {audience.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='wordCountRange'>Word Count Range</Label>
                <div className='flex gap-4'>
                  <Input
                    id='wordCountMin'
                    name='wordCountMin'
                    type='number'
                    placeholder='Min'
                    required
                    min={0}
                    // disabled={!!savedPeelId}
                    // readOnly={!!savedPeelId}
                  />
                  <Input
                    id='wordCountMax'
                    name='wordCountMax'
                    type='number'
                    placeholder='Max'
                    required
                    min={0}
                    // disabled={!!savedPeelId}
                    // readOnly={!!savedPeelId}
                  />
                </div>
              </div>

              <div className='flex items-center space-x-4'>
                <Checkbox
                  id='verification'
                  checked={isChecked}
                  onCheckedChange={() => setIsChecked(!isChecked)}
                  className='border-purple-400 data-[state=checked]:bg-purple-400'
                  // disabled={!!savedPeelId}
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
                disabled={!isChecked || isLoading}
                className='w-full'
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Generating...
                  </>
                ) : savedPeelId ? (
                  "Regenerate PEEL Paragraph"
                ) : (
                  "Generate PEEL Paragraph"
                )}
              </Button>
            </form>
          </Card>

          {/* Results Card */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            <div className='flex justify-between items-center mb-6'>
              <h2 className='text-2xl font-bold text-gray-900'>
                Generated PEEL Paragraph
              </h2>
              {peelResponse && (
                <ReportButton
                  toolType='peel'
                  resultId={peelResponse.id}
                  position='inline'
                />
              )}
            </div>

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
            ) : peelResponse?.data ? (
              <div className='space-y-6'>
                <div className='flex gap-4'>
                  <ExportDropdown options={exportOptions} />
                </div>

                {/* Point Section */}
                {peelResponse.data.peel_content?.point && (
                  <div className='bg-white p-6 rounded-lg border border-gray-100'>
                    <h3 className='font-semibold text-gray-900 mb-3'>Point</h3>
                    <p className='text-gray-700'>
                      {peelResponse.data.peel_content.point}
                    </p>
                  </div>
                )}

                {/* Evidence Section */}
                {peelResponse.data.peel_content?.evidence && (
                  <div className='bg-white p-6 rounded-lg border border-gray-100'>
                    <h3 className='font-semibold text-gray-900 mb-3'>Evidence</h3>
                    <p className='text-gray-700'>
                      {peelResponse.data.peel_content.evidence}
                    </p>
                  </div>
                )}

                {/* Explanation Section */}
                {peelResponse.data.peel_content?.explanation && (
                  <div className='bg-white p-6 rounded-lg border border-gray-100'>
                    <h3 className='font-semibold text-gray-900 mb-3'>
                      Explanation
                    </h3>
                    <p className='text-gray-700'>
                      {peelResponse.data.peel_content.explanation}
                    </p>
                  </div>
                )}

                {/* Link Section */}
                {peelResponse.data.peel_content?.link && (
                  <div className='bg-white p-6 rounded-lg border border-gray-100'>
                    <h3 className='font-semibold text-gray-900 mb-3'>Link</h3>
                    <p className='text-gray-700'>
                      {peelResponse.data.peel_content.link}
                    </p>
                  </div>
                )}

                {/* Feedback Section */}
                {peelResponse.data.peel_content?.feedback && (
                  <div className='bg-white p-6 rounded-lg border border-gray-100'>
                    <h3 className='font-semibold text-gray-900 mb-3'>Feedback</h3>
                    <div className='space-y-4'>
                      {peelResponse.data.peel_content.feedback.strengths && (
                        <div>
                          <h4 className='font-medium text-gray-900'>Strengths</h4>
                          <p className='text-gray-700'>
                            {peelResponse.data.peel_content.feedback.strengths}
                          </p>
                        </div>
                      )}
                      {peelResponse.data.peel_content.feedback.improvements && (
                        <div>
                          <h4 className='font-medium text-gray-900'>
                            Improvements
                          </h4>
                          <p className='text-gray-700'>
                            {peelResponse.data.peel_content.feedback.improvements}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className='text-center text-gray-500'>
                Your generated PEEL paragraph will appear here
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
