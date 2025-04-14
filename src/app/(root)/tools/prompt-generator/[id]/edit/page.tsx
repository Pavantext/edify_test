// app/prompt-generator/[id]/edit/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export default function PromptEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [prompt, setPrompt] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refinedPrompts, setRefinedPrompts] = useState<any[]>([]);

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const { data } = await axios.get(
          `/api/tools/prompt-generator/${id}?id=${id}`
        );
        setPrompt(data);
        setRefinedPrompts(data.ai_refined_prompts);
      } catch (error) {
        console.error("Failed to fetch prompt:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrompt();
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.put(`/api/tools/prompt-generator/${id}?id=${id}`, {
        ai_refined_prompts: refinedPrompts,
      });
      toast.success("Refined prompts updated successfully!");
      router.push(`/tools/prompt-generator/${id}/view`);
    } catch (error) {
      console.error("Failed to update refined prompts:", error);
      toast.error("Failed to update refined prompts");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefinedPromptChange = (index: number, field: string, value: string) => {
    const updatedPrompts = [...refinedPrompts];
    if (field === 'promptText') {
      updatedPrompts[index].promptText = value;
    } else if (field === 'explanation') {
      updatedPrompts[index].explanation.explanation = value;
    } else if (field === 'refinedLevel') {
      updatedPrompts[index].explanation.complexityLevel.refinedLevel = value;
    } else if (field === 'bloomsLevel') {
      updatedPrompts[index].explanation.complexityLevel.bloomsLevel = value;
    } else if (field === 'focusAreas') {
      updatedPrompts[index].explanation.focusAreas = value.split(',').map((area: string) => area.trim());
    }
    setRefinedPrompts(updatedPrompts);
  };

  if (isLoading) {
    return (
      <div className='flex justify-center items-center min-h-screen'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </div>
    );
  }

  if (!prompt) {
    return <div className='text-center mt-8'>Prompt not found</div>;
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='container mx-auto px-4 py-12'>
        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            Edit Refined Prompts
          </h1>
        </div>

        <Card className='p-8 shadow-lg'>
          <div className='space-y-6'>
            {/* Original Prompt (Read-only) */}
            <div className='space-y-2'>
              <Label htmlFor='originalPrompt'>Original Prompt</Label>
              <Textarea
                id='originalPrompt'
                value={prompt.input_original_prompt}
                readOnly
                className='min-h-[100px] bg-gray-100'
              />
            </div>

            {/* Editable Refined Prompts */}
            {refinedPrompts.map((refinedPrompt, index) => (
              <div key={index} className='space-y-4 p-6 border border-gray-200 rounded-lg'>
                <div className='flex justify-between items-center mb-4'>
                  <Label htmlFor={`refinedPrompt-${index}`} className="text-lg font-semibold">
                    Refined Version {index + 1}
                  </Label>
                  <div className='flex items-center gap-2'>
                    <div className='space-y-1'>
                      <Label htmlFor={`refinedLevel-${index}`} className="text-xs">Refined Level</Label>
                      <Input
                        id={`refinedLevel-${index}`}
                        value={refinedPrompt.explanation.complexityLevel.refinedLevel}
                        onChange={(e) => handleRefinedPromptChange(index, 'refinedLevel', e.target.value)}
                        className='h-8'
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor={`bloomsLevel-${index}`} className="text-xs">Bloom's Level</Label>
                      <Input
                        id={`bloomsLevel-${index}`}
                        value={refinedPrompt.explanation.complexityLevel.bloomsLevel}
                        onChange={(e) => handleRefinedPromptChange(index, 'bloomsLevel', e.target.value)}
                        className='h-8'
                      />
                    </div>
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor={`promptText-${index}`}>Prompt Text</Label>
                  <Textarea
                    id={`promptText-${index}`}
                    value={refinedPrompt.promptText}
                    onChange={(e) => handleRefinedPromptChange(index, 'promptText', e.target.value)}
                    className='min-h-[100px]'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor={`explanation-${index}`}>Explanation</Label>
                  <Textarea
                    id={`explanation-${index}`}
                    value={refinedPrompt.explanation.explanation}
                    onChange={(e) => handleRefinedPromptChange(index, 'explanation', e.target.value)}
                    className='min-h-[100px]'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor={`focusAreas-${index}`}>Focus Areas (comma-separated)</Label>
                  <Textarea
                    id={`focusAreas-${index}`}
                    value={refinedPrompt.explanation.focusAreas.join(', ')}
                    onChange={(e) => handleRefinedPromptChange(index, 'focusAreas', e.target.value)}
                    className='min-h-[60px]'
                    placeholder="Enter focus areas separated by commas"
                  />
                </div>
              </div>
            ))}

            {/* Save Button */}
            <Button onClick={handleSave} disabled={isSaving} className='w-full'>
              {isSaving ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
