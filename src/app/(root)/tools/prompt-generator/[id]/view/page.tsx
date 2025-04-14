"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Edit } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import Link from "next/link";

export default function PromptViewPage() {
  const { id } = useParams();
  const [prompt, setPrompt] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        const { data } = await axios.get(
          `/api/tools/prompt-generator/${id}?id=${id}`
        );
        setPrompt(data);
      } catch (error) {
        console.error("Failed to fetch prompt:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrompt();
  }, [id]);

  console.log(prompt);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
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
            View Generated Prompt
          </h1>
          <div className="flex gap-2 justify-center">
            <Button onClick={handleCopyLink}>
              Copy Link to Share
            </Button>
            <Link href={`/tools/prompt-generator/${id}/edit`} passHref>
              <Button variant="outline">
                <Edit className='h-4 w-4' />
              </Button>
            </Link>
          </div>
        </div>

        <Card className='p-8 shadow-lg'>
          <div className='space-y-8'>
            <div className='bg-white p-6 rounded-lg border border-gray-100'>
              <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                Original Prompt
              </h3>
              <p className='text-gray-700'>{prompt.input_original_prompt}</p>
            </div>

            {prompt.ai_refined_prompts.map(
              (refinedPrompt: any, index: number) => (
                <div
                  key={index}
                  className='bg-white p-6 rounded-lg border border-gray-100'
                >
                  <div className='flex justify-between items-center mb-4'>
                    <h3 className='text-lg font-semibold'>
                      Refined Version {index + 1}
                    </h3>
                    <div className='flex items-center space-x-2'>
                      <span className='px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full'>
                        Refined Level:{" "}
                        {refinedPrompt.explanation.complexityLevel.refinedLevel}
                      </span>
                      <span className='px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full'>
                        {refinedPrompt.explanation.complexityLevel.bloomsLevel}
                      </span>
                    </div>
                  </div>

                  <div className='prose prose-sm max-w-none'>
                    <p className='text-gray-800'>{refinedPrompt.promptText}</p>
                    <div className='mt-4 space-y-2'>
                      <h4 className='font-medium text-gray-900'>Explanation</h4>
                      <p className='text-gray-700'>
                        {refinedPrompt.explanation.explanation}
                      </p>
                    </div>
                    <div className='mt-4'>
                      <h4 className='font-medium text-gray-900'>Focus Areas</h4>
                      <ul className='list-disc pl-5 space-y-1'>
                        {refinedPrompt.explanation.focusAreas.map(
                          (area: string, i: number) => (
                            <li key={i} className='text-gray-700'>
                              {area}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
