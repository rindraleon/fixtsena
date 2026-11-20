export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-white focus:text-sm focus:font-semibold focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      Aller au contenu principal
    </a>
  );
}
