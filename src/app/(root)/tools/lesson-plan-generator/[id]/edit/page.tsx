"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Edit, Save, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LessonPlanActivity {
  description: string;
  duration: number;
  materials: string[];
  instructions: string[];
}

interface LessonPlanOption {
  optionNumber: number;
  teachingStyle: string;
  starterActivity: LessonPlanActivity;
  mainActivities: LessonPlanActivity[];
  plenary: LessonPlanActivity;
}

interface Overview {
  subject: string;
  topic: string;
  yearGroup: string;
  duration: number;
  learningObjectives: string[];
  initialPrompts: string[];
}

interface DifferentiationAndSEN {
  differentiation: {
    support: string[];
    core: string[];
    extension: string[];
  };
  senSupport?: {
    visual?: string[];
    auditory?: string[];
    cognitive?: string[];
  };
}

interface AssessmentQuestions {
  knowledge: string[];
  comprehension: string[];
  application: string[];
  analysis: string[];
  synthesis: string[];
  evaluation: string[];
}

interface LessonPlan {
  overview: Overview;
  lessonOptions: LessonPlanOption[];
  reflectionSuggestions: string[];
  differentiationAndSEN: DifferentiationAndSEN;
  crossCurricularLinks: string[];
  assessmentQuestions: AssessmentQuestions;
  additionalNotes: string[];
}

const defaultLessonPlan: LessonPlan = {
  overview: {
    subject: "",
    topic: "",
    yearGroup: "",
    duration: 0,
    learningObjectives: [],
    initialPrompts: [],
  },
  lessonOptions: [],
  reflectionSuggestions: [],
  differentiationAndSEN: {
    differentiation: {
      support: [],
      core: [],
      extension: [],
    },
    senSupport: {
      visual: [],
      auditory: [],
      cognitive: [],
    },
  },
  crossCurricularLinks: [],
  assessmentQuestions: {
    knowledge: [],
    comprehension: [],
    application: [],
    analysis: [],
    synthesis: [],
    evaluation: [],
  },
  additionalNotes: [],
};

