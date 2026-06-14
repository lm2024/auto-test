let htmlDialog = `
<h2>Wow! You have been very active</h2>
<div>Hi there, we can't help but notice you have executed a lot. It's important for us to understand how and why you are using Katalon Recorder. If it's convenient, please consider having a short conversation with us.</div>
</br>
<div style="text-align:center"><button id="talktoUs" type="button" style="color: black">Talk to Us</button></div>
`;

$(() => {
  $("#connecting").click(() => {
    window.open("https://calendar.app.google/EurYN8hKBbuikt6JA");
  });
});
