"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, Edit, Save, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface MainPoints {
  mainArgument: string;
  keyPoints: string[];
  implicitAssumptions: string[];
}

interface AlternativePerspective {
  title: string;
  points: string[];
}

interface EvidenceExploration {
  supporting: string[];
  challenging: string[];
  researchQuestions: string[];
}

interface BiasAssessment {
  potentialBiases: string[];
  reductionSuggestions: string[];
}

interface PerspectiveAnalysis {
  id: string;
  created_at: string;
  topic: string;
  input: string;
  analysis: {
    mainPoints: MainPoints;
    alternativePerspectives: AlternativePerspective[];
    evidenceExploration: EvidenceExploration;
    biasAssessment: BiasAssessment;
    adaptabilitySuggestions: string[];
  };
}

const defaultAnalysis: PerspectiveAnalysis = {
  id: "",
  created_at: "",
  topic: "",
  input: "",
      analysis: {
        mainPoints: {
      mainArgument: "",
      keyPoints: [],
      implicitAssumptions: [],
    },
    alternativePerspectives: [],
    evidenceExploration: {
      supporting: [],
      challenging: [],
      researchQuestions: [],
    },
    biasAssessment: {
      potentialBiases: [],
      reductionSuggestions: [],
    },
    adaptabilitySuggestions: [],
  },
};

