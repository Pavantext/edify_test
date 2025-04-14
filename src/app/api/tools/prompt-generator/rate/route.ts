import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";

const ratingSchema = z.object({
    promptId: z.string(),
    promptIndex: z.number().min(0).max(4),
    rating: z.number().min(1).max(5),
});

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validatedData = ratingSchema.parse(body);

        const supabase = await createClient();

        // First, get the current prompt
        const { data: prompt, error: promptError } = await supabase
            .from("prompt_generator_results")
            .select("ai_refined_prompts")
            .eq("id", validatedData.promptId)
            .single();

        if (promptError) throw promptError;

        // Update the ratings in the refined prompts array
        const refinedPrompts = prompt.ai_refined_prompts;
        const currentPrompt = refinedPrompts[validatedData.promptIndex];

        if (!currentPrompt.ratings) {
            currentPrompt.ratings = {
                totalRatings: 0,
                averageRating: 0,
                ratings: [],
            };
        }

        // Add the new rating
        currentPrompt.ratings.ratings.push({
            userId,
            rating: validatedData.rating,
            timestamp: new Date().toISOString(),
        });

        // Calculate new average
        const avgRating = currentPrompt.ratings.ratings.reduce(
            (acc: any, curr: { rating: any; }) => acc + curr.rating,
            0
        ) / currentPrompt.ratings.ratings.length;

        currentPrompt.ratings.averageRating = avgRating;
        currentPrompt.ratings.totalRatings = currentPrompt.ratings.ratings.length;

        // Update the database
        const { data, error } = await supabase
            .from("prompt_generator_results")
            .update({
                ai_refined_prompts: refinedPrompts,
            })
            .eq("id", validatedData.promptId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            ratings: currentPrompt.ratings,
        });
    } catch (error) {
        console.error("Rating Error:", error);
        return NextResponse.json(
            { error: "Failed to submit rating" },
            { status: 500 }
        );
    }
} 