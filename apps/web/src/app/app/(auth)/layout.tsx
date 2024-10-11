export default function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <div className="flex items-center justify-center w-full h-screen">
      {children}
    </div>
  );
}
