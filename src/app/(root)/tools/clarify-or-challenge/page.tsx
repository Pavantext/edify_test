"use client";
import ChallengeOutputComponent from "@/components/tools/challenge-output";
import ClarifyOutputComponent from "@/components/tools/clarify-output";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, Info, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReportButton } from "@/components/ReportButton";
import SubscriptionDialog from "@/components/SubscriptionDialog";

export default function Home() {
  const [isChecked, setIsChecked] = useState(false);
  const [type, setType] = useState<string>("clarify");
  const [inputText, setInputText] = useState("");
  const [output, setOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audience, setAudience] = useState("intermediate");
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [hasApprovedId, setHasApprovedId] = useState(false);
  const [approvedId, setApprovedId] = useState<string | null>(null);

  // Check for approved content on component mount
  useEffect(() => {
    const fetchApprovedContent = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const approvedParam = searchParams.get('approved');

      if (approvedParam) {
        setLoading(true);
        setHasApprovedId(true);
        setApprovedId(approvedParam);

        try {
          const response = await fetch(`/api/tools/clarify-or-challenge?approved=${approvedParam}`);
          const data = await response.json();

          if (!response.ok) {
            if (response.status === 403) {
              // Content not approved
              setError(`Content not approved: ${data.details?.status || 'Unknown status'}`);
              return;
            }
            throw new Error(data.error || 'Failed to fetch content');
          }

          // Set the form data but not the output - we'll generate that when user clicks Generate
          setType(data.type);
          setInputText(data.input_text);
          setAudience(data.audience);
          // Don't set output here - wait for user to click Generate
        } catch (err: any) {
          setError(err.message || 'Failed to load approved content');
          toast.error(err.message || 'Failed to load approved content');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchApprovedContent();
  }, []);

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

    setLoading(true);
    setError("");
    setOutput(null);

    try {
      const apiUrl = approvedId
        ? `/api/tools/clarify-or-challenge?approved=${approvedId}`
        : "/api/tools/clarify-or-challenge";



      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, inputText, audience }),
      });


      const data = await response.json();


      if (!response.ok) {
        throw new Error(data.error || "Failed to generate response");
      }


      console.log("Output text preview:", typeof data.output_text === 'string' ?
        data.output_text.substring(0, 100) :
        JSON.stringify(data.output_text).substring(0, 100));
      setOutput(data);
      toast.success("Response generated successfully!");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsChecked(!isChecked);
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    try {
      const promise = fetch("/api/tools/clarify-or-challenge/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outputId: output.id,
          rating,
          feedback,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to submit feedback");
        }
        return response.json();
      });

      toast.promise(promise, {
        loading: "Submitting feedback...",
        success: () => {
          // Reset feedback form
          setRating(0);
          setFeedback("");
          return "Thank you for your feedback!";
        },
        error: (err) => {
          console.error("Error in handleFeedbackSubmit:", err);
          return err.message || "Failed to submit feedback";
        },
      });
    } catch (err) {
      console.error("Error in handleFeedbackSubmit:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to submit feedback"
      );
    }
  };

  const handleCopyOutput = () => {
    if (!output?.output_text) return;

    let outputText = "";
    let data;

    try {
      data = typeof output.output_text === "string" && output.output_text
        ? JSON.parse(output.output_text)
        : output.output_text || {};
    } catch (e) {
      console.error('Failed to parse output JSON for copying:', e);
      toast.error('Failed to copy output - invalid data format');
      return;
    }

    if (!data) {
      toast.error('No data to copy');
      return;
    }

    if (type === "clarify") {
      outputText = `Main Argument:\n${data.main_argument || 'N/A'}\n\n`;

      outputText += `Key Concepts:\n`;
      if (Array.isArray(data.key_concepts)) {
        data.key_concepts.forEach((concept: any) => {
          outputText += `• ${concept.title || 'N/A'}: ${concept.description || 'N/A'}\n`;
        });
      }
      outputText += "\n";

      outputText += `Critical Details:\n`;
      if (Array.isArray(data.critical_details)) {
        data.critical_details.forEach((detail: string) => {
          outputText += `• ${detail || 'N/A'}\n`;
        });
      }
      outputText += "\n";

      outputText += `Applications in Practice:\n`;
      if (Array.isArray(data.applications_in_practice)) {
        data.applications_in_practice.forEach((app: any) => {
          outputText += `• ${app.example || 'N/A'}: ${app.description || 'N/A'}\n`;
        });
      }
    } else {
      outputText = `Critical Reflection Questions:\n`;
      if (Array.isArray(data.critical_reflection_questions)) {
        data.critical_reflection_questions.forEach((q: string) => {
          outputText += `• ${q || 'N/A'}\n`;
        });
      }
      outputText += "\n";

      outputText += `Advanced Concepts:\n`;
      if (Array.isArray(data.advanced_concepts)) {
        data.advanced_concepts.forEach((concept: any) => {
          outputText += `• ${concept.concept || 'N/A'}: ${concept.explanation || 'N/A'}\n`;
        });
      }
      outputText += "\n";

      outputText += `Interdisciplinary Connections:\n`;
      if (Array.isArray(data.interdisciplinary_connections)) {
        data.interdisciplinary_connections.forEach((conn: any) => {
          outputText += `• ${conn.field || 'N/A'}: ${conn.connection || 'N/A'}\n`;
        });
      }
      outputText += "\n";

      outputText += `Counterarguments:\n`;
      if (Array.isArray(data.counterarguments)) {
        data.counterarguments.forEach((arg: string) => {
          outputText += `• ${arg || 'N/A'}\n`;
        });
      }
      outputText += "\n";

      outputText += `Future Challenges:\n`;
      if (Array.isArray(data.future_challenges)) {
        data.future_challenges.forEach((challenge: string) => {
          outputText += `• ${challenge || 'N/A'}\n`;
        });
      }
    }

    navigator.clipboard.writeText(outputText);
    toast.success("Output copied to clipboard!");
  };

  return (
    <div className='min-h-screen bg-white py-12'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className='container mx-auto px-4'>
        {/* Report button in corner */}
        <div className='flex justify-end mb-4'>
          <ReportButton
            toolType='clarify_challenge'
            position='inline'
            variant='pre'
          />
        </div>

        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 mb-4'>
            Clarify or Challenge
          </h1>
          <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
            Engage in critical thinking exercises by clarifying concepts or
            challenging ideas
          </p>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
          <div className='bg-[#f9fafb] p-6 rounded-lg shadow'>
            {hasApprovedId && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-blue-800 text-sm mb-4">
                <p className="font-medium">This content has been pre-approved</p>
                <p>The input field is locked based on approved content. You can proceed to generate the results.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className='space-y-6'>
              <div>
                <Label>Clarify or Challenge</Label>
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setOutput(null);
                  }}
                  className='w-full p-2 border rounded-md'
                  disabled={hasApprovedId}
                >
                  <option value='clarify'>Clarify</option>
                  <option value='challenge'>Challenge</option>
                </select>
              </div>

              <div>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className='w-full p-2 border rounded-md'
                  disabled={hasApprovedId}
                >
                  <option value='beginner'>Beginner</option>
                  <option value='intermediate'>Intermediate</option>
                  <option value='advanced'>Advanced</option>
                </select>
              </div>

              <div>
                <Label>Topic</Label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className='w-full h-48 p-4 border rounded-md'
                  placeholder='Type your specific information, idea, perception or argument, include as much detail as possible.'
                  disabled={hasApprovedId}
                />
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
                disabled={!isChecked || loading || (!hasApprovedId && !inputText.trim())}
                className='w-full'
              >
                {loading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Generating ...
                  </>
                ) : (
                  "Generate "
                )}
              </Button>

              {error && (
                <div className='text-red-500 mt-2 text-sm'>{error}</div>
              )}
            </form>
          </div>

          <div>
            <div className='bg-white p-6 rounded-lg shadow'>
              {!output ? (
                <p className='text-sm text-gray-500'>
                  {hasApprovedId ? "Click Generate to create content from the approved input" : "Generated output will appear here"}
                </p>
              ) : (
                <div className='space-y-8'>
                  <div className='p-6 bg-gray-50 rounded-md'>
                    <div className='flex justify-between items-center mb-4'>
                      <h2 className='text-2xl font-bold'>
                        {type === "clarify"
                          ? "Clarified Output"
                          : "Challenge Output"}
                      </h2>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={handleCopyOutput}
                        className='flex items-center gap-2'
                      >
                        <Copy className='h-4 w-4' />
                        Copy
                      </Button>
                    </div>

                    <div className='bg-blue-50 border border-blue-200 rounded-md p-4 mb-4'>
                      <p className='text-sm text-blue-700'>
                        <strong>Pro Tip:</strong> Need to adjust the language for
                        a different age group? Copy this output and paste it into
                        an Edify Chat with a prompt like: "Translate this into
                        language suitable for a [year/age] student studying
                        [subject]"
                      </p>
                    </div>

                    {typeof output.output_text === 'string' && output.output_text ? (
                      type === "clarify" ? (
                        <ClarifyOutputComponent
                          output={(() => {
                            try {

                              const parsed = JSON.parse(output.output_text);

                              return parsed;
                            } catch (e) {
                              console.error('Failed to parse output JSON for clarify:', e);

                              return {}; // Return empty object on parse error
                            }
                          })()}
                        />
                      ) : (
                        <ChallengeOutputComponent
                          output={(() => {
                            try {

                              const parsed = JSON.parse(output.output_text);

                              return parsed;
                            } catch (e) {
                              console.error('Failed to parse output JSON for challenge:', e);

                              return {}; // Return empty object on parse error
                            }
                          })()}
                        />
                      )
                    ) : output.output_text ? (
                      type === "clarify" ? (
                        <>
                          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <p className="text-sm text-yellow-800">Debug: Using object output_text, type: {typeof output.output_text}</p>
                          </div>
                          <ClarifyOutputComponent output={output.output_text} />
                        </>
                      ) : (
                        <>
                          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <p className="text-sm text-yellow-800">Debug: Using object output_text, type: {typeof output.output_text}</p>
                          </div>
                          <ChallengeOutputComponent output={output.output_text} />
                        </>
                      )
                    ) : (
                      <div className="p-6 text-center bg-gray-100 rounded-lg">
                        <p className="text-gray-500">No output data available. Please generate a new response.</p>
                        <p className="text-sm text-gray-400 mt-2">The approved content may require regeneration.</p>
                      </div>
                    )}
                  </div>

                  <div className='p-6 bg-white rounded-md shadow'>
                    <h3 className='text-xl font-semibold mb-4'>
                      Provide Feedback
                    </h3>
                    <div className='space-y-4'>
                      <div>
                        <Label>Rating (1-5)</Label>
                        <div className='flex gap-2'>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setRating(star)}
                              className={`text-2xl ${rating >= star
                                ? "text-yellow-400"
                                : "text-gray-300"
                                }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Written Feedback</Label>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          className='w-full h-24 p-2 border rounded-md'
                          placeholder='Please provide your feedback on the output...'
                        />
                      </div>
                      <Button
                        onClick={handleFeedbackSubmit}
                        disabled={!rating || !feedback.trim()}
                        className='w-full'
                      >
                        Submit Feedback
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
