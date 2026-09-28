export function FieldError({ children }: { children: string }) {
  return (
    <p className="text-danger mt-1 text-sm" role="alert">
      {children}
    </p>
  );
}
