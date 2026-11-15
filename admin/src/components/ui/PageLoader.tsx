export function PageLoader() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-[40vh] items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-antique" />
    </div>
  );
}
