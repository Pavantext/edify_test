"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, Edit } from "lucide-react";
import { ReportButton } from "@/components/ReportButton";
import axios from "axios";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buttonVariants } from "@/components/ui/button";
import { ExportDropdown } from "@/components/ExportDropdown";
interface Question {
  level: string;
  question: string;
  exampleResponse: string;
}

interface ExportOption {
  label: string;
  value: string;
  onClick: () => void | Promise<void>;
}

export default function ViewQAPage() {
  const params = useParams();
  const id = params?.id as string;
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await axios.get(`/api/tools/long-qa-generator/${id}`);
        setQuestions(response.data.ai_generated_questions.questions);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load questions"
        );
        toast.error("Failed to load questions");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchQuestions();
    }
  }, [id]);

  const downloadAsTxt = () => {
    if (!questions) return;

    const content = questions
      .map(
        (q) =>
          `Level: ${q.level}\nQuestion: ${q.question}\nExample Response: ${q.exampleResponse}\n\n`
      )
      .join("");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsCsv = () => {
    if (!questions) return;

    const headers = ["Level", "Question", "Example Response"];
    const rows = questions.map((q) => [q.level, q.question, q.exampleResponse]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAsWord = async () => {
    if (!questions) return;

    try {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: questions.flatMap((q) => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Level: ${q.level}`,
                    bold: true,
                    size: 28,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Question:",
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: q.question,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Example Response:",
                    bold: true,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: q.exampleResponse,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                children: [new TextRun({ text: "" })],
              }),
            ]),
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "questions.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to download Word document");
      console.error("Error generating Word document:", error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-red-500 text-center">{error}</div>
      </div>
    );
  }

  const exportOptions: ExportOption[] = [
    {
      label: "Download TXT",
      value: "txt",
      onClick: downloadAsTxt,
    },
    {
      label: "Download CSV",
      value: "csv",
      onClick: downloadAsCsv,
    },
    {
      label: "Download Word",
      value: "word",
      onClick: () => {
        downloadAsWord().catch(error => {
          console.error("Error downloading Word document:", error);
          toast.error("Failed to download Word document");
        });
      },
    },
  ];

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">View Questions</h1>
        <div className="flex gap-4">
          <ExportDropdown options={exportOptions} />
          <TooltipProvider>
            {/* <Tooltip>
          <TooltipTrigger asChild>
          <Button
            onClick={downloadAsTxt}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Download TXT
          </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Download TXT</p>
          </TooltipContent>
          </Tooltip>
          <Tooltip>
          <TooltipTrigger asChild>
          <Button
            onClick={downloadAsCsv}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download CSV
          </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Download CSV</p>
          </TooltipContent>
          </Tooltip>
          <Tooltip>
          <TooltipTrigger asChild>
          <Button
            onClick={downloadAsWord}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Download Word
          </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Download Word</p>
          </TooltipContent>
          </Tooltip> */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/tools/long-qa-generator/${id}/edit`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                    className: "w-9 h-9",
                  })}
                >
                  <Edit className='h-4 w-4' />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit questions</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <ReportButton toolType="long_qa" resultId={id} position="inline" />
        </div>
      </div>

      <div className="space-y-6">
        {questions?.map((q, index) => (
          <Card key={index} className="p-6">
            <h3 className="font-semibold text-lg text-blue-600 mb-4">
              {q.level}
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700">Question:</h4>
                <p className="mt-1 text-gray-600">{q.question}</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-700">Example Response:</h4>
                <p className="mt-1 text-gray-600">{q.exampleResponse}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