export default function EditAnalysis() {
  const [analysis, setAnalysis] = useState<PerspectiveAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const { data, error } = await supabase
          .from("perspective_challenge_results")
          .select("*")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        if (!data) throw new Error("Analysis not found");

        setAnalysis(data);
      } catch (err: any) {
        setError(err.message || "Failed to fetch analysis");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [params.id]);

  const handleSave = async () => {
    if (!analysis) return;

    setIsSaving(true);
    setError("");

    try {
      const { error } = await supabase
        .from("perspective_challenge_results")
        .update(analysis)
        .eq("id", params.id);

      if (error) throw error;

      toast.success("Analysis saved successfully");
      router.push(`/tools/perspective-challenge/${params.id}/view`);
    } catch (err: any) {
      setError(err.message || "Failed to save analysis");
      toast.error("Failed to save analysis");
      setIsSaving(false);
    }
  };

  const updateAnalysis = (field: string, value: any) => {
    setAnalysis((prev) => {
      if (!prev) return prev;

      if (field.includes(".")) {
        const parts = field.split(".");
        const result = { ...prev };
        let current: any = result;

        for (let i = 0; i < parts.length - 1; i++) {
          current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
        return result;
      }

      return { ...prev, [field]: value };
    });
  };

  const addListItem = (field: string, defaultValue: any = "") => {
    setAnalysis((prev) => {
      if (!prev) return prev;

      const parts = field.split(".");
      const result = structuredClone(prev);
      let current: any = result;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }

      const lastPart = parts[parts.length - 1];
      if (!Array.isArray(current[lastPart])) {
        current[lastPart] = [];
      }
      current[lastPart] = [...current[lastPart], defaultValue];

      return result;
    });
  };

  const removeListItem = (field: string, index: number) => {
    setAnalysis((prev) => {
      if (!prev) return prev;

      const parts = field.split(".");
      const result = structuredClone(prev);
      let current: any = result;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          return prev;
        }
        current = current[parts[i]];
      }

      const lastPart = parts[parts.length - 1];
      if (!Array.isArray(current[lastPart])) {
        return prev;
      }

      current[lastPart] = current[lastPart].filter((_: any, i: number) => i !== index);
      return result;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Analysis not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Edit Analysis</h1>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
          Save Changes
            </>
          )}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Main Points */}
        <Card>
          <CardHeader>
            <CardTitle>Main Points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div>
              <label htmlFor="main-argument" className="block text-sm font-medium mb-1">Main Argument</label>
            <Textarea
                id="main-argument"
                value={analysis.analysis.mainPoints.mainArgument}
                onChange={(e) =>
                  updateAnalysis("analysis.mainPoints.mainArgument", e.target.value)
                }
                className="min-h-[100px]"
            />
          </div>

          <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="key-points" className="block text-sm font-medium">Key Points</label>
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addListItem("analysis.mainPoints.keyPoints")}
                >
                  <Plus className="h-4 w-4" />
              </Button>
            </div>
              {analysis.analysis.mainPoints.keyPoints.map((point: string, index: number) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                  <Input
                    id={`key-point-${index}`}
                    value={point}
                    onChange={(e) => {
                      const newPoints = [...analysis.analysis.mainPoints.keyPoints];
                      newPoints[index] = e.target.value;
                      updateAnalysis("analysis.mainPoints.keyPoints", newPoints);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeListItem("analysis.mainPoints.keyPoints", index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
          </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="implicit-assumptions" className="block text-sm font-medium">Implicit Assumptions</label>
          <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addListItem("analysis.mainPoints.implicitAssumptions")}
                >
                  <Plus className="h-4 w-4" />
          </Button>
        </div>
              {analysis.analysis.mainPoints.implicitAssumptions.map(
                (assumption: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <Input
                      id={`implicit-assumption-${index}`}
                      value={assumption}
                      onChange={(e) => {
                        const newAssumptions = [
                          ...analysis.analysis.mainPoints.implicitAssumptions,
                        ];
                        newAssumptions[index] = e.target.value;
                        updateAnalysis(
                          "analysis.mainPoints.implicitAssumptions",
                          newAssumptions
                        );
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        removeListItem("analysis.mainPoints.implicitAssumptions", index)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alternative Perspectives */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Alternative Perspectives</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  addListItem("analysis.alternativePerspectives", {
                    title: "",
                    points: [],
                  })
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {analysis.analysis.alternativePerspectives.map(
              (perspective: AlternativePerspective, index: number) => (
                <Card key={index} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-4">
                      <Input
                        value={perspective.title}
                        onChange={(e) => {
                          const newPerspectives = [
                            ...analysis.analysis.alternativePerspectives,
                          ];
                          newPerspectives[index] = {
                            ...perspective,
                            title: e.target.value,
                          };
                          updateAnalysis(
                            "analysis.alternativePerspectives",
                            newPerspectives
                          );
                        }}
                        placeholder="Perspective Title"
                      />
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label htmlFor={`perspective-${index}-points`} className="block text-sm font-medium">Points</label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newPerspectives = [
                                ...analysis.analysis.alternativePerspectives,
                              ];
                              newPerspectives[index] = {
                                ...perspective,
                                points: [...perspective.points, ""],
                              };
                              updateAnalysis(
                                "analysis.alternativePerspectives",
                                newPerspectives
                              );
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {perspective.points.map((point: string, pointIndex: number) => (
                          <div key={pointIndex} className="flex items-center gap-2 mb-2">
                        <Input
                          id={`perspective-${index}-point-${pointIndex}`}
                          value={point}
                              onChange={(e) => {
                                const newPerspectives = [
                                  ...analysis.analysis.alternativePerspectives,
                                ];
                                newPerspectives[index] = {
                                  ...perspective,
                                  points: perspective.points.map((p, i) =>
                                    i === pointIndex ? e.target.value : p
                                  ),
                                };
                                updateAnalysis(
                                  "analysis.alternativePerspectives",
                                  newPerspectives
                                );
                              }}
                        />
                        <Button
                              variant="outline"
                              size="sm"
                          onClick={() => {
                                const newPerspectives = [
                                  ...analysis.analysis.alternativePerspectives,
                                ];
                                newPerspectives[index] = {
                                  ...perspective,
                                  points: perspective.points.filter(
                                    (_, i) => i !== pointIndex
                                  ),
                                };
                                updateAnalysis(
                                  "analysis.alternativePerspectives",
                                  newPerspectives
                            );
                          }}
                        >
                              <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPerspectives =
                          analysis.analysis.alternativePerspectives.filter(
                            (_, i) => i !== index
                          );
                        updateAnalysis(
                          "analysis.alternativePerspectives",
                          newPerspectives
                        );
                      }}
                      className="ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              )
            )}
          </CardContent>
        </Card>

        {/* Evidence Exploration */}
        <Card>
          <CardHeader>
            <CardTitle>Evidence Exploration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Supporting Evidence */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="supporting-evidence" className="block text-sm font-medium">Supporting Evidence</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addListItem("analysis.evidenceExploration.supporting")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {analysis.analysis.evidenceExploration.supporting.map(
                (evidence: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <Input
                      id={`supporting-evidence-${index}`}
                      value={evidence}
                      onChange={(e) => {
                        const newEvidence = [
                          ...analysis.analysis.evidenceExploration.supporting,
                        ];
                        newEvidence[index] = e.target.value;
                        updateAnalysis(
                          "analysis.evidenceExploration.supporting",
                          newEvidence
                        );
                      }}
                    />
                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        removeListItem("analysis.evidenceExploration.supporting", index)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
            )
          )}
        </div>

            {/* Challenging Evidence */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="challenging-evidence" className="block text-sm font-medium">Challenging Evidence</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addListItem("analysis.evidenceExploration.challenging")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {analysis.analysis.evidenceExploration.challenging.map(
                (evidence: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <Input
                      id={`challenging-evidence-${index}`}
                      value={evidence}
                      onChange={(e) => {
                        const newEvidence = [
                          ...analysis.analysis.evidenceExploration.challenging,
                        ];
                        newEvidence[index] = e.target.value;
                        updateAnalysis(
                          "analysis.evidenceExploration.challenging",
                          newEvidence
                        );
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        removeListItem("analysis.evidenceExploration.challenging", index)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              )}
            </div>

            {/* Research Questions */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="research-questions" className="block text-sm font-medium">Research Questions</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    addListItem("analysis.evidenceExploration.researchQuestions")
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {analysis.analysis.evidenceExploration.researchQuestions.map(
                (question: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <Input
                      id={`research-question-${index}`}
                      value={question}
                      onChange={(e) => {
                        const newQuestions = [
                          ...analysis.analysis.evidenceExploration.researchQuestions,
                        ];
                        newQuestions[index] = e.target.value;
                        updateAnalysis(
                          "analysis.evidenceExploration.researchQuestions",
                          newQuestions
                        );
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        removeListItem(
                          "analysis.evidenceExploration.researchQuestions",
                          index
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bias Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Bias Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Potential Biases */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="potential-biases" className="block text-sm font-medium">Potential Biases</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addListItem("analysis.biasAssessment.potentialBiases")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {analysis.analysis.biasAssessment.potentialBiases.map(
                (bias: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <Input
                      id={`potential-bias-${index}`}
                      value={bias}
                      onChange={(e) => {
                        const newBiases = [
                          ...analysis.analysis.biasAssessment.potentialBiases,
                        ];
                        newBiases[index] = e.target.value;
                        updateAnalysis(
                          "analysis.biasAssessment.potentialBiases",
                          newBiases
                        );
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        removeListItem("analysis.biasAssessment.potentialBiases", index)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              )}
          </div>

            {/* Reduction Suggestions */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="reduction-suggestions" className="block text-sm font-medium">Reduction Suggestions</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    addListItem("analysis.biasAssessment.reductionSuggestions")
                  }
                >
                  <Plus className="h-4 w-4" />
          </Button>
        </div>
              {analysis.analysis.biasAssessment.reductionSuggestions.map(
                (suggestion: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <Input
                      id={`reduction-suggestion-${index}`}
                      value={suggestion}
                      onChange={(e) => {
                        const newSuggestions = [
                          ...analysis.analysis.biasAssessment.reductionSuggestions,
                        ];
                        newSuggestions[index] = e.target.value;
                        updateAnalysis(
                          "analysis.biasAssessment.reductionSuggestions",
                          newSuggestions
                        );
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        removeListItem(
                          "analysis.biasAssessment.reductionSuggestions",
                          index
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Adaptability Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle>Adaptability Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="adaptability-suggestions" className="block text-sm font-medium">Suggestions</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addListItem("analysis.adaptabilitySuggestions")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {analysis.analysis.adaptabilitySuggestions.map(
                (suggestion: string, index: number) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <Input
                      id={`adaptability-suggestion-${index}`}
                      value={suggestion}
                      onChange={(e) => {
                        const newSuggestions = [
                          ...analysis.analysis.adaptabilitySuggestions,
                        ];
                        newSuggestions[index] = e.target.value;
                        updateAnalysis(
                          "analysis.adaptabilitySuggestions",
                          newSuggestions
                        );
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        removeListItem("analysis.adaptabilitySuggestions", index)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
