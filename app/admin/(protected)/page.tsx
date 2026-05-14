import {redirect} from "next/navigation";

export default function AdminOverviewRedirect() {
  redirect("/admin/releases");
}
