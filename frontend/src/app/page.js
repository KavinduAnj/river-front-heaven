import { redirect } from "next/navigation";

// Temporary: the public home page (task T23) will replace this
export default function Home() {
  redirect("/staff");
}
