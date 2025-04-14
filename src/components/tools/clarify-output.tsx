function ClarifyOutputComponent({ output }: { output: any }) {
  if (!output) return null;

  return (
    <div className='space-y-6'>
      {output.main_argument && (
        <div>
          <h3 className='text-xl font-semibold  mb-2'>
            Main Argument
          </h3>
          <p className=''>{output.main_argument}</p>
        </div>
      )}

      {output.key_concepts?.length > 0 && (
        <div>
          <h3 className='text-xl font-semibold  mb-2'>
            Key Concepts
          </h3>
          <div className='space-y-4'>
            {output.key_concepts.map((concept: any, index: number) => (
              <div key={index}>
                <h4 className='font-medium '>{concept.title}</h4>
                <p className='text-gray-700'>{concept.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {output.critical_details?.length > 0 && (
        <div>
          <h3 className='text-xl font-semibold  mb-2'>
            Critical Details
          </h3>
          <ul className='list-disc pl-5 space-y-2'>
            {output.critical_details.map((detail: any, index: number) => (
              <li key={index} className='text-gray-700'>
                {detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {output.applications_in_practice?.length > 0 && (
        <div>
          <h3 className='text-xl font-semibold  mb-2'>
            Applications in Practice
          </h3>
          <div className='space-y-4'>
            {output.applications_in_practice.map(
              (application: any, index: number) => (
                <div key={index}>
                  <h4 className='font-medium '>
                    {application.example}
                  </h4>
                  <p className='text-gray-700'>{application.description}</p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClarifyOutputComponent;
