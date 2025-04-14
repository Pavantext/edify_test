"use client";
import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import ShareButton from "@/components/share-btn";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ReportButton } from "@/components/ReportButton";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Edit, FileText, FileDown } from "lucide-react";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buttonVariants } from "@/components/ui/button";

export default function LessonPlanView() {
  const [lessonPlan, setLessonPlan] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    async function fetchLessonPlan() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("lesson_plan_results")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError || !data) {
          setError(
            "Lesson plan not found or error occurred while fetching data."
          );
          return;
        }

        setLessonPlan(JSON.parse(data.ai_lesson_plan));
      } catch (err) {
        setError("An error occurred while processing the lesson plan.");
      }
    }

    fetchLessonPlan();
  }, [id]);

  const handleExport = (format: "pdf" | "word") => {
    if (!lessonPlan) return;

    if (format === "pdf") {
      const doc = new jsPDF();
      let yPosition = 20;
      const leftMargin = 20;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Add logo and title at the top of first page
      const addHeaderWithLogo = () => {
        try {
          // Add title on the left
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text("Lesson Plan", leftMargin, 25);

          // Add logo on the right - make it square
          const logoSize = 20; // Size for both width and height
          const logoX = pageWidth - logoSize - leftMargin; // Position from right
          const logoY = 10; // Align with title

          // Add the logo image
          doc.addImage(
            "/edify-logo.png", // Path to logo in public folder
            "PNG",
            logoX,
            logoY,
            logoSize, // Same size for width
            logoSize  // Same size for height
          );

          // Reset font settings for content
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
        } catch (error) {
          console.error("Error adding header with logo:", error);
        }
      };

      // Add header with logo to first page
      addHeaderWithLogo();

      // Start content after header
      yPosition = 40; // Adjust starting position to account for header

      const addSection = (title: string, content: string | string[]) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        // Normal font for headers
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0); // Ensure text is black
        doc.text(title, leftMargin, yPosition);
        yPosition += 10;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        const contentText = Array.isArray(content) ? content.join("\n") : content;
        const lines = doc.splitTextToSize(contentText, pageWidth - 40);

        lines.forEach((line: string) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, leftMargin, yPosition);
          yPosition += 6;
        });

        yPosition += 10;
      };

      addSection("Overview", [
        `Subject: ${lessonPlan.overview?.subject}`,
        `Topic: ${lessonPlan.overview?.topic}`,
        `Year Group: ${lessonPlan.overview?.yearGroup}`,
        `Duration: ${lessonPlan.overview?.duration} minutes`,
        "\nLearning Objectives:",
        ...(lessonPlan.overview?.learningObjectives || []).map(
          (obj: string) => `• ${obj}`
        ),
        "\nInitial Prompts:",
        ...(lessonPlan.overview?.initialPrompts || []).map(
          (prompt: string) => `• ${prompt}`
        ),
      ]);

      lessonPlan.lessonOptions?.forEach((option: any, index: number) => {
        addSection(`Lesson Option ${index + 1}`, [
          "Starter Activity:",
          `Duration: ${option.starterActivity.duration} minutes`,
          `Description: ${option.starterActivity.description}`,
          "\nMaterials:",
          ...(option.starterActivity.materials || []).map((m: string) => `• ${m}`),
          "\nInstructions:",
          ...(option.starterActivity.instructions || []).map((i: string) => `• ${i}`),

          "\nMain Activities:",
          ...option.mainActivities
            .map((activity: any, actIndex: number) => [
              `\nActivity ${actIndex + 1}:`,
              `Duration: ${activity.duration} minutes`,
              `Description: ${activity.description}`,
              "\nMaterials:",
              ...(activity.materials || []).map((m: string) => `• ${m}`),
              "\nInstructions:",
              ...(activity.instructions || []).map((i: string) => `• ${i}`),
            ])
            .flat(),

          "\nPlenary:",
          `Duration: ${option.plenary.duration} minutes`,
          `Description: ${option.plenary.description}`,
          "\nInstructions:",
          ...(option.plenary.instructions || []).map((i: string) => `• ${i}`),
        ]);
      });

      addSection(
        "Suggestions for Reflecting on Learning",
        (lessonPlan.reflectionSuggestions || []).map((suggestion: string) => `• ${suggestion}`)
      );

      addSection("Differentiation & SEN Support", [
        "Differentiation:",
        "\nSupport:",
        ...(lessonPlan.differentiationAndSEN?.differentiation?.support || []).map(
          (i: string) => `• ${i}`
        ),
        "\nCore:",
        ...(lessonPlan.differentiationAndSEN?.differentiation?.core || []).map(
          (i: string) => `• ${i}`
        ),
        "\nExtension:",
        ...(lessonPlan.differentiationAndSEN?.differentiation?.extension || []).map(
          (i: string) => `• ${i}`
        ),
        "\nSEN Support:",
        "\nVisual Support:",
        ...(lessonPlan.differentiationAndSEN?.senSupport?.visual || []).map(
          (i: string) => `• ${i}`
        ),
        "\nAuditory Support:",
        ...(lessonPlan.differentiationAndSEN?.senSupport?.auditory || []).map(
          (i: string) => `• ${i}`
        ),
        "\nCognitive Support:",
        ...(lessonPlan.differentiationAndSEN?.senSupport?.cognitive || []).map(
          (i: string) => `• ${i}`
        ),
      ]);

      addSection(
        "Cross-curricular Links",
        (lessonPlan.crossCurricularLinks || []).map((link: string) => `• ${link}`)
      );

      addSection("Assessment Questions", [
        "Knowledge:",
        ...(lessonPlan.assessmentQuestions?.knowledge || []).map(
          (q: string) => `• ${q}`
        ),
        "\nComprehension:",
        ...(lessonPlan.assessmentQuestions?.comprehension || []).map(
          (q: string) => `• ${q}`
        ),
        "\nApplication:",
        ...(lessonPlan.assessmentQuestions?.application || []).map(
          (q: string) => `• ${q}`
        ),
        "\nAnalysis:",
        ...(lessonPlan.assessmentQuestions?.analysis || []).map(
          (q: string) => `• ${q}`
        ),
        "\nSynthesis:",
        ...(lessonPlan.assessmentQuestions?.synthesis || []).map(
          (q: string) => `• ${q}`
        ),
        "\nEvaluation:",
        ...(lessonPlan.assessmentQuestions?.evaluation || []).map(
          (q: string) => `• ${q}`
        ),
      ]);

      if (lessonPlan.additionalNotes?.length) {
        addSection(
          "Additional Notes",
          lessonPlan.additionalNotes.map((note: string) => `• ${note}`)
        );
      }

      doc.save("lesson-plan.pdf");
    } else if (format === "word") {
      // ... existing word export code ...
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
        </div>
      </div>
    );
  }

  if (!lessonPlan) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">Loading lesson plan...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Lesson Plan Details</h1>
          <div className="flex space-x-4">
          <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => handleExport("pdf")}
              className="flex items-center"
            >
              <FileText className="h-4 w-4" />
            </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Download PDF</p>
            </TooltipContent>
            </Tooltip>
            {/* <Button
              onClick={() => handleExport("word")}
              className="flex items-center"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Download Word
            </Button> */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => router.push(`/tools/lesson-plan-generator/${id}/edit`)}
                    className={buttonVariants({
                      
                      size: "icon",
                      className: "w-9 h-9",
                    })}
                  >
                    <Edit className='h-4 w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit lesson plan</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ShareButton
              shareUrl={`${process.env.NEXT_PUBLIC_APP_URL}/tools/lesson-plan-generator/${id}/view`}
              toolType="Lesson Plan Generator"
            />
            <ReportButton
              toolType="lesson_plan"
              resultId={id}
              position="inline"
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle>{lessonPlan.overview.topic}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <p>
                  <span className="font-medium">Subject:</span>{" "}
                  {lessonPlan.overview.subject}
                </p>
                <p>
                  <span className="font-medium">Year Group:</span>{" "}
                  {lessonPlan.overview.yearGroup}
                </p>
                <p>
                  <span className="font-medium">Duration:</span>{" "}
                  {lessonPlan.overview.duration} minutes
                </p>
              </div>

              {/* Learning Objectives */}
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Learning Objectives</h4>
                <ul className="list-disc pl-5">
                  {lessonPlan.overview.learningObjectives.map(
                    (objective: string, index: number) => (
                      <li key={index}>{objective}</li>
                    )
                  )}
                </ul>
              </div>

              {/* Initial Prompts */}
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Initial Prompts</h4>
                <ul className="list-disc pl-5">
                  {lessonPlan.overview.initialPrompts.map(
                    (prompt: string, index: number) => (
                      <li key={index}>{prompt}</li>
                    )
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Lesson Options */}
          {lessonPlan.lessonOptions.map((option: any, optionIndex: number) => (
            <Card key={optionIndex}>
              <CardHeader>
                <CardTitle>Lesson Option {option.optionNumber}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Starter Activity */}
                  <div>
                    <h4 className="font-semibold mb-2">
                      Starter Activity ({option.starterActivity.duration} mins)
                    </h4>
                    <p className="mb-2">{option.starterActivity.description}</p>
                    <div className="pl-4">
                      <p className="font-medium text-sm mb-1">Materials:</p>
                      <ul className="list-disc pl-5 text-sm">
                        {option.starterActivity.materials.map(
                          (material: string, idx: number) => (
                            <li key={idx}>{material}</li>
                          )
                        )}
                      </ul>
                      <p className="font-medium text-sm mb-1 mt-2">
                        Instructions:
                      </p>
                      <ul className="list-disc pl-5 text-sm">
                        {option.starterActivity.instructions.map(
                          (instruction: string, idx: number) => (
                            <li key={idx}>{instruction}</li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Main Activities */}
                  {option.mainActivities.map(
                    (activity: any, activityIndex: number) => (
                      <div key={activityIndex}>
                        <h4 className="font-semibold mb-2">
                          Main Activity {activityIndex + 1} ({activity.duration}{" "}
                          mins)
                        </h4>
                        <p className="mb-2">{activity.description}</p>
                        <div className="pl-4">
                          <p className="font-medium text-sm mb-1">Materials:</p>
                          <ul className="list-disc pl-5 text-sm">
                            {activity.materials.map(
                              (material: string, idx: number) => (
                                <li key={idx}>{material}</li>
                              )
                            )}
                          </ul>
                          <p className="font-medium text-sm mb-1 mt-2">
                            Instructions:
                          </p>
                          <ul className="list-disc pl-5 text-sm">
                            {activity.instructions.map(
                              (instruction: string, idx: number) => (
                                <li key={idx}>{instruction}</li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>
                    )
                  )}

                  {/* Plenary */}
                  <div>
                    <h4 className="font-semibold mb-2">
                      Plenary ({option.plenary.duration} mins)
                    </h4>
                    <p className="mb-2">{option.plenary.description}</p>
                    <div className="pl-4">
                      <p className="font-medium text-sm mb-1">Instructions:</p>
                      <ul className="list-disc pl-5 text-sm">
                        {option.plenary.instructions.map(
                          (instruction: string, idx: number) => (
                            <li key={idx}>{instruction}</li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Reflection Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle>Reflection Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5">
                {lessonPlan.reflectionSuggestions.map(
                  (suggestion: string, index: number) => (
                    <li key={index}>{suggestion}</li>
                  )
                )}
              </ul>
            </CardContent>
          </Card>

          {/* Differentiation & SEN Support */}
          <Card>
            <CardHeader>
              <CardTitle>Differentiation & SEN Support</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Differentiation</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="font-medium text-sm mb-1">Support:</p>
                      <ul className="list-disc pl-5 text-sm">
                        {lessonPlan.differentiationAndSEN.differentiation.support.map(
                          (item: string, idx: number) => (
                            <li key={idx}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-sm mb-1">Core:</p>
                      <ul className="list-disc pl-5 text-sm">
                        {lessonPlan.differentiationAndSEN.differentiation.core.map(
                          (item: string, idx: number) => (
                            <li key={idx}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-sm mb-1">Extension:</p>
                      <ul className="list-disc pl-5 text-sm">
                        {lessonPlan.differentiationAndSEN.differentiation.extension.map(
                          (item: string, idx: number) => (
                            <li key={idx}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {lessonPlan.differentiationAndSEN.senSupport && (
                  <div>
                    <h4 className="font-semibold mb-2">SEN Support</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {lessonPlan.differentiationAndSEN.senSupport.visual && (
                        <div>
                          <p className="font-medium text-sm mb-1">
                            Visual Support:
                          </p>
                          <ul className="list-disc pl-5 text-sm">
                            {lessonPlan.differentiationAndSEN.senSupport.visual.map(
                              (item: string, idx: number) => (
                                <li key={idx}>{item}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                      {lessonPlan.differentiationAndSEN.senSupport.auditory && (
                        <div>
                          <p className="font-medium text-sm mb-1">
                            Auditory Support:
                          </p>
                          <ul className="list-disc pl-5 text-sm">
                            {lessonPlan.differentiationAndSEN.senSupport.auditory.map(
                              (item: string, idx: number) => (
                                <li key={idx}>{item}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                      {lessonPlan.differentiationAndSEN.senSupport
                        .cognitive && (
                        <div>
                          <p className="font-medium text-sm mb-1">
                            Cognitive Support:
                          </p>
                          <ul className="list-disc pl-5 text-sm">
                            {lessonPlan.differentiationAndSEN.senSupport.cognitive.map(
                              (item: string, idx: number) => (
                                <li key={idx}>{item}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cross-curricular Links */}
          <Card>
            <CardHeader>
              <CardTitle>Cross-curricular Links</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5">
                {lessonPlan.crossCurricularLinks.map(
                  (link: string, index: number) => (
                    <li key={index}>{link}</li>
                  )
                )}
              </ul>
            </CardContent>
          </Card>

          {/* Assessment Questions */}
          <Card>
            <CardHeader>
              <CardTitle>
                Assessment Questions (Based on Bloom's Taxonomy)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries({
                  knowledge: "Knowledge",
                  comprehension: "Comprehension",
                  application: "Application",
                  analysis: "Analysis",
                  synthesis: "Synthesis",
                  evaluation: "Evaluation",
                }).map(([key, title]) => (
                  <div key={key}>
                    <h4 className="font-semibold mb-2">{title}</h4>
                    <ul className="list-disc pl-5">
                      {lessonPlan.assessmentQuestions[key].map(
                        (question: string, idx: number) => (
                          <li key={idx}>{question}</li>
                        )
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5">
                {lessonPlan.additionalNotes.map(
                  (note: string, index: number) => (
                    <li key={index}>{note}</li>
                  )
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
