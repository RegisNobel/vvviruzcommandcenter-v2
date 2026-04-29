import {redirect} from "next/navigation";

export default function PublicExclusiveRedirectPage() {
  redirect("/exclusives");
}
