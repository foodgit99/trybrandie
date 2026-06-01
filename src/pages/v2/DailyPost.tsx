import { useParams } from "react-router-dom";

const DailyPost = () => {
  const { dayId } = useParams();
  return (
    <main className="min-h-screen bg-background text-foreground lg:pl-20">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-3">
        <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground">v2 · Daily Execution</p>
        <h1 className="font-serif text-3xl sm:text-4xl">Post — Phase D</h1>
        <p className="text-muted-foreground">Day: {dayId}</p>
      </div>
    </main>
  );
};
export default DailyPost;
