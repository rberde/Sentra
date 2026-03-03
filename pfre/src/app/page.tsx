"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/contexts/app-context";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function Home() {
  const { state } = useApp();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (!state.onboardingComplete || !state.profile) {
    return <OnboardingWizard />;
  }

  return <DashboardLayout />;
}
