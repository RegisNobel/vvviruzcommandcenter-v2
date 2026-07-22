import {permanentRedirect} from "next/navigation";

export default function LegacyAlbumsPage() {
  permanentRedirect("/projects");
}
