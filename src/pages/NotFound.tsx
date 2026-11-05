import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-8">
      <div className="w-full max-w-[480px] text-center">
        <h1 className="mb-3 font-display text-[26px] leading-8 text-ink-950">404</h1>
        <p className="mb-6 text-sm text-ink-500">Oops! Page not found</p>
        <a
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-[10px] border border-ink-200 bg-background px-4 text-sm font-medium text-primary transition-colors duration-150 hover:bg-ink-100"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
