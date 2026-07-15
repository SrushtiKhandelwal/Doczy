import Navbar from "./components/Navbar";
import AuthGate from "./components/AuthGate";
import ConverterCard from "./components/ConverterCard";

export default function Home() {
  return (
    <>
      <Navbar />

      <main
        style={{
          minHeight: "calc(100dvh - 56px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "48px 24px 80px",
        }}
      >
        {/* Hero section */}
        <div
          style={{
            textAlign: "center",
            maxWidth: "560px",
            marginBottom: "40px",
          }}
        >
          <p
            className="stagger-item stagger-1"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--brand)",
              marginBottom: "14px",
              padding: "4px 12px",
              borderRadius: "var(--radius-full)",
              background: "var(--brand-subtle)",
              border: "1px solid rgba(99,102,241,0.2)",
            }}
          >
            Free · Secure · Private
          </p>

          <h1
            className="stagger-item stagger-2"
            style={{
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--text)",
              lineHeight: 1.1,
              marginBottom: "14px",
            }}
          >
            Convert documents
            <br />
            <span
              style={{
                background:
                  "linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              in seconds
            </span>
          </h1>

          <p
            className="stagger-item stagger-3"
            style={{
              fontSize: "16px",
              color: "var(--text-muted)",
              lineHeight: 1.7,
            }}
          >
            PDF, Word, PowerPoint, and images — convert between any format
            instantly. Your files are scanned, converted, and auto-deleted
            within 24 hours.
          </p>
        </div>

        {/* Converter */}
        <div
          className="stagger-item stagger-4"
          style={{ width: "100%", maxWidth: "580px" }}
        >
          <AuthGate>
            <ConverterCard />
          </AuthGate>
        </div>

        {/* Trust badges */}
        <div
          className="stagger-item stagger-5"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "24px",
            marginTop: "36px",
            justifyContent: "center",
          }}
        >
          {[
            "🔒 Virus-scanned",
            "🗑️ Files deleted after 24h",
            "🔑 Auth-gated",
            "📦 Up to 20 MB",
          ].map((badge) => (
            <span
              key={badge}
              style={{
                fontSize: "12px",
                color: "var(--text-dimmed)",
                letterSpacing: "0.01em",
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </main>
    </>
  );
}
