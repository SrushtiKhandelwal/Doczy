import Navbar from "./components/Navbar";
import ToolGrid from "./components/ToolGrid";

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-20 pt-16 lg:px-10">
        <section className="w-full max-w-2xl text-left">
          <h1 className="text-[clamp(34px,5vw,52px)] font-semibold leading-[1.08] tracking-tight">
            One file in. <span className="text-primary">Any format</span> out.
          </h1>

          <p className="mt-4 max-w-[50ch] text-base leading-relaxed text-muted-foreground">
            Convert between PDF, Word, Markdown, HTML, and image formats in
            seconds. Fast, secure, and built for people who need the file —
            not the fuss.
          </p>
        </section>

        <div className="mt-14 w-full">
          <ToolGrid />
        </div>
      </main>
    </>
  );
}
