import { Empty } from './bits';

/**
 * The loading and failed states every list page shows above its rows. Renders nothing once data has arrived.
 * `what` completes "Could not load …" (e.g. "orders"); `onRetry` adds the "Try again" button.
 */
export function QueryStatus({ isLoading, isError, onRetry, what }: { isLoading: boolean; isError: boolean; onRetry: () => void; what?: string }) {
  return (
    <>
      {isLoading && <p role="status" className="py-12 text-center text-taupe">Loading…</p>}
      {isError && (
        <Empty>
          Could not load{what ? ` ${what}` : ''}. <button className="underline" onClick={onRetry}>Try again</button>
        </Empty>
      )}
    </>
  );
}
