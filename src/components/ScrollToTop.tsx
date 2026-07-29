import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Pages that manage (and restore) their own scroll position.
const SELF_MANAGED = ["/brand", "/brand/editor"];

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    if (SELF_MANAGED.includes(pathname)) return;
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);


  return null;
};

export default ScrollToTop;
