"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { ReportButton } from "@/components/ReportButton";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import { FileText, FileDown, Eye, Edit } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportDropdown } from "@/components/ExportDropdown";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Document, Packer, Paragraph, TextRun, ImageRun, Header } from "docx";
import SubscriptionDialog from "@/components/SubscriptionDialog";

const LessonPlanForm = () => {
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lessonPlan, setLessonPlan] = useState<any>(null);
  const [savedLessonPlanId, setSavedLessonPlanId] = useState<string | null>(
    null
  );
  const [showDifferentiation, setShowDifferentiation] = useState(false);
  const [showSEN, setShowSEN] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [isFromApprovedUrl, setIsFromApprovedUrl] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Add useEffect to fetch lesson plan when approved ID is present
  useEffect(() => {
    const fetchApprovedLessonPlan = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const approvedId = searchParams.get('approved');

      if (approvedId) {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/tools/lesson-plan?approved=${approvedId}`);
          const data = await response.json();

          if (!response.ok) {
            if (response.status === 403) {
              // Content not approved
              setError(`Content not approved: ${data.details?.status || 'Unknown status'}`);
              return;
            }
            throw new Error(data.error || 'Failed to fetch lesson plan');
          }

          setLessonPlan(data.lesson_plan);
          setSavedLessonPlanId(approvedId);
          // Add a flag to track if content is from approved URL
          setIsFromApprovedUrl(true);

          // Pre-fill form with input data
          if (data.input_data) {
            const form = formRef.current;
            if (form) {
              form.topic.value = data.input_data.topic || '';
              form.subject.value = data.input_data.subject || '';
              form.yearGroup.value = data.input_data.yearGroup || '';
              form.duration.value = data.input_data.duration || '';

              // Handle special considerations if present
              if (data.input_data.specialConsiderations) {
                const { differentiation, send } = data.input_data.specialConsiderations;
                if (differentiation) {
                  setShowDifferentiation(true);
                  if (form.higherAbility) form.higherAbility.checked = differentiation.higherAbility || false;
                  if (form.lowerAbility) form.lowerAbility.checked = differentiation.lowerAbility || false;
                  if (form.esl) form.esl.checked = differentiation.esl || false;
                }
                if (send) {
                  setShowSEN(true);
                  if (form.visualImpairment) form.visualImpairment.checked = send.visualImpairment || false;
                  if (form.hearingImpairment) form.hearingImpairment.checked = send.hearingImpairment || false;
                  if (form.dyslexia) form.dyslexia.checked = send.dyslexia || false;
                  if (form.autism) form.autism.checked = send.autism || false;
                  if (form.adhd) form.adhd.checked = send.adhd || false;
                }
              }
            }
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load lesson plan');
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchApprovedLessonPlan();
  }, []);

  const yearGroups = Array.from({ length: 13 }, (_, i) => `Year ${i + 1}`);

  const handleSubmit = async (e: any) => {
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
    setLessonPlan(null);
    setSavedLessonPlanId(null);

    if (!formRef.current) {
      console.error("Form reference is null");
      return;
    }

    // Get form data including disabled fields
    const formData = new FormData(formRef.current);
    const data = {
      topic: isFromApprovedUrl ? formRef.current.topic.value : formData.get('topic') || '',
      subject: isFromApprovedUrl ? formRef.current.subject.value : formData.get('subject') || '',
      yearGroup: isFromApprovedUrl ? formRef.current.yearGroup.value : formData.get('yearGroup') || '',
      duration: isFromApprovedUrl ? formRef.current.duration.value : formData.get('duration') || '',
      learningObjectives: formData.get('objectives') || '', // Ensure it's never null
      specialConsiderations: {
        differentiation: showDifferentiation ? {
          higherAbility: formData.get('higherAbility') === 'on',
          lowerAbility: formData.get('lowerAbility') === 'on',
          esl: formData.get('esl') === 'on'
        } : undefined,
        send: showSEN ? {
          visualImpairment: formData.get('visualImpairment') === 'on',
          hearingImpairment: formData.get('hearingImpairment') === 'on',
          dyslexia: formData.get('dyslexia') === 'on',
          autism: formData.get('autism') === 'on',
          adhd: formData.get('adhd') === 'on'
        } : undefined
      }
    };

    try {
      const response = await fetch(`/api/tools/lesson-plan${savedLessonPlanId ? `?approvedId=${savedLessonPlanId}` : ''}`, {
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
        throw new Error(result.error || "Failed to generate lesson plan");
      }

      setLessonPlan(JSON.parse(result.data.ai_lesson_plan));
      setSavedLessonPlanId(result.data.id);
    } catch (err: any) {
      setError(
        err.message || "An error occurred while generating the lesson plan"
      );
    } finally {
      setIsLoading(false);
      setIsChecked(!isChecked);
    }
  };

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
          // Add logo on the right - make it square
          const logoSize = 16; // Size for both width and height
          const logoX = pageWidth - logoSize - leftMargin; // Position from right
          const logoY = 10; // Align with title

          // Add the logo image
          doc.addImage(
            "/edify-logo.png", // Path to logo in public folder
            "PNG",
            logoX,
            logoY,
            logoSize, // Same size for width
            logoSize // Same size for height
          );

          // Reset font settings for content
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
        } catch (error) {
          console.error("Error adding header with logo:", error);
        }
      };

      // Add title on the left
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Lesson Plan", leftMargin, 25);
      // Add header with logo to first page
      addHeaderWithLogo();

      // Start content after header
      yPosition = 40; // Adjust starting position to account for header

      const addSection = (title: string, content: string | string[]) => {
        if (yPosition > 270) {
          doc.addPage();
          // addWatermark(); // Add watermark to new page
          addHeaderWithLogo(); // Add header with logo on new page
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

        const contentText = Array.isArray(content)
          ? content.join("\n")
          : content;
        const lines = doc.splitTextToSize(contentText, pageWidth - 40);

        lines.forEach((line: string) => {
          if (yPosition > 270) {
            doc.addPage();
            addHeaderWithLogo(); // Add header with logo on new page
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

      // Lesson Options
      lessonPlan.lessonOptions?.forEach((option: any, index: number) => {
        addSection(`Lesson Option ${index + 1}`, [
          // Starter Activity
          "Starter Activity:",
          `Duration: ${option.starterActivity.duration} minutes`,
          `Description: ${option.starterActivity.description}`,
          "\nMaterials:",
          ...(option.starterActivity.materials || []).map(
            (m: string) => `• ${m}`
          ),
          "\nInstructions:",
          ...(option.starterActivity.instructions || []).map(
            (i: string) => `• ${i}`
          ),

          // Main Activities
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

          // Plenary
          "\nPlenary:",
          `Duration: ${option.plenary.duration} minutes`,
          `Description: ${option.plenary.description}`,
          "\nInstructions:",
          ...(option.plenary.instructions || []).map((i: string) => `• ${i}`),
        ]);
      });

      // Reflection Suggestions
      addSection(
        "Suggestions for Reflecting on Learning",
        (lessonPlan.reflectionSuggestions || []).map(
          (suggestion: string) => `• ${suggestion}`
        )
      );

      // Differentiation & SEN Support
      addSection("Differentiation & SEN Support", [
        "Differentiation:",
        "\nSupport:",
        ...(
          lessonPlan.differentiationAndSEN?.differentiation?.support || []
        ).map((i: string) => `• ${i}`),
        "\nCore:",
        ...(lessonPlan.differentiationAndSEN?.differentiation?.core || []).map(
          (i: string) => `• ${i}`
        ),
        "\nExtension:",
        ...(
          lessonPlan.differentiationAndSEN?.differentiation?.extension || []
        ).map((i: string) => `• ${i}`),
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

      // Cross-curricular Links
      addSection(
        "Cross-curricular Links",
        (lessonPlan.crossCurricularLinks || []).map(
          (link: string) => `• ${link}`
        )
      );

      // Assessment Questions
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

      // Additional Notes
      if (lessonPlan.additionalNotes?.length) {
        addSection(
          "Additional Notes",
          lessonPlan.additionalNotes.map((note: string) => `• ${note}`)
        );
      }

      doc.save("lesson-plan.pdf");
    } else if (format === "word") {


      const handleExportWord = async () => {
        if (!lessonPlan) return;

        // Load the logo image
        const imageUrl = "/mainlogo.png";
        const response = await fetch(imageUrl);
        const imageBuffer = await response.arrayBuffer();

        // Create a Word document
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
                          transformation: { width: 50, height: 50 }, // Small size
                          type: 'png', // Specify the image type
                        }),
                      ],
                      alignment: "right", // Align image to the left
                    }),
                  ],
                }),
              },
              children: [
                new Paragraph({
                  children: [new TextRun("Lesson Plan")],
                  heading: "Heading1",
                }),
                new Paragraph({ children: [new TextRun(`Subject: ${lessonPlan.overview?.subject || lessonPlan.subject}`)] }),
                new Paragraph({ children: [new TextRun(`Year Group: ${lessonPlan.overview?.yearGroup || lessonPlan.yearGroup}`)] }),
                new Paragraph({ children: [new TextRun(`Duration: ${lessonPlan.overview?.duration || lessonPlan.duration} minutes`)] }),
                new Paragraph({ children: [new TextRun(`Topic: ${lessonPlan.overview?.topic || lessonPlan.topic}`)] }),
                new Paragraph({ children: [new TextRun("Learning Objectives")], heading: "Heading2" }),
                ...((lessonPlan.overview?.learningObjectives || lessonPlan.learningObjectives || []).map((obj: string) =>
                  new Paragraph({ children: [new TextRun(`• ${obj}`)] })
                )),
                new Paragraph({ children: [new TextRun("Initial Prompts")], heading: "Heading2" }),
                ...((lessonPlan.overview?.initialPrompts || []).map((prompt: string) =>
                  new Paragraph({ children: [new TextRun(`• ${prompt}`)] })
                )),
                lessonPlan.differentiationAndSEN && new Paragraph({
                  children: [new TextRun("Differentiation & SEN Support")],
                  heading: "Heading2",
                }),
                ...["support", "core", "extension"].flatMap((key) =>
                  lessonPlan.differentiationAndSEN?.differentiation?.[key] ? [
                    new Paragraph({ children: [new TextRun(`${key.charAt(0).toUpperCase() + key.slice(1)}:`)], heading: "Heading3" }),
                    ...lessonPlan.differentiationAndSEN.differentiation[key].map((item: string) =>
                      new Paragraph({ children: [new TextRun(`• ${item}`)] })
                    )
                  ] : []
                ),
                ...["visual", "auditory", "cognitive"].flatMap((key) =>
                  lessonPlan.differentiationAndSEN?.senSupport?.[key] ? [
                    new Paragraph({ children: [new TextRun(`${key.charAt(0).toUpperCase() + key.slice(1)} Support:`)], heading: "Heading3" }),
                    ...lessonPlan.differentiationAndSEN.senSupport[key].map((item: string) =>
                      new Paragraph({ children: [new TextRun(`• ${item}`)] })
                    )
                  ] : []
                ),
                ...(lessonPlan.lessonOptions?.flatMap((option: any, optionIndex: number) => [
                  new Paragraph({ children: [new TextRun(`Lesson Option ${option.optionNumber}`)], heading: "Heading2" }),
                  new Paragraph({ children: [new TextRun(`Starter Activity (${option.starterActivity.duration} min)`)], heading: "Heading3" }),
                  new Paragraph({ children: [new TextRun(option.starterActivity.description)] }),
                  ...option.starterActivity.materials.map((material: string) => new Paragraph({ children: [new TextRun(`• ${material}`)] })),
                  ...option.starterActivity.instructions.map((instruction: string) => new Paragraph({ children: [new TextRun(`• ${instruction}`)] })),
                  ...option.mainActivities.flatMap((activity: any, actIndex: number) => [
                    new Paragraph({ children: [new TextRun(`Main Activity ${actIndex + 1} (${activity.duration} min)`)], heading: "Heading3" }),
                    new Paragraph({ children: [new TextRun(activity.description)] }),
                    ...activity.materials.map((material: string) => new Paragraph({ children: [new TextRun(`• ${material}`)] })),
                    ...activity.instructions.map((instruction: string) => new Paragraph({ children: [new TextRun(`• ${instruction}`)] }))
                  ]),
                  new Paragraph({ children: [new TextRun(`Plenary (${option.plenary.duration} min)`)], heading: "Heading3" }),
                  new Paragraph({ children: [new TextRun(option.plenary.description)] }),
                  ...option.plenary.instructions.map((instruction: string) => new Paragraph({ children: [new TextRun(`• ${instruction}`)] }))
                ]) || []),
                lessonPlan.reflectionSuggestions?.length && new Paragraph({
                  children: [new TextRun("Suggestions for Reflecting on Learning")],
                  heading: "Heading2",
                }),
                ...(lessonPlan.reflectionSuggestions?.map((suggestion: string) =>
                  new Paragraph({ children: [new TextRun(`• ${suggestion}`)] })
                ) || []),
                new Paragraph({ children: [new TextRun("Cross-curricular Links")], heading: "Heading2" }),
                ...(lessonPlan.crossCurricularLinks?.map((link: string) =>
                  new Paragraph({ children: [new TextRun(`• ${link}`)] })
                ) || []),
                lessonPlan.assessmentQuestions && new Paragraph({
                  children: [new TextRun("Assessment Questions")],
                  heading: "Heading2",
                }),
                ...["knowledge", "comprehension", "application", "analysis", "synthesis", "evaluation"].flatMap((category) =>
                  lessonPlan.assessmentQuestions?.[category]?.length ? [
                    new Paragraph({ children: [new TextRun(category.charAt(0).toUpperCase() + category.slice(1))], heading: "Heading3" }),
                    ...lessonPlan.assessmentQuestions[category].map((q: string) => new Paragraph({ children: [new TextRun(`• ${q}`)] }))
                  ] : []
                ),
                lessonPlan.additionalNotes?.length && new Paragraph({
                  children: [new TextRun("Additional Notes")],
                  heading: "Heading2",
                }),
                ...(lessonPlan.additionalNotes?.map((note: string) =>
                  new Paragraph({ children: [new TextRun(`• ${note}`)] })
                ) || []),
              ]
                .filter(Boolean),
            },
          ],
        });

        // Generate the Word file
        const blob = await Packer.toBlob(doc);
        saveAs(blob, "lesson-plan.docx");
      };

      handleExportWord();



    }
  };

  const renderLessonStructure = () => {
    if (!lessonPlan?.lessonStructure) return null;

    return (
      <div className='space-y-6'>
        {/* Starter Activity */}
        {lessonPlan.lessonStructure.starter && (
          <Card>
            <CardHeader>
              <CardTitle>
                Starter Activity (
                {lessonPlan.lessonStructure.starter?.duration || 0} mins)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='mb-4'>
                {lessonPlan.lessonStructure.starter?.description}
              </p>
              <div className='space-y-4'>
                {lessonPlan.lessonStructure.starter?.teacherInstructions
                  ?.length > 0 && (
                    <div>
                      <h4 className='font-semibold'>Teacher Instructions</h4>
                      <ul className='list-disc pl-5'>
                        {lessonPlan.lessonStructure.starter.teacherInstructions.map(
                          (instruction: string, idx: number) => (
                            <li key={idx}>{instruction}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                {lessonPlan.lessonStructure.starter?.studentInstructions
                  ?.length > 0 && (
                    <div>
                      <h4 className='font-semibold'>Student Instructions</h4>
                      <ul className='list-disc pl-5'>
                        {lessonPlan.lessonStructure.starter.studentInstructions.map(
                          (instruction: string, idx: number) => (
                            <li key={idx}>{instruction}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Activities */}
        {lessonPlan.lessonStructure.mainActivities?.map(
          (activity: any, index: number) =>
            activity && (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>
                    Activity {index + 1} ({activity?.duration || 0} mins)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-4'>
                    <p>{activity?.description}</p>
                    {activity?.teacherInstructions?.length > 0 && (
                      <div>
                        <h4 className='font-semibold'>Teacher Instructions</h4>
                        <ul className='list-disc pl-5'>
                          {activity.teacherInstructions.map(
                            (instruction: string, idx: number) => (
                              <li key={idx}>{instruction}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                    {activity?.studentInstructions?.length > 0 && (
                      <div>
                        <h4 className='font-semibold'>Student Instructions</h4>
                        <ul className='list-disc pl-5'>
                          {activity.studentInstructions.map(
                            (instruction: string, idx: number) => (
                              <li key={idx}>{instruction}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
        )}

        {/* Plenary */}
        {lessonPlan.lessonStructure.plenary && (
          <Card>
            <CardHeader>
              <CardTitle>
                Plenary ({lessonPlan.lessonStructure.plenary?.duration || 0}{" "}
                mins)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className='mb-4'>
                {lessonPlan.lessonStructure.plenary?.description}
              </p>
              {lessonPlan.lessonStructure.plenary?.instructions?.length > 0 && (
                <div>
                  <h4 className='font-semibold'>Instructions</h4>
                  <ul className='list-disc pl-5'>
                    {lessonPlan.lessonStructure.plenary.instructions.map(
                      (instruction: string, idx: number) => (
                        <li key={idx}>{instruction}</li>
                      )
                    )}
                  </ul>
                </div>
              )}
              {lessonPlan.lessonStructure.plenary?.successIndicators?.length >
                0 && (
                  <div className='mt-4'>
                    <h4 className='font-semibold'>Success Indicators</h4>
                    <ul className='list-disc pl-5'>
                      {lessonPlan.lessonStructure.plenary.successIndicators.map(
                        (indicator: string, idx: number) => (
                          <li key={idx}>{indicator}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const exportOptions = [
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
      <div className='container mx-auto px-4'>
        {/* Report button in corner */}
        <div className='flex justify-end mb-4'>
          <ReportButton
            toolType='lesson_plan'
            position='inline'
            variant='pre'
          />
        </div>

        {/* Centered heading */}
        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            AI Lesson Plan Generator
          </h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Create comprehensive lesson plans with learning objectives and
            activities
          </p>
        </div>

        <div className='grid md:grid-cols-2 gap-8 max-w-6xl mx-auto'>
          {/* Form Section */}
          <div className='bg-white p-6 rounded-lg shadow'>
            {isFromApprovedUrl && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-blue-800 text-sm mb-4">
                <p className="font-medium">Some fields are locked based on approved content</p>
                <p>You can still adjust other settings like learning objectives and special considerations.</p>
              </div>
            )}
            <form ref={formRef} onSubmit={handleSubmit} className='space-y-6'>
              <div>
                <Label htmlFor='topic'>
                  Lesson Topic <span className='text-red-500'>*</span>
                </Label>
                <Textarea
                  id='topic'
                  name='topic'
                  required
                  placeholder='Enter the main topic of the lesson'
                  className='mt-1 min-h-[100px]'
                  disabled={isFromApprovedUrl}
                />
              </div>

              <div>
                <Label htmlFor='subject'>
                  Subject <span className='text-red-500'>*</span>
                </Label>
                <Input
                  id='subject'
                  name='subject'
                  required
                  placeholder='Enter the subject'
                  className='mt-1'
                  disabled={isFromApprovedUrl}
                />
              </div>

              <div>
                <Label htmlFor='objectives'>
                  Learning Objectives <span className='text-red-500'>*</span>
                </Label>
                <Textarea
                  id='objectives'
                  name='objectives'
                  required
                  placeholder='Enter the learning objectives (one per line)'
                  className='mt-1 min-h-[100px]'
                />
              </div>

              <div>
                <Label htmlFor='yearGroup'>
                  Year Group <span className='text-red-500'>*</span>
                </Label>
                <select
                  name='yearGroup'
                  id='yearGroup'
                  className='w-full mt-1 p-2 border rounded'
                  defaultValue={yearGroups[0]}
                  aria-label='Select year group'
                  disabled={isFromApprovedUrl}
                >
                  {yearGroups.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor='duration'>
                  Duration (minutes) <span className='text-red-500'>*</span>
                </Label>
                <Input
                  id='duration'
                  name='duration'
                  type='number'
                  min='1'
                  max='60'
                  defaultValue='60'
                  required
                  className='mt-1'
                  disabled={isFromApprovedUrl}
                />
              </div>

              <div className='space-y-4'>
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    id='enableDifferentiation'
                    checked={showDifferentiation}
                    onCheckedChange={(checked) =>
                      setShowDifferentiation(checked as boolean)
                    }
                  />
                  <Label htmlFor='enableDifferentiation'>
                    Enable Differentiation Options
                  </Label>
                </div>

                {showDifferentiation && (
                  <div className='space-y-4 ml-6'>
                    <h3 className='font-semibold'>Differentiation</h3>
                    <div className='grid grid-cols-2 gap-4'>
                      <div className='flex items-center space-x-2'>
                        <Checkbox id='higherAbility' name='higherAbility' />
                        <Label htmlFor='higherAbility'>Higher Ability</Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox id='lowerAbility' name='lowerAbility' />
                        <Label htmlFor='lowerAbility'>Lower Ability</Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox id='esl' name='esl' />
                        <Label htmlFor='esl'>ESL</Label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className='space-y-4'>
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    id='enableSEND'
                    checked={showSEN}
                    onCheckedChange={(checked) =>
                      setShowSEN(checked as boolean)
                    }
                  />
                  <Label htmlFor='enableSEND'>Enable SEN Considerations</Label>
                </div>

                {showSEN && (
                  <div className='space-y-4 ml-6'>
                    <h3 className='font-semibold'>SEN Considerations</h3>
                    <div className='grid grid-cols-2 gap-4'>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='visualImpairment'
                          name='visualImpairment'
                        />
                        <Label htmlFor='visualImpairment'>
                          Visual Impairment
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='hearingImpairment'
                          name='hearingImpairment'
                        />
                        <Label htmlFor='hearingImpairment'>
                          Hearing Impairment
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox id='dyslexia' name='dyslexia' />
                        <Label htmlFor='dyslexia'>Dyslexia</Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox id='autism' name='autism' />
                        <Label htmlFor='autism'>Autism</Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox id='adhd' name='adhd' />
                        <Label htmlFor='adhd'>ADHD</Label>
                      </div>
                    </div>
                  </div>
                )}
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
                className='w-full'
                disabled={!isChecked || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Generating Plan...
                  </>
                ) : (
                  "Generate Lesson Plan"
                )}
              </Button>
            </form>
          </div>

          {/* Results Section */}
          <div className='bg-white p-6 rounded-lg shadow overflow-y-auto max-h-[800px]'>
            {error && (
              <div className='mb-4 p-4 bg-red-50 text-red-700 rounded'>
                {error}
              </div>
            )}

            {isLoading ? (
              <div className='space-y-4'>
                <div className='h-4 bg-gray-200 rounded animate-pulse'></div>
                <div className='h-4 bg-gray-200 rounded animate-pulse w-5/6'></div>
                <div className='h-4 bg-gray-200 rounded animate-pulse'></div>
              </div>
            ) : lessonPlan ? (
              <div className='space-y-6'>
                <div className='flex items-center mb-4'>
                  <div className='flex space-x-4'>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={`/tools/lesson-plan-generator/${savedLessonPlanId}/view`}
                            className={buttonVariants({
                              variant: "outline",
                              size: "icon",
                              className: "w-9 h-9",
                            })}
                          >
                            <Eye className='h-4 w-4' />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View lesson plan</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/tools/lesson-plan-generator/${savedLessonPlanId}/edit`}
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
                        <p>Edit lesson plan</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className='flex space-x-4 px-4'>
                    <ExportDropdown options={exportOptions} />
                  </div>
                  {savedLessonPlanId && (
                    <ReportButton
                      toolType='lesson_plan'
                      resultId={savedLessonPlanId}
                      position='inline'
                    />
                  )}
                </div>

                <Tabs defaultValue='overview' className='w-full'>
                  <TabsList className='gap-0'>
                    <TabsTrigger value='overview'>Overview</TabsTrigger>
                    {lessonPlan.lessonOptions?.map((_: any, index: number) => (
                      <TabsTrigger key={index} value={`option${index + 1}`}>
                        Option {index + 1}
                      </TabsTrigger>
                    ))}
                    <TabsTrigger value='assessment'>Assessment</TabsTrigger>
                    <TabsTrigger value='additional'>Additional</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value='overview' className='space-y-6'>
                    {/* Overview Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Overview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className='space-y-4'>
                          <div className='grid grid-cols-2 gap-4 text-sm'>
                            <p>
                              <span className='font-medium'>Subject:</span>{" "}
                              {lessonPlan.overview?.subject || "N/A"}
                            </p>
                            <p>
                              <span className='font-medium'>Topic:</span>{" "}
                              {lessonPlan.overview?.topic || "N/A"}
                            </p>
                            <p>
                              <span className='font-medium'>Year Group:</span>{" "}
                              {lessonPlan.overview?.yearGroup || "N/A"}
                            </p>
                            <p>
                              <span className='font-medium'>Duration:</span>{" "}
                              {lessonPlan.overview?.duration || 0} minutes
                            </p>
                          </div>

                          <div>
                            <h4 className='font-semibold mb-2'>
                              Learning Objectives
                            </h4>
                            <ul className='list-disc pl-5'>
                              {lessonPlan.overview?.learningObjectives?.map(
                                (objective: string, index: number) => (
                                  <li key={index}>{objective}</li>
                                )
                              ) || <li>No learning objectives specified</li>}
                            </ul>
                          </div>

                          <div>
                            <h4 className='font-semibold mb-2'>
                              Initial Prompts
                            </h4>
                            <ul className='list-disc pl-5'>
                              {lessonPlan.overview?.initialPrompts?.map(
                                (prompt: string, index: number) => (
                                  <li key={index}>{prompt}</li>
                                )
                              ) || <li>No initial prompts specified</li>}
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Differentiation & SEN Support Card */}
                    {lessonPlan?.differentiationAndSEN && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Differentiation & SEN Support</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className='space-y-4'>
                            {lessonPlan.differentiationAndSEN
                              .differentiation && (
                                <div>
                                  <h4 className='font-semibold mb-2'>
                                    Differentiation
                                  </h4>
                                  <div className='grid grid-cols-3 gap-4'>
                                    {lessonPlan.differentiationAndSEN
                                      .differentiation.support && (
                                        <div>
                                          <p className='font-medium text-sm mb-1'>
                                            Support:
                                          </p>
                                          <ul className='list-disc pl-5 text-sm'>
                                            {lessonPlan.differentiationAndSEN.differentiation.support.map(
                                              (item: string, idx: number) => (
                                                <li key={idx}>{item}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    {lessonPlan.differentiationAndSEN
                                      .differentiation.core && (
                                        <div>
                                          <p className='font-medium text-sm mb-1'>
                                            Core:
                                          </p>
                                          <ul className='list-disc pl-5 text-sm'>
                                            {lessonPlan.differentiationAndSEN.differentiation.core.map(
                                              (item: string, idx: number) => (
                                                <li key={idx}>{item}</li>
                                              )
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    {lessonPlan.differentiationAndSEN
                                      .differentiation.extension && (
                                        <div>
                                          <p className='font-medium text-sm mb-1'>
                                            Extension:
                                          </p>
                                          <ul className='list-disc pl-5 text-sm'>
                                            {lessonPlan.differentiationAndSEN.differentiation.extension.map(
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

                            {lessonPlan.differentiationAndSEN.senSupport && (
                              <div>
                                <h4 className='font-semibold mb-2'>
                                  SEN Support
                                </h4>
                                <div className='grid grid-cols-3 gap-4'>
                                  {lessonPlan.differentiationAndSEN.senSupport
                                    .visual && (
                                      <div>
                                        <p className='font-medium text-sm mb-1'>
                                          Visual Support:
                                        </p>
                                        <ul className='list-disc pl-5 text-sm'>
                                          {lessonPlan.differentiationAndSEN.senSupport.visual.map(
                                            (item: string, idx: number) => (
                                              <li key={idx}>{item}</li>
                                            )
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                  {lessonPlan.differentiationAndSEN.senSupport
                                    .auditory && (
                                      <div>
                                        <p className='font-medium text-sm mb-1'>
                                          Auditory Support:
                                        </p>
                                        <ul className='list-disc pl-5 text-sm'>
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
                                        <p className='font-medium text-sm mb-1'>
                                          Cognitive Support:
                                        </p>
                                        <ul className='list-disc pl-5 text-sm'>
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
                    )}
                  </TabsContent>

                  {/* Lesson Option Tabs */}
                  {lessonPlan.lessonOptions?.map(
                    (option: any, optionIndex: number) => (
                      <TabsContent
                        key={optionIndex}
                        value={`option${optionIndex + 1}`}
                        className='space-y-6'
                      >
                        {/* Teaching Style */}
                        {/* <Card>
                  <CardHeader>
                          <CardTitle>Teaching Approach</CardTitle>
                  </CardHeader>
                  <CardContent>
                          <p className="text-lg font-medium">{option.teachingStyle}</p>
                        </CardContent>
                      </Card> */}

                        {/* Starter Activity */}
                        <Card>
                          <CardHeader>
                            <CardTitle>
                              Starter Activity (
                              {option.starterActivity.duration} min)
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className='mb-4'>
                              {option.starterActivity.description}
                            </p>
                            <div className='space-y-4'>
                              <div>
                                <h4 className='font-semibold'>Materials</h4>
                                <ul className='list-disc pl-5'>
                                  {option.starterActivity.materials.map(
                                    (material: string, idx: number) => (
                                      <li key={idx}>{material}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                              <div>
                                <h4 className='font-semibold'>Instructions</h4>
                                <ul className='list-disc pl-5'>
                                  {option.starterActivity.instructions.map(
                                    (instruction: string, idx: number) => (
                                      <li key={idx}>{instruction}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Main Activities */}
                        {option.mainActivities.map(
                          (activity: any, activityIndex: number) => (
                            <Card key={activityIndex}>
                              <CardHeader>
                                <CardTitle>
                                  Main Activity {activityIndex + 1} (
                                  {activity.duration} min)
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className='mb-4'>{activity.description}</p>
                                <div className='space-y-4'>
                                  <div>
                                    <h4 className='font-semibold'>Materials</h4>
                                    <ul className='list-disc pl-5'>
                                      {activity.materials.map(
                                        (material: string, idx: number) => (
                                          <li key={idx}>{material}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                  <div>
                                    <h4 className='font-semibold'>
                                      Instructions
                                    </h4>
                                    <ul className='list-disc pl-5'>
                                      {activity.instructions.map(
                                        (instruction: string, idx: number) => (
                                          <li key={idx}>{instruction}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        )}

                        {/* Plenary */}
                        <Card>
                          <CardHeader>
                            <CardTitle>
                              Plenary ({option.plenary.duration} min)
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className='mb-4'>{option.plenary.description}</p>
                            <div>
                              <h4 className='font-semibold'>Instructions</h4>
                              <ul className='list-disc pl-5'>
                                {option.plenary.instructions.map(
                                  (instruction: string, idx: number) => (
                                    <li key={idx}>{instruction}</li>
                                  )
                                )}
                              </ul>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    )
                  )}

                  {/* Assessment Tab */}
                  <TabsContent value='assessment' className='space-y-6'>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Assessment Questions (Based on Bloom's Taxonomy)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className='space-y-4'>
                          {Object.entries({
                            knowledge: "Knowledge",
                            comprehension: "Comprehension",
                            application: "Application",
                            analysis: "Analysis",
                            synthesis: "Synthesis",
                            evaluation: "Evaluation",
                          }).map(([key, title]) => (
                            <div key={key}>
                              <h4 className='font-semibold mb-2'>{title}</h4>
                              <ul className='list-disc pl-5'>
                                {lessonPlan.assessmentQuestions?.[key]?.map(
                                  (question: string, idx: number) => (
                                    <li key={idx}>{question}</li>
                                  )
                                ) || (
                                    <li>
                                      No {title.toLowerCase()} questions specified
                                    </li>
                                  )}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Additional Tab */}
                  <TabsContent value='additional' className='space-y-6'>
                    {/* Reflection Suggestions */}
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Suggestions for Reflecting on Learning
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className='list-disc pl-5'>
                          {lessonPlan.reflectionSuggestions?.map(
                            (suggestion: string, index: number) => (
                              <li key={index}>{suggestion}</li>
                            )
                          ) || <li>No reflection suggestions specified</li>}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Cross-curricular Links */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Cross-curricular Links</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className='list-disc pl-5'>
                          {lessonPlan.crossCurricularLinks?.map(
                            (link: string, index: number) => (
                              <li key={index}>{link}</li>
                            )
                          ) || <li>No cross-curricular links specified</li>}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Additional Notes */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Additional Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className='list-disc pl-5'>
                          {lessonPlan.additionalNotes?.map(
                            (note: string, index: number) => (
                              <li key={index}>{note}</li>
                            )
                          ) || <li>No additional notes specified</li>}
                        </ul>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <p className='text-gray-500 bg-[#f9fafb] text-center py-8'>
                Your lesson plan will appear here once generated
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonPlanForm;
