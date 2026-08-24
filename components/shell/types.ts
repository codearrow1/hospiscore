import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon?: ReactNode;
}

export interface QuickAction {
  label: string;
  href: string;
}

export interface ShellUser {
  name?: string | null;
  email: string;
  roleLabel: string;
}

/** Plane descriptor — one workspace surface (SaaS, Growth, Customer, …). */
export interface PlaneInfo {
  id: string;
  name: string;
}
