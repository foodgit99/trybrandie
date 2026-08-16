import { useEffect } from "react";

const TAWK_SRC = "https://embed.tawk.to/6a7ca7dd82680b1d4b300f0d/1jvrevebg";

export default function TawkToWidget() {
  useEffect(() => {
    // Skip if widget already injected
    if (document.querySelector(`script[src="${TAWK_SRC}"]`)) return;

    const s1 = document.createElement("script");
    s1.async = true;
    s1.src = TAWK_SRC;
    s1.charset = "UTF-8";
    s1.setAttribute("crossorigin", "*");

    const s0 = document.getElementsByTagName("script")[0];
    if (s0 && s0.parentNode) {
      s0.parentNode.insertBefore(s1, s0);
    } else {
      document.head.appendChild(s1);
    }

    return () => {
      // Best-effort cleanup if the component unmounts
      const existing = document.querySelector(`script[src="${TAWK_SRC}"]`);
      if (existing) existing.remove();
    };
  }, []);

  return null;
}
