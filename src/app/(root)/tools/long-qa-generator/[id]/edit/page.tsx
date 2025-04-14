"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ReportButton } from "@/components/ReportButton";
import axios from "axios";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

interface Question {
  level: string;
  question: string;
  exampleResponse: string;
}

export default function EditQAPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const handleQuestionChange = (
    index: number,
    field: keyof Question,
    value: string
  ) => {
    if (!questions) return;

    const updatedQuestions = [...questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value,
    };
    setQuestions(updatedQuestions);
  };

  const handleSave = async () => {
    if (!questions) return;

    setSaving(true);
    try {
      await axios.put(`/api/tools/long-qa-generator/${id}`, {
        questions,
      });
      toast.success("Questions saved successfully!");
      router.push(`/tools/long-qa-generator/${id}/view`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save questions");
      toast.error("Failed to save questions");
    } finally {
      setSaving(false);
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

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Edit Questions</h1>
        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <ReportButton toolType="long_qa" resultId={id} position="inline" />
        </div>
      </div>

      <div className="space-y-8">
        {questions?.map((q, index) => (
          <Card key={index} className="p-6">
            <div className="space-y-6">
              <div>
                <Label htmlFor={`level-${index}`}>Level</Label>
                <Textarea
                  id={`level-${index}`}
                  value={q.level}
                  onChange={(e) =>
                    handleQuestionChange(index, "level", e.target.value)
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor={`question-${index}`}>Question</Label>
                <Textarea
                  id={`question-${index}`}
                  value={q.question}
                  onChange={(e) =>
                    handleQuestionChange(index, "question", e.target.value)
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor={`response-${index}`}>Example Response</Label>
                <Textarea
                  id={`response-${index}`}
                  value={q.exampleResponse}
                  onChange={(e) =>
                    handleQuestionChange(
                      index,
                      "exampleResponse",
                      e.target.value
                    )
                  }
                  className="mt-2"
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
