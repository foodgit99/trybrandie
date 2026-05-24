import { Link } from "react-router-dom";
import brandieLogo from "@/assets/brandie-logo.png";

const LandingFooter = () => (
  <footer className="border-t border-border px-4 sm:px-8 py-8">
    <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <img src={brandieLogo} alt="Brandie" className="h-5 w-5" />
        <span className="text-sm font-serif">Brandie</span>
      </div>
      <nav className="flex items-center gap-5 text-xs text-muted-foreground">
        <Link to="/affiliates" className="hover:text-foreground transition-colors">
          Affiliates
        </Link>
      </nav>
      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} Yaries Digital Labs. All rights reserved.
      </p>
    </div>
  </footer>
);

export default LandingFooter;
