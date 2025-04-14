"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Edit, Loader2 } from "lucide-react";
import Link from "next/link";
import ShareButton from "@/components/share-btn";
import { createClient } from "@/utils/supabase/client";
import { ReportButton } from "@/components/ReportButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buttonVariants } from "@/components/ui/button";

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

export default function ViewAnalysis() {
  const [analysis, setAnalysis] = useState<PerspectiveAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const { data, error } = await supabase
          .from("perspective_challenge_results")
          .select("*")
          .eq("id", id)
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
  }, [id]);

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
        <h1 className="text-2xl font-semibold">Analysis View</h1>
        <div className="flex space-x-4">
          <ShareButton
            shareUrl={`${process.env.NEXT_PUBLIC_APP_URL}/tools/perspective-challenge/${id}/view`}
            toolType="Perspective Challenge"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/tools/perspective-challenge/${analysis.id}/edit`}
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
          </TooltipProvider>
          <ReportButton
            toolType="perspective_challenge"
            resultId={id}
            position="inline"
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* Main Points */}
        <Card>
          <CardHeader>
            <CardTitle>Main Points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700">Main Argument</h4>
              <p className="mt-2">{analysis.analysis.mainPoints.mainArgument}</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-700">Key Points</h4>
              <ul className="list-disc pl-6 mt-2">
                {analysis.analysis.mainPoints.keyPoints.map((point, index) => (
                  <li key={index} className="mt-1">
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-700">Implicit Assumptions</h4>
              <ul className="list-disc pl-6 mt-2">
                {analysis.analysis.mainPoints.implicitAssumptions.map(
                  (assumption, index) => (
                    <li key={index} className="mt-1">
                      {assumption}
                    </li>
                  )
                )}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Alternative Perspectives */}
        <Card>
          <CardHeader>
            <CardTitle>Alternative Perspectives</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {analysis.analysis.alternativePerspectives.map(
              (perspective, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="font-medium text-gray-700">
                    {perspective.title}
                  </h4>
                  <ul className="list-disc pl-6">
                    {perspective.points.map((point, pointIndex) => (
                      <li key={pointIndex} className="mt-1">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
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
            <div>
              <h4 className="font-medium text-gray-700">Supporting Evidence</h4>
              <ul className="list-disc pl-6 mt-2">
                {analysis.analysis.evidenceExploration.supporting.map(
                  (evidence, index) => (
                    <li key={index} className="mt-1">
                      {evidence}
                    </li>
                  )
                )}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-700">Challenging Evidence</h4>
              <ul className="list-disc pl-6 mt-2">
                {analysis.analysis.evidenceExploration.challenging.map(
                  (evidence, index) => (
                    <li key={index} className="mt-1">
                      {evidence}
                    </li>
                  )
                )}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-700">Research Questions</h4>
              <ul className="list-disc pl-6 mt-2">
                {analysis.analysis.evidenceExploration.researchQuestions.map(
                  (question, index) => (
                    <li key={index} className="mt-1">
                      {question}
                    </li>
                  )
                )}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Bias Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Bias Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium text-gray-700">Potential Biases</h4>
              <ul className="list-disc pl-6 mt-2">
                {analysis.analysis.biasAssessment.potentialBiases.map(
                  (bias, index) => (
                    <li key={index} className="mt-1">
                      {bias}
                    </li>
                  )
                )}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-700">Reduction Suggestions</h4>
              <ul className="list-disc pl-6 mt-2">
                {analysis.analysis.biasAssessment.reductionSuggestions.map(
                  (suggestion, index) => (
                    <li key={index} className="mt-1">
                      {suggestion}
                    </li>
                  )
                )}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Adaptability Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle>Adaptability Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-6">
              {analysis.analysis.adaptabilitySuggestions.map(
                (suggestion, index) => (
                  <li key={index} className="mt-1">
                    {suggestion}
                  </li>
                )
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
