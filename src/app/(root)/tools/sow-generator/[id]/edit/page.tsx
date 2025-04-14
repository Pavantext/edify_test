"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Activity {
  title: string;
  description: string;
  duration: number;
  resources: string[];
}

interface Differentiation {
  support: string[];
  core: string[];
  extension: string[];
}

interface Lesson {
  lessonNumber: number;
  title: string;
  duration: number;
  learningObjectives: string[];
  activities: Activity[];
  assessment: string[];
  differentiation: Differentiation;
  stretchTasks: string[];
  scaffoldingStrategies: string[];
  reflectionPrompts: string[];
  crossCurricularLinks: string[];
}

interface SOWData {
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
  lessons: Lesson[];
}

const defaultSOW: SOWData = {
  metadata: {
    subject: "",
    topic: "",
    ageGroup: {
      year: 0,
    },
    author: "",
    createdAt: new Date().toISOString(),
    version: "1.0",
  },
  overarchingObjectives: [],
  lessons: [],
};

export default function SOWEdit() {
  const [sow, setSOW] = useState<SOWData>(defaultSOW);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("metadata");
  const [activeLessonTab, setActiveLessonTab] = useState<number>(0);

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

        console.log("Raw data:", data);

        // Parse the data first
        let parsedData = typeof data.sow_data === 'string' 
          ? JSON.parse(data.sow_data)
          : data.sow_data;

        console.log("Parsed data:", parsedData);

        // Extract the actual SOW data
        let sowData = parsedData.data || parsedData;

        console.log("SOW data before restructure:", sowData);

        // Create a properly structured SOW data
        const restructuredData = {
          metadata: {
            subject: data.subject || sowData.subject || "",
            topic: data.topic || sowData.topic || "",
            ageGroup: {
              year: data.year_group || (sowData.ageGroup && sowData.ageGroup.year) || 0
            },
            author: "Curriculum Planner",
            createdAt: new Date().toISOString(),
            version: "1.0"
          },
          overarchingObjectives: sowData.overarchingObjectives || [],
          lessons: sowData.lessons || []
        };

        console.log("Restructured data:", restructuredData);
        
        setSOW(restructuredData);
      } catch (err) {
        console.error("Error processing SOW:", err);
        setError("An error occurred while processing the Scheme of Work.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchSOW();
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("sow_generator_results")
        .update({
          sow_data: JSON.stringify(sow),
          subject: sow.metadata.subject,
          topic: sow.metadata.topic,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      toast.success("Changes saved successfully!");
      router.push(`/tools/sow-generator/${id}/view`);
    } catch (err) {
      setError("Failed to save changes.");
      toast.error("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateMetadata = (field: string, value: any) => {
    setSOW((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [field]: value,
      },
    }));
  };

  const updateAgeGroup = (year: number) => {
    setSOW((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        ageGroup: { year },
      },
    }));
  };

  const addObjective = () => {
    setSOW((prev) => ({
      ...prev,
      overarchingObjectives: [...prev.overarchingObjectives, ""],
    }));
  };

  const updateObjective = (index: number, value: string) => {
    setSOW((prev) => {
      const newObjectives = [...prev.overarchingObjectives];
      newObjectives[index] = value;
      return {
        ...prev,
        overarchingObjectives: newObjectives,
      };
    });
  };

  const removeObjective = (index: number) => {
    setSOW((prev) => ({
      ...prev,
      overarchingObjectives: prev.overarchingObjectives.filter((_, i) => i !== index),
    }));
  };

  const addLesson = () => {
    const newLesson: Lesson = {
      lessonNumber: sow.lessons.length + 1,
      title: "",
      duration: 60,
      learningObjectives: [],
      activities: [],
      assessment: [],
      differentiation: {
        support: [],
        core: [],
        extension: [],
      },
      stretchTasks: [],
      scaffoldingStrategies: [],
      reflectionPrompts: [],
      crossCurricularLinks: [],
    };

    setSOW((prev) => ({
      ...prev,
      lessons: [...prev.lessons, newLesson],
    }));
    setActiveLessonTab(sow.lessons.length);
  };

  const updateLesson = (index: number, field: string, value: any) => {
    setSOW((prev) => {
      const newLessons = [...prev.lessons];
      newLessons[index] = {
        ...newLessons[index],
        [field]: value,
      };
      return {
        ...prev,
        lessons: newLessons,
      };
    });
  };

  const removeLesson = (index: number) => {
    setSOW((prev) => {
      const newLessons = prev.lessons.filter((_, i) => i !== index);
      // Update lesson numbers
      newLessons.forEach((lesson, i) => {
        lesson.lessonNumber = i + 1;
      });
      return {
        ...prev,
        lessons: newLessons,
      };
    });
    setActiveLessonTab(Math.max(0, index - 1));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
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
              onClick={() => router.push("/tools/sow-generator")}
              className="mt-4"
            >
              Return to SOW Generator
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Edit Scheme of Work</h1>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            <TabsTrigger value="objectives">Objectives</TabsTrigger>
            <TabsTrigger value="lessons">Lessons</TabsTrigger>
          </TabsList>

          <TabsContent value="metadata">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Subject</label>
                    <input
                      type="text"
                      value={sow.metadata.subject}
                      onChange={(e) => updateMetadata("subject", e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Topic</label>
                    <input
                      type="text"
                      value={sow.metadata.topic}
                      onChange={(e) => updateMetadata("topic", e.target.value)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Year Group</label>
                    <input
                      type="number"
                      value={sow.metadata.ageGroup.year}
                      onChange={(e) => updateAgeGroup(parseInt(e.target.value) || 0)}
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="objectives">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Overarching Objectives</CardTitle>
                <Button onClick={addObjective} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Objective
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sow.overarchingObjectives.map((objective, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <input
                        type="text"
                        value={objective}
                        onChange={(e) => updateObjective(index, e.target.value)}
                        className="flex-1 p-2 border rounded-md"
                        placeholder="Enter objective"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => removeObjective(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lessons">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lessons</CardTitle>
                <Button onClick={addLesson} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lesson
                </Button>
              </CardHeader>
              <CardContent>
                {sow.lessons.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No lessons added yet. Click the button above to add one.
                  </div>
                ) : (
                  <Tabs
                    value={`lesson-${activeLessonTab}`}
                    onValueChange={(value) =>
                      setActiveLessonTab(parseInt(value.split("-")[1]))
                    }
                  >
                    <TabsList className="flex-wrap">
                      {sow.lessons.map((lesson, index) => (
                        <TabsTrigger key={index} value={`lesson-${index}`}>
                          Lesson {lesson.lessonNumber}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {sow.lessons.map((lesson, index) => (
                      <TabsContent key={index} value={`lesson-${index}`}>
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 mr-4">
                              <label className="block text-sm font-medium mb-1">
                                Lesson Title
                              </label>
                              <input
                                type="text"
                                value={lesson.title}
                                onChange={(e) =>
                                  updateLesson(index, "title", e.target.value)
                                }
                                className="w-full p-2 border rounded-md"
                              />
                            </div>
                            <div className="w-32">
                              <label className="block text-sm font-medium mb-1">
                                Duration (mins)
                              </label>
                              <input
                                type="number"
                                value={lesson.duration}
                                onChange={(e) =>
                                  updateLesson(
                                    index,
                                    "duration",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-full p-2 border rounded-md"
                              />
                            </div>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => removeLesson(index)}
                              className="ml-4 self-end"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Learning Objectives */}
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Learning Objectives
                            </label>
                            <div className="space-y-2">
                              {lesson.learningObjectives.map((objective, objIndex) => (
                                <div key={objIndex} className="flex gap-2">
                                  <input
                                    type="text"
                                    value={objective}
                                    onChange={(e) => {
                                      const newObjectives = [...lesson.learningObjectives];
                                      newObjectives[objIndex] = e.target.value;
                                      updateLesson(
                                        index,
                                        "learningObjectives",
                                        newObjectives
                                      );
                                    }}
                                    className="flex-1 p-2 border rounded-md"
                                  />
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => {
                                      const newObjectives = lesson.learningObjectives.filter(
                                        (_, i) => i !== objIndex
                                      );
                                      updateLesson(
                                        index,
                                        "learningObjectives",
                                        newObjectives
                                      );
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                onClick={() => {
                                  const newObjectives = [...lesson.learningObjectives, ""];
                                  updateLesson(index, "learningObjectives", newObjectives);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Learning Objective
                              </Button>
                            </div>
                          </div>

                          {/* Activities */}
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Activities
                            </label>
                            <div className="space-y-4">
                              {lesson.activities.map((activity, actIndex) => (
                                <div key={actIndex} className="border p-4 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium">Activity {actIndex + 1}</h4>
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      onClick={() => {
                                        const newActivities = lesson.activities.filter(
                                          (_, i) => i !== actIndex
                                        );
                                        updateLesson(index, "activities", newActivities);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={activity.title}
                                      onChange={(e) => {
                                        const newActivities = [...lesson.activities];
                                        newActivities[actIndex] = {
                                          ...activity,
                                          title: e.target.value,
                                        };
                                        updateLesson(index, "activities", newActivities);
                                      }}
                                      placeholder="Activity Title"
                                      className="w-full p-2 border rounded-md"
                                    />
                                    <textarea
                                      value={activity.description}
                                      onChange={(e) => {
                                        const newActivities = [...lesson.activities];
                                        newActivities[actIndex] = {
                                          ...activity,
                                          description: e.target.value,
                                        };
                                        updateLesson(index, "activities", newActivities);
                                      }}
                                      placeholder="Activity Description"
                                      className="w-full p-2 border rounded-md"
                                      rows={3}
                                    />
                                    <input
                                      type="number"
                                      value={activity.duration}
                                      onChange={(e) => {
                                        const newActivities = [...lesson.activities];
                                        newActivities[actIndex] = {
                                          ...activity,
                                          duration: parseInt(e.target.value) || 0,
                                        };
                                        updateLesson(index, "activities", newActivities);
                                      }}
                                      placeholder="Duration (minutes)"
                                      className="w-full p-2 border rounded-md"
                                    />
                                    <div>
                                      <label className="block text-sm font-medium mb-1">
                                        Resources
                                      </label>
                                      {activity.resources.map((resource, resIndex) => (
                                        <div key={resIndex} className="flex gap-2 mb-2">
                                          <input
                                            type="text"
                                            value={resource}
                                            onChange={(e) => {
                                              const newActivities = [...lesson.activities];
                                              newActivities[actIndex].resources[resIndex] =
                                                e.target.value;
                                              updateLesson(
                                                index,
                                                "activities",
                                                newActivities
                                              );
                                            }}
                                            className="flex-1 p-2 border rounded-md"
                                          />
                                          <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => {
                                              const newActivities = [...lesson.activities];
                                              newActivities[actIndex].resources = activity.resources.filter(
                                                (_, i) => i !== resIndex
                                              );
                                              updateLesson(
                                                index,
                                                "activities",
                                                newActivities
                                              );
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ))}
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          const newActivities = [...lesson.activities];
                                          newActivities[actIndex].resources.push("");
                                          updateLesson(index, "activities", newActivities);
                                        }}
                                      >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Resource
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                onClick={() => {
                                  const newActivities = [
                                    ...lesson.activities,
                                    {
                                      title: "",
                                      description: "",
                                      duration: 0,
                                      resources: [],
                                    },
                                  ];
                                  updateLesson(index, "activities", newActivities);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Activity
                              </Button>
                            </div>
                          </div>

                          {/* Assessment */}
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Assessment
                            </label>
                            <div className="space-y-2">
                              {lesson.assessment.map((item, assIndex) => (
                                <div key={assIndex} className="flex gap-2">
                                  <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => {
                                      const newAssessment = [...lesson.assessment];
                                      newAssessment[assIndex] = e.target.value;
                                      updateLesson(index, "assessment", newAssessment);
                                    }}
                                    className="flex-1 p-2 border rounded-md"
                                  />
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => {
                                      const newAssessment = lesson.assessment.filter(
                                        (_, i) => i !== assIndex
                                      );
                                      updateLesson(index, "assessment", newAssessment);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                onClick={() => {
                                  const newAssessment = [...lesson.assessment, ""];
                                  updateLesson(index, "assessment", newAssessment);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Assessment Item
                              </Button>
                            </div>
                          </div>

                          {/* Differentiation */}
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Differentiation
                            </label>
                            <div className="grid grid-cols-3 gap-4">
                              {["support", "core", "extension"].map((type) => (
                                <div key={type}>
                                  <h4 className="font-medium mb-2 capitalize">{type}</h4>
                                  <div className="space-y-2">
                                    {lesson.differentiation[type as keyof Differentiation].map(
                                      (item, diffIndex) => (
                                        <div key={diffIndex} className="flex gap-2">
                                          <input
                                            type="text"
                                            value={item}
                                            onChange={(e) => {
                                              const newDiff = {
                                                ...lesson.differentiation,
                                              };
                                              newDiff[type as keyof Differentiation][
                                                diffIndex
                                              ] = e.target.value;
                                              updateLesson(
                                                index,
                                                "differentiation",
                                                newDiff
                                              );
                                            }}
                                            className="flex-1 p-2 border rounded-md"
                                          />
                                          <Button
                                            variant="destructive"
                                            size="icon"
                                            onClick={() => {
                                              const newDiff = {
                                                ...lesson.differentiation,
                                              };
                                              newDiff[type as keyof Differentiation] =
                                                lesson.differentiation[
                                                  type as keyof Differentiation
                                                ].filter((_, i) => i !== diffIndex);
                                              updateLesson(
                                                index,
                                                "differentiation",
                                                newDiff
                                              );
                                            }}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )
                                    )}
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        const newDiff = { ...lesson.differentiation };
                                        newDiff[type as keyof Differentiation].push("");
                                        updateLesson(index, "differentiation", newDiff);
                                      }}
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Add {type}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Additional Information */}
                          <div className="grid grid-cols-2 gap-4">
                            {[
                              {
                                field: "stretchTasks",
                                label: "Stretch Tasks",
                              },
                              {
                                field: "scaffoldingStrategies",
                                label: "Scaffolding Strategies",
                              },
                              {
                                field: "reflectionPrompts",
                                label: "Reflection Prompts",
                              },
                              {
                                field: "crossCurricularLinks",
                                label: "Cross-Curricular Links",
                              },
                            ].map(({ field, label }) => (
                              <div key={field}>
                                <label className="block text-sm font-medium mb-2">
                                  {label}
                                </label>
                                <div className="space-y-2">
                                  {(['stretchTasks', 'scaffoldingStrategies', 'reflectionPrompts', 'crossCurricularLinks'].includes(field) ? 
                                    (lesson[field as keyof Lesson] as string[]).map(
                                    (item: string, itemIndex: number) => (
                                      <div key={itemIndex} className="flex gap-2">
                                        <input
                                          type="text"
                                          value={item}
                                          onChange={(e) => {
                                            const newItems = [
                                              ...(lesson[field as keyof Lesson] as string[]),
                                            ];
                                            newItems[itemIndex] = e.target.value;
                                            updateLesson(index, field, newItems);
                                          }}
                                          className="flex-1 p-2 border rounded-md"
                                        />
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          onClick={() => {
                                            const newItems = (
                                              lesson[field as keyof Lesson] as string[]
                                            ).filter((_, i) => i !== itemIndex);
                                            updateLesson(index, field, newItems);
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))
                                    : null)}
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      const newItems = [
                                        ...(lesson[field as keyof Lesson] as string[]),
                                        "",
                                      ];
                                      updateLesson(index, field, newItems);
                                    }}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add {label}
                                  </Button>
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
