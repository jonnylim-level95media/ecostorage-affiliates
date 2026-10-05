import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth";

export default async function Home() {
  const { user, role } = await getCurrentUserRole();
  if (!user) redirect("/login");
  redirect(role === "admin" ? "/admin" : "/affiliate");
}
