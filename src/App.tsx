/* ============================================================
   WACRM · Website CMS — app root
   ============================================================ */
import { Shell } from "./components/Shell";
import { Overview } from "./views/Overview";
import { Sites } from "./views/Sites";
import { Pages } from "./views/Pages";
import { Builder } from "./views/Builder";
import { Library } from "./views/Library";
import { ThemeStudio } from "./views/ThemeStudio";
import { Layouts } from "./views/Layouts";
import { Placeholder } from "./views/Placeholder";
import { DrawerHost } from "./components/overlays/DrawerHost";
import { ModalHost } from "./components/overlays/ModalHost";
import { AppProvider, useApp } from "./lib/store";

function Screen() {
  const { screen } = useApp();
  return (
    <div className="page" key={screen}>
      {screen === "overview" ? <Overview />
        : screen === "sites" ? <Sites />
        : screen === "pages" ? <Pages />
        : screen === "builder" ? <Builder />
        : screen === "library" ? <Library />
        : screen === "theme" ? <ThemeStudio />
        : screen === "layouts" ? <Layouts />
        : <Placeholder screen={screen} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="app">
        <Shell>
          <Screen />
        </Shell>
      </div>
      <DrawerHost />
      <ModalHost />
    </AppProvider>
  );
}
