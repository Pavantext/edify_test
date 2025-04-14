import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-[380px] min-w-[300px] mx-auto px-4">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/waitlist"
          afterSignInUrl="/tools"
          afterSignUpUrl="/waitlist"
        />
      </div>
    </div>
  );
}