"use client";

import Link from "next/link";

interface ViewMapLinkProps {
  className?: string;
}

const mapUrl = process.env.NEXT_PUBLIC_MAP_URL;

export function ViewMapLink({ className }: ViewMapLinkProps) {
  if (!mapUrl) {
    return null;
  }

  const baseClasses =
    "inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors";
  const combinedClassName = className
    ? `${baseClasses} ${className}`
    : baseClasses;

  return (
    <Link
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={combinedClassName}
    >
      View map
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M5 10a1 1 0 011-1h3a1 1 0 110 2H7v3a1 1 0 11-2 0v-4z" />
        <path d="M9 5a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 11-2 0V7.414l-8.293 8.293a1 1 0 01-1.414-1.414L14.586 6H10a1 1 0 01-1-1z" />
      </svg>
    </Link>
  );
}
