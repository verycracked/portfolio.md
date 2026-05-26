import { redirect } from "next/navigation";

// `/human.md` is just an alias for the canonical homepage. Keeps the
// file-style URL working if someone types it directly.
export default function HumanRedirect() {
  redirect("/");
}
