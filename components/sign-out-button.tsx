import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted hover:text-foreground"
      >
        Sign out
      </button>
    </form>
  );
}
