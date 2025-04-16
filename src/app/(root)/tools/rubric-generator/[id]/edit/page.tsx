"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  topic: string;
  assessmentType: string;
  keyStage: string;
  yearGroup: string;
}

interface RubricData {
  metadata: RubricMetadata;
  rubric: {
    criteria: RubricCriterion[];
  };
}

const defaultRubric: RubricData = {
  metadata: {
    topic: "",
    assessmentType: "",
    keyStage: "",
    yearGroup: "",
  },
  rubric: {
    criteria: [],
  },
};

const levelKeys = ["emerging", "basic", "proficient", "advanced", "exceptional"] as const;

export default function RubricEdit() {
  const [rubric, setRubric] = useState<RubricData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchRubric = async () => {
      try {
        const { data, error } = await supabase
          .from("rubrics_generator_results")
          .select("*")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        if (!data) throw new Error("Rubric not found");

        const parsedRubric = JSON.parse(data.ai_response);
        
        // Extract metadata from the stored fields
        const metadata = {
          topic: data.topic || "",
          assessmentType: data.assessment_type || "",
          keyStage: data.key_stage || "",
          yearGroup: data.year_group || ""
        };

        setRubric({
          ...defaultRubric,
          ...parsedRubric.data,
          metadata
        });
      } catch (err: any) {
        setError(err.message || "Failed to fetch rubric");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRubric();
  }, [params.id]);

  const handleSave = async () => {
    if (!rubric) return;

    setIsSaving(true);
    setError("");

    try {
      // Prepare the data for saving
      const updateData = {
        ai_response: JSON.stringify({ data: rubric }),
        // subject: rubric.metadata.subject,
        topic: rubric.metadata.topic,
        assessment_type: rubric.metadata.assessmentType,
        key_stage: rubric.metadata.keyStage,
        year_group: rubric.metadata.yearGroup
      };

      const { error } = await supabase
        .from("rubrics_generator_results")
        .update(updateData)
        .eq("id", params.id);

      if (error) throw error;

      router.push(`/tools/rubric-generator/${params.id}/view`);
    } catch (err: any) {
      setError(err.message || "Failed to save rubric");
      setIsSaving(false);
    }
  };

  const updateMetadata = (field: keyof RubricMetadata, value: string | number) => {
    setRubric((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          [field]: value,
        },
      };
    });
  };

  const addCriterion = () => {
    setRubric((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rubric: {
          ...prev.rubric,
          criteria: [
            ...prev.rubric.criteria,
            {
              name: "",
              levels: {
                exceptional: { score: 5, description: "", feedback: "" },
                advanced: { score: 4, description: "", feedback: "" },
                proficient: { score: 3, description: "", feedback: "" },
                basic: { score: 2, description: "", feedback: "" },
                emerging: { score: 1, description: "", feedback: "" },
              },
            },
          ],
        },
      };
    });
  };

  const removeCriterion = (index: number) => {
    setRubric((prev) => {
      if (!prev) return prev;
      const newCriteria = [...prev.rubric.criteria];
      newCriteria.splice(index, 1);
      return {
        ...prev,
        rubric: {
          ...prev.rubric,
          criteria: newCriteria,
        },
      };
    });
  };

  const updateCriterion = (index: number, field: string, value: any) => {
    setRubric((prev) => {
      if (!prev) return prev;
      const newCriteria = [...prev.rubric.criteria];
      if (field === "name") {
        newCriteria[index] = {
          ...newCriteria[index],
          name: value,
        };
      } else {
        const [level, subfield] = field.split(".");
        newCriteria[index] = {
          ...newCriteria[index],
          levels: {
            ...newCriteria[index].levels,
            [level]: {
              ...newCriteria[index].levels[level as keyof typeof newCriteria[typeof index]["levels"]],
              [subfield]: value,
            },
          },
        };
      }
      return {
        ...prev,
        rubric: {
          ...prev.rubric,
          criteria: newCriteria,
        },
      };
    });
  };

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
              onClick={() => router.push("/tools/rubric-generator")}
              className="mt-4"
            >
              Return to Rubrics
            </Button>
          </div>
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
          <h1 className="text-3xl font-bold">Edit Rubric</h1>
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

        <Tabs defaultValue="metadata" className="w-full">
          <TabsList>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            <TabsTrigger value="criteria">Criteria</TabsTrigger>
          </TabsList>

          <TabsContent value="metadata">
            <Card>
              <CardHeader>
                <CardTitle>Rubric Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="topic" className="block text-sm font-medium mb-1">Topic</label>
                    <input
                      id="topic"
                      type="text"
                      value={rubric.metadata.topic}
                      onChange={(e) => updateMetadata("topic", e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="assessment-type" className="block text-sm font-medium mb-1">Assessment Type</label>
                    <input
                      id="assessment-type"
                      type="text"
                      value={rubric.metadata.assessmentType}
                      onChange={(e) => updateMetadata("assessmentType", e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="key-stage" className="block text-sm font-medium mb-1">Key Stage</label>
                    <input
                      id="key-stage"
                      type="text"
                      value={rubric.metadata.keyStage}
                      onChange={(e) => updateMetadata("keyStage", e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="year-group" className="block text-sm font-medium mb-1">Year Group</label>
                    <input
                      id="year-group"
                      type="text"
                      value={rubric.metadata.yearGroup}
                      onChange={(e) => updateMetadata("yearGroup", e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="criteria">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Criteria</CardTitle>
                <Button
                  onClick={addCriterion}
                  variant="outline"
                  className="ml-4"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Criterion
                </Button>
              </CardHeader>
              <CardContent>
                {rubric.rubric.criteria.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    No criteria added yet. Click the button above to add one.
                  </div>
                ) : (
                  <Tabs defaultValue={`criterion-0`} className="w-full">
                    <TabsList className="flex-wrap">
                      {rubric.rubric.criteria.map((criterion, index) => (
                        <TabsTrigger key={index} value={`criterion-${index}`}>
                          {criterion.name || `Criterion ${index + 1}`}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {rubric.rubric.criteria.map((criterion, criterionIndex) => (
                      <TabsContent key={criterionIndex} value={`criterion-${criterionIndex}`}>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <input
                              type="text"
                              value={criterion.name}
                              onChange={(e) =>
                                updateCriterion(criterionIndex, "name", e.target.value)
                              }
                              placeholder="Criterion Name"
                              className="w-full p-2 border rounded-md"
                              id={`criterion-name-${criterionIndex}`}
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => removeCriterion(criterionIndex)}
                              className="ml-4"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-6">
                            {levelKeys.map((level) => (
                              <div key={level} className="border p-4 rounded-lg">
                                <h4 className="font-semibold mb-4 capitalize">{level}</h4>
                                <div className="space-y-4">
                                  <div>
                                    <label htmlFor={`score-${criterionIndex}-${level}`} className="block text-sm font-medium mb-1">Score</label>
                                    <input
                                      id={`score-${criterionIndex}-${level}`}
                                      type="number"
                                      value={criterion.levels[level]?.score || 0}
                                      onChange={(e) =>
                                        updateCriterion(
                                          criterionIndex,
                                          `${level}.score`,
                                          parseInt(e.target.value) || 0
                                        )
                                      }
                                      className="w-full p-2 border rounded-md"
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor={`description-${criterionIndex}-${level}`} className="block text-sm font-medium mb-1">Description</label>
                                    <textarea
                                      id={`description-${criterionIndex}-${level}`}
                                      value={criterion.levels[level]?.description || ""}
                                      onChange={(e) =>
                                        updateCriterion(
                                          criterionIndex,
                                          `${level}.description`,
                                          e.target.value
                                        )
                                      }
                                      className="w-full p-2 border rounded-md min-h-[100px]"
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor={`feedback-${criterionIndex}-${level}`} className="block text-sm font-medium mb-1">Feedback</label>
                                    <textarea
                                      id={`feedback-${criterionIndex}-${level}`}
                                      value={criterion.levels[level]?.feedback || ""}
                                      onChange={(e) =>
                                        updateCriterion(
                                          criterionIndex,
                                          `${level}.feedback`,
                                          e.target.value
                                        )
                                      }
                                      className="w-full p-2 border rounded-md min-h-[100px]"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
