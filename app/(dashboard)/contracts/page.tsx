import { redirect } from "next/navigation";

export default function ContractsPage() {
  redirect("/contracts/by-state");
}
