import { Lightbulb } from "lucide-react";

function Loader() {
  return (
    <div className='flex flex-col items-center justify-center min-h-[400px] gap-8'>
      <h2 className='text-4xl font-bold text-emerald-500'>
        We're just generating your results
      </h2>
      <Lightbulb className='w-16 h-16 text-emerald-500 animate-pulse' />
      <div className='max-w-2xl text-center text-muted-foreground'>
        <h3 className='text-xl font-semibold mb-4'>Did you know?</h3>
        <p>
          Our lesson plans incorporates theories like Bloom's Taxonomy to
          generate assessments that evaluate understanding, application, and
          critical thinking.
        </p>
      </div>
    </div>
  );
}

export default Loader;
