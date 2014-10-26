var userNav = document.getElementById('userNavLabel');
var userName = userNavLabel.innerText;
var userNameInput = document.getElementById('UserLookupInput');
userNameInput.value = userName;
var saveBtn = document.getElementById('editPage');
debugger;
saveBtn.submit();
window.location.href = '/setup/ui/listApexTraces.apexp';
/*console.log(saveBtn);
var evt = new MouseEvent("click", {
    canBubble: true,
    cancelable: true,
    view: window,
  });
saveBtn.dispatchEvent(evt);
*/