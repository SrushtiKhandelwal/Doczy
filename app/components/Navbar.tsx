"use client";

import Link from "next/link";
import { UserButton, SignInButton, useAuth } from "@clerk/nextjs";
import { FileText } from "lucide-react";

export default function Navbar() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "0 24px",
        height: "56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(9,9,11,0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: 600,
          fontSize: "15px",
          letterSpacing: "-0.02em",
          color: "var(--text)",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            background: "var(--brand)",
            borderRadius: "var(--radius-sm)",
            color: "#fff",
          }}
        >
          <FileText size={15} />
        </span>
        Doczy
      </Link>

      {/* Auth */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {!isLoaded ? null : isSignedIn ? (
          <UserButton
            appearance={{
              elements: {
                avatarBox: { width: 30, height: 30 },
              },
            }}
          />
        ) : (
          <SignInButton mode="modal">
            <button className="btn btn-ghost btn-sm">Sign in</button>
          </SignInButton>
        )}
      </div>
    </header>
  );
}
