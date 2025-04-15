"use client";
import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Share2, Loader2, FileDown } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import jsPDF from "jspdf";
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import SubscriptionDialog from "@/components/SubscriptionDialog";

interface Evaluation {
  id?: string;
  highExpectationsAndPriorKnowledge?: {
    rating?: "🟢" | "🟡" | "🔴";
    areasOfStrength?: string[];
    ideasForDevelopment?: string[];
  };
  pupilProgressAndInclusion?: {
    rating?: "🟢" | "🟡" | "🔴";
    areasOfStrength?: string[];
    ideasForDevelopment?: string[];
  };
  assessmentAndFeedback?: {
    rating?: "🟢" | "🟡" | "🔴";
    areasOfStrength?: string[];
    ideasForDevelopment?: string[];
  };
  adaptiveTeachingAndCognitiveScience?: {
    rating?: "🟢" | "🟡" | "🔴";
    areasOfStrength?: string[];
    ideasForDevelopment?: string[];
  };
  metacognitionAndProfessionalReflection?: {
    rating?: "🟢" | "🟡" | "🔴";
    areasOfStrength?: string[];
    ideasForDevelopment?: string[];
  };
  lessonStructureAndBehaviourManagement?: {
    rating?: "🟢" | "🟡" | "🔴";
    areasOfStrength?: string[];
    ideasForDevelopment?: string[];
  };
  criticalThinkingAndCommunication?: {
    rating?: "🟢" | "🟡" | "🔴";
    areasOfStrength?: string[];
    ideasForDevelopment?: string[];
  };
  finalEvaluation?: {
    overallRating?: "🟢" | "🟡" | "🔴";
    summary?: string;
    keyStrengths?: string[];
    developmentAreas?: string[];
  };
}

const getRatingDetails = (rating: "🟢" | "🟡" | "🔴" | undefined) => {
  switch (rating) {
    case "🟢":
      return {
        color: [0, 200, 0] as [number, number, number], // Type assertion as tuple
        text: "Strong performance with clear evidence of effectiveness.",
      };
    case "🟡":
      return {
        color: [255, 191, 0] as [number, number, number],
        text: "Satisfactory with some areas for improvement.",
      };
    case "🔴":
      return {
        color: [255, 0, 0] as [number, number, number],
        text: "Needs significant improvement and development.",
      };
    default:
      return {
        color: [128, 128, 128] as [number, number, number],
        text: "Not evaluated",
      };
  }
};

