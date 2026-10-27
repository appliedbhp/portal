// Provider-only shortcut; the backend authenticates access to the client folder.
function updateProviderClientDriveButton() {
  const button = document.getElementById("clientDriveBtn");
  if (button) button.style.display = isProvider() && getClientId() ? "inline-flex" : "none";
}

async function openProviderClientDrive() {
  if (!isProvider() || !getClientId()) return;
  const clientId = getClientId();
  const button = document.getElementById("clientDriveBtn");
  // Open synchronously so browsers do not block the tab after the request.
  const driveTab = window.open("about:blank", "_blank");
  if (!driveTab) {
    alert("Allow pop-ups for this portal to open the client’s Google Drive folder.");
    return;
  }
  driveTab.opener = null;
  driveTab.document.title = "Opening client Google Drive";
  driveTab.document.body.textContent = "Opening client Google Drive…";
  button.disabled = true;
  try {
    const data = await apiCall("getClientHub", { clientId });
    if (!isProvider() || getClientId() !== clientId) {
      driveTab.close();
      return;
    }
    if (!data.folderUrl) throw new Error("No Google Drive folder is available for this client.");
    const url = new URL(data.folderUrl);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com") {
      throw new Error("The client’s Google Drive folder link is invalid.");
    }
    if (!driveTab.closed) driveTab.location.replace(url.href);
  } catch (error) {
    if (!driveTab.closed) driveTab.close();
    alert("Could not open the client’s Google Drive folder: " + error.message);
  } finally {
    button.disabled = false;
    updateProviderClientDriveButton();
  }
}
