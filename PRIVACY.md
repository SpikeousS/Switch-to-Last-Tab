# Privacy Policy for Switch to Last Tab

**Last Updated: June 15, 2024**

## Introduction
"Switch to Last Tab" ("the extension") is designed with user privacy as a top priority. This policy outlines how we handle data and permissions to provide the extension's functionality. We are committed to transparency and collecting the minimum information necessary.

## Data Collection and Usage
**We do not collect, store, or transmit any personally identifiable information (PII) or user data to any external servers.**

All data processed by the extension is handled locally on your computer and is essential for its core features:

1.  **Tab History**: The extension keeps a temporary, in-memory list of recently accessed tab IDs and their corresponding window IDs. This history is fundamental for the "switch to last tab" feature and is automatically cleared when your browser is closed. This information is **not** associated with your browsing history, content, or personal identity, and it never leaves your device.

2.  **User Settings**: Your configured preferences, such as the number of tabs to cycle through and your custom shortcut, are saved locally using Chrome's `storage` API (`chrome.storage.sync` and `chrome.storage.local`). This allows your settings to be preserved between browser sessions and synced across your devices if you are logged into a Chrome profile. This data is managed by your browser and is not accessible to us.

## Permissions Justification
To provide its features, "Switch to Last Tab" requires the following permissions, each with a specific, limited purpose:

-   **`tabs`**: This is the core permission. It is used to:
    -   Identify recently activated tabs to build the switching history.
    -   Perform the switch to the target tab.
    -   Access tab properties like `id`, `windowId`, and `url` (to exclude internal `devtools://` pages).

-   **`tabGroups`**: This permission is used to ensure a seamless experience when a target tab is located inside a collapsed tab group. It allows the extension to identify and interact with the group to make the tab visible.

-   **`storage`**: This permission is used to save your personalized settings (e.g., the number of tabs to cycle and your preferred shortcut) so they persist.

## Third-Party Services
The extension does not use any third-party services, analytics tools, or advertising networks. There are no external scripts or connections made.

## Changes to This Policy
We may update this Privacy Policy in the future. Any changes will be reflected in the "Last Updated" date at the top of this document and will be made available through the Chrome Web Store.

## Contact Us
If you have any questions or concerns about this Privacy Policy or the extension's practices, please contact us at [spikesu@hotmail.com].