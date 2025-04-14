function ChallengeOutputComponent({ output }: { output: any }) {
  if (!output) return null;

  return (
    <div className='space-y-6'>
      {output.critical_reflection_questions?.length > 0 && (
        <div>
          <h3 className='text-xl font-semibold  mb-2'>
            Critical Reflection Questions
          </h3>
          <ul className='list-disc pl-5 space-y-2'>
            {output.critical_reflection_questions.map(
              (question: any, index: number) => (
                <li key={index} className='text-gray-700'>
                  {question}
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {output.advanced_concepts?.length > 0 && (
        <div>
          <h3 className='text-xl font-semibold  mb-2'>
            Advanced Concepts
          </h3>
          <div className='space-y-4'>
            {output.advanced_concepts.map((concept: any, index: number) => (
              <div key={index}>
                  <h4 className='font-medium '>{concept.concept}</h4>
                <p className='text-gray-700'>{concept.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {output.interdisciplinary_connections?.length > 0 && (
        <div>
          <h3 className='text-xl font-semibold  mb-2'>
            Interdisciplinary Connections
          </h3>
          <div className='space-y-4'>
            {output.interdisciplinary_connections.map(
              (connection: any, index: number) => (
                <div key={index}>
                  <h4 className='font-medium '>
                    {connection.field}
                  </h4>
                  <p className='text-gray-700'>{connection.connection}</p>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {output.counterarguments?.length > 0 && (
        <div>
          <h3 className='text-xl font-semibold  mb-2'>
            Counterarguments
          </h3>
          <ul className='list-disc pl-5 space-y-2'>
            {output.counterarguments.map((argument: any, index: number) => (
              <li key={index} className='text-gray-700'>
                {argument}
              </li>
            ))}
          </ul>
        </div>
      )}

      {output.future_challenges?.length > 0 && (
        <div>
          <h3 className='text-xl font-semibold  mb-2'>
            Future Challenges
          </h3>
          <ul className='list-disc pl-5 space-y-2'>
            {output.future_challenges.map((challenge: any, index: number) => (
              <li key={index} className='text-gray-700'>
                {challenge}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ChallengeOutputComponent;
