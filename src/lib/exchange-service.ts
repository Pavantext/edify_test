import { cache } from "react";

interface ExchangeRate {
  rate: number;
  timestamp: number;
}

let cachedRate: ExchangeRate | null = null;
const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

export const getExchangeRate = cache(async (): Promise<number> => {
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    return cachedRate.rate;
  }

  try {
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/USD`
    );
    const data = await response.json();
    const rate = data.rates.GBP;

    cachedRate = {
      rate,
      timestamp: Date.now(),
    };

    return rate;
  } catch (error) {
    console.error("Failed to fetch exchange rate:", error);
    return cachedRate?.rate || 0.79; // Fallback rate
  }
});

export const calculateGBPPrice = async (
  inputTokens: number,
  outputTokens: number,
  model: string
): Promise<number> => {
  // Add debug logs
  console.log("Price calculation inputs:", {
    inputTokens,
    outputTokens,
    model,
  });

  const prices = {
    "gpt-4-turbo-preview": {
      input: 0.01,
      output: 0.03,
    },
    "gpt-4o-mini": {
      input: 0.01,
      output: 0.03,
    },
    "gpt-4o": {
      input: 0.01,
      output: 0.03,
    },
  };

  const modelPrices = prices[model as keyof typeof prices];
  if (!modelPrices) throw new Error("Invalid model for pricing");

  const usdPrice =
    (inputTokens / 1000) * modelPrices.input +
    (outputTokens / 1000) * modelPrices.output;

  console.log("USD Price:", usdPrice);

  const exchangeRate = await getExchangeRate();
  console.log("Exchange rate:", exchangeRate);

  const gbpPrice = Number((usdPrice * exchangeRate).toFixed(6));
  console.log("Final GBP Price:", gbpPrice);

  return gbpPrice;
};
