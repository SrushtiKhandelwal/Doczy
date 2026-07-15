"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "brand" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Disable the scale-on-press effect */
  static?: boolean;
  loading?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  static: isStatic = false,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const variantClass = {
    primary: "btn-primary",
    brand: "btn-brand",
    ghost: "btn-ghost",
    danger: "btn-danger",
  }[variant];

  const sizeClass = {
    sm: "btn-sm",
    md: "",
    lg: "btn-lg",
  }[size];

  return (
    <button
      className={cn(
        "btn",
        variantClass,
        sizeClass,
        isStatic && "btn-static",
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <>
          <span
            className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
