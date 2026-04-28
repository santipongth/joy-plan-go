import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import CommandPalette from "@/components/CommandPalette";
import OnboardingHint from "@/components/OnboardingHint";
import { useApplyTheme } from "@/lib/theme-store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Trip.Planner — AI Travel Itinerary Builder" },
      { name: "description", content: "Plan trips with AI. Build day-by-day itineraries with maps, save them locally, and visualize your journey." },
      { name: "author", content: "Trip.Planner" },
      { property: "og:title", content: "Trip.Planner — AI Travel Itinerary Builder" },
      { property: "og:description", content: "Plan trips with AI. Build day-by-day itineraries with maps, save them locally, and visualize your journey." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Trip.Planner — AI Travel Itinerary Builder" },
      { name: "twitter:description", content: "Plan trips with AI. Build day-by-day itineraries with maps, save them locally, and visualize your journey." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d3d9f6da-fc33-4375-b1cb-835f97f44f96/id-preview-8bd90c5a--6011be32-862c-4741-9142-08e5ec65a784.lovable.app-1777395212767.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d3d9f6da-fc33-4375-b1cb-835f97f44f96/id-preview-8bd90c5a--6011be32-862c-4741-9142-08e5ec65a784.lovable.app-1777395212767.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useApplyTheme();
  return (
    <>
      <Outlet />
      <CommandPalette />
      <OnboardingHint />
    </>
  );
}
