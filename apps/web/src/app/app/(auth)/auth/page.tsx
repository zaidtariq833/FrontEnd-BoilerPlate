import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { Suspense } from "react";

import SignInForm from "./_components/signin-form";
import SignUpForm from "./_components/signup-form";

export default function SignIn() {
  return (
    <Suspense>
      <Tabs defaultValue="signin" className="w-[400px]">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">SignIn</TabsTrigger>
          <TabsTrigger value="signup">SignUp</TabsTrigger>
        </TabsList>
        <TabsContent value="signin">
          <SignInForm />
        </TabsContent>
        <TabsContent value="signup">
          <SignUpForm />
        </TabsContent>
      </Tabs>
    </Suspense>
  );
}