export default function LessonPlanEdit() {
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchLessonPlan = async () => {
      try {
        const { data, error } = await supabase
          .from("lesson_plan_results")
          .select("*")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        if (!data) throw new Error("Lesson plan not found");

        const parsedPlan = JSON.parse(data.ai_lesson_plan);
        // Ensure all required fields exist by merging with defaultLessonPlan
        setLessonPlan({
          ...defaultLessonPlan,
          ...parsedPlan,
          differentiationAndSEN: {
            ...defaultLessonPlan.differentiationAndSEN,
            ...parsedPlan.differentiationAndSEN,
            differentiation: {
              ...defaultLessonPlan.differentiationAndSEN.differentiation,
              ...parsedPlan.differentiationAndSEN?.differentiation,
            },
            senSupport: {
              ...defaultLessonPlan.differentiationAndSEN.senSupport,
              ...parsedPlan.differentiationAndSEN?.senSupport,
            },
          },
          assessmentQuestions: {
            ...defaultLessonPlan.assessmentQuestions,
            ...parsedPlan.assessmentQuestions,
          },
        });
      } catch (err: any) {
        setError(err.message || "Failed to fetch lesson plan");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessonPlan();
  }, [params.id]);

  const handleSave = async () => {
    if (!lessonPlan) return;

    setIsSaving(true);
    setError("");

    try {
      const { error } = await supabase
        .from("lesson_plan_results")
        .update({ ai_lesson_plan: JSON.stringify(lessonPlan) })
        .eq("id", params.id);

      if (error) throw error;

      router.push(`/tools/lesson-plan-generator/${params.id}/view`);
    } catch (err: any) {
      setError(err.message || "Failed to save lesson plan");
      setIsSaving(false);
    }
  };

  const updateLessonPlan = (field: keyof LessonPlan | string, value: any) => {
    setLessonPlan((prev) => {
      if (!prev) return prev;

      if (field.includes(".")) {
        const parts = field.split(".");
        const result = structuredClone(prev); // Use structuredClone for deep copy
        let current: any = result;

        // Navigate through the object structure
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in current)) {
            if (parts[i] === "differentiationAndSEN") {
              current[parts[i]] = {
                differentiation: { support: [], core: [], extension: [] },
                senSupport: { visual: [], auditory: [], cognitive: [] },
              };
            } else {
              current[parts[i]] = {};
            }
          }
          current = current[parts[i]];
        }

        // Set the final value
        current[parts[parts.length - 1]] = value;
        return result;
      }
      return { ...prev, [field]: value };
    });
  };

  const addListItem = (field: keyof LessonPlan | string, defaultValue: any) => {
    setLessonPlan((prev) => {
      if (!prev) return prev;

      if (field.includes(".")) {
        const parts = field.split(".");
        const result = structuredClone(prev); // Use structuredClone for deep copy
        let current: any = result;

        // Navigate through the object structure
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in current)) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }

        // Get the final array or create it if it doesn't exist
        const lastPart = parts[parts.length - 1];
        const currentArray = Array.isArray(current[lastPart])
          ? current[lastPart]
          : [];
        current[lastPart] = [...currentArray, defaultValue];

        return result;
      }

      const fieldValue = prev[field as keyof LessonPlan];
      return {
        ...prev,
        [field]: Array.isArray(fieldValue)
          ? [...fieldValue, defaultValue]
          : [defaultValue],
      };
    });
  };

  const removeListItem = (field: keyof LessonPlan | string, index: number) => {
    setLessonPlan((prev) => {
      if (!prev) return prev;

      if (field.includes(".")) {
        const parts = field.split(".");
        const result = structuredClone(prev); // Use structuredClone for deep copy
        let current: any = result;

        // Navigate through the object structure
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in current)) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }

        // Remove item from the array
        const lastPart = parts[parts.length - 1];
        if (Array.isArray(current[lastPart])) {
          current[lastPart] = current[lastPart].filter(
            (_: any, i: number) => i !== index
          );
        }

        return result;
      }

      const fieldValue = prev[field as keyof LessonPlan];
      return {
        ...prev,
        [field]: Array.isArray(fieldValue)
          ? fieldValue.filter((_, i) => i !== index)
          : [],
      };
    });
  };

  const updateOption = (optionIndex: number, field: string, value: any) => {
    setLessonPlan((prev) => {
      if (!prev) return prev;

      const updatedOptions = [...prev.lessonOptions];
      updatedOptions[optionIndex] = {
        ...updatedOptions[optionIndex],
        [field]: value,
      };
      return { ...prev, lessonOptions: updatedOptions };
    });
  };

  // Fixing linter errors by ensuring proper typing
  const differentiationTypes: Array<
    keyof DifferentiationAndSEN["differentiation"]
  > = ["support", "core", "extension"];
  const senSupportTypes: Array<
    keyof NonNullable<DifferentiationAndSEN["senSupport"]>
  > = ["visual", "auditory", "cognitive"];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center min-h-[400px]">
            <Loader2 className="animate-spin" size={48} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="bg-red-50 border border-red-200 p-4 rounded-md">
            <p className="text-red-700">{error}</p>
            <Button
              onClick={() => router.push("/tools/lesson-plan-generator")}
              className="mt-4"
            >
              Return to Lesson Plans
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!lessonPlan) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center min-h-[400px]">
            <Loader2 className="animate-spin" size={48} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Edit Lesson Plan</h1>
          <div className="flex space-x-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {lessonPlan.lessonOptions?.map((_, index) => (
              <TabsTrigger key={index} value={`option${index + 1}`}>
                Option {index + 1}
              </TabsTrigger>
            ))}
            <TabsTrigger value="assessment">Assessment</TabsTrigger>
            <TabsTrigger value="additional">Additional</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="topic">Topic</label>
                    <input
                      id="topic"
                      type="text"
                      value={lessonPlan.overview.topic}
                      onChange={(e) =>
                        updateLessonPlan("overview.topic", e.target.value)
                      }
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="subject">Subject</label>
                    <input
                      id="subject"
                      type="text"
                      value={lessonPlan.overview.subject}
                      onChange={(e) =>
                        updateLessonPlan("overview.subject", e.target.value)
                      }
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="yearGroup">Year Group</label>
                    <input
                      id="yearGroup"
                      type="text"
                      value={lessonPlan.overview.yearGroup}
                      onChange={(e) =>
                        updateLessonPlan("overview.yearGroup", e.target.value)
                      }
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="duration">Duration (minutes)</label>
                    <input
                      id="duration"
                      type="number"
                      value={lessonPlan.overview.duration || 0}
                      onChange={(e) =>
                        updateLessonPlan("overview.duration", parseInt(e.target.value) || 0)
                      }
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Learning Objectives */}
            <Card>
              <CardHeader>
                <CardTitle>Learning Objectives</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lessonPlan.overview.learningObjectives.map(
                    (objective: string, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={objective}
                          onChange={(e) => {
                            const newObjectives = [...lessonPlan.overview.learningObjectives];
                            newObjectives[index] = e.target.value;
                            updateLessonPlan("overview.learningObjectives", newObjectives);
                          }}
                          className="flex-1 p-2 border rounded-md"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeListItem("overview.learningObjectives", index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  )}
                  <Button
                    onClick={() => addListItem("overview.learningObjectives", "")}
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Objective
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Initial Prompts */}
            <Card>
              <CardHeader>
                <CardTitle>Initial Prompts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lessonPlan.overview.initialPrompts.map(
                    (prompt: string, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={prompt}
                          onChange={(e) => {
                            const newPrompts = [...lessonPlan.overview.initialPrompts];
                            newPrompts[index] = e.target.value;
                            updateLessonPlan("overview.initialPrompts", newPrompts);
                          }}
                          className="flex-1 p-2 border rounded-md"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => removeListItem("overview.initialPrompts", index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  )}
                  <Button
                    onClick={() => addListItem("overview.initialPrompts", "")}
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Prompt
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lesson Option Tabs */}
          {lessonPlan.lessonOptions?.map((option: LessonPlanOption, optionIndex: number) => (
            <TabsContent key={optionIndex} value={`option${optionIndex + 1}`} className="space-y-6">
              {/* Teaching Style */}
              {/* <Card>
                <CardHeader>
                  <CardTitle>Teaching Approach</CardTitle>
                </CardHeader>
                <CardContent>
                  <input
                    type="text"
                    value={option.teachingStyle || ""}
                    onChange={(e) =>
                      updateOption(optionIndex, "teachingStyle", e.target.value)
                    }
                    className="w-full p-2 border rounded-md"
                    placeholder="Enter teaching style (e.g., inquiry-based, direct instruction)"
                  />
                </CardContent>
              </Card> */}

              {/* Starter Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Starter Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="description">Description</label>
                      <textarea
                        id="description"
                        value={option.starterActivity.description}
                        onChange={(e) =>
                          updateOption(optionIndex, "starterActivity", {
                            ...option.starterActivity,
                            description: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded-md min-h-[100px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="duration">Duration (minutes)</label>
                      <input
                        id="duration"
                        type="number"
                        value={option.starterActivity.duration || 0}
                        onChange={(e) =>
                          updateOption(optionIndex, "starterActivity", {
                            ...option.starterActivity,
                            duration: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="materials">Materials</label>
                      {option.starterActivity.materials.map((material, idx) => (
                        <div key={idx} className="flex items-center space-x-2 mb-2">
                          <input
                            id="materials"
                            type="text"
                            value={material}
                            onChange={(e) => {
                              const newMaterials = [...option.starterActivity.materials];
                              newMaterials[idx] = e.target.value;
                              updateOption(optionIndex, "starterActivity", {
                                ...option.starterActivity,
                                materials: newMaterials,
                              });
                            }}
                            className="flex-1 p-2 border rounded-md"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              const newMaterials = option.starterActivity.materials.filter(
                                (_, i) => i !== idx
                              );
                              updateOption(optionIndex, "starterActivity", {
                                ...option.starterActivity,
                                materials: newMaterials,
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() =>
                          updateOption(optionIndex, "starterActivity", {
                            ...option.starterActivity,
                            materials: [...option.starterActivity.materials, ""],
                          })
                        }
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Material
                      </Button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="instructions">Instructions</label>
                      {option.starterActivity.instructions.map((instruction, idx) => (
                        <div key={idx} className="flex items-center space-x-2 mb-2">
                          <input
                            id="instructions"
                            type="text"
                            value={instruction}
                            onChange={(e) => {
                              const newInstructions = [...option.starterActivity.instructions];
                              newInstructions[idx] = e.target.value;
                              updateOption(optionIndex, "starterActivity", {
                                ...option.starterActivity,
                                instructions: newInstructions,
                              });
                            }}
                            className="flex-1 p-2 border rounded-md"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              const newInstructions = option.starterActivity.instructions.filter(
                                (_, i) => i !== idx
                              );
                              updateOption(optionIndex, "starterActivity", {
                                ...option.starterActivity,
                                instructions: newInstructions,
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() =>
                          updateOption(optionIndex, "starterActivity", {
                            ...option.starterActivity,
                            instructions: [...option.starterActivity.instructions, ""],
                          })
                        }
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Instruction
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Main Activities */}
              {option.mainActivities.map((activity, activityIndex) => (
                <Card key={activityIndex}>
                  <CardHeader>
                    <CardTitle className="flex justify-between">
                      <span>Main Activity {activityIndex + 1}</span>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => {
                          const newActivities = option.mainActivities.filter(
                            (_, i) => i !== activityIndex
                          );
                          updateOption(optionIndex, "mainActivities", newActivities);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="description">Description</label>
                        <textarea
                          id="description"
                          value={activity.description}
                          onChange={(e) => {
                            const newActivities = [...option.mainActivities];
                            newActivities[activityIndex] = {
                              ...activity,
                              description: e.target.value,
                            };
                            updateOption(optionIndex, "mainActivities", newActivities);
                          }}
                          className="w-full p-2 border rounded-md min-h-[100px]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="duration">Duration (minutes)</label>
                        <input
                          id="duration"
                          type="number"
                          value={activity.duration || 0}
                          onChange={(e) => {
                            const newActivities = [...option.mainActivities];
                            newActivities[activityIndex] = {
                              ...activity,
                              duration: parseInt(e.target.value) || 0,
                            };
                            updateOption(optionIndex, "mainActivities", newActivities);
                          }}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="materials">Materials</label>
                        {(activity.materials || []).map((material, idx) => (
                          <div key={idx} className="flex items-center space-x-2 mb-2">
                            <input
                              id="materials"
                              type="text"
                              value={material}
                              onChange={(e) => {
                                const newActivities = [...option.mainActivities];
                                const newMaterials = [...activity.materials];
                                newMaterials[idx] = e.target.value;
                                newActivities[activityIndex] = {
                                  ...activity,
                                  materials: newMaterials,
                                };
                                updateOption(optionIndex, "mainActivities", newActivities);
                              }}
                              className="flex-1 p-2 border rounded-md"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => {
                                const newActivities = [...option.mainActivities];
                                const newMaterials = activity.materials.filter((_, i) => i !== idx);
                                newActivities[activityIndex] = {
                                  ...activity,
                                  materials: newMaterials,
                                };
                                updateOption(optionIndex, "mainActivities", newActivities);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          onClick={() => {
                            const newActivities = [...option.mainActivities];
                            newActivities[activityIndex] = {
                              ...activity,
                              materials: [...activity.materials, ""],
                            };
                            updateOption(optionIndex, "mainActivities", newActivities);
                          }}
                          variant="outline"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Material
                        </Button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="instructions">Instructions</label>
                        {(activity.instructions || []).map((instruction, idx) => (
                          <div key={idx} className="flex items-center space-x-2 mb-2">
                            <input
                              id="instructions"
                              type="text"
                              value={instruction}
                              onChange={(e) => {
                                const newActivities = [...option.mainActivities];
                                const newInstructions = [...activity.instructions];
                                newInstructions[idx] = e.target.value;
                                newActivities[activityIndex] = {
                                  ...activity,
                                  instructions: newInstructions,
                                };
                                updateOption(optionIndex, "mainActivities", newActivities);
                              }}
                              className="flex-1 p-2 border rounded-md"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => {
                                const newActivities = [...option.mainActivities];
                                const newInstructions = activity.instructions.filter((_, i) => i !== idx);
                                newActivities[activityIndex] = {
                                  ...activity,
                                  instructions: newInstructions,
                                };
                                updateOption(optionIndex, "mainActivities", newActivities);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          onClick={() => {
                            const newActivities = [...option.mainActivities];
                            newActivities[activityIndex] = {
                              ...activity,
                              instructions: [...activity.instructions, ""],
                            };
                            updateOption(optionIndex, "mainActivities", newActivities);
                          }}
                          variant="outline"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Instruction
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button
                onClick={() => {
                  const newActivities = [
                    ...option.mainActivities,
                    {
                      description: "",
                      duration: 0,
                      materials: [],
                      instructions: [],
                    },
                  ];
                  updateOption(optionIndex, "mainActivities", newActivities);
                }}
                variant="outline"
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Main Activity
              </Button>

              {/* Plenary */}
              <Card>
                <CardHeader>
                  <CardTitle>Plenary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="description">Description</label>
                      <textarea
                        id="description"
                        value={option.plenary.description}
                        onChange={(e) =>
                          updateOption(optionIndex, "plenary", {
                            ...option.plenary,
                            description: e.target.value,
                          })
                        }
                        className="w-full p-2 border rounded-md min-h-[100px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="duration">Duration (minutes)</label>
                      <input
                        id="duration"
                        type="number"
                        value={option.plenary.duration || 0}
                        onChange={(e) =>
                          updateOption(optionIndex, "plenary", {
                            ...option.plenary,
                            duration: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="materials">Materials</label>
                      {(option.plenary.materials || []).map((material, idx) => (
                        <div key={idx} className="flex items-center space-x-2 mb-2">
                          <input
                            id="materials"
                            type="text"
                            value={material}
                            onChange={(e) => {
                              const newMaterials = [...(option.plenary.materials || [])];
                              newMaterials[idx] = e.target.value;
                              updateOption(optionIndex, "plenary", {
                                ...option.plenary,
                                materials: newMaterials,
                              });
                            }}
                            className="flex-1 p-2 border rounded-md"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              const newMaterials = (option.plenary.materials || []).filter(
                                (_, i) => i !== idx
                              );
                              updateOption(optionIndex, "plenary", {
                                ...option.plenary,
                                materials: newMaterials,
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() =>
                          updateOption(optionIndex, "plenary", {
                            ...option.plenary,
                            materials: [...(option.plenary.materials || []), ""],
                          })
                        }
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Material
                      </Button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" htmlFor="instructions">Instructions</label>
                      {(option.plenary.instructions || []).map((instruction, idx) => (
                        <div key={idx} className="flex items-center space-x-2 mb-2">
                          <input
                            id="instructions"
                            type="text"
                            value={instruction}
                            onChange={(e) => {
                              const newInstructions = [...(option.plenary.instructions || [])];
                              newInstructions[idx] = e.target.value;
                              updateOption(optionIndex, "plenary", {
                                ...option.plenary,
                                instructions: newInstructions,
                              });
                            }}
                            className="flex-1 p-2 border rounded-md"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              const newInstructions = (option.plenary.instructions || []).filter(
                                (_, i) => i !== idx
                              );
                              updateOption(optionIndex, "plenary", {
                                ...option.plenary,
                                instructions: newInstructions,
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() =>
                          updateOption(optionIndex, "plenary", {
                            ...option.plenary,
                            instructions: [...(option.plenary.instructions || []), ""],
                          })
                        }
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Instruction
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}

          {/* Assessment Tab */}
          <TabsContent value="assessment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(lessonPlan.assessmentQuestions).map(([key, questions]) => (
                    <div key={key}>
                      <h4 className="font-semibold mb-2 capitalize">{key}</h4>
                      {questions.map((question: string, idx: number) => (
                        <div key={idx} className="flex items-center space-x-2 mb-2">
                          <input
                            type="text"
                            value={question}
                            onChange={(e) => {
                              const newQuestions = [...questions];
                              newQuestions[idx] = e.target.value;
                              updateLessonPlan(`assessmentQuestions.${key}`, newQuestions);
                            }}
                            className="flex-1 p-2 border rounded-md"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => removeListItem(`assessmentQuestions.${key}`, idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() => addListItem(`assessmentQuestions.${key}`, "")}
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add {key.charAt(0).toUpperCase() + key.slice(1)} Question
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Additional Tab */}
          <TabsContent value="additional" className="space-y-6">
            {/* Reflection Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle>Reflection Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lessonPlan.reflectionSuggestions.map((suggestion: string, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={suggestion}
                        onChange={(e) => {
                          const newSuggestions = [...lessonPlan.reflectionSuggestions];
                          newSuggestions[index] = e.target.value;
                          updateLessonPlan("reflectionSuggestions", newSuggestions);
                        }}
                        className="flex-1 p-2 border rounded-md"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => removeListItem("reflectionSuggestions", index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    onClick={() => addListItem("reflectionSuggestions", "")}
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Suggestion
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Cross-curricular Links */}
            <Card>
              <CardHeader>
                <CardTitle>Cross-curricular Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lessonPlan.crossCurricularLinks.map((link: string, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={link}
                        onChange={(e) => {
                          const newLinks = [...lessonPlan.crossCurricularLinks];
                          newLinks[index] = e.target.value;
                          updateLessonPlan("crossCurricularLinks", newLinks);
                        }}
                        className="flex-1 p-2 border rounded-md"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => removeListItem("crossCurricularLinks", index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    onClick={() => addListItem("crossCurricularLinks", "")}
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Link
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Additional Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lessonPlan.additionalNotes.map((note: string, index: number) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => {
                          const newNotes = [...lessonPlan.additionalNotes];
                          newNotes[index] = e.target.value;
                          updateLessonPlan("additionalNotes", newNotes);
                        }}
                        className="flex-1 p-2 border rounded-md"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => removeListItem("additionalNotes", index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    onClick={() => addListItem("additionalNotes", "")}
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Note
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}