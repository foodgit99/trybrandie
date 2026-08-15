import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { capturePartnerRef } from "@/lib/partnerRef";

/** Captures ?ref= / ?partner= partner slugs on any route so signups stay attributed. */
export default function PartnerRefCapture() {
  const location = useLocation();

  useEffect(() => {
    capturePartnerRef(location.search);
  }, [location.search]);

  return null;
}
