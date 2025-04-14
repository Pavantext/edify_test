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

interface SOWLesson {
  lessonNumber: number;
  title: string;
  duration: number;
  learningObjectives: string[];
  activities: {
    title: string;
    description: string;
    duration: number;
    resources: string[];
  }[];
  assessment: string[];
  differentiation: {
    support: string[];
    core: string[];
    extension: string[];
  };
  stretchTasks: string[];
  scaffoldingStrategies: string[];
  reflectionPrompts: string[];
  crossCurricularLinks: string[];
}

interface SOWData {
  id: string;
  metadata: {
    subject: string;
    topic: string;
    ageGroup: {
      year: number;
    };
    author: string;
    createdAt: string;
    version: string;
  };
  overarchingObjectives: string[];
  lessons: SOWLesson[];
}

export default function SOWView() {
  const [sow, setSOW] = useState<SOWData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    async function fetchSOW() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("sow_generator_results")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError || !data) {
          setError("Scheme of Work not found or error occurred while fetching data.");
          return;
        }
        console.log("Raw data from DB:", data);

        // Handle the nested data structure and restructure the data
        let parsedData;
        try {
          parsedData = typeof data.sow_data === 'string' 
            ? JSON.parse(data.sow_data)
            : data.sow_data;
          console.log("Parsed data:", parsedData);
        } catch (parseError) {
          console.error("Error parsing sow_data:", parseError);
          setError("Error parsing scheme of work data");
          return;
        }

        // Extract the data property or use the whole object if data property doesn't exist
        let sowData = parsedData?.data || parsedData;
        console.log("SOW data before restructure:", sowData);

        if (!sowData) {
          setError("Invalid scheme of work data structure");
          return;
        }
        
        // Ensure the metadata and ageGroup structure exists
        const restructuredData = {
          id: data.id, // Use the ID from the database record instead of parsed data
          metadata: {
            subject: sowData.subject || data.subject || '',
            topic: sowData.topic || data.topic || '',
            ageGroup: {
              year: sowData.ageGroup?.year || data.year_group || 0
            },
            author: sowData.metadata?.author || 'Curriculum Planner',
            createdAt: sowData.metadata?.createdAt || new Date().toISOString(),
            version: sowData.metadata?.version || '1.0'
          },
          overarchingObjectives: sowData.overarchingObjectives || [],
          lessons: sowData.lessons || []
        };

        console.log("Restructured data:", restructuredData);
        setSOW(restructuredData);
      } catch (err) {
        console.error("Error processing SOW:", err);
        setError("An error occurred while processing the Scheme of Work.");
      }
    }

    fetchSOW();
  }, [id]);

  const handleExportPDF = () => {
    if (!sow) return;

    const doc = new jsPDF();
    let yPos = 20;
    const leftMargin = 20;

    // Title and Metadata
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Scheme of Work", leftMargin, yPos);
    yPos += 15;

    // Metadata
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Subject: ${sow.metadata.subject}`, leftMargin, yPos);
    yPos += 10;
    doc.text(`Topic: ${sow.metadata.topic}`, leftMargin, yPos);
    yPos += 10;
    doc.text(`Year Group: ${sow.metadata.ageGroup.year}`, leftMargin, yPos);
    yPos += 20;

    // Overarching Objectives
    doc.setFont("helvetica", "bold");
    doc.text("Overarching Objectives:", leftMargin, yPos);
    yPos += 10;
    doc.setFont("helvetica", "normal");
    sow.overarchingObjectives.forEach(objective => {
      doc.text(`• ${objective}`, leftMargin + 5, yPos);
      yPos += 7;
    });
    yPos += 10;

    // Lessons
    sow.lessons.forEach((lesson, index) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.text(`Lesson ${lesson.lessonNumber}: ${lesson.title}`, leftMargin, yPos);
      yPos += 10;

      doc.setFont("helvetica", "normal");
      doc.text(`Duration: ${lesson.duration} minutes`, leftMargin + 5, yPos);
      yPos += 10;

      // Learning Objectives
      doc.setFont("helvetica", "bold");
      doc.text("Learning Objectives:", leftMargin + 5, yPos);
      yPos += 7;
      doc.setFont("helvetica", "normal");
      lesson.learningObjectives.forEach(objective => {
        doc.text(`• ${objective}`, leftMargin + 10, yPos);
        yPos += 7;
      });
      yPos += 10;

      // Add more lesson details as needed...
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
    });

    doc.save("scheme-of-work.pdf");
    toast.success("PDF exported successfully!");
  };

  const handleExportWord = async () => {
    if (!sow) return;

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Scheme of Work",
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `\nSubject: ${sow.metadata.subject}`,
                size: 24,
              }),
            ],
          }),
          // Add more content...
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "scheme-of-work.docx");
    toast.success("Word document exported successfully!");
  };

  const handleExportCSV = () => {
    if (!sow) return;

    const rows = [
      ["Subject", "Topic", "Year Group"],
      [sow.metadata.subject, sow.metadata.topic, sow.metadata.ageGroup.year.toString()],
      [],
      ["Overarching Objectives"],
      ...sow.overarchingObjectives.map(obj => [obj]),
      [],
      ["Lesson Number", "Title", "Duration", "Learning Objectives"],
      ...sow.lessons.map(lesson => [
        lesson.lessonNumber.toString(),
        lesson.title,
        lesson.duration.toString(),
        lesson.learningObjectives.join("; ")
      ])
    ];

    const csvContent = rows
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "scheme-of-work.csv");
    toast.success("CSV exported successfully!");
  };

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

  if (!sow) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading scheme of work...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Scheme of Work Details</h1>
          <div className="flex space-x-4">
            <ExportDropdown options={exportOptions} />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => router.push(`/tools/sow-generator/${id}/edit`)}
                    className="flex items-center"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit Scheme of Work</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ShareButton
              shareUrl={`${process.env.NEXT_PUBLIC_APP_URL}/tools/sow-generator/${id}/view`}
              toolType="SOW Generator"
            />
            <ReportButton
              toolType="sow"
              resultId={id}
              position="inline"
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <p><span className="font-medium">Subject:</span> {sow.metadata.subject}</p>
                <p><span className="font-medium">Topic:</span> {sow.metadata.topic}</p>
                <p><span className="font-medium">Year Group:</span> Year {sow.metadata.ageGroup.year}</p>
                {/* <p><span className="font-medium">Created:</span> {new Date(sow.metadata.createdAt).toLocaleDateString()}</p> */}
              </div>
            </CardContent>
          </Card>

          {/* Table Section */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                    LESSON NUMBER
                  </th>
                  <th className="px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                    DURATION
                  </th>
                  <th className="px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                    LEARNING OBJECTIVES
                  </th>
                  <th className="px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                    KEY ACTIVITIES AND RESOURCES
                  </th>
                  <th className="px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                    STRETCH/CHALLENGE TASKS
                  </th>
                  <th className="px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                    SCAFFOLDING/SUPPORT STRATEGIES
                  </th>
                  <th className="px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                    REFLECTION/METACOGNITION PROMPTS
                  </th>
                  <th className="px-4 py-3 bg-gray-50 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">
                    CROSS-CURRICULAR LINKS
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sow.lessons.map((lesson, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-4 text-sm text-gray-900 align-top border border-gray-200">
                      {lesson.lessonNumber} . {lesson.title}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 align-top border border-gray-200">
                      {lesson.duration} mins
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 align-top border border-gray-200">
                      <ul className="list-disc list-inside">
                        {lesson.learningObjectives.map((obj, i) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 align-top border border-gray-200">
                      {lesson.activities.map((activity, i) => (
                        <div key={i} className="mb-2">
                          <p className="font-medium">{activity.title}</p>
                          <p>{activity.description}</p>
                          {activity.resources && (
                            <ul className="list-disc list-inside mt-1">
                              {activity.resources.map((resource, ri) => (
                                <li key={ri} className="text-gray-600">
                                  {resource}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 align-top border border-gray-200">
                      {lesson.stretchTasks && (
                        <ul className="list-disc list-inside">
                          {lesson.stretchTasks.map((task, i) => (
                            <li key={i}>{task}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 align-top border border-gray-200">
                      {lesson.scaffoldingStrategies && (
                        <ul className="list-disc list-inside">
                          {lesson.scaffoldingStrategies.map((strategy, i) => (
                            <li key={i}>{strategy}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 align-top border border-gray-200">
                      {lesson.reflectionPrompts && (
                        <ul className="list-disc list-inside">
                          {lesson.reflectionPrompts.map((prompt, i) => (
                            <li key={i}>{prompt}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 align-top border border-gray-200">
                      {lesson.crossCurricularLinks && (
                        <ul className="list-disc list-inside">
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
          {/* <div className="text-sm text-gray-500 mt-4">
            <p>Author: {sow.metadata.author}</p>
            <p>Created: {new Date(sow.metadata.createdAt).toLocaleString()}</p>
            <p>Version: {sow.metadata.version}</p>
          </div> */}
        </div>
      </div>
    </div>
  );
}