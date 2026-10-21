import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App.svelte";
import { HU } from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("App", () => {
  it("a language without content yet says so", async () => {
    localStorage.setItem("tutor-lang", JSON.stringify("fr"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    render(App);
    expect(await screen.findByText("No stories for French yet.")).toBeTruthy();
  });

  it("shows the next story from the content file", async () => {
    localStorage.setItem("tutor-lang", JSON.stringify("hu"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(HU), { status: 200 })));
    render(App);
    expect(await screen.findByText("🐈 A macska")).toBeTruthy();
    expect(screen.getByText(/0\/1 stories/)).toBeTruthy();
  });
});

describe("App content edge cases", () => {
  it("an HTML page instead of JSON (no file on the host) says there are no stories", async () => {
    localStorage.setItem("tutor-lang", JSON.stringify("it"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html><html></html>", { status: 200, headers: { "content-type": "text/html" } })));
    render(App);
    expect(await screen.findByText("No stories for Italian yet.")).toBeTruthy();
  });

  it("a server that is down says so, and Retry loads the stories", async () => {
    localStorage.setItem("tutor-lang", JSON.stringify("hu"));
    const down = vi.fn(async () => new Response("", { status: 502 }));
    vi.stubGlobal("fetch", down);
    render(App);
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(screen.getByText("Can't load the Hungarian stories. Check your connection.")).toBeTruthy();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(HU), { status: 200 })));
    await fireEvent.click(retry);
    expect(await screen.findByText("🐈 A macska")).toBeTruthy();
  });

  it("no network at all says the same", async () => {
    localStorage.setItem("tutor-lang", JSON.stringify("hu"));
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    render(App);
    expect(await screen.findByText("Can't load the Hungarian stories. Check your connection.")).toBeTruthy();
  });

  it("a content file with no stories says so too", async () => {
    localStorage.setItem("tutor-lang", JSON.stringify("fr"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...HU, lang: "fr", stories: [] }), { status: 200 })));
    render(App);
    expect(await screen.findByText("No stories for French yet.")).toBeTruthy();
  });

  it("a slow answer for the previous language never replaces the new one", async () => {
    localStorage.setItem("tutor-lang", JSON.stringify("de"));
    let releaseDe: (r: Response) => void = () => {};
    const DE = { ...HU, lang: "de", stories: [{ ...HU.stories[0], id: "001-de", title: "Die Katze" }] };
    vi.stubGlobal("fetch", vi.fn((url: string) =>
      url.includes("/de.json")
        ? new Promise<Response>((resolve) => (releaseDe = resolve))
        : Promise.resolve(new Response(JSON.stringify(HU), { status: 200 })),
    ));
    render(App);
    const picker = await screen.findByLabelText("Learn");
    await fireEvent.change(picker, { target: { value: "hu" } });
    expect(await screen.findByText("🐈 A macska")).toBeTruthy();
    releaseDe(new Response(JSON.stringify(DE), { status: 200 }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("🐈 Die Katze")).toBeNull();
    expect(screen.getByText("🐈 A macska")).toBeTruthy();
  });
});

describe("App export", () => {
  it("keeps the download link alive until the browser has started the download", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(HU), { status: 200 })));
    const revoke = vi.fn();
    vi.stubGlobal("URL", class extends URL { static createObjectURL = () => "blob:x"; static revokeObjectURL = revoke; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(App);
    await screen.findByText("🐈 A macska"); // loaded: the store is open
    await fireEvent.click(screen.getByText("Settings"));
    await fireEvent.click(await screen.findByText("Export"));
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    expect(revoke).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:x"), { timeout: 3000 });
    click.mockRestore();
  });
});

describe("App under a sub-path (GitHub Pages)", () => {
  it("loads content relative to the site's base", async () => {
    vi.stubEnv("BASE_URL", "/ai-language-tutor/");
    localStorage.setItem("tutor-lang", JSON.stringify("hu"));
    const fetch = vi.fn(async () => new Response(JSON.stringify(HU), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(App);
    expect(await screen.findByText("🐈 A macska")).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith("/ai-language-tutor/content/hu.json");
    vi.unstubAllEnvs();
  });
});
