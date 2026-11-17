export default defineBackground(() => {
  // Wired up in later steps: toolbar toggle, debugger session, throttling.
  browser.action.onClicked.addListener((tab) => {
    console.log('[potato] toolbar clicked on tab', tab.id);
  });
});
