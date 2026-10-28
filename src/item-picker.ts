import { api, type AppEntry, type Item } from "./api";
import { byId, el } from "./dom";
import { iconElement } from "./icons";
import { onWorkspacesChange, pinItem, workspaces } from "./workspaces";

export class ItemPicker {
  private workspaceId = "";
  private apps: AppEntry[] = [];
  private appsReady = false;

  open(workspaceId: string) {
    this.workspaceId = workspaceId;
    byId("picker-title").textContent = `Add to ${this.workspace()?.name ?? "screen"}`;
    byId("workspace-path-note").textContent = "";
    byId("item-picker").hidden = false;
    this.render();
    byId("workspace-app-search").focus();
  }

  close() { byId("item-picker").hidden = true; }
  isOpen() { return !byId("item-picker").hidden; }
  setApps(apps: AppEntry[]) { this.apps = [...apps]; this.appsReady = true; this.render(); }

  init() {
    byId("picker-close").addEventListener("click", () => this.close());
    byId("workspace-app-search").addEventListener("input", () => this.render());
    for (const kind of ["folder", "file"] as const) {
      byId(`workspace-browse-${kind}`).addEventListener("click", () => void this.chooseFile(kind));
    }
    byId("workspace-path-form").addEventListener("submit", event => void this.addPath(event));
    onWorkspacesChange(() => this.render());
  }

  private workspace() { return workspaces().find(space => space.id === this.workspaceId); }

  private async add(item: Item): Promise<boolean> {
    const workspace = this.workspace();
    try {
      if (!workspace) throw new Error("This screen no longer exists.");
      await pinItem(workspace.id, item);
      this.note(`${item.name} added to ${workspace.name}.`, true);
      return true;
    } catch (error) { this.note(`Could not save ${item.name}: ${String(error)}`); return false; }
  }

  private note(message: string, success = false) {
    byId("workspace-path-note").textContent = message;
    byId("workspace-path-note").className = success ? "note ok" : "note";
  }

  private async chooseFile(kind: "folder" | "file") {
    const buttons = [byId<HTMLButtonElement>("workspace-browse-folder"), byId<HTMLButtonElement>("workspace-browse-file")];
    buttons.forEach(button => { button.disabled = true; });
    try {
      const item = await api.pickWorkspaceItem(kind);
      if (item) await this.add(item);
    } catch (error) { this.note(String(error)); }
    finally { buttons.forEach(button => { button.disabled = false; }); }
  }

  private async addPath(event: Event) {
    event.preventDefault();
    const input = byId<HTMLInputElement>("workspace-path");
    const button = byId("workspace-path-form").querySelector<HTMLButtonElement>("button")!;
    button.disabled = true;
    try {
      const item = await api.workspaceItem(input.value);
      if (await this.add(item)) input.value = "";
    } catch (error) { this.note(String(error)); }
    finally { button.disabled = false; }
  }

  render() {
    if (!this.isOpen()) return;
    const holder = byId("workspace-app-results");
    const needle = byId<HTMLInputElement>("workspace-app-search").value.trim().toLocaleLowerCase();
    if (!needle) {
      holder.replaceChildren(el("p", "row-hint", ["Search the Windows app list to add an application."]));
      return;
    }
    const saved = new Set((this.workspace()?.items ?? []).map(item => item.path));
    const matches = this.apps.filter(app => app.name.toLocaleLowerCase().includes(needle))
      .sort((a, b) => Number(!a.name.toLocaleLowerCase().startsWith(needle)) - Number(!b.name.toLocaleLowerCase().startsWith(needle)) || a.name.localeCompare(b.name))
      .slice(0, 12);
    holder.replaceChildren(...(matches.length ? matches.map(app => this.choice(app, saved.has(app.path)))
      : [el("p", "row-hint", [this.appsReady ? "No matching Windows apps." : "Loading installed apps…"])]));
  }

  private choice(app: AppEntry, saved: boolean) {
    const button = el("button", "workspace-app-choice", [iconElement(app.path, app.name), el("span", "", [app.name])]);
    button.type = "button";
    button.disabled = saved;
    button.setAttribute("aria-label", `${saved ? "Already in this space: " : "Add "}${app.name}`);
    button.addEventListener("click", () => void this.add({ ...app, isFolder: false }));
    return button;
  }
}

export const itemPicker = new ItemPicker();
