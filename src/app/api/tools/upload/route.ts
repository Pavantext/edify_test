//api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { createClient } from "@/utils/supabase/server";

// Define supported file types
const SUPPORTED_FILE_TYPES = {
  PDF: "application/pdf",
  DOC: "application/msword",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

// Error handling utility
const handleError = (message: string, status: number = 500) => {
  console.error(`Error: ${message}`);
  return NextResponse.json({ error: message }, { status });
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const formData = await request.formData();
    console.log(formData);
    const file = formData.get("file") as File | null;
    console.log(file);

    if (!file) {
      return handleError("No file uploaded", 400);
    }

    // Validate file type
    if (!Object.values(SUPPORTED_FILE_TYPES).includes(file.type as any)) {
      return handleError("Unsupported file type", 415);
    }

    // Upload file to Supabase Storage
    const filePath = `lesson-plans/${Date.now()}_${file.name}`;
    console.log(filePath);
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      console.log(uploadError);
      return handleError(`Upload failed: ${uploadError.message}`);
    }

    // Get the file URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return handleError("Failed to get public URL");
    }

    // Parse file content based on file type
    let parsedContent = "";

    return NextResponse.json({
      success: true,
      fileUrl: urlData.publicUrl,
      parsedContent,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
  } catch (error) {
    console.log(error);
    return handleError(`Unexpected error: ${(error as Error).message}`);
  }
}

// try {
//   const fileBuffer = await file.arrayBuffer();

//   if (file.type === SUPPORTED_FILE_TYPES.PDF) {
//     const pdfData = await pdfParse(Buffer.from(fileBuffer));
//     parsedContent = pdfData.text;
//   } else if (
//     file.type === SUPPORTED_FILE_TYPES.DOC ||
//     file.type === SUPPORTED_FILE_TYPES.DOCX
//   ) {
//     const result = await mammoth.extractRawText({
//       arrayBuffer: fileBuffer,
//     });
//     parsedContent = result.value;
//   }
// } catch (parseError) {
//   return handleError(
//     `Failed to parse file: ${(parseError as Error).message}`
//   );
// }
