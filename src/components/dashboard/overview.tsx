"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

// Function to generate secure random numbers
const getSecureRandomNumber = (min: number, max: number): number => {
  // Create a new Uint32Array with a single element
  const array = new Uint32Array(1);
  // Generate a cryptographically secure random value
  window.crypto.getRandomValues(array);
  // Convert to a number between 0 and 1, then scale to desired range
  const randomNumber = array[0] / (0xffffffff + 1); // Divide by 2^32
  return Math.floor(randomNumber * (max - min + 1)) + min;
};

const data = [
  {
    name: "Jan",
    total: getSecureRandomNumber(1000, 6000),
  },
  // Add more monthly data...
]

export function Overview() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Bar
          dataKey="total"
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </BarChart>
    </ResponsiveContainer>
  )
} 