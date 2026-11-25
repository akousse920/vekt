"use client";

import { Card, CardContent } from "@/components/ui/card";
import React from "react";

type Props = { icon: React.ReactNode; label: string; value: number };

export default function StatCard({ icon, label, value }: Props) {
  return (
    <Card className="border-[#d8e0e8] bg-white shadow-sm">
      <CardContent className="flex flex-wrap items-center gap-3 p-5">
        {icon}
        <div>
          <p className="text-3xl font-bold leading-none">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
