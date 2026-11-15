import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="font-serif text-4xl">Page not found</h1>
      <Link to="/" className="btn-primary mt-6">Back to dashboard</Link>
    </div>
  );
}
