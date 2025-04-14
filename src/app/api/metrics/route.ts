import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_tools_metrics")
      .select()
      .eq("flagged", false)
      .gt("price_gbp", 0);

    if (error) {
      return NextResponse.json({ error: error.message });
    }

    // Group data by prompt_type
    const groupedByPromptType = data.reduce((acc, item) => {
      const promptType = item.prompt_type || "unknown";

      if (!acc[promptType]) {
        acc[promptType] = {
          records: [],
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalPriceGBP: 0,
        };
      }

      acc[promptType].records.push(item);
      acc[promptType].totalInputTokens += item.input_tokens || 0;
      acc[promptType].totalOutputTokens += item.output_tokens || 0;
      acc[promptType].totalPriceGBP += item.price_gbp || 0;

      return acc;
    }, {});

    // Calculate metrics for each prompt type
    const metrics = Object.keys(groupedByPromptType).map((promptType) => {
      const group = groupedByPromptType[promptType];
      const recordCount = group.records.length;

      // Calculate average values
      const avgInputTokens =
        recordCount > 0 ? group.totalInputTokens / recordCount : 0;
      const avgOutputTokens =
        recordCount > 0 ? group.totalOutputTokens / recordCount : 0;
      const avgPriceGBP =
        recordCount > 0 ? group.totalPriceGBP / recordCount : 0;

      // Calculate average for last 5 generations if available
      const last5 = group.records.slice(-Math.min(5, recordCount));
      const avgPriceLast5 =
        last5.length > 0
          ? last5.reduce(
              (sum: number, item: any) => sum + (item.price_gbp || 0),
              0
            ) / last5.length
          : 0;

      // Calculate average for last 10 generations if available
      const last10 = group.records.slice(-Math.min(10, recordCount));
      const avgPriceLast10 =
        last10.length > 0
          ? last10.reduce(
              (sum: number, item: any) => sum + (item.price_gbp || 0),
              0
            ) / last10.length
          : 0;

      return {
        prompt_type: promptType,
        count: recordCount,
        total_input_tokens: group.totalInputTokens,
        total_output_tokens: group.totalOutputTokens,
        total_price_gbp: group.totalPriceGBP,
        avg_input_tokens: parseFloat(avgInputTokens.toFixed(2)),
        avg_output_tokens: parseFloat(avgOutputTokens.toFixed(2)),
        avg_price_gbp: parseFloat(avgPriceGBP.toFixed(4)),
        avg_price_last_5: parseFloat(avgPriceLast5.toFixed(4)),
        avg_price_last_10: parseFloat(avgPriceLast10.toFixed(4)),
      };
    });

    // Create summary data
    const summary = {
      total_records: data.length,
      total_input_tokens: data.reduce(
        (sum, item) => sum + (item.input_tokens || 0),
        0
      ),
      total_output_tokens: data.reduce(
        (sum, item) => sum + (item.output_tokens || 0),
        0
      ),
      total_price_gbp: parseFloat(
        data.reduce((sum, item) => sum + (item.price_gbp || 0), 0).toFixed(4)
      ),
      prompt_types_count: metrics.length,
    };

    // Generate CSV for metrics data
    const metricsHeaders = [
      "prompt_type",
      "count",
      "total_input_tokens",
      "total_output_tokens",
      "total_price_gbp",
      "avg_input_tokens",
      "avg_output_tokens",
      "avg_price_gbp",
      "avg_price_last_5",
      "avg_price_last_10",
    ];

    let metricsCSV = metricsHeaders.join(",") + "\n";
    metrics.forEach((row) => {
      const rowValues = metricsHeaders.map((header) => {
        const value = row[header as keyof typeof row];
        // Wrap text values in quotes, leave numbers as is
        return typeof value === "string" ? `"${value}"` : value;
      });
      metricsCSV += rowValues.join(",") + "\n";
    });

    // Generate CSV for summary data
    const summaryHeaders = [
      "total_records",
      "total_input_tokens",
      "total_output_tokens",
      "total_price_gbp",
      "prompt_types_count",
    ];

    let summaryCSV = summaryHeaders.join(",") + "\n";
    const summaryValues = summaryHeaders.map(
      (header) => summary[header as keyof typeof summary]
    );
    summaryCSV += summaryValues.join(",") + "\n";

    // Save CSV files
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\./g, "-");
    const metricsFilePath = path.join(
      process.cwd(),
      "public",
      `ai_metrics_by_prompt_type_${timestamp}.csv`
    );
    const summaryFilePath = path.join(
      process.cwd(),
      "public",
      `ai_metrics_summary_${timestamp}.csv`
    );

    fs.writeFileSync(metricsFilePath, metricsCSV);
    fs.writeFileSync(summaryFilePath, summaryCSV);

    return NextResponse.json({
      success: true,
      metrics_file: `/ai_metrics_by_prompt_type_${timestamp}.csv`,
      summary_file: `/ai_metrics_summary_${timestamp}.csv`,
      metrics_preview: metrics,
      summary_preview: summary,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "An error occurred" });
  }
}
