# Appearance feature

Owns complete material recipes and portable user-created visual profiles.

## Data model

`presets.ts` defines the appearance-only slice of `Settings` and five built-in recipes. A recipe includes material profile, backdrop blur,
saturation/brightness, tint, pane blur, light bending (`refraction`, 0 in every built-in), corner radius, tile glass and custom surface colour/opacity. Built-ins are values, not special-case
rendering code; selecting one stages the same settings a user can tune manually. The five are Opaline Original, Windows Mica, One UI Glass, Frutiger Aero and Deep Night. A saved `apple-glass` material profile (a preset that was removed) loads as `custom` with its values.

`background.ts` resolves the backdrop source: Current screen (the captured desktop, the default and the stored `desktop` mode), the bundled Opaline Aero landscape, or a downsampled custom image that is stored in settings.

`user-presets.ts` expands the captured slice to visual layout choices such as panel width, taskbar visibility, edge and alignment, background and navigation arrangement (including the sidebar edge). It
validates versioned JSON imports, limits local profiles to 24, and exports no wallpaper, icons or thumbnails.

```mermaid
flowchart LR
  BuiltIn[presets.ts] --> Draft[Settings draft]
  Manual[Appearance controls] --> Draft
  Imported[validated JSON] --> Draft
  Draft --> Preview[live launcher simulation]
  Draft -->|Done| Store[settings/store.ts]
  Store --> CSS[CSS variables + body attributes]
  Draft -->|Save current| Local[user-presets localStorage]
  Local --> Export[versioned JSON]
```

`appearance.css` owns preset/profile cards; actual material behavior is shared with launcher surface CSS. When adding a material, add its
typed profile, full preset values, applied surface rules, simulation rules and uniqueness tests together. Profiles remain entirely local and
make no network calls.
