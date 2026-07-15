"use client";

import { SignInButton } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    // Skeleton state — avoid layout shift
    return (
      <div
        style={{
          minHeight: "360px",
          borderRadius: "var(--radius-2xl)",
          background: "var(--surface-2)",
          border: "1px solid var(--border-subtle)",
          animation: "pulse 2s infinite",
        }}
      />
    );
  }

  if (!isSignedIn) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ type: "spring", duration: 0.4, bounce: 0 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          minHeight: "280px",
          padding: "40px 24px",
          borderRadius: "var(--radius-2xl)",
          background: "var(--surface-2)",
          border: "1px solid var(--border-subtle)",
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "52px",
            height: "52px",
            borderRadius: "var(--radius-lg)",
            background: "var(--surface-3)",
            color: "var(--text-muted)",
            outline: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Lock size={22} />
        </span>

        <div>
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text)",
              letterSpacing: "-0.02em",
            }}
          >
            Sign in to convert files
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              marginTop: "6px",
              maxWidth: "280px",
            }}
          >
            Create a free account to convert documents securely. Your files are
            never stored longer than 24 hours.
          </p>
        </div>

        <SignInButton mode="modal">
          <button className="btn btn-primary" id="auth-gate-signin-btn">
            Sign in to get started
          </button>
        </SignInButton>
      </motion.div>
    );
  }

  return <>{children}</>;
}
