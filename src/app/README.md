# Application composition

`launcher.ts` is Opaline's composition root. It wires feature initialisers, distributes native data, owns overlay show/hide, and handles
global shortcuts that cross feature boundaries. It must coordinate features rather than implement their internal rules.

`launcher.css` owns global tokens, shell geometry and shared surface primitives. Feature-specific selectors are imported from the owning
folder. Moving a feature rule back into this file requires a cross-feature reason.

```mermaid
sequenceDiagram
  participant Native
  participant App as launcher.ts
  participant Grid
  participant Pages as navigation/pages
  participant Settings
  Native-->>App: show overlay
  App->>App: capture/apply backdrop
  par cached Home data
    App->>Grid: setItems + render
  and installed apps
    App->>Pages: setApps
  and preferences
    App->>Settings: apply/sync
  end
  App-->>Native: overlay ready
```

The composition root may import every feature. Features must not import it. Expensive app enumeration, taskbar refresh and thumbnail warming
remain deferred so cached Home content can appear first.

