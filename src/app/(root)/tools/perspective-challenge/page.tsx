"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, Edit, Share2 } from "lucide-react";
import ShareButton from "@/components/share-btn";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { ReportButton } from "@/components/ReportButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import SubscriptionDialog from "@/components/SubscriptionDialog";

interface PerspectiveAnalysis {
  id: string;
  created_at: string;
  topic: string;
  input: string;
  analysis: {
    mainPoints: {
      mainArgument: string;
      keyPoints: string[];
      implicitAssumptions: string[];
    };
    alternativePerspectives: {
      title: string;
      points: string[];
    }[];
    evidenceExploration: {
      supporting: string[];
      challenging: string[];
      researchQuestions: string[];
    };
    biasAssessment: {
      potentialBiases: string[];
      reductionSuggestions: string[];
    };
    adaptabilitySuggestions: string[];
  };
}

export default function Home() {
  const [currentAnalysis, setCurrentAnalysis] =
    useState<PerspectiveAnalysis | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<{
    message: string;
    violations?: any[];
  } | null>(null);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const openSubscriptionDialog = () => setShowSubscriptionDialog(true);

  useEffect(() => {
    const fetchApprovedContent = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const approvedId = searchParams.get('approved');

      if (approvedId) {
        try {
          const response = await fetch(`/api/tools/perspective-challenge?approved=${approvedId}`);
          const data = await response.json();

          if (!response.ok) {
            if (response.status === 403) {
              setError({
                message: `Content not approved: ${data.details?.status || 'Unknown status'}`
              });
              return;
            }
            throw new Error(data.error || 'Failed to fetch analysis');
          }

          setCurrentAnalysis(data);
        } catch (err: any) {
          setError({
            message: err.message || 'Failed to load analysis'
          });
        }
      }
    };

    fetchApprovedContent();
  }, []);

  const handleRegenerate = async () => {
    if (!currentAnalysis) return;
    setRegenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/tools/perspective-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: currentAnalysis.topic,
          perspective: currentAnalysis.input,
          regenerate: true,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to regenerate analysis");
      }

      const data = await response.json();
      setCurrentAnalysis(data);
    } catch (error) {
      console.error("Failed to regenerate:", error);
      setError({ message: "Failed to regenerate analysis" });
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <main className='max-w-7xl mx-auto px-4 py-8 bg-white'>
      {showSubscriptionDialog && <SubscriptionDialog />}
      <div className='flex justify-end mb-4'>
        <ReportButton
          toolType='perspective_challenge'
          position='inline'
          variant='pre'
        />
      </div>

      <div className='text-center mb-12'>
        <h1 className='text-4xl font-bold text-gray-900 mb-4'>
          Perspective Challenge
        </h1>
        <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
          Test and expand your viewpoints with thought-provoking questions
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
        <PerspectiveForm
          onAnalysisComplete={setCurrentAnalysis}
          initialData={null}
          editMode={false}
          onError={setError}
          openSubscriptionDialog={openSubscriptionDialog}
        />
        <div className='flex-col space-y-2'>
          {currentAnalysis && (
            <div className='flex space-x-3'>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => {
                        const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tools/perspective-challenge/${currentAnalysis.id}/view`;
                        navigator.clipboard.writeText(shareUrl);
                      }}
                      variant='outline'
                      size='icon'
                      className='w-9 h-9'
                    >
                      <Share2 className='h-4 w-4' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy share link</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/tools/perspective-challenge/${currentAnalysis.id}/view`}
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
                    <p>View analysis</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/tools/perspective-challenge/${currentAnalysis.id}/edit`}
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
                    <p>Edit analysis</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      variant='outline'
                    >
                      {regenerating ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Regenerating...
                        </>
                      ) : (
                        "Regenerate"
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>

                    <p>Regenerate analysis</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          <AnalysisResult analysis={currentAnalysis} error={error} />
        </div>
      </div>
    </main>
  );
}

interface PerspectiveFormProps {
  onAnalysisComplete: (analysis: PerspectiveAnalysis) => void;
  initialData: PerspectiveAnalysis | null;
  editMode: boolean;
  onError: (error: { message: string; violations?: any[]; } | null) => void;
  openSubscriptionDialog: () => void;
}

function PerspectiveForm({
  onAnalysisComplete,
  onError,
  openSubscriptionDialog,
}: PerspectiveFormProps) {
  const [isChecked, setIsChecked] = useState(false);
  const [topic, setTopic] = useState("");
  const [perspective, setPerspective] = useState("");
  const [loading, setLoading] = useState(false);
  const [isApprovedContent, setIsApprovedContent] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const approvedId = searchParams.get('approved');

    if (approvedId) {
      setIsApprovedContent(true);
      // Fetch the approved content
      fetch(`/api/tools/perspective-challenge?approved=${approvedId}`)
        .then(response => response.json())
        .then(data => {
          if (data.input_data) {
            setPerspective(data.input_data.input);
            setIsChecked(true); // Auto-check the verification since it's approved content
          }
        })
        .catch(err => {
          console.error('Failed to fetch approved content:', err);
        });
    }
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
        openSubscriptionDialog();
        return;
      }
    } catch (err) {
      console.error("Error checking premium status:", err);
    }

    setLoading(true);
    onError(null);

    try {
      const response = await fetch("/api/tools/perspective-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          topic, 
          perspective,
          approvedId: isApprovedContent ? new URLSearchParams(window.location.search).get('approved') : undefined 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate analysis", {
          cause: data,
        });
      }

      onAnalysisComplete(data);
    } catch (err: any) {
      const errorData = err.cause || {};
      onError({
        message: err.message || "An error occurred",
        violations: errorData.violations || [],
      });
    } finally {
      setLoading(false);
      setIsChecked(!isChecked);
    }
  };

  return (
    <div>
      <Card className='p-6 bg-[#f9fafb]'>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <div>
            <div className='space-y-4 mb-4'>
              <div>
                <label
                  htmlFor='perspective'
                  className='block text-sm font-medium mb-1'
                >
                  Enter your Perspective
                </label>
                <Textarea
                  id='perspective'
                  placeholder='Type your specific idea, perception or argument, include as much detail as possible.'
                  value={perspective}
                  onChange={(e) => setPerspective(e.target.value)}
                  className='min-h-[200px]'
                  required
                  disabled={isApprovedContent}
                />
                <p className='text-sm text-gray-500 mt-1'>
                  {isApprovedContent 
                    ? 'This is an approved perspective. The input field is locked.' 
                    : 'Provide a detailed perspective for better analysis'}
                </p>
              </div>
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
                I verify that I have not used any personal data such as student
                names or private information. Instead of names, I have referred
                to them as student, pupil or similar.
              </label>
            </div>

            <Button
              type='submit'
              className='w-full mt-6'
              disabled={!isChecked || loading}
            >
              {loading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {isApprovedContent ? 'Loading Analysis...' : 'Generating Analysis...'}
                </>
              ) : (
                isApprovedContent ? 'View Analysis' : 'Generate Analysis'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

interface AnalysisResultProps {
  analysis: PerspectiveAnalysis | null;
  error: { message: string; violations?: any[]; } | null;
}

function AnalysisResult({ analysis, error }: AnalysisResultProps) {
  if (error) {
    return (
      <Card className='p-6 bg-[#f9fafb]'>
        <Alert variant='destructive'>
          <AlertDescription>
            <div className='space-y-2'>
              <p>{error.message}</p>
              {error.violations && error.violations.length > 0 && (
                <div className='mt-2'>
                  <p className='font-semibold'>Content Violations Detected:</p>
                  <ul className='list-disc pl-4 mt-1'>
                    {Object.entries(error.violations).map(
                      ([key, value]) =>
                        value && (
                          <li key={key} className='text-sm'>
                            {key.replace(/_/g, " ")}
                          </li>
                        )
                    )}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </Card>
    );
  }

  if (!analysis?.analysis) return (
    <div className='bg-[#f9fafb] p-6 rounded-lg shadow'>
      <p className='text-sm text-gray-500'>
        Generated output will appear here
      </p>
    </div>
  );

  return (
    <Card className='p-6 bg-[#f9fafb] space-y-8'>
      <h2 className='text-2xl font-semibold text-cyan-700'>Analysis Results</h2>

      <section className='space-y-4'>
        <h3 className='text-xl font-medium'>Main Points and Assumptions</h3>
        <div className='space-y-4 pl-4'>
          <div>
            <h4 className='font-medium text-gray-700'>Main Argument</h4>
            <p className='mt-1'>{analysis.analysis.mainPoints.mainArgument}</p>
          </div>

          <div>
            <h4 className='font-medium text-gray-700'>Key Points</h4>
            <ul className='list-disc pl-6 mt-1'>
              {analysis.analysis.mainPoints.keyPoints.map((point, index) => (
                <li key={index} className='mt-1'>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className='font-medium text-gray-700'>Implicit Assumptions</h4>
            <ul className='list-disc pl-6 mt-1'>
              {analysis.analysis.mainPoints.implicitAssumptions.map(
                (assumption, index) => (
                  <li key={index} className='mt-1'>
                    {assumption}
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className='space-y-4'>
        <h3 className='text-xl font-medium'>Alternative Perspectives</h3>
        <div className='space-y-6'>
          {analysis.analysis.alternativePerspectives.map(
            (perspective, index) => (
              <div key={index} className='pl-4'>
                <h4 className='font-medium text-gray-700'>
                  {perspective.title}
                </h4>
                <ul className='list-disc pl-6 mt-1'>
                  {perspective.points.map((point, pointIndex) => (
                    <li key={pointIndex} className='mt-1'>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
      </section>

      <section className='space-y-4'>
        <h3 className='text-xl font-medium'>Evidence-Based Exploration</h3>
        <div className='space-y-6 pl-4'>
          <div>
            <h4 className='font-medium text-gray-700'>Supporting Evidence</h4>
            <ul className='list-disc pl-6 mt-1'>
              {analysis.analysis.evidenceExploration.supporting.map(
                (evidence, index) => (
                  <li key={index} className='mt-1'>
                    {evidence}
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <h4 className='font-medium text-gray-700'>Challenging Evidence</h4>
            <ul className='list-disc pl-6 mt-1'>
              {analysis.analysis.evidenceExploration.challenging.map(
                (evidence, index) => (
                  <li key={index} className='mt-1'>
                    {evidence}
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <h4 className='font-medium text-gray-700'>Research Questions</h4>
            <ul className='list-disc pl-6 mt-1'>
              {analysis.analysis.evidenceExploration.researchQuestions.map(
                (question, index) => (
                  <li key={index} className='mt-1'>
                    {question}
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className='space-y-4'>
        <h3 className='text-xl font-medium'>Bias Assessment</h3>
        <div className='space-y-6 pl-4'>
          <div>
            <h4 className='font-medium text-gray-700'>Potential Biases</h4>
            <ul className='list-disc pl-6 mt-1'>
              {analysis.analysis.biasAssessment.potentialBiases.map(
                (bias, index) => (
                  <li key={index} className='mt-1'>
                    {bias}
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <h4 className='font-medium text-gray-700'>Reduction Suggestions</h4>
            <ul className='list-disc pl-6 mt-1'>
              {analysis.analysis.biasAssessment.reductionSuggestions.map(
                (suggestion, index) => (
                  <li key={index} className='mt-1'>
                    {suggestion}
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className='space-y-4'>
        <h3 className='text-xl font-medium'>Adaptability Suggestions</h3>
        <ul className='list-disc pl-10 mt-1'>
          {analysis.analysis.adaptabilitySuggestions.map(
            (suggestion, index) => (
              <li key={index} className='mt-1'>
                {suggestion}
              </li>
            )
          )}
        </ul>
      </section>

    </Card>
  );
}
