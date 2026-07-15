import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "60px", minHeight: "calc(100vh - 56px)" }}>
      <SignUp />
    </div>
  );
}
