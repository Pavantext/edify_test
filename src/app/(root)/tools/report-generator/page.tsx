"use client";
import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { ReportButton } from "@/components/ReportButton";
import { ExportDropdown } from "@/components/ExportDropdown";
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import SubscriptionDialog from "@/components/SubscriptionDialog";

export default function ReportGeneratorPage() {
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportResponse, setReportResponse] = useState<any>(null);
  const [wordCount, setWordCount] = useState(300);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [isApprovedView, setIsApprovedView] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Add useEffect to fetch report when approved ID is present
  useEffect(() => {
    const fetchApprovedReport = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const approvedId = searchParams.get('approved');

      if (approvedId) {
        setIsLoading(true);
        setIsApprovedView(true);
        try {
          const response = await fetch(`/api/tools/report-generator?approved=${approvedId}`);
          const data = await response.json();

          if (!response.ok) {
            if (response.status === 403) {
              setError(`Content not approved: ${data.details?.status || 'Unknown status'}`);
              return;
            }
            throw new Error(data.error || 'Failed to fetch report');
          }

          if (!data.data) {
            throw new Error("No data received from server");
          }

          setReportResponse(data.data);
          // Pre-fill form with input data
          if (data.input_data) {
            const form = formRef.current;
            if (form) {
              form.studentId.value = data.input_data.student || '';
              form.strengths.value = data.input_data.strengths || '';
              form.areasOfDevelopment.value = data.input_data.areasOfDevelopment || '';
              form.progress.value = data.input_data.progress || '';
            }
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load report');
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchApprovedReport();
  }, []);

  const validateForm = (
    formData: FormData
  ): { isValid: boolean; error?: string; } => {
    // Skip validation if in approved view
    if (isApprovedView) {
      return { isValid: true };
    }

    const studentId = formData.get("studentId") as string;
    const strengths = formData.get("strengths") as string;
    const areasOfDevelopment = formData.get("areasOfDevelopment") as string;
    const progress = formData.get("progress") as string;
    const wordCountValue = parseInt(formData.get("wordCount") as string);

    if (!studentId?.trim()) {
      return { isValid: false, error: "Student ID is required" };
    }
    if (!strengths?.trim() || strengths.length < 10) {
      return {
        isValid: false,
        error: "Strengths must be at least 10 characters",
      };
    }
    if (!areasOfDevelopment?.trim() || areasOfDevelopment.length < 10) {
      return {
        isValid: false,
        error: "Areas of development must be at least 10 characters",
      };
    }
    if (!progress?.trim() || progress.length < 10) {
      return {
        isValid: false,
        error: "Progress must be at least 10 characters",
      };
    }
    if (isNaN(wordCountValue) || wordCountValue < 50 || wordCountValue > 500) {
      return { isValid: false, error: "Word count must be between 50 and 500" };
    }

    return { isValid: true };
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

    setError("");
    setReportResponse(null);

    // Skip checkbox verification if in approved view
    if (!isChecked && !isApprovedView) {
      setError("Please verify the checkbox before submitting");
      return;
    }

    if (!formRef.current) {
      console.error("Form reference is null");
      return;
    }

    setIsLoading(true);

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const approvedId = searchParams.get('approved');
      
      const response = await fetch(`/api/tools/report-generator${approvedId ? `?approved=${approvedId}` : ''}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentDetails: {
            studentId: formRef.current.studentId.value,
            strengths: formRef.current.strengths.value,
            areasOfDevelopment: formRef.current.areasOfDevelopment.value,
            progress: formRef.current.progress.value,
          },
          config: {
            wordCount: parseInt(formRef.current.wordCount.value),
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.details) {
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
        throw new Error(result.error || "Failed to generate report");
      }

      if (!result.data) {
        throw new Error("No data received from server");
      }

      setReportResponse(result.data);
      toast("Report generated successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate report";
      setError(errorMessage);
      toast(errorMessage);
    } finally {
      setIsChecked(false);
      setIsLoading(false);
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


  const handleDownloadPDF = async () => {
    if (!reportResponse) return;

    try {
      const doc = new jsPDF();
      let yPosition = 20;
      const leftMargin = 20;
      const pageWidth = doc.internal.pageSize.width;

      // Add title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Student Report", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      // Add student ID
      doc.setFontSize(12);
      doc.text(`Student ID: ${reportResponse.student}`, leftMargin, yPosition);
      yPosition += 15;

      // Add complete report
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const contentLines = doc.splitTextToSize(
        reportResponse.complete_report,
        pageWidth - leftMargin * 2
      );

      contentLines.forEach((line: string) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(line, leftMargin, yPosition);
        yPosition += 6;
      });

      // Add metadata
      const metadata = reportResponse.metadata;
      if (metadata) {
        yPosition += 10;
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text(
          `Generated: ${metadata.generatedAt} `,
          leftMargin,
          yPosition
        );
      }

      // doc.save("student_report.pdf");
      const pdfBytes = doc.output('arraybuffer');
      const watermarkedPdf = await addWatermarkToPDF(new Uint8Array(pdfBytes));

      const blob = new Blob([watermarkedPdf], { type: 'application/pdf' });
      saveAs(blob, "student_report.pdf");
      toast("PDF downloaded successfully");
    } catch (error) {
      toast("Failed to generate PDF");
    }
  };

  const handleDownloadCSV = () => {
    if (!reportResponse) return;

    try {
      // Create CSV content with properly aligned columns
      const headers = ["Student ID", "Report", "Generated At"];
      const values = [
        reportResponse.student,
        reportResponse.complete_report.replace(/,/g, ";"), // Replace commas with semicolons
        reportResponse.metadata.generatedAt,
        // reportResponse.metadata.wordCount.toString(),
      ];

      const csvContent = [headers.join(","), values.join(",")].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "student_report.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast("CSV downloaded successfully");
    } catch (error) {
      toast("Failed to generate CSV");
    }
  };

  const exportOptions = [
    {
      label: "Export PDF",
      value: "pdf",
      onClick: handleDownloadPDF,
    },
    {
      label: "Export CSV",
      value: "csv",
      onClick: handleDownloadCSV,
    },
  ];

  return (
    <div className='min-h-screen bg-white'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className='container mx-auto px-4 py-12'>
        <div className='flex justify-end mb-4'>
          <ReportButton
            toolType='report-generator'
            position='inline'
            variant='pre'
          />
        </div>

        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            Student Report Generator
          </h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Generate comprehensive student progress reports
          </p>
        </div>

        <div className='grid gap-8 lg:grid-cols-2 max-w-7xl mx-auto'>
          {/* Form Card */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            <form ref={formRef} onSubmit={handleSubmit} className='space-y-6'>
              <div className='space-y-2'>
                <Label htmlFor='studentId'>Student ID</Label>
                <Input
                  id='studentId'
                  name='studentId'
                  required
                  placeholder='e.g. 001'
                  disabled={isApprovedView}
                  onChange={(e) => {
                    // Use a regular expression to allow only numbers and the hash symbol
                    const value = e.target.value.replace(/[^0-9#]/g, "");
                    e.target.value = value;
                  }}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='strengths'>Student Strengths</Label>
                <Textarea
                  id='strengths'
                  name='strengths'
                  required
                  placeholder="Describe student's strengths..."
                  className='min-h-[100px]'
                  disabled={isApprovedView}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='areasOfDevelopment'>
                  Areas for Development
                </Label>
                <Textarea
                  id='areasOfDevelopment'
                  name='areasOfDevelopment'
                  required
                  placeholder='Describe areas needing improvement...'
                  className='min-h-[100px]'
                  disabled={isApprovedView}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='progress'>Overall Progress</Label>
                <Textarea
                  id='progress'
                  name='progress'
                  required
                  placeholder="Describe student's progress..."
                  className='min-h-[100px]'
                  disabled={isApprovedView}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='wordCount'>Report Word Count (50-500)</Label>
                <Input
                  id='wordCount'
                  name='wordCount'
                  type='number'
                  value={wordCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    setWordCount(value);
                  }}
                  min={50}
                  max={500}
                  required
                  disabled={isApprovedView}
                  className={error ? "border-red-500" : ""}
                />
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
                disabled={!isChecked || isLoading}
                className='w-full'
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Generating...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </form>
          </Card>

          {/* Results Card */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6'>
              <h2 className='text-2xl font-bold text-gray-900'>
                Generated Report
              </h2>
              {reportResponse && (
                <div className='flex gap-2'>
                  <ExportDropdown options={exportOptions} />
                </div>
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
            ) : reportResponse ? (
              <div className='bg-white p-6 rounded-lg border border-gray-100'>
                <p className='text-gray-700 whitespace-pre-line'>
                  {reportResponse.complete_report}
                </p>
              </div>
            ) : (
              <p className='text-center text-gray-500'>
                Your generated report will appear here
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
