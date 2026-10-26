import { LayoutDashboard, CalendarDays, UserCheck, BedDouble, Binoculars, UtensilsCrossed, Receipt, TrendingUp, Users } from "lucide-react";

// The sidebar menu. adminOnly items are hidden from Staff (the API still enforces it).
export const NAV = [
  { href: "/staff", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff/reservations", label: "Reservations", icon: CalendarDays },
  { href: "/staff/guests", label: "Guests and check-in", icon: UserCheck },
  { href: "/staff/cabana", label: "Cabana and packages", icon: BedDouble },
  { href: "/staff/activities", label: "Activities and safaris", icon: Binoculars },
  { href: "/staff/food", label: "Food and beverage", icon: UtensilsCrossed },
  { href: "/staff/billing", label: "Billing", icon: Receipt },
  { href: "/staff/reports", label: "Reports", icon: TrendingUp, adminOnly: true },
  { href: "/staff/users", label: "Users and roles", icon: Users, adminOnly: true },
];