const LessonPlanEvaluator = () => {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);

  const validateFileType = (file: File) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Only PDF and DOC/DOCX files are supported");
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      try {
        validateFileType(selectedFile);
        setFile(selectedFile);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "Invalid file type");
        setFile(null);
      }
    }
  };

  const renderEvaluationSection = (
    title: string,
    data?: {
      rating?: string;
      areasOfStrength?: string[];
      ideasForDevelopment?: string[];
    }
  ) => {
    if (!data) return null;

    return (
      <div className='mb-6 bg-white p-4 rounded-lg shadow'>
        <h3 className='text-xl font-semibold flex items-center gap-2 mb-3'>
          {title} <span className='text-2xl'>{data.rating || "⚪"}</span>
        </h3>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <h4 className='font-medium text-[#98CDC6] mb-2'>
              Areas of Strength
            </h4>
            {data.areasOfStrength && data.areasOfStrength.length > 0 ? (
              <ul className='list-disc pl-4 space-y-1'>
                {data.areasOfStrength.map((strength, idx) => (
                  <li key={idx} className='text-gray-700'>
                    {strength}
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-gray-500 italic'>
                No areas of strength identified
              </p>
            )}
          </div>
          <div>
            <h4 className='font-medium text-[#98CDC6] mb-2'>
              Ideas for Development
            </h4>
            {data.ideasForDevelopment && data.ideasForDevelopment.length > 0 ? (
              <ul className='list-disc pl-4 space-y-1'>
                {data.ideasForDevelopment.map((idea, idx) => (
                  <li key={idx} className='text-gray-700'>
                    {idea}
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-gray-500 italic'>
                No development ideas provided
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFinalEvaluation = (
    finalEvaluation?: Evaluation["finalEvaluation"]
  ) => {
    if (!finalEvaluation) return null;

    return (
      <>
        {/* {evaluation && (
          <div className='flex space-x-3 mb-4'>
            <Button
              onClick={() => {
                const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tools/lesson-plan-evaluator/${evaluation.id}/view`;
                navigator.clipboard.writeText(shareUrl);
              }}
              variant='outline'
              size='icon'
              className='w-9 h-9'
            >
              <Share2 className='h-4 w-4' />
            </Button>
            <Link
              href={`/tools/lesson-plan-evaluator/${evaluation.id}/view`}
              className='inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9'
            >
              <Eye className='h-4 w-4' />
            </Link>
            <Link
              href={`/tools/lesson-plan-evaluator/${evaluation.id}/edit`}
              className='inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9'
            >
              <Edit className='h-4 w-4' />
            </Link>
          </div>
        )} */}
        <div className='bg-gray-50 p-6 rounded-lg border-2 border-[#98CDC6] mt-6'>
          <h3 className='text-2xl font-bold flex items-center gap-2 mb-4'>
            Final Evaluation{" "}
            <span className='text-2xl'>
              {finalEvaluation?.overallRating || "⚪"}
            </span>
          </h3>
          {finalEvaluation?.summary ? (
            <p className='text-gray-700 mb-4'>{finalEvaluation.summary}</p>
          ) : (
            <p className='text-gray-500 italic mb-4'>No summary provided</p>
          )}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <h4 className='font-medium text-[#98CDC6] mb-2'>Key Strengths</h4>
              {finalEvaluation?.keyStrengths &&
                finalEvaluation.keyStrengths.length > 0 ? (
                <ul className='list-disc pl-4 space-y-1'>
                  {finalEvaluation.keyStrengths.map((strength, idx) => (
                    <li key={idx} className='text-gray-700'>
                      {strength}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className='text-gray-500 italic'>
                  No key strengths identified
                </p>
              )}
            </div>
            <div>
              <h4 className='font-medium text-[#98CDC6] mb-2'>
                Development Areas
              </h4>
              {finalEvaluation?.developmentAreas &&
                finalEvaluation.developmentAreas.length > 0 ? (
                <ul className='list-disc pl-4 space-y-1'>
                  {finalEvaluation.developmentAreas.map((area, idx) => (
                    <li key={idx} className='text-gray-700'>
                      {area}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className='text-gray-500 italic'>
                  No development areas identified
                </p>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

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

    if (!file || !name || !isChecked) {
      setError(
        "Please fill in all required fields and check the verification box."
      );
      setEvaluation(null);
      return;
    }

    setUploading(true);
    setError(null);
    setEvaluation(null);

    try {
      const fileExt = file.name.split(".").pop();
      // Generate a cryptographically secure random filename
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const fileName = `${array[0]}.${fileExt}`;

      const filePath = `lesson-plans/${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw new Error(uploadError.message || "Upload failed");

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);
      if (!urlData) throw new Error("Failed to get public URL");

      const fileUrl = urlData.publicUrl;

      const response = await fetch("/api/tools/lesson-plan-evaluator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileUrl: fileUrl,
          name: name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed with status: ${response.status}`);
      }

      if (!result?.data) {
        throw new Error("Received empty response from server");
      }

      setEvaluation(result.data);
      setError(null);

    } catch (err: any) {
      console.error("Error during submission:", err);
      setError(err?.message || "An unknown error occurred");
      setEvaluation(null);
    } finally {
      setUploading(false);
      setIsChecked(!isChecked);
    }
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

  const handleDownloadPDF = async (evaluation: Evaluation) => {
    const doc = new jsPDF();

    // Set title with better styling
    doc.setFillColor(255, 255, 255); // Blue header background
    doc.rect(0, 0, doc.internal.pageSize.width, 30, "F");
    doc.setTextColor(0, 0, 0); // White text
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Lesson Plan Evaluation: Full Report", 20, 20);

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Table configuration
    const startY = 40;
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const usableWidth = pageWidth - 2 * margin;
    const lineHeight = 7;
    const cellPadding = 5;

    // Column widths (adjusted for better proportions)
    const colWidths = {
      category: usableWidth * 0.34,
      strength: usableWidth * 0.33,
      development: usableWidth * 0.33,
    };

    let currentY = startY;

    // Headers with improved styling
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, currentY - 5, usableWidth, 12, "F");

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const headers = [
      "Category",
      "Areas of Strength",
      "Ideas for Development",
    ];
    const headerPositions = [
      margin,
      margin + colWidths.category,
      margin + colWidths.category + colWidths.strength,
    ];

    // Center align and wrap headers
    headers.forEach((header, i) => {
      const headerWidth = i === 0 ? colWidths.category : (i === 1 ? colWidths.strength : colWidths.development);
      const headerLines = doc.splitTextToSize(header, headerWidth - cellPadding * 2);
      const headerX = headerPositions[i] + cellPadding + (headerWidth - doc.getTextWidth(headerLines[0])) / 2;
      doc.text(headerLines, headerX, currentY + 2);
    });
    currentY += 12;

    // Function to add a row with dynamic height
    const addRow = (category: string, data: any) => {
      // Check if we need a new page before starting the row
      if (currentY > doc.internal.pageSize.height - 40) {
        doc.addPage();
        currentY = startY;
        // Add header to new page
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, startY - 5, usableWidth, 12, "F");
        headers.forEach((header, i) => {
          const headerWidth = i === 0 ? colWidths.category : (i === 1 ? colWidths.strength : colWidths.development);
          const headerLines = doc.splitTextToSize(header, headerWidth - cellPadding * 2);
          const headerX = headerPositions[i] + cellPadding + (headerWidth - doc.getTextWidth(headerLines[0])) / 2;
          doc.text(headerLines, headerX, startY + 2);
        });
        currentY = startY + 12;
      }

      const initialY = currentY;
      doc.setDrawColor(200, 200, 200);

      // Calculate text heights for each column with proper line spacing
      doc.setFont("helvetica", "bold");
      const categoryLines = doc.splitTextToSize(
        category,
        colWidths.category - cellPadding * 2 - 10 // Extra padding for rating circle
      );
      const categoryHeight = categoryLines.length * lineHeight;

      // Areas of Strength with dynamic height
      const strengthLines = data.areasOfStrength.map((s: string) => `• ${s}`);
      const strengthText = doc.splitTextToSize(
        strengthLines.join("\n"),
        colWidths.strength - cellPadding * 2
      );
      const strengthHeight = strengthText.length * lineHeight;

      // Ideas for Development with dynamic height
      const developmentLines = data.ideasForDevelopment.map(
        (d: string) => `• ${d}`
      );
      const developmentText = doc.splitTextToSize(
        developmentLines.join("\n"),
        colWidths.development - cellPadding * 2
      );
      const developmentHeight = developmentText.length * lineHeight;

      // Calculate row height based on the maximum content height plus padding
      const contentHeight = Math.max(
        categoryHeight,
        strengthHeight,
        developmentHeight
      );
      const rowHeight = contentHeight + cellPadding * 3; // Increased padding

      // Check if the row will fit on the current page
      if (initialY + rowHeight > doc.internal.pageSize.height - 20) {
        doc.addPage();
        currentY = startY;
        // Add header to new page
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, startY - 5, usableWidth, 12, "F");
        headers.forEach((header, i) => {
          const headerWidth = i === 0 ? colWidths.category : (i === 1 ? colWidths.strength : colWidths.development);
          const headerLines = doc.splitTextToSize(header, headerWidth - cellPadding * 2);
          const headerX = headerPositions[i] + cellPadding + (headerWidth - doc.getTextWidth(headerLines[0])) / 2;
          doc.text(headerLines, headerX, startY + 2);
        });
        currentY = startY + 12;
        return addRow(category, data); // Recursively call to add the row on the new page
      }

      // Draw cell backgrounds
      doc.setFillColor(252, 252, 252);
      doc.rect(margin, initialY, usableWidth, rowHeight, "F");

      // Draw rating circle
      const ratingX = margin + cellPadding;
      const ratingY = initialY + cellPadding;
      const ratingDetails = getRatingDetails(data.rating);
      doc.setFillColor(
        ratingDetails.color[0],
        ratingDetails.color[1],
        ratingDetails.color[2]
      );
      doc.setDrawColor(
        ratingDetails.color[0],
        ratingDetails.color[1],
        ratingDetails.color[2]
      );
      doc.roundedRect(ratingX, ratingY, 5, 5, 3, 3, "F");

      // Draw content with proper vertical alignment
      const contentY = initialY + cellPadding * 1.5; // Increased initial padding

      // Draw category
      doc.setFont("helvetica", "bold");
      doc.text(categoryLines, margin + cellPadding + 7, contentY);

      // Draw strength and development columns
      doc.setFont("helvetica", "normal");
      doc.text(
        strengthText,
        margin + colWidths.category + cellPadding,
        contentY
      );
      doc.text(
        developmentText,
        margin + colWidths.category + colWidths.strength + cellPadding,
        contentY
      );

      // Draw borders
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.1);

      // Vertical lines
      headerPositions.forEach((x) => {
        doc.line(x, initialY, x, initialY + rowHeight);
      });
      doc.line(
        pageWidth - margin,
        initialY,
        pageWidth - margin,
        initialY + rowHeight
      );

      // Horizontal lines
      doc.line(margin, initialY, pageWidth - margin, initialY);
      doc.line(
        margin,
        initialY + rowHeight,
        pageWidth - margin,
        initialY + rowHeight
      );

      currentY = initialY + rowHeight;
    };

    // Add all sections with their standards
    if (evaluation?.highExpectationsAndPriorKnowledge) {
      addRow("1. High Expectations & Prior Knowledge\n(Teachers' Standard 1)", {
        rating: evaluation.highExpectationsAndPriorKnowledge.rating,
        areasOfStrength:
          evaluation.highExpectationsAndPriorKnowledge.areasOfStrength || [],
        ideasForDevelopment:
          evaluation.highExpectationsAndPriorKnowledge.ideasForDevelopment || [],
      });
    }

    if (evaluation?.pupilProgressAndInclusion) {
      addRow("2. Pupil Progress & Inclusion\n(Teachers' Standards 2 & 5)", {
        rating: evaluation.pupilProgressAndInclusion.rating,
        areasOfStrength:
          evaluation.pupilProgressAndInclusion.areasOfStrength || [],
        ideasForDevelopment:
          evaluation.pupilProgressAndInclusion.ideasForDevelopment || [],
      });
    }

    if (evaluation?.assessmentAndFeedback) {
      addRow("3. Assessment & Feedback\n(Teachers' Standard 6)", {
        rating: evaluation.assessmentAndFeedback.rating,
        areasOfStrength: evaluation.assessmentAndFeedback.areasOfStrength || [],
        ideasForDevelopment:
          evaluation.assessmentAndFeedback.ideasForDevelopment || [],
      });
    }

    if (evaluation?.adaptiveTeachingAndCognitiveScience) {
      addRow(
        "4. Adaptive Teaching & Cognitive Science\n(Teachers' Standards 4 & 5)",
        {
          rating: evaluation.adaptiveTeachingAndCognitiveScience.rating || "⚪",
          areasOfStrength:
            evaluation.adaptiveTeachingAndCognitiveScience.areasOfStrength || [],
          ideasForDevelopment:
            evaluation.adaptiveTeachingAndCognitiveScience.ideasForDevelopment || [],
        }
      );
    }

    if (evaluation?.metacognitionAndProfessionalReflection) {
      addRow(
        "5. Metacognition & Professional Reflection\n(Teachers' Standards 7 & 8)",
        {
          rating: evaluation.metacognitionAndProfessionalReflection.rating || "⚪",
          areasOfStrength:
            evaluation.metacognitionAndProfessionalReflection.areasOfStrength || [],
          ideasForDevelopment:
            evaluation.metacognitionAndProfessionalReflection.ideasForDevelopment || [],
        }
      );
    }

    if (evaluation?.lessonStructureAndBehaviourManagement) {
      addRow(
        "6. Lesson Structure & Behavior Management\n(Teachers' Standard 7)",
        {
          rating: evaluation.lessonStructureAndBehaviourManagement.rating || "⚪",
          areasOfStrength:
            evaluation.lessonStructureAndBehaviourManagement.areasOfStrength || [],
          ideasForDevelopment:
            evaluation.lessonStructureAndBehaviourManagement.ideasForDevelopment || [],
        }
      );
    }

    if (evaluation?.criticalThinkingAndCommunication) {
      addRow(
        "7. Critical Thinking & Communication\n(Teachers' Standards 3 & 4)",
        {
          rating: evaluation.criticalThinkingAndCommunication.rating || "⚪",
          areasOfStrength:
            evaluation.criticalThinkingAndCommunication.areasOfStrength || [],
          ideasForDevelopment:
            evaluation.criticalThinkingAndCommunication.ideasForDevelopment || [],
        }
      );
    }

    // Add final evaluation summary if needed
    if (evaluation?.finalEvaluation) {
      doc.addPage();

      // Add styled header for final evaluation
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, doc.internal.pageSize.width, 30, "F");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("Final Evaluation", 20, 20);
      doc.setTextColor(0, 0, 0);

      const finalMargin = 20;
      let finalY = 40;
      const maxWidth = doc.internal.pageSize.width - finalMargin * 2;

      // Overall Rating with styled box
      // doc.setFillColor(245, 247, 250);
      // doc.rect(finalMargin, finalY, maxWidth, 25, "F");
      // doc.setDrawColor(200, 200, 200);
      // doc.rect(finalMargin, finalY, maxWidth, 25, "S");

      // doc.setFontSize(14);
      // doc.setFont("helvetica", "bold");
      // doc.text("Overall Rating", finalMargin + 10, finalY + 16);
      // finalY += 35;

      // Summary section with background
      if (evaluation.finalEvaluation.summary) {
        doc.setFillColor(245, 247, 250);
        doc.rect(finalMargin, finalY, maxWidth, 40, "F");
        doc.setDrawColor(200, 200, 200);
        doc.rect(finalMargin, finalY, maxWidth, 40, "S");

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Summary", finalMargin + 10, finalY + 10);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        const summaryLines = doc.splitTextToSize(
          evaluation.finalEvaluation.summary || "",
          maxWidth - 20
        );
        doc.text(summaryLines, finalMargin + 10, finalY + 25);
        finalY += 50;
      }

      // Key Strengths section
      if (evaluation.finalEvaluation.keyStrengths?.length) {
        finalY += 10;
        doc.setFillColor(245, 247, 250);
        const strengthsHeight =
          evaluation.finalEvaluation.keyStrengths.length * 10 + 30;
        doc.rect(finalMargin, finalY, maxWidth, strengthsHeight, "F");
        doc.setDrawColor(200, 200, 200);
        doc.rect(finalMargin, finalY, maxWidth, strengthsHeight, "S");

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Key Strengths", finalMargin + 10, finalY + 10);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        evaluation.finalEvaluation.keyStrengths.forEach((strength, index) => {
          const strengthLines = doc.splitTextToSize(
            `• ${strength}`,
            maxWidth - 25
          );
          doc.text(strengthLines, finalMargin + 15, finalY + 25 + index * 15);
        });
        finalY += strengthsHeight + 10;
      }

      // Development Areas section
      if (evaluation.finalEvaluation.developmentAreas?.length) {
        doc.setFillColor(245, 247, 250);
        const devHeight =
          evaluation.finalEvaluation.developmentAreas.length * 10 + 30;
        doc.rect(finalMargin, finalY, maxWidth, devHeight, "F");
        doc.setDrawColor(200, 200, 200);
        doc.rect(finalMargin, finalY, maxWidth, devHeight, "S");

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Development Areas", finalMargin + 10, finalY + 10);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        evaluation.finalEvaluation.developmentAreas.forEach((area, index) => {
          const areaLines = doc.splitTextToSize(`• ${area}`, maxWidth - 25);
          doc.text(areaLines, finalMargin + 15, finalY + 25 + index * 15);
        });
      }
    }

    // doc.save("lesson-plan-evaluation.pdf");
    const pdfBytes = doc.output('arraybuffer');
    const watermarkedPdf = await addWatermarkToPDF(new Uint8Array(pdfBytes));

    const blob = new Blob([watermarkedPdf], { type: 'application/pdf' });
    saveAs(blob, "lesson-plan-evaluation.pdf");

  };

  return (
    <div className='min-h-screen bg-white'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className='container mx-auto px-4 py-6 md:py-12 evaluation-container'>
        {/* Header Section */}
        <div className='text-center mb-6 md:mb-12'>
          <h1 className='text-2xl md:text-4xl font-bold text-gray-900 mb-2 md:mb-4 evaluation-header'>
            Lesson Plan Evaluator
          </h1>
          <p className='text-base md:text-lg text-gray-600 max-w-2xl mx-auto evaluation-subtext'>
            Evaluate and refine lesson plans for effectiveness
          </p>
        </div>

        {/* Main Content Grid */}
        <div className='grid gap-4 md:gap-8 evaluation-grid lg:grid-cols-2 max-w-7xl mx-auto'>
          {/* Input Form Card */}
          <Card className='p-4 md:p-8 shadow-lg evaluation-card overflow-y-auto'>
            <div className='space-y-4 md:space-y-6'>
              <div>
                <Label htmlFor='name' className='text-gray-700'>
                  Lesson Plan Name
                </Label>
                <Input
                  id='name'
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className='mt-2'
                  placeholder='Enter lesson plan name'
                  disabled={uploading}
                />
              </div>

              <div>
                <Label htmlFor='file' className='text-gray-700'>
                  Upload File (pdf, doc, docx)
                </Label>
                <div className='mt-2 relative'>
                  <Input
                    id='file'
                    type='file'
                    onChange={handleFileChange}
                    accept='.pdf,.doc,.docx'
                    disabled={uploading}
                  />
                </div>
                {file && (
                  <p className='mt-2 text-sm text-gray-500'>
                    Selected: {file.name}
                  </p>
                )}
              </div>

              <div className='flex items-start space-x-3'>
                <Checkbox
                  id='verification'
                  checked={isChecked}
                  onCheckedChange={(checked) => setIsChecked(checked === true)}
                  className='mt-1 checkbox-custom'
                />
                <Label
                  htmlFor='verification'
                  className='text-sm text-purple-400 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                >
                  I verify that I have not used any personal data such as
                  student names or private information. Instead of names, I have
                  referred to them as student, pupil or similar.
                </Label>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={uploading || !isChecked || !file || !name}
                className='w-full'
              >
                {uploading ? (
                  <div className='flex items-center justify-center'>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    <span>Evaluating...</span>
                  </div>
                ) : (
                  "Evaluate"
                )}
              </Button>
            </div>
          </Card>

          {/* Results Card */}
          <Card className='p-2 md:p-6 shadow-lg results-card overflow-y-auto'>
            <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6'>
              <h2 className='text-xl md:text-2xl font-bold mb-2 md:mb-0'>Evaluation Results</h2>
              {evaluation && (
                <Button
                  onClick={() => handleDownloadPDF(evaluation)}
                  variant='outline'
                  className='flex items-center gap-2 w-full md:w-auto'
                >
                  <FileDown className='w-4 h-4' />
                  Download PDF Report
                </Button>
              )}
            </div>

            {error ? (
              <Alert variant="destructive" className='bg-red-50 text-red-700 border border-red-200 rounded-lg'>
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
            ) : uploading ? (
              <div className='flex flex-col items-center justify-center py-12'>
                <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
                <p className='mt-4 text-gray-600'>
                  Evaluating your lesson plan...
                </p>
              </div>
            ) : !evaluation ? (
              <div className='flex flex-col items-center justify-center py-12 text-gray-400'>
                <svg
                  className='w-16 h-16 mb-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                  />
                </svg>
                <p className='text-gray-500'>
                  Your lesson plan evaluation will appear here once uploaded
                </p>
              </div>
            ) : (
              <div className='space-y-6'>
                {renderEvaluationSection(
                  "High Expectations & Prior Knowledge",
                  evaluation?.highExpectationsAndPriorKnowledge
                )}
                {renderEvaluationSection(
                  "Pupil Progress & Inclusion",
                  evaluation?.pupilProgressAndInclusion
                )}
                {renderEvaluationSection(
                  "Assessment & Feedback",
                  evaluation?.assessmentAndFeedback
                )}
                {renderEvaluationSection(
                  "Adaptive Teaching & Cognitive Science",
                  evaluation?.adaptiveTeachingAndCognitiveScience
                )}
                {renderEvaluationSection(
                  "Metacognition & Professional Reflection",
                  evaluation?.metacognitionAndProfessionalReflection
                )}
                {renderEvaluationSection(
                  "Lesson Structure & Behaviour Management",
                  evaluation?.lessonStructureAndBehaviourManagement
                )}
                {renderEvaluationSection(
                  "Critical Thinking & Communication",
                  evaluation?.criticalThinkingAndCommunication
                )}
                {renderFinalEvaluation(evaluation?.finalEvaluation)}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LessonPlanEvaluator;