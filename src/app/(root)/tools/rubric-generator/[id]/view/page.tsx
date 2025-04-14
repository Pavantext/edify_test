"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import ShareButton from "@/components/share-btn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ReportButton } from "@/components/ReportButton";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Edit, FileText } from "lucide-react";
import jsPDF from "jspdf";
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
} from "docx";
import { ExportDropdown } from "@/components/ExportDropdown";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RubricLevel {
  description: string;
  feedback: string;
  score?: number;
}

interface RubricCriterion {
  name: string;
  levels: {
    [key: string]: RubricLevel;
  };
}

export default function RubricView() {
  const [rubric, setRubric] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    async function fetchRubric() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("rubrics_generator_results")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError || !data) {
          setError("Rubric not found or error occurred while fetching data.");
          return;
        }

        // Parse the ai_response field which contains the full rubric data
        const aiResponse = JSON.parse(data.ai_response);
        
        // Extract metadata from the stored fields
        const metadata = {
          subject: data.subject || "",
          topic: data.topic || "",
          assessmentType: data.assessment_type || "",
          keyStage: data.key_stage || "",
          yearGroup: data.year_group || ""
        };

        // Combine metadata with the AI response data
        setRubric({
          ...aiResponse.data,
          metadata
        });
      } catch (err) {
        setError("An error occurred while processing the rubric.");
      }
    }

    fetchRubric();
  }, [id]);

  const handleExportPDF = () => {
    if (!rubric) return;

    const doc = new jsPDF();
    let yPos = 20;
    const leftMargin = 20;
    const pageWidth = doc.internal.pageSize.width;

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Rubric Assessment", leftMargin, yPos);
    yPos += 15;

    // Metadata section
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Assessment Details", leftMargin, yPos);
    yPos += 10;

    doc.setFont("helvetica", "normal");
    const metadata = [
    //   `Subject: ${rubric.metadata.subject}`,
      `Topic: ${rubric.metadata.topic}`,
      `Assessment Type: ${rubric.metadata.assessmentType}`,
      `Key Stage: ${rubric.metadata.keyStage}`,
      `Year Group: ${rubric.metadata.yearGroup}`,
    ];

    metadata.forEach((item) => {
      doc.text(item, leftMargin + 5, yPos);
      yPos += 7;
    });
    yPos += 10;

    // Criteria Table
    const keyStageNumber = parseInt(rubric.metadata.keyStage.replace("ks", ""));
    const allLevels = [
      { key: "exceptional", label: "Exceptional (5)" },
      { key: "advanced", label: "Advanced (4)" },
      { key: "proficient", label: "Proficient (3)" },
      { key: "basic", label: "Basic (2)" },
      { key: "emerging", label: "Emerging (1)" },
    ].filter(
      (level) =>
        parseInt(level.label.match(/\d+/)?.[0] || "0") <=
        (keyStageNumber === 5 ? 5 : keyStageNumber)
    );

    // Calculate column widths
    const criterionWidth = 40;
    const levelWidth =
      (pageWidth - leftMargin * 2 - criterionWidth) / allLevels.length;

    // Draw table header
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(leftMargin, yPos - 5, pageWidth - leftMargin * 2, 10, "F");
    doc.text("Criteria", leftMargin + 2, yPos);

    allLevels.forEach((level, index) => {
      doc.text(
        level.label,
        leftMargin + criterionWidth + levelWidth * index,
        yPos
      );
    });
    yPos += 10;

    // Draw table content
    doc.setFont("helvetica", "normal");
    rubric.rubric.criteria.forEach((criterion: RubricCriterion, index: number) => {
      const startY = yPos;
      let maxHeight = 0;

      // Criterion name
      doc.setFont("helvetica", "bold");
      const splitName = doc.splitTextToSize(criterion.name, criterionWidth - 4);
      doc.text(splitName, leftMargin + 2, yPos);
      maxHeight = Math.max(maxHeight, splitName.length * 7);

      // Level descriptions
      doc.setFont("helvetica", "normal");
      allLevels.forEach((level, levelIndex) => {
        const x = leftMargin + criterionWidth + levelWidth * levelIndex;
        if (criterion.levels && criterion.levels[level.key]) {
          const levelData = criterion.levels[level.key];
          const description = levelData.description;
          const feedback = levelData.feedback;
          const splitDesc = doc.splitTextToSize(
            `${description}\n\nFeedback: ${feedback}`,
            levelWidth - 4
          );
          doc.text(splitDesc, x + 2, yPos);
          maxHeight = Math.max(maxHeight, splitDesc.length * 7);
        }
      });

      // Draw cell borders
      doc.rect(leftMargin, startY - 5, criterionWidth, maxHeight + 10);
      allLevels.forEach((_, levelIndex) => {
        const x = leftMargin + criterionWidth + levelWidth * levelIndex;
        doc.rect(x, startY - 5, levelWidth, maxHeight + 10);
      });

      yPos += maxHeight + 10;

      // Add new page if needed
      if (yPos > doc.internal.pageSize.height - 20) {
        doc.addPage();
        yPos = 20;
      }
    });

    doc.save("rubric.pdf");
  };

  const handleExportWord = async () => {
    if (!rubric) return;

    const keyStageNumber = parseInt(rubric.metadata.keyStage.replace("ks", ""));
    const allLevels = [
      { key: "exceptional", label: "Exceptional (5)" },
      { key: "advanced", label: "Advanced (4)" },
      { key: "proficient", label: "Proficient (3)" },
      { key: "basic", label: "Basic (2)" },
      { key: "emerging", label: "Emerging (1)" },
    ].filter(
      (level) =>
        parseInt(level.label.match(/\d+/)?.[0] || "0") <=
        (keyStageNumber === 5 ? 5 : keyStageNumber)
    );

    // Create table rows
    const tableRows = rubric.rubric.criteria.map((criterion: RubricCriterion) => {
      const cells = [
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: criterion.name, bold: true, size: 24 })],
            }),
          ],
          width: { size: 2000, type: "dxa" }, // Fixed width for criterion column
        }),
        ...allLevels.map((level) => {
          const levelData = criterion.levels[level.key];
          return new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: levelData?.description || "", size: 24 }),
                  new TextRun({ text: "\n\nFeedback: ", bold: true, size: 24 }),
                  new TextRun({ text: levelData?.feedback || "", size: 24 }),
                ],
              }),
            ],
            width: { size: 3000, type: "dxa" }, // Fixed width for level columns
          });
        }),
      ];
      return new TableRow({ 
        children: cells,
        height: { value: 3000, rule: "atLeast" } // Minimum row height
      });
    });

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: "landscape"
              },
              margin: {
                top: 1000,
                right: 1000,
                bottom: 1000,
                left: 1000,
              },
            },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Rubric Assessment",
                  bold: true,
                  size: 36,
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Assessment Details\n",
                  bold: true,
                  size: 28,
                }),
                new TextRun({
                  text: `Topic: ${rubric.metadata.topic}\n`,
                  size: 24,
                }),
                new TextRun({
                  text: `Assessment Type: ${rubric.metadata.assessmentType}\n`,
                  size: 24,
                }),
                new TextRun({
                  text: `Key Stage: ${rubric.metadata.keyStage}\n`,
                  size: 24,
                }),
                new TextRun({
                  text: `Year Group: ${rubric.metadata.yearGroup}\n\n`,
                  size: 24,
                }),
              ],
              spacing: { after: 400 },
            }),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: "Criteria", bold: true, size: 24 }),
                          ],
                        }),
                      ],
                      width: { size: 2000, type: "dxa" },
                    }),
                    ...allLevels.map(
                      (level) =>
                        new TableCell({
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({ text: level.label, bold: true, size: 24 }),
                              ],
                            }),
                          ],
                          width: { size: 3000, type: "dxa" },
                        })
                    ),
                  ],
                  height: { value: 500, rule: "atLeast" },
                }),
                ...tableRows,
              ],
              width: {
                size: 100,
                type: "pct",
              },
              margins: {
                top: 100,
                bottom: 100,
                right: 100,
                left: 100,
              },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "rubric.docx");
    toast.success("Word document exported successfully!");
  };

  const handleExportCSV = () => {
    if (!rubric) return;

    const keyStageNumber = parseInt(rubric.metadata.keyStage.replace("ks", ""));
    const allLevels = [
      { key: "exceptional", label: "Exceptional (5)" },
      { key: "advanced", label: "Advanced (4)" },
      { key: "proficient", label: "Proficient (3)" },
      { key: "basic", label: "Basic (2)" },
      { key: "emerging", label: "Emerging (1)" },
    ].filter(
      (level) =>
        parseInt(level.label.match(/\d+/)?.[0] || "0") <=
        (keyStageNumber === 5 ? 5 : keyStageNumber)
    );

    const rows = [
      // Metadata
      ["Assessment Details"],
    //   ["Subject", rubric.metadata.subject],
      ["Topic", rubric.metadata.topic],
      ["Assessment Type", rubric.metadata.assessmentType],
      ["Key Stage", rubric.metadata.keyStage],
      ["Year Group", rubric.metadata.yearGroup],
      [""], // Empty row for spacing

      // Headers
      [
        "Criteria",
        ...allLevels.flatMap((level) => [
          `${level.label} Description`,
          `${level.label} Feedback`,
        ]),
      ],

      // Criteria rows
      ...rubric.rubric.criteria.map((criterion: RubricCriterion) => {
        const row = [criterion.name];
        allLevels.forEach((level) => {
          if (criterion.levels && criterion.levels[level.key]) {
            const levelData = criterion.levels[level.key];
            row.push(levelData.description);
            row.push(levelData.feedback);
          } else {
            row.push("", "");
          }
        });
        return row;
      }),
    ];

    const csvContent = rows
      .map((row) => row.map((cell: string) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "rubric.csv");
  };

  // Export options configuration
  const exportOptions = [
    {
      label: "Export as PDF",
      value: "pdf",
      onClick: handleExportPDF,
    },
    {
      label: "Export as Word",
      value: "word",
      onClick: handleExportWord,
    },
    {
      label: "Export as CSV",
      value: "csv",
      onClick: handleExportCSV,
    },
  ];

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
        </div>
      </div>
    );
  }

  if (!rubric) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading rubric...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Rubric Details</h1>
          <div className="flex space-x-4">
            <ExportDropdown options={exportOptions} />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => router.push(`/tools/rubric-generator/${id}/edit`)}
                    className="flex items-center"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit Rubric</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ShareButton
              shareUrl={`${process.env.NEXT_PUBLIC_APP_URL}/tools/rubric-generator/${id}/view`}
              toolType="Rubric Generator"
            />
            <ReportButton
              toolType="rubric"
              resultId={id}
              position="inline"
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Assessment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <p><span className="font-medium">Topic:</span> {rubric?.metadata.topic}</p>
                <p><span className="font-medium">Assessment Type:</span> {rubric?.metadata.assessmentType}</p>
                <p><span className="font-medium">Key Stage:</span> {rubric?.metadata.keyStage}</p>
                <p><span className="font-medium">Year Group:</span> {rubric?.metadata.yearGroup}</p>
              </div>
            </CardContent>
          </Card>

          {/* Rubric Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Criterion</th>
                  {rubric && Object.entries(rubric.rubric.criteria[0]?.levels || {})
                    .sort(([levelA], [levelB]) => {
                      const order = ["emerging", "basic", "proficient", "advanced", "exceptional"];
                      return order.indexOf(levelA) - order.indexOf(levelB);
                    })
                    .map(([level]) => (
                      <th key={level} className="border p-2 text-left capitalize">
                        {level.replace('_', ' ')}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {rubric?.rubric.criteria.map((criterion: RubricCriterion, idx: number) => (
                  <tr key={idx}>
                    <td className="border p-2 font-semibold">{criterion.name}</td>
                    {Object.entries(criterion.levels)
                      .sort(([levelA], [levelB]) => {
                        const order = ["emerging", "basic", "proficient", "advanced", "exceptional"];
                        return order.indexOf(levelA) - order.indexOf(levelB);
                      })
                      .map(([level, data]: [string, RubricLevel]) => (
                        <td key={level} className="border p-2">
                          <div className="space-y-2">
                            <div>{data.description}</div>
                            <div className="text-sm text-gray-600 italic">
                              Feedback: {data.feedback}
                            </div>
                          </div>
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
