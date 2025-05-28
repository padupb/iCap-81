import { UserMenu } from "./UserMenu";

export default function Header() {

  return (
    <header className="bg-card border-b border-border px-1 py-5 min-h-[96px] flex items-center justify-end sticky top-0 z-10">
      {/* Perfil de usuário */}
      <UserMenu />
    </header>
  );
}
