import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@clerk/nextjs/server";
export const maxDuration = 299;
// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

// Add at the top with other constants
const MAX_PAPERS_SUMMARY = process.env.MAX_SUMMARY_PAPERS
  ? parseInt(process.env.MAX_SUMMARY_PAPERS)
  : 5; // Match frontend default

export async function POST(request: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { papers, sections } = await request.json();

    if (!papers || !Array.isArray(papers)) {
      return NextResponse.json(
        { error: "Invalid papers data" },
        { status: 400 }
      );
    }

    // Prepare papers content
    let contentText = "";
    const papersToSummarize = papers.slice(
      0,
      Math.min(MAX_PAPERS_SUMMARY, papers.length)
    );

    for (const paper of papersToSummarize) {
      const paperContent = `
Title: ${paper.title}
Authors: ${paper.authors.join(", ")}
Abstract: ${paper.abstract}
${paper.year ? `Year: ${paper.year}` : ""}
${paper.venue ? `Venue: ${paper.venue}` : ""}
${paper.authorAffiliation ? `Affiliation: ${paper.authorAffiliation}` : ""}
-------------------
`;
      contentText += paperContent;
    }

    if (contentText === "") {
      return NextResponse.json(
        { error: "No content to generate summary" },
        { status: 400 }
      );
    }

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Modify the prompt generation to use dynamic sections
    const sectionTemplates: Record<string, string> = {
      overview: `<h2>OVERVIEW</h2>
Main Topics and Themes:
• List the primary topics covered in the papers
• Highlight key research areas and focus points
• Identify common themes across papers

Significance and Relevance:
• Explain why this research matters
• Describe the practical importance
• Outline potential benefits to the field

Key Research Questions:
• List main research questions addressed
• Identify core problems being solved
• Note any hypotheses being tested`,

      keyfindings: `<h2>KEY FINDINGS</h2>
Primary Results:
• List major discoveries and outcomes
• Highlight breakthrough findings
• Summarize key conclusions

Supporting Evidence:
• Present important statistics and data
• Note significant measurements
• Include relevant experimental results

Practical Applications:
• Describe real-world uses
• List potential implementations
• Outline practical benefits`,

      methods: `<h2>RESEARCH METHODS</h2>
Methodologies Used:
• List primary research approaches
• Describe experimental setups
• Outline theoretical frameworks

Tools and Techniques:
• Detail specific tools used
• Describe technical approaches
• List relevant technologies

Study Limitations:
• Note methodology constraints
• Identify potential biases
• Highlight areas for improvement`,

      impact: `<h2>SIGNIFICANCE & IMPACT</h2>
    Explain the broader impact of these research findings:
    • How they advance knowledge in the field.
    • Potential real-world applications and societal benefits.
    • Industry relevance and possible future implications.`,

      connections: `<h2>CONNECTIONS BETWEEN PAPERS</h2>
    Analyse relationships between the selected papers:
    • Common themes and shared conclusions.
    • Contradictions, differing perspectives, or gaps in research.
    • How the papers build upon or challenge each other.`,

      conclusion: `<h2>CONCLUSION</h2>
    Provide a well-rounded summary and future research directions:
    • The most critical takeaways from the research.
    • Unanswered questions or areas for further investigation.
    • Final thoughts on the overall contribution of the research.`,
    };

    const validSections = Array.isArray(sections)
      ? sections.filter((s) => s in sectionTemplates)
      : Object.keys(sectionTemplates);

    const prompt = `Analyse the following research papers and generate a structured, in-depth summary. 
    Ensure clarity, depth, and logical flow while keeping the structure below:
    
    ${validSections.map((section) => sectionTemplates[section]).join("\n\n")}
    
    - Use precise language to convey key insights without unnecessary complexity.
    - Maintain the provided section headers (<h2>) in the response.
    - Where necessary, explain complex concepts in a reader-friendly way.
    - Provide a cohesive analysis that synthesizes information across multiple papers.
    
    Research Papers to Analyse:
    
    ${contentText}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    const response = await result.response;
    const summary = response.text();

    // Clean up the summary text while preserving HTML headers and bullet points
    const cleanedSummary = summary
      .replace(/\n\s*\n/g, "\n") // Replace multiple newlines with single newline
      .replace(/\*\*([^:]+):\*\*/g, "<br/><strong>$1:</strong><br/>") // Add line breaks before and after section titles
      .replace(/\*([^*]+)\*/g, "<li>$1</li>") // Convert asterisk bullets to HTML list items without bold
      .replace(/((?:<li>.*?<\/li>\n?)+)/g, "<ul>$1</ul>") // Wrap consecutive list items in ul tags
      // .replace(/(<h2>.*?<\/h2>)/g, '<br/>$1')
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)
      .join("\n")
      .trim();

    return NextResponse.json({
      summary: cleanedSummary,
    });
  } catch (error) {
    console.error("Error generating summary:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
