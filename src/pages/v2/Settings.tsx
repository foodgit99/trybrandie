import { Link } from "react-router-dom";

const Settings = () => (
  <main className="min-h-screen bg-background text-foreground lg:pl-20">
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-4">
      <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground">v2 · Settings</p>
      <h1 className="font-serif text-3xl sm:text-4xl">Settings — Phase D</h1>
      <Link to="/" className="inline-block text-sm underline text-muted-foreground hover:text-foreground">
        Open Legacy App →
      </Link>
    </div>
  </main>
);
export default Settings;
