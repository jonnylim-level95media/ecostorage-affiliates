export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-surface">
        Sign out
      </button>
    </form>
  );
}
