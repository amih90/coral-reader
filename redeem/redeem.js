const copyButton = document.getElementById("copy-code");
const copyStatus = document.getElementById("copy-status");
const offerCode = document.getElementById("offer-code");

copyButton.hidden = false;
copyButton.addEventListener("click", async () => {
  const code = offerCode.textContent.trim();
  copyButton.disabled = true;
  copyStatus.textContent = "";
  delete copyStatus.dataset.state;

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard access is unavailable.");
    }
    await navigator.clipboard.writeText(code);
    copyStatus.dataset.state = "success";
    copyStatus.textContent = `Copied ${code}. Choose your store below.`;
  } catch {
    copyStatus.dataset.state = "error";
    copyStatus.textContent = `Couldn't copy. Select ${code} above and copy it manually.`;
  } finally {
    copyButton.disabled = false;
  }
});
