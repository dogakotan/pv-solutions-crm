import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 font-sans">
      <h1 className="text-3xl font-semibold">PV Solutions CRM</h1>
      <p className="text-neutral-600">
        Proje iskeleti kuruldu (Faz 0). Auth, roller ve iş modülleri sonraki
        fazlarda eklenecek.
      </p>
      <Link
        href="/health"
        className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
      >
        Sistem sağlık kontrolüne git
      </Link>
    </main>
  );
}
