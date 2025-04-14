"use client";
import { useState, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Minus, Edit, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ReportButton } from "@/components/ReportButton";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Toaster, toast } from "sonner";
import { ExportDropdown } from "@/components/ExportDropdown";
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
import jsPDF from "jspdf";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/utils/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PDFDocument } from "pdf-lib";
import { Header, ImageRun } from "docx";
import SubscriptionDialog from "@/components/SubscriptionDialog";

type AssignmentType =
  | "analytical_essay"
  | "debate"
  | "research_project"
  | "presentation"
  | "other";

const assignmentTypes = [
  { value: "analytical_essay", label: "Analytical Essay" },
  { value: "debate", label: "Debate" },
  { value: "research_project", label: "Research Project" },
  { value: "presentation", label: "Presentation" },
  { value: "other", label: "Other" },
];

const keyStages = [
  { value: "ks3", label: "Key Stage 3" },
  { value: "ks4", label: "Key Stage 4" },
  { value: "ks5", label: "Key Stage 5" },
];

const assessmentTypes = [
  { value: "teacher", label: "Teacher Assessment" },
  { value: "peer", label: "Peer Assessment" },
  { value: "self", label: "Self Assessment" },
];

// Default criteria suggestions based on assignment type
const defaultCriteriaSuggestions: Record<AssignmentType, string[]> = {
  analytical_essay: [
    "Analysis & Critical Thinking",
    "Evidence & Support",
    "Organization & Structure",
    "Writing Style & Clarity",
    "Originality & Insight",
  ],
  debate: [
    "Argument Quality",
    "Evidence & Research",
    "Rebuttal & Response",
    "Presentation Skills",
    "Team Collaboration",
  ],
  research_project: [
    "Research Methodology",
    "Data Analysis",
    "Critical Evaluation",
    "Presentation Quality",
    "Innovation & Originality",
  ],
  presentation: [
    "Content Quality",
    "Delivery & Communication",
    "Visual Aids",
    "Engagement & Interaction",
    "Time Management",
  ],
  other: [
    "Understanding & Knowledge",
    "Application of Skills",
    "Critical Thinking",
    "Communication",
    "Creativity",
  ],
};

interface SortableCriterionProps {
  id: string;
  criterion: string;
  index: number;
  updateCriterion: (index: number, value: string) => void;
  removeCriterion: (index: number) => void;
}

// Sortable Criterion Component
const SortableCriterion = ({
  id,
  criterion,
  index,
  updateCriterion,
  removeCriterion,
}: SortableCriterionProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Check if we're in the approved URL mode by checking if updateCriterion is a no-op function
  const isDisabled = typeof updateCriterion === 'function' && updateCriterion.toString().includes('() => {}');

  return (
    <div ref={setNodeRef} style={style} className='flex gap-2 items-center'>
      <div {...(isDisabled ? {} : { ...attributes, ...listeners })} className={`${isDisabled ? 'cursor-not-allowed' : 'cursor-move'} p-2`}>
        ⋮⋮
      </div>
      <Input
        value={criterion}
        onChange={(e) => updateCriterion(index, e.target.value)}
        placeholder={`Criterion ${index + 1}`}
        disabled={isDisabled}
        required
      />
      {index > 0 && !isDisabled && (
        <Button
          type='button'
          variant='outline'
          size='icon'
          onClick={() => removeCriterion(index)}
        >
          <Minus className='h-4 w-4' />
        </Button>
      )}
    </div>
  );
};

interface RubricLevel {
  score: number;
  description: string;
  feedback: string;
}

interface RubricCriterion {
  name: string;
  levels: {
    exceptional?: RubricLevel;
    advanced?: RubricLevel;
    proficient?: RubricLevel;
    basic?: RubricLevel;
    emerging?: RubricLevel;
  };
}

interface RubricMetadata {
  subject: string;
  topic: string;
  assessmentType: string;
  assessor: string;
  keyStage: string;
  level: number;
  yearGroup: string;
}

interface RubricData {
  id: string;
  version: string;
  createdAt: string;
  metadata: RubricMetadata;
  rubric: {
    criteria: RubricCriterion[];
  };
}

interface RubricResponse {
  data: RubricData;
}

// Add at the top with other type definitions
type RubricLevelKey =
  | "exceptional"
  | "advanced"
  | "proficient"
  | "basic"
  | "emerging";

