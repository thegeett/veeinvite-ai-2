import { logout } from "@/app/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={logout}>
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
