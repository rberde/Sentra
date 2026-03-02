"use client";

import { useApp } from "@/contexts/app-context";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function Home() {
  const { state } = useApp();

  if (!state.onboardingComplete || !state.profile) {
    return <OnboardingWizard />;
  }

  return <DashboardLayout />;
}
