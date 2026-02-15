type QaResult = {
  check: string;
  ok: boolean;
  details: string;
};

const pushResult = (
  results: QaResult[],
  check: string,
  ok: boolean,
  details: string,
) => {
  results.push({ check, ok, details });
};

const byQa = (name: string) =>
  document.querySelector<HTMLElement>(`[data-qa="${name}"]`);

const withInputEvent = (element: HTMLTextAreaElement, value: string) => {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

export const runUiInteractionSanity = async () => {
  const results: QaResult[] = [];

  try {
    const composer = byQa("composer-input") as HTMLTextAreaElement | null;
    if (!composer) {
      pushResult(results, "composer-input", false, "Composer textarea not found");
    } else {
      const original = composer.value;
      withInputEvent(composer, "sanity check");
      const counter = byQa("composer-counter");
      const counterText = counter?.textContent?.trim() || "";
      const counterOk = /\/280$/.test(counterText);
      pushResult(
        results,
        "character-counter",
        counterOk,
        counterOk ? counterText : "Counter did not update as expected",
      );
      withInputEvent(composer, original);
    }

    const sidebarPost = byQa("sidebar-post-button");
    if (!sidebarPost) {
      pushResult(results, "sidebar-post-button", false, "Sidebar post button not found");
    } else {
      sidebarPost.click();
      const focused = document.activeElement?.getAttribute("data-qa") === "composer-input";
      pushResult(
        results,
        "sidebar-focus-composer",
        focused,
        focused ? "Composer focused" : "Composer was not focused",
      );
    }

    const qaControls = [
      "composer-post-button",
      "composer-image-upload",
      "composer-gif-toggle",
      "composer-poll-toggle",
      "tweet-like-button",
      "tweet-retweet-button",
      "tweet-share-button",
      "tweet-bookmark-button",
      "tweet-reply-button",
      "dm-send-button",
      "dm-media-upload",
    ];

    for (const control of qaControls) {
      const node = byQa(control);
      pushResult(
        results,
        control,
        Boolean(node),
        node ? "Found" : "Missing",
      );
    }
  } catch (error: any) {
    pushResult(
      results,
      "runtime",
      false,
      error?.message || "Unexpected QA helper error",
    );
  }

  const passCount = results.filter((result) => result.ok).length;
  const failCount = results.length - passCount;
  console.group("Twiller UI Sanity");
  console.table(results);
  console.info(`Pass: ${passCount} | Fail: ${failCount}`);
  console.groupEnd();
  return { passCount, failCount, results };
};

declare global {
  interface Window {
    twillerRunUiSanity?: () => Promise<{
      passCount: number;
      failCount: number;
      results: QaResult[];
    }>;
  }
}

export const registerUiInteractionQa = () => {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.twillerRunUiSanity = runUiInteractionSanity;
  return () => {
    if (window.twillerRunUiSanity === runUiInteractionSanity) {
      delete window.twillerRunUiSanity;
    }
  };
};
