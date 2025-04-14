import React from "react";
import Image from "next/image";

export default function Home(): React.ReactElement {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Home</h1>
    </div>
  );
}