interface Level {
  key: RubricLevelKey;
  label: string;
}

const RubricGenerator = () => {
  const [isChecked, setIsChecked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [rubricData, setRubricData] = useState<RubricResponse | null>(null);
  const [showCustomType, setShowCustomType] = useState<boolean>(false);
  const [criteria, setCriteria] = useState<string[]>([""]);
  const supabase = createClient();
  const [inputMethod, setInputMethod] = useState("text"); // "text" or "file"
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<any>("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [isFromApprovedUrl, setIsFromApprovedUrl] = useState(false);

  // Form field states for validation
  const [formFields, setFormFields] = useState<{
    assignmentType: string;
    customAssignmentType: string;
    keyStage: string;
    yearGroup: string;
    assessmentType: string;
    topic: string;
  }>({
    assignmentType: "",
    customAssignmentType: "",
    keyStage: "",
    yearGroup: "",
    assessmentType: "",
    topic: "",
  });

  const [previewRubric, setPreviewRubric] = useState<RubricResponse | null>(
    null
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const router = useRouter();

  // Add useEffect to fetch rubric plan when approved ID is present
  useEffect(() => {
    const fetchApprovedRubric = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const approvedId = searchParams.get('approved');

      if (approvedId) {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/tools/rubric-generator?approved=${approvedId}`);

          if (!response.ok) {
            if (response.status === 403) {
              // Content not approved
              const errorData = await response.json();
              setError(`Content not approved: ${errorData?.details?.status || 'Unknown status'}`);
              setIsLoading(false);
              return;
            }
            throw new Error(`Failed to fetch rubric: ${response.statusText}`);
          }

          const data = await response.json();

          // Set the rubric data
          setRubricData(data);

          // Prefill form fields with input data
          if (data?.input_data) {
            setFormFields({
              assignmentType: data.input_data.assignmentType || "",
              customAssignmentType: data.input_data.customAssignmentType || "",
              keyStage: data.input_data.keyStage || "",
              yearGroup: data.input_data.yearGroup || "",
              assessmentType: data.input_data.assessmentType || "",
              topic: data.input_data.topic || "",
            });

            // Set input method based on whether fileUrl exists
            if (data.input_data.fileUrl) {
              setInputMethod("file");
              setUploadedFileUrl(data.input_data.fileUrl);
            } else {
              setInputMethod("text");
            }

            // Set criteria if available
            if (data.input_data.criteria) {
              let criteriaArray = [];
              if (typeof data.input_data.criteria === 'string') {
                criteriaArray = data.input_data.criteria.split(',').map((c: string) => c.trim());
              } else if (Array.isArray(data.input_data.criteria)) {
                criteriaArray = data.input_data.criteria;
              }
              setCriteria(criteriaArray.length > 0 ? criteriaArray : [""]);
            }
          }

          // Add a flag to track if content is from approved URL
          setIsFromApprovedUrl(true);
        } catch (err) {
          console.error('Error fetching approved rubric:', err);
          setError(`Failed to load the approved rubric: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchApprovedRubric();
  }, []);

  // Update form fields with default criteria when assignment type changes
  useEffect(() => {
    const assignmentType = formFields.assignmentType as AssignmentType;
    if (assignmentType && defaultCriteriaSuggestions[assignmentType] && !isFromApprovedUrl) {
      setCriteria(defaultCriteriaSuggestions[assignmentType].slice(0, 5));
    }
  }, [formFields.assignmentType, isFromApprovedUrl]);

  // Real-time preview generation
  useEffect(() => {
    if (!isFormValid()) {
      return;
    }
    generatePreview();
  }, []);

  const generatePreview = async () => {
    try {
      const response = await fetch("/api/tools/rubric-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formFields,
          criteria: criteria.filter((c) => c.trim()),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate preview");
      }

      // Use the data directly without parsing
      setPreviewRubric(data);
    } catch (err) {
      console.error("Preview generation error:", err);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id && over?.id) {
      const oldIndex = criteria.findIndex(
        (_, i) => `criterion-${i}` === active.id
      );
      const newIndex = criteria.findIndex(
        (_, i) => `criterion-${i}` === over.id
      );

      setCriteria(arrayMove(criteria, oldIndex, newIndex));
    }
  };

  const addCriterion = () => {
    if (criteria.length < 6) {
      setCriteria([...criteria, ""]);
      if (criteria.length === 5) {
        toast.info("Maximum number of criteria reached");
      }
    }
  };

  const removeCriterion = (index: number) => {
    if (criteria.length > 1) {
      setCriteria(criteria.filter((_, i) => i !== index));
      toast.info("Criterion removed");
    }
  };

  const updateCriterion = (index: number, value: string) => {
    const newCriteria = [...criteria];
    newCriteria[index] = value;
    setCriteria(newCriteria);
  };

  const isFormValid = () => {
    const commonValidation =
      formFields.assignmentType &&
      formFields.keyStage &&
      formFields.yearGroup &&
      formFields.assessmentType &&
      criteria.every((c) => c.trim()) &&
      isChecked;

    // For both methods, we need a topic
    return (
      commonValidation &&
      formFields.topic.trim() !== "" &&
      (inputMethod === "text" ||
        (inputMethod === "file" && uploadedFileUrl !== ""))
    );
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a PDF or Word document");
      return;
    }

    setUploadLoading(true);
    setUploadError("");

    try {
      // Generate a unique filename
      const timestamp = Date.now();
      const fileExt = file.name.split(".").pop();
      const fileName = `${timestamp}.${fileExt}`;
      const filePath = `rubric-uploads/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(filePath);

      setUploadedFileUrl(publicUrl);

      // Set the topic as filename + "text in document"
      const topicName = file.name.split(".")[0];
      setFormFields({
        ...formFields,
        topic: `${topicName}`,
      });

      toast.success("File uploaded successfully");
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError("Failed to upload file");
      toast.error("Failed to upload file");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    setRubricData(null);

    if (!isFormValid()) {
      const missingFields = [];
      if (!formFields.assignmentType) missingFields.push("Assignment Type");
      if (!formFields.keyStage) missingFields.push("Key Stage");
      if (!criteria.every((c) => c.trim())) missingFields.push("Criteria");
      if (inputMethod === "text" && !formFields.topic.trim())
        missingFields.push("Topic");
      if (inputMethod === "file" && !uploadedFileUrl)
        missingFields.push("Document Upload");
      if (!isChecked) missingFields.push("Verification Checkbox");

      toast.error(
        `Please fill in all required fields: ${missingFields.join(", ")}`
      );
      setIsLoading(false);
      return;
    }

    try {
      // Prepare form data with modified topic for file upload
      const formData = {
        ...formFields,
        fileUrl: uploadedFileUrl,
        inputMethod: inputMethod,
        criteria: criteria.filter((c) => c.trim()),
        // Modify topic field if it's file upload method
        topic:
          inputMethod === "file"
            ? `${formFields.topic} - upload document text`
            : formFields.topic,
      };
      console.log("formData", formData);

      // Get the URL parameters
      const searchParams = new URLSearchParams(window.location.search);
      const approvedId = searchParams.get('approved');

      // Add approvedId to URL if from approved URL
      const url = isFromApprovedUrl && approvedId
        ? `/api/tools/rubric-generator?approvedId=${approvedId}`
        : "/api/tools/rubric-generator";

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || "Failed to generate rubric");
      }
      setRubricData(responseData);
    } catch (err: any) {
      setError(err.message);
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  console.log(rubricData);

  const renderMetadata = () => {
    if (!rubricData?.data) return null;

    return (
      <div className='bg-gray-50 p-1 rounded-lg'>
        {/* <h3 className='font-semibold text-2xl mb-2'>Generated Rubric </h3> */}
        <div className='grid grid-cols-2 gap-2 pb-4 text-sm'>
          <p className='font-semibold'>
            Topic: {rubricData.data.metadata?.topic || ''}
          </p>
          <p>Subject: {rubricData.data.metadata?.subject || ''}</p>
          <p>Assessment Type: {rubricData.data.metadata?.assessmentType || ''}</p>
          <p>Assessor: {rubricData.data.metadata?.assessor || ''}</p>
          <p>Level: {rubricData.data.metadata?.level || ''}</p>
        </div>
      </div>
    );
  };

  const renderCriteria = () => {
    if (!rubricData?.data?.rubric?.criteria) return null;

    // Get the key stage number from the string (e.g., "ks3" -> 3)
    const keyStageNumber = parseInt(
      (rubricData.data.metadata?.keyStage || '').replace('ks', '') || '0'
    );

    // Define all possible levels
    const allLevels: Level[] = [
      { key: "exceptional" as RubricLevelKey, label: "Exceptional (5)" },
      { key: "advanced" as RubricLevelKey, label: "Advanced (4)" },
      { key: "proficient" as RubricLevelKey, label: "Proficient (3)" },
      { key: "basic" as RubricLevelKey, label: "Basic (2)" },
      { key: "emerging" as RubricLevelKey, label: "Emerging (1)" },
    ];

    // Filter levels based on key stage
    const visibleLevels = allLevels.filter(
      (level) =>
        level.label.match(/\d+/)?.[0] &&
        parseInt(level.label.match(/\d+/)?.[0]!) <=
        (keyStageNumber === 5 ? 5 : keyStageNumber)
    );

    return (
      <div className='space-y-8'>
        <div className='overflow-x-auto'>
          <table className='w-full border-collapse'>
            <thead>
              <tr className='bg-gray-100'>
                <th className='border p-2 text-left'>Criterion</th>
                {visibleLevels.map((level) => (
                  <th key={level.key} className='border p-2 text-left'>
                    {level.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rubricData.data.rubric?.criteria || []).map(
                (
                  criterion: {
                    name?: string;
                    levels?: {
                      [key: string]: {
                        description?: string;
                        feedback?: string;
                      };
                    };
                  },
                  idx: number
                ) => (
                  <tr key={idx}>
                    <td className='border p-2 font-semibold'>
                      {criterion?.name || ''}
                    </td>
                    {visibleLevels.map((level) => (
                      <td key={level.key} className='border p-2'>
                        <div className='space-y-2'>
                          {criterion?.levels && criterion.levels[level.key] && (
                            <>
                              <div>
                                {criterion.levels[level.key]?.description || ''}
                              </div>
                              <div className='text-sm text-gray-600 italic'>
                                {criterion.levels[level.key]?.feedback || ''}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handlePrint = () => {
    if (!rubricData?.data) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const keyStageNumber = parseInt(
      (rubricData.data.metadata?.keyStage || '').replace('ks', '') || '0'
    );
    const allLevels: Level[] = [
      { key: "exceptional" as RubricLevelKey, label: "Exceptional (5)" },
      { key: "advanced" as RubricLevelKey, label: "Advanced (4)" },
      { key: "proficient" as RubricLevelKey, label: "Proficient (3)" },
      { key: "basic" as RubricLevelKey, label: "Basic (2)" },
      { key: "emerging" as RubricLevelKey, label: "Emerging (1)" },
    ].filter((level) => {
      const match = level.label.match(/\d+/);
      return (
        match &&
        parseInt(match[0]!) <= (keyStageNumber === 5 ? 5 : keyStageNumber)
      );
    });

    const visibleLevels = allLevels.filter((level) => {
      const match = level.label.match(/\d+/);
      return (
        match &&
        parseInt(match[0]!) <= (keyStageNumber === 5 ? 5 : keyStageNumber)
      );
    });

    printWindow.document.write(`
        <html>
          <head>
            <title>Rubric - ${rubricData?.data.metadata?.subject || ''}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 0px; }
              .header { margin-bottom: 0px; }
              table { width: 100%; border-collapse: collapse; margin: 0px 0; }
              th, td { border: 1px solid #ddd; padding: 0px; text-align: left; vertical-align: top; }
              th { background-color: #f5f5f5; }
              .feedback { font-style: italic; color: #666; font-size: 0.9em; margin-top: 8px; }
              .description { margin-bottom: 8px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Assessment Rubric</h1>
              <p>Subject: ${rubricData?.data.metadata?.subject || ''}</p>
              <p>Topic: ${rubricData?.data.metadata?.topic || ''}</p>
              <p>Assessment Type: ${rubricData?.data.metadata?.assessmentType || ''}</p>
              <p>Key Stage: ${rubricData?.data.metadata?.keyStage || ''}</p>
              <p>Year Group: ${rubricData?.data.metadata?.yearGroup || ''}</p>
            </div>

            <table >
              <thead>
                <tr>
                  <th>Criterion</th>
                  ${visibleLevels
        .map((level) => `<th>${level.label}</th>`)
        .join("")}
                </tr>
              </thead>
              <tbody>
                  ${(rubricData?.data.rubric?.criteria || [])
        .map(
          (criterion: {
            name?: string;
            levels?: {
              [key: string]: {
                description?: string;
                feedback?: string;
              };
            };
          }) => `
                  <tr>
                    <td><strong>${criterion?.name || ''}</strong></td>
                    ${visibleLevels
              .map(
                (level) => `
                      <td>
                        <div class="description">${criterion?.levels?.[level.key]?.description || ""}</div>
                        <div class="feedback">${criterion?.levels?.[level.key]?.feedback || ""}</div>
                      </td>
                    `
              )
              .join("")}
                  </tr>
                `
        )
        .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `);
    printWindow.document.close();
    printWindow.print();
  };

  async function addWatermarkToPDF(pdfBytes: Uint8Array) {
    try {
      if (!pdfBytes) return pdfBytes;

      const pdfDoc = await PDFDocument.load(pdfBytes);
      const logoResponse = await fetch("/mainlogo.png");

      if (!logoResponse.ok) {
        console.error("Error fetching logo:", logoResponse.statusText);
        return pdfBytes;
      }

      const logoBytes = await logoResponse.arrayBuffer();
      const logoImage = await pdfDoc.embedPng(logoBytes);

      // Increase scale to 0.20 (20% of original size)
      const logoDims = logoImage.scale(0.2);

      const pages = pdfDoc.getPages();
      pages.forEach((page) => {
        const { width, height } = page.getSize();
        const margin = 20;

        // Adjust position calculation for larger size
        page.drawImage(logoImage, {
          x: width - logoDims.width - margin,
          y: height - logoDims.height - margin,
          width: logoDims.width,
          height: logoDims.height,
          opacity: 0.3, // Slightly more visible
        });
      });

      return await pdfDoc.save();
    } catch (error) {
      console.error("Error adding watermark:", error);
      return pdfBytes;
    }
  }

  // Export handlers
  const handleExportPDF = async () => {
    if (!rubricData?.data) return;

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
      `Subject: ${rubricData.data.metadata?.subject || ''}`,
      `Topic: ${rubricData.data.metadata?.topic || ''}`,
      `Assessment Type: ${rubricData.data.metadata?.assessmentType || ''}`,
      `Key Stage: ${rubricData.data.metadata?.keyStage || ''}`,
      `Year Group: ${rubricData.data.metadata?.yearGroup || ''}`,
    ];

    metadata.forEach((item) => {
      doc.text(item, leftMargin + 5, yPos);
      yPos += 7;
    });
    yPos += 10;

    // Criteria Table
    const keyStageNumber = parseInt(
      (rubricData.data.metadata?.keyStage || '').replace('ks', '') || '0'
    );
    const allLevels: Level[] = [
      { key: "exceptional" as RubricLevelKey, label: "Exceptional (5)" },
      { key: "advanced" as RubricLevelKey, label: "Advanced (4)" },
      { key: "proficient" as RubricLevelKey, label: "Proficient (3)" },
      { key: "basic" as RubricLevelKey, label: "Basic (2)" },
      { key: "emerging" as RubricLevelKey, label: "Emerging (1)" },
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
    rubricData.data.rubric.criteria.forEach((criterion, index) => {
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
          const levelData = criterion.levels[level.key]!;
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

    // doc.save("rubric.pdf");
    const pdfBytes = doc.output("arraybuffer");
    const watermarkedPdf = await addWatermarkToPDF(new Uint8Array(pdfBytes));

    const blob = new Blob([watermarkedPdf], { type: "application/pdf" });
    saveAs(blob, "rubric.pdf");

    toast.success("PDF exported successfully!");
  };

  const handleExportWord = async () => {
    if (!rubricData?.data) return;

    try {
      // Load the watermark image
      const imageUrl = "/mainlogo.png";
      const response = await fetch(imageUrl);
      const imageBuffer = await response.arrayBuffer();

      const keyStageNumber = parseInt(
        (rubricData.data.metadata?.keyStage || '').replace('ks', '') || '0'
      );
      const allLevels: Level[] = [
        { key: "exceptional" as RubricLevelKey, label: "Exceptional (5)" },
        { key: "advanced" as RubricLevelKey, label: "Advanced (4)" },
        { key: "proficient" as RubricLevelKey, label: "Proficient (3)" },
        { key: "basic" as RubricLevelKey, label: "Basic (2)" },
        { key: "emerging" as RubricLevelKey, label: "Emerging (1)" },
      ].filter(
        (level) =>
          parseInt(level.label.match(/\d+/)?.[0] || "0") <=
          (keyStageNumber === 5 ? 5 : keyStageNumber)
      );

      // Create table rows
      const tableRows = (rubricData.data.rubric?.criteria || []).map((criterion) => {
        const cells = [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: criterion?.name || "", bold: true })],
              }),
            ],
            width: { size: 20, type: "pct" },
          }),
          ...allLevels.map((level) => {
            const levelData = criterion?.levels && criterion.levels[level.key];
            return new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: levelData?.description || "", size: 20 }),
                    new TextRun({ text: "\n\nFeedback: ", bold: true, size: 20 }),
                    new TextRun({ text: levelData?.feedback || "", size: 20 }),
                  ],
                }),
              ],
              width: { size: 80 / allLevels.length, type: "pct" },
            });
          }),
        ];
        return new TableRow({ children: cells });
      });

      // Create the document with a watermark in the header
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
                    alignment: "right", // Align watermark to the right
                  }),
                ],
              }),
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Rubric Assessment",
                    bold: true,
                    size: 32,
                  }),
                ],
                spacing: { after: 300 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Assessment Details\n",
                    bold: true,
                    size: 24,
                  }),
                  new TextRun({
                    text: `Subject: ${rubricData.data.metadata?.subject || ''}\n`,
                  }),
                  new TextRun({
                    text: `Topic: ${rubricData.data.metadata?.topic || ''}\n`,
                  }),
                  new TextRun({
                    text: `Assessment Type: ${rubricData.data.metadata?.assessmentType || ''}\n`,
                  }),
                  new TextRun({
                    text: `Key Stage: ${rubricData.data.metadata?.keyStage || ''}\n`,
                  }),
                  new TextRun({
                    text: `Year Group: ${rubricData.data.metadata?.yearGroup || ''}\n\n`,
                  }),
                ],
                spacing: { after: 300 },
              }),
              new Table({
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: "Criteria", bold: true }),
                            ],
                          }),
                        ],
                        width: { size: 20, type: "pct" },
                      }),
                      ...allLevels.map(
                        (level) =>
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({ text: level.label, bold: true }),
                                ],
                              }),
                            ],
                            width: { size: 80 / allLevels.length, type: "pct" },
                          })
                      ),
                    ],
                  }),
                  ...tableRows,
                ],
              }),
            ],
          },
        ],
      });

      // Generate the document
      const blob = await Packer.toBlob(doc);
      saveAs(blob, "rubric.docx");

      toast.success("Word document exported successfully!");
    } catch (error) {
      toast.error("Failed to export Word document");
      console.error("Error generating Word document:", error);
    }
  };


  const handleExportCSV = () => {
    if (!rubricData?.data) return;

    const keyStageNumber = parseInt(
      (rubricData.data.metadata?.keyStage || '').replace('ks', '') || '0'
    );
    const allLevels: Level[] = [
      { key: "exceptional" as RubricLevelKey, label: "Exceptional (5)" },
      { key: "advanced" as RubricLevelKey, label: "Advanced (4)" },
      { key: "proficient" as RubricLevelKey, label: "Proficient (3)" },
      { key: "basic" as RubricLevelKey, label: "Basic (2)" },
      { key: "emerging" as RubricLevelKey, label: "Emerging (1)" },
    ].filter(
      (level) =>
        parseInt(level.label.match(/\d+/)?.[0] || "0") <=
        (keyStageNumber === 5 ? 5 : keyStageNumber)
    );

    const rows = [
      // Metadata
      ["Assessment Details"],
      ["Subject", rubricData.data.metadata?.subject || ''],
      ["Topic", rubricData.data.metadata?.topic || ''],
      ["Assessment Type", rubricData.data.metadata?.assessmentType || ''],
      ["Key Stage", rubricData.data.metadata?.keyStage || ''],
      ["Year Group", rubricData.data.metadata?.yearGroup || ''],
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
      ...(rubricData.data.rubric?.criteria || []).map((criterion) => {
        const row = [criterion?.name || ''];
        allLevels.forEach((level) => {
          if (criterion?.levels && criterion.levels[level.key]) {
            const levelData = criterion.levels[level.key]!;
            row.push(levelData?.description || '');
            row.push(levelData?.feedback || '');
          } else {
            row.push("", "");
          }
        });
        return row;
      }),
    ];

    const csvContent = rows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "rubric.csv");
    toast.success("CSV exported successfully!");
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

  return (
    <div className='min-h-screen bg-white py-12'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      {/* <Toaster position="top-center" expand={true} richColors /> */}
      <div className='container mx-auto px-4'>
        <div className='flex justify-end mb-4'>
          <ReportButton toolType='rubric' position='inline' variant='pre' />
        </div>

        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            Rubric Generator
          </h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Create detailed assessment rubrics for any task
          </p>
        </div>

        <div className=''>
          {/* Form Section */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            {isFromApprovedUrl && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-blue-800 text-sm mb-4">
                <p className="font-medium">Using pre-approved template</p>
                <p>This form contains approved content. Input fields are locked to preserve the template integrity.</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className='space-y-6'>
              {/* Input Method Selection */}
              <div className='space-y-2'>
                <Label>Input Method</Label>
                <RadioGroup
                  defaultValue='text'
                  value={inputMethod}
                  onValueChange={setInputMethod}
                  disabled={isFromApprovedUrl}
                  className='flex space-x-4'
                >
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='text' id='text' />
                    <Label htmlFor='text'>Enter Text</Label>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <RadioGroupItem value='file' id='file' />
                    <Label htmlFor='file'>Upload Document</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Conditional Input Based on Selection */}
              {inputMethod === "text" ? (
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='assignmentType'>Assignment Type *</Label>
                    <Select
                      name='assignmentType'
                      disabled={isFromApprovedUrl}
                      value={formFields.assignmentType}
                      onValueChange={(value: string) => {
                        setFormFields({
                          ...formFields,
                          assignmentType: value,
                        });
                        setShowCustomType(value === "other");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select assignment type' />
                      </SelectTrigger>
                      <SelectContent>
                        {assignmentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor='topic'>Topic *</Label>
                    <Input
                      id='topic'
                      name='topic'
                      disabled={isFromApprovedUrl}
                      placeholder='Enter the topic'
                      required
                      value={formFields.topic}
                      onChange={(e) =>
                        setFormFields({
                          ...formFields,
                          topic: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className='space-y-4'>
                  <div>
                    <Label htmlFor='assignmentType'>Assignment Type *</Label>
                    <Select
                      name='assignmentType'
                      disabled={isFromApprovedUrl}
                      value={formFields.assignmentType}
                      onValueChange={(value: string) => {
                        setFormFields({
                          ...formFields,
                          assignmentType: value,
                        });
                        setShowCustomType(value === "other");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select assignment type' />
                      </SelectTrigger>
                      <SelectContent>
                        {assignmentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='file'>
                      Upload Document (PDF or Word) *
                    </Label>
                    <div className='flex items-center gap-4'>
                      <Input
                        id='file'
                        type='file'
                        accept='.pdf,.doc,.docx'
                        required
                        disabled={isFromApprovedUrl}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedFile(file);
                            handleFileUpload(file);
                          }
                        }}
                        className='flex-1'
                      />
                      {uploadLoading && (
                        <Loader2 className='w-4 h-4 animate-spin text-gray-500' />
                      )}
                      {uploadedFileUrl && (
                        <div className='text-sm text-green-600'>
                          ✓ File uploaded
                        </div>
                      )}
                    </div>
                    <div className='mt-4'>
                      <Label htmlFor='topic'>Topic Name *</Label>
                      <Input
                        id='topic'
                        name='topic'
                        value={formFields.topic}
                        placeholder='Enter topic name'
                        required
                        disabled={isFromApprovedUrl}
                        onChange={(e) =>
                          setFormFields({
                            ...formFields,
                            topic: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {showCustomType && (
                <div>
                  <Label htmlFor='customAssignmentType'>Custom Type</Label>
                  <Input
                    id='customAssignmentType'
                    name='customAssignmentType'
                    disabled={isFromApprovedUrl}
                    value={formFields.customAssignmentType}
                    placeholder='Enter custom assignment type'
                    onChange={(e) =>
                      setFormFields({
                        ...formFields,
                        customAssignmentType: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {/* Row 2: Key Stage, Year Group, and Assessment Type */}
              <div className='grid grid-cols-3 gap-4'>
                <div>
                  <Label htmlFor='keyStage'>Key Stage</Label>
                  <Input
                    id='keyStage'
                    name='keyStage'
                    type='number'
                    min={3}
                    max={5}
                    required
                    disabled={isFromApprovedUrl}
                    value={formFields.keyStage?.replace('ks', '')}
                    placeholder='Enter key stage number (3-5)'
                    onChange={(e) =>
                      setFormFields({
                        ...formFields,
                        keyStage: `ks${e.target.value}`,
                      })
                    }
                  />
                  <p className='text-sm text-muted-foreground mt-1'>
                    Enter only the number: 3 for KS3, 4 for KS4, or 5 for KS5
                  </p>
                </div>

                <div>
                  <Label htmlFor='yearGroup'>Year Group</Label>
                  <Input
                    id='yearGroup'
                    name='yearGroup'
                    type='number'
                    min={7}
                    max={13}
                    required
                    disabled={isFromApprovedUrl}
                    value={formFields.yearGroup}
                    onChange={(e) =>
                      setFormFields({
                        ...formFields,
                        yearGroup: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor='assessmentType'>Assessment Type</Label>
                  <Select
                    name='assessmentType'
                    disabled={isFromApprovedUrl}
                    value={formFields.assessmentType}
                    onValueChange={(value: string) =>
                      setFormFields({
                        ...formFields,
                        assessmentType: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select assessment type' />
                    </SelectTrigger>
                    <SelectContent>
                      {assessmentTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Assessment Criteria and Additional Instructions */}
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-4'>
                  <div className='flex justify-between items-center'>
                    <Label>Assessment Criteria</Label>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={addCriterion}
                      disabled={criteria.length >= 6 || isFromApprovedUrl}
                    >
                      <Plus className='h-4 w-4 mr-2' />
                      Add Criterion
                    </Button>
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={criteria.map((_, index) => `criterion-${index}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {criteria.map((criterion, index) => (
                        <SortableCriterion
                          key={`criterion-${index}`}
                          id={`criterion-${index}`}
                          criterion={criterion}
                          index={index}
                          updateCriterion={isFromApprovedUrl ? (() => { }) : updateCriterion}
                          removeCriterion={isFromApprovedUrl ? (() => { }) : removeCriterion}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>

                {/* <div>
                  <Label htmlFor='additionalInstructions'>
                    Additional Instructions (Optional)
                  </Label>
                  <Textarea
                    id='additionalInstructions'
                    name='additionalInstructions'
                    placeholder='Enter any additional instructions...'
                    className='h-full min-h-[200px]'
                  />
                </div> */}
              </div>

              <div className='flex items-center space-x-4 mt-6'>
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

              <div className='flex justify-center mt-6'>
                <Button
                  type='submit'
                  className='w-1/3'
                  disabled={!isFormValid() || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Generating...
                    </>
                  ) : (
                    "Generate Rubric"
                  )}
                </Button>
              </div>
            </form>
          </Card>

          {/* Results Section */}
          <Card className='p-8 shadow-lg bg-[#f9fafb]'>
            {error && (
              <div className='bg-red-50 text-red-600 p-4 rounded-lg'>
                {error}
              </div>
            )}
            <CardHeader>
              <div className='flex justify-between items-center '>
                <CardTitle>
                  <h2 className='text-2xl font-bold text-gray-900'>
                    Generated Rubric
                  </h2>
                </CardTitle>
                {rubricData && (
                  <div className='flex items-center gap-2'>
                    <ExportDropdown options={exportOptions} />

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={`/tools/rubric-generator/${rubricData?.data?.id || ''}/view`}
                            className={buttonVariants({ variant: "outline" })}
                          >
                            <FileText className='w-4 h-4 mr-2' />
                            {/* View Rubric */}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View full rubric details</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={`/tools/rubric-generator/${rubricData?.data?.id || ''}/edit`}
                            className={buttonVariants({ variant: "outline" })}
                          >
                            <Edit className='w-4 h-4 mr-2' />
                            {/* Edit Rubric */}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit this rubric</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className='animate-pulse space-y-4'>
                  <div className='h-4 bg-gray-200 rounded w-3/4'></div>
                  <div className='h-4 bg-gray-200 rounded w-full'></div>
                  <div className='h-4 bg-gray-200 rounded w-5/6'></div>
                </div>
              ) : rubricData && rubricData.data ? (
                <div className='space-y-1'>
                  <div>
                    {renderMetadata()}
                    {renderCriteria()}
                  </div>
                </div>
              ) : (
                <div className='text-center text-gray-500'>
                  <p>Your generated rubric will appear here</p>
                  <p className='text-sm mt-2'>
                    Fill out the form and click "Generate Rubric" to get started
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RubricGenerator;
